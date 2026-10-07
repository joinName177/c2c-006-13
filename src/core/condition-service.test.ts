import{describe,it,expect}from'vitest';
import{evaluateConditions,evaluateCondition}from'./condition-service';
import{normalizeDraft}from'./draft-normalize';
import type{DecisionDraft,MustCondition}from'./models';

function draft(conditions:MustCondition[],overrides?:Partial<DecisionDraft>):DecisionDraft{
  return normalizeDraft({
    id:'t',title:'测试决策',background:'',
    weights:{stability:25,growth:25,freedom:25,money:25},
    conditions:{enabled:true,conditions},
    options:[
      {id:'a',name:'甲',description:'',impacts:{stability:4,growth:4,freedom:0,money:3},reversibility:80},
      {id:'b',name:'乙',description:'',impacts:{stability:-2,growth:5,freedom:2,money:1},reversibility:50},
      {id:'c',name:'丙',description:'',impacts:{stability:2,growth:null,freedom:1,money:2},reversibility:62},
    ],
    ...overrides,
  });
}
const cond=(id:string,metric:MustCondition['metric'],operator:MustCondition['operator'],threshold:number,tolerance?:number):MustCondition=>({id,metric,operator,threshold,tolerance,enabled:true});

describe('evaluateCondition 三值判断',()=>{
  const opt=draft([]).options[0]; // growth=4, reversibility=80
  it('明确达标为 pass',()=>{
    expect(evaluateCondition(opt,cond('x','growth','gte',3)).status).toBe('pass');
    expect(evaluateCondition(opt,cond('x','growth','lte',4)).status).toBe('pass');
  });
  it('明确越过阈值（超出容忍带）为 fail',()=>{
    expect(evaluateCondition(opt,cond('x','growth','gte',5,0.5)).status).toBe('fail');
    expect(evaluateCondition(opt,cond('x','reversibility','lte',70,5)).status).toBe('fail');
  });
  it('落在阈值 ± 容忍带内为 unknown，而不是直接满足/不满足',()=>{
    // growth=4，阈值 4.4，容忍带 1：|4-4.4|<1 -> unknown
    expect(evaluateCondition(opt,cond('x','growth','gte',4.4,1)).status).toBe('unknown');
    // reversibility=80，阈值 84，容忍带 5：80<84 且 |80-84|<=5 -> unknown
    expect(evaluateCondition(opt,cond('x','reversibility','gte',84,5)).status).toBe('unknown');
  });
  it('未评估（null）为 unknown，且 margin 为 null',()=>{
    const missing=draft([]).options[2]; // growth=null
    const r=evaluateCondition(missing,cond('x','growth','gte',0));
    expect(r.status).toBe('unknown');expect(r.actual).toBeNull();expect(r.margin).toBeNull();
    expect(r.reason).toContain('尚未评估');
  });
  it('容忍带为 0 时严格按阈值：贴边即满足，差一点即不满足',()=>{
    expect(evaluateCondition(opt,cond('x','reversibility','gte',80)).status).toBe('pass');
    expect(evaluateCondition(opt,cond('x','reversibility','gte',81)).status).toBe('fail');
  });
});

describe('evaluateConditions 资格分档',()=>{
  it('全部满足 -> eligible；任一 fail -> excluded；无 fail 有 unknown -> conditional',()=>{
    const out=evaluateConditions(draft([cond('rev','reversibility','gte',60),cond('g','growth','gte',3)]));
    const tier=(id:string)=>out.eligibilities.find(e=>e.optionId===id)!.tier;
    expect(out.status).toBe('clear');
    expect(tier('a')).toBe('eligible');      // rev80>=60, growth4>=3
    expect(tier('b')).toBe('excluded');      // rev50<60
    expect(tier('c')).toBe('conditional');   // rev62>=60 但 growth 未评估
    expect(out.eligibleIds).toEqual(['a']);
    expect(out.excludedIds).toEqual(['b']);
    expect(out.conditionalIds).toEqual(['c']);
    expect(out.unresolved.map(u=>u.optionId)).toEqual(['c']);
  });
  it('同指标下限高于上限 -> conflict，资格判断暂停（不产出任何 id 分组）',()=>{
    const out=evaluateConditions(draft([cond('lo','reversibility','gte',70),cond('hi','reversibility','lte',60)]));
    expect(out.status).toBe('conflict');
    expect(out.conflicts[0].conditionIds).toContain('lo');
    expect(out.eligibleIds).toEqual([]);expect(out.conditionalIds).toEqual([]);expect(out.excludedIds).toEqual([]);
    expect(out.unresolved).toEqual([]);
  });
  it('阈值超出取值域 -> conflict',()=>{
    const out=evaluateConditions(draft([cond('bad','reversibility','gte',120)]));
    expect(out.status).toBe('conflict');
    expect(out.conflicts[0].message).toContain('超出可设范围');
  });
  it('全部条件关闭或功能关闭 -> 所有方案 eligible（等价于无门槛）',()=>{
    const off=draft([{...cond('rev','reversibility','gte',60),enabled:false}]);
    expect(evaluateConditions(off).enabled).toBe(false);
    const disabled=draft([cond('rev','reversibility','gte',60)],{conditions:{enabled:false,conditions:[cond('rev','reversibility','gte',60)]}});
    expect(evaluateConditions(disabled).eligibleIds.sort()).toEqual(['a','b','c']);
  });
  it('被禁用的单条条件不参与判断',()=>{
    const d=draft([{...cond('rev','reversibility','gte',60),enabled:false}]);
    const out=evaluateConditions(d);
    expect(out.eligibilities.every(e=>e.tier==='eligible')).toBe(true);
  });
});
