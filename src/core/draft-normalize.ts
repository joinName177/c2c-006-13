import{VALUE_KEYS,type ConditionSettings,type DecisionDraft,type Impacts}from'./models';
export const emptyImpacts=(v=0):Impacts=>({stability:v,growth:v,freedom:v,money:v});
// 旧版本存档没有 conditions，或影响值缺项：统一补齐，使“关闭条件”的旧案例回到原有评分结果。
export function normalizeDraft(raw:Partial<DecisionDraft>):DecisionDraft{
  const conditions:ConditionSettings=raw.conditions??{enabled:false,conditions:[]};
  return{
    id:raw.id??`case-${Date.now()}`,
    title:raw.title??'',
    background:raw.background??'',
    weights:{...{stability:0,growth:0,freedom:0,money:0},...(raw.weights??{})},
    conditions:{enabled:Boolean(conditions.enabled),conditions:(conditions.conditions??[]).map(c=>({...c,enabled:Boolean(c.enabled)}))},
    updatedAt:raw.updatedAt??new Date().toISOString(),
    options:(raw.options??[]).map(o=>({
      id:o.id,name:o.name,description:o.description??'',reversibility:o.reversibility,
      impacts:Object.fromEntries(VALUE_KEYS.map(k=>[k,o.impacts&&k in o.impacts?o.impacts[k]:0]))as Impacts,
    })),
  };
}
