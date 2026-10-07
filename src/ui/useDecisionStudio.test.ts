import{describe,it,expect}from'vitest';
import{useDecisionStudio}from'./useDecisionStudio';
import type{SavedCase}from'../core/models';

class FakeRepo{private items:SavedCase[]=[];list(){return this.items}save(v:SavedCase){this.items=this.items.filter(c=>c.draft.id!==v.draft.id);this.items.unshift(v)}delete(id:string){this.items=this.items.filter(c=>c.draft.id!==id)}}
const printer={print(){}};

describe('useDecisionStudio 条件工作流',()=>{
  it('启用条件后资格改变 winner；关闭条件回到原评分；条件编辑使结果过期；保存携带条件依据',()=>{
    const studio=useDecisionStudio(new FakeRepo(),printer);
    studio.analyze();
    expect(studio.errors.value).toEqual([]);
    const unconstrainedWinner=studio.analysis.value!.winnerId;
    expect(studio.analysis.value!.conditions.enabled).toBe(false);

    // 可逆性不低于 60（容忍带 0）：新机会 55 明确排除；成长不低于 0：留下来 -1 排除；再准备半年 85/3 合规
    studio.setConditionsEnabled(true);
    studio.draft.conditions.conditions[0].enabled=true;
    studio.draft.conditions.conditions[0].tolerance=0;
    studio.draft.conditions.conditions[1].enabled=true;
    studio.analyze();
    const withConditions=studio.analysis.value!;
    expect(withConditions.winnerId).toBe('prepare');
    expect(withConditions.conditions.excludedIds.sort()).toEqual(['leave','stay']);

    // 修改阈值（可逆性 ≥90）使全部 fail -> none-qualified，没有勉强胜者
    const revId=studio.draft.conditions.conditions[0].id;
    studio.updateCondition(revId,{threshold:90});
    expect(studio.stale.value).toBe(true);
    studio.analyze();
    expect(studio.analysis.value!.recommendationKind).toBe('none-qualified');
    expect(studio.analysis.value!.winnerId).toBeUndefined();
    expect(studio.analysis.value!.recommendation).toContain('待解决条件');

    // 关闭条件后重新计算，winner 回到纯评分结果
    studio.setConditionsEnabled(false);
    studio.analyze();
    expect(studio.analysis.value!.winnerId).toBe(unconstrainedWinner);

    // 保存的案例中保留条件配置与判断依据
    studio.save();
    const saved=studio.cases.value[0];
    expect(saved.draft.conditions.enabled).toBe(false);
    expect(saved.analysis?.conditions).toBeDefined();
  });

  it('旧版本存档（无 conditions 字段）加载后按无门槛迁移，并提示结果过期需重算',()=>{
    const repo=new FakeRepo();
    const legacy={draft:{id:'old',title:'旧案例',background:'',weights:{stability:25,growth:25,freedom:25,money:25},
      options:[
        {id:'a',name:'甲',description:'',impacts:{stability:1,growth:1,freedom:1,money:1},reversibility:40},
        {id:'b',name:'乙',description:'',impacts:{stability:0,growth:0,freedom:0,money:0},reversibility:70},
      ],updatedAt:new Date().toISOString()}} as unknown as SavedCase;
    repo.save(legacy);
    const studio=useDecisionStudio(repo,printer);
    studio.load(studio.cases.value[0]);
    expect(studio.draft.conditions.enabled).toBe(false);
    expect(studio.analysis.value).toBeUndefined();
    expect(studio.stale.value).toBe(true);
    studio.analyze();
    expect(studio.errors.value).toEqual([]);
  });
});
