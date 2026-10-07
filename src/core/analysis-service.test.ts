import{describe,it,expect}from'vitest';
import{analyzeDecision}from'./analysis-service';
import{normalizeDraft}from'./draft-normalize';
import type{DecisionDraft,MustCondition}from'./models';

function build(conditions:MustCondition[],enabled=true):DecisionDraft{
  return normalizeDraft({
    id:'t',title:'测试决策',background:'',
    weights:{stability:25,growth:25,freedom:25,money:25},
    conditions:{enabled,conditions},
    options:[
      {id:'a',name:'高分但违规',description:'',impacts:{stability:4,growth:-1,freedom:4,money:4},reversibility:40},
      {id:'b',name:'低分但合规',description:'',impacts:{stability:-3,growth:-3,freedom:-3,money:-3},reversibility:80},
      {id:'c',name:'缺数据',description:'',impacts:{stability:0,growth:null,freedom:0,money:0},reversibility:30},
    ],
  });
}
const cond=(id:string,metric:MustCondition['metric'],operator:MustCondition['operator'],threshold:number,tolerance?:number):MustCondition=>({id,metric,operator,threshold,tolerance,enabled:true});

describe('资格与推荐衔接',()=>{
  it('未启用条件：保留原有低分胜出逻辑',()=>{
    const a=analyzeDecision(build([],false));
    expect(a.recommendationKind).toMatch(/^unconstrained/);
    expect(a.options[0].option.id).toBe('a');
    expect(a.winnerId).toBeDefined();
  });
  it('总分最好的方案若明确不满足门槛，不得成为 winner；合规方案胜出',()=>{
    const a=analyzeDecision(build([cond('rev','reversibility','gte',60)]));
    expect(a.recommendationKind).toBe('winner');
    expect(a.winnerId).toBe('b'); // a 虽总分最低但 rev=40<60
    expect(a.options.find(o=>o.option.id==='a')!.eligibility!.tier).toBe('excluded');
    expect(a.recommendation).toContain('未获得选择资格');
  });
  it('全部明确不满足 -> none-qualified，无 winner，返回待解决条件',()=>{
    const a=analyzeDecision(build([cond('rev','reversibility','gte',90)]));
    expect(a.recommendationKind).toBe('none-qualified');
    expect(a.winnerId).toBeUndefined();
    expect(a.recommendation).toContain('待解决条件');
    // 原始分数仍然全部可见
    expect(a.options.every(o=>typeof o.total==='number')).toBe(true);
  });
  it('只有条件候选（信息不足）-> conditional-only，不推荐，说明缺什么',()=>{
    // b rev=80 合规但 money=-1? 让 b 也缺数据：把门槛设为 growth>=2，a fail、b fail（-3），c unknown
    const a=analyzeDecision(build([cond('g','growth','gte',2)]));
    expect(a.recommendationKind).toBe('conditional-only');
    expect(a.winnerId).toBeUndefined();
    expect(a.options.find(o=>o.option.id==='c')!.eligibility!.tier).toBe('conditional');
    expect(a.recommendation).toContain('成长');
  });
  it('条件冲突 -> condition-conflict，分数照常但不推荐',()=>{
    const a=analyzeDecision(build([cond('lo','reversibility','gte',80),cond('hi','reversibility','lte',50)]));
    expect(a.recommendationKind).toBe('condition-conflict');
    expect(a.winnerId).toBeUndefined();
    expect(a.options.length).toBe(3);
    expect(a.recommendation).toContain('冲突');
  });
  it('合规者前两名差距 <5 -> tie，不下强结论',()=>{
    const d=normalizeDraft({
      id:'t2',title:'接近',background:'',weights:{stability:25,growth:25,freedom:25,money:25},
      conditions:{enabled:true,conditions:[cond('rev','reversibility','gte',60)]},
      options:[
        {id:'x',name:'合规甲',description:'',impacts:{stability:1,growth:1,freedom:1,money:1},reversibility:80},
        {id:'y',name:'合规乙',description:'',impacts:{stability:1,growth:1,freedom:1,money:1},reversibility:80},
        {id:'z',name:'违规',description:'',impacts:{stability:4,growth:4,freedom:4,money:4},reversibility:30},
      ],
    });
    const a=analyzeDecision(d);
    expect(a.recommendationKind).toBe('tie');
    expect(a.winnerId).toBeUndefined();
  });
  it('未评估影响在评分中按 0 计入，并产出 assumptions 说明',()=>{
    const a=analyzeDecision(build([cond('rev','reversibility','gte',90)]));
    const c=a.options.find(o=>o.option.id==='c')!;
    expect(c.assumptions.join()).toContain('成长');
    expect(c.assumptions.join()).toContain('中性');
  });
  it('修改/关闭条件后重新计算：同一输入关闭门槛后 winner 回到总分最低者',()=>{
    const d=build([cond('rev','reversibility','gte',60)]);
    const constrained=analyzeDecision(d);
    expect(constrained.winnerId).toBe('b');
    d.conditions.enabled=false;
    const unconstrained=analyzeDecision(d);
    expect(unconstrained.winnerId).toBe('a');
  });
});
