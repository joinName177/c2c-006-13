import{METRIC_DOMAIN,METRIC_LABELS,type ConditionCheck,type ConditionConflict,type ConditionMetric,type ConditionsOutcome,type DecisionDraft,type DecisionOption,type EligibilityTier,type MustCondition}from'./models';

export function activeConditionsOf(draft:DecisionDraft):MustCondition[]{
  if(!draft.conditions?.enabled)return[];
  return draft.conditions.conditions.filter(c=>c.enabled);
}
export function metricValue(option:DecisionOption,metric:ConditionMetric):number|null{
  return metric==='reversibility'?option.reversibility:option.impacts[metric];
}
// 条件配置本身是否超出指标取值域（无法被任何方案满足）
function validateCondition(c:MustCondition):string|null{
  const domain=METRIC_DOMAIN[c.metric];
  if(c.threshold<domain.min||c.threshold>domain.max){
    return`「${METRIC_LABELS[c.metric]}」条件的阈值 ${c.threshold}${domain.unit} 超出可设范围 ${domain.min}${domain.unit}–${domain.max}${domain.unit}`;
  }
  if((c.tolerance??0)<0)return`「${METRIC_LABELS[c.metric]}」条件的容忍带不能为负`;
  return null;
}
// 同一指标的上下限若矛盾（下限严格高于上限），任何方案都不可能满足。
function detectConflicts(conditions:MustCondition[]):ConditionConflict[]{
  const conflicts:ConditionConflict[]=[];
  const byMetric=new Map<ConditionMetric,MustCondition[]>();
  for(const c of conditions){
    const list=byMetric.get(c.metric)??[];list.push(c);byMetric.set(c.metric,list);
    const invalid=validateCondition(c);
    if(invalid)conflicts.push({conditionIds:[c.id],metric:c.metric,message:invalid});
  }
  for(const[metric,list]of byMetric){
    const floors=list.filter(c=>c.operator==='gte');
    const ceilings=list.filter(c=>c.operator==='lte');
    for(const floor of floors)for(const ceiling of ceilings){
      if(floor.threshold>ceiling.threshold){
        const d=METRIC_DOMAIN[metric];
        conflicts.push({conditionIds:[floor.id,ceiling.id],metric,
          message:`条件冲突：${METRIC_LABELS[metric]}既要求不低于 ${floor.threshold}${d.unit}，又要求不高于 ${ceiling.threshold}${d.unit}，没有任何方案能同时满足。`});
      }
    }
  }
  return conflicts;
}
// 单条件对单方案的三值判断。
// gte（不低于）：actual>=threshold+tol -> pass；actual<threshold-tol -> fail；之间（容忍带内）-> unknown。
// lte 对称。actual 为 null（未评估）-> unknown（尚无法判断，不记为不满足）。
export function evaluateCondition(option:DecisionOption,condition:MustCondition):ConditionCheck{
  const actual=metricValue(option,condition.metric);
  const tol=Math.max(0,condition.tolerance??0);
  const label=METRIC_LABELS[condition.metric];
  const unit=METRIC_DOMAIN[condition.metric].unit;
  const id=condition.id;
  if(actual===null){
    return{conditionId:id,status:'unknown',actual:null,margin:null,
      reason:`${label}尚未评估，无法核对「${condition.operator==='gte'?'不低于':'不高于'} ${condition.threshold}${unit}」的要求。`};
  }
  if(condition.operator==='gte'){
    const margin=Math.round((actual-condition.threshold)*100)/100;
    if(actual>=condition.threshold+tol)return{conditionId:id,status:'pass',actual,margin,reason:`${label} ${actual}${unit}，达到不低于 ${condition.threshold}${unit} 的要求。`};
    if(actual<condition.threshold-tol)return{conditionId:id,status:'fail',actual,margin,reason:`${label} ${actual}${unit}，低于不低于 ${condition.threshold}${unit} 的要求（差 ${condition.threshold-actual}${unit}）。`};
    return{conditionId:id,status:'unknown',actual,margin,
      reason:`${label} ${actual}${unit}，距阈值 ${condition.threshold}${unit} 仅 ${Math.abs(actual-condition.threshold)}${unit}，处于 ±${tol}${unit} 的边界容忍带，建议核实数据。`};
  }
  const margin=Math.round((condition.threshold-actual)*100)/100;
  if(actual<=condition.threshold-tol)return{conditionId:id,status:'pass',actual,margin,reason:`${label} ${actual}${unit}，满足不高于 ${condition.threshold}${unit} 的要求。`};
  if(actual>condition.threshold+tol)return{conditionId:id,status:'fail',actual,margin,reason:`${label} ${actual}${unit}，高于不高于 ${condition.threshold}${unit} 的要求（超 ${actual-condition.threshold}${unit}）。`};
  return{conditionId:id,status:'unknown',actual,margin,
    reason:`${label} ${actual}${unit}，距阈值 ${condition.threshold}${unit} 仅 ${Math.abs(actual-condition.threshold)}${unit}，处于 ±${tol}${unit} 的边界容忍带，建议核实数据。`};
}
// 单方案资格：任一 fail -> excluded；无 fail 但有 unknown -> conditional；全部 pass -> eligible。
// 无启用条件时统一为 eligible。
export function tierOf(checks:ConditionCheck[]):EligibilityTier{
  if(!checks.length)return'eligible';
  if(checks.some(c=>c.status==='fail'))return'excluded';
  if(checks.some(c=>c.status==='unknown'))return'conditional';
  return'eligible';
}
export function evaluateConditions(draft:DecisionDraft):ConditionsOutcome{
  const active=activeConditionsOf(draft);
  if(!active.length){
    return{status:'clear',enabled:false,activeConditions:[],conflicts:[],eligibilities:[],
      eligibleIds:draft.options.map(o=>o.id),conditionalIds:[],excludedIds:[],unresolved:[]};
  }
  const conflicts=detectConflicts(active);
  const conflictIds=new Set(conflicts.flatMap(c=>c.conditionIds));
  // 有冲突的条件不参与逐方案判断：冲突未解决前，资格结论暂停。
  const usable=active.filter(c=>!conflictIds.has(c.id));
  const eligibilities=draft.options.map(option=>{
    const checks=usable.map(c=>evaluateCondition(option,c));
    return{optionId:option.id,tier:tierOf(checks),checks};
  });
  const pick=(tier:EligibilityTier)=>eligibilities.filter(e=>e.tier===tier).map(e=>e.optionId);
  // 冲突时资格结论暂停：待解决清单也留空，避免给出半套判断。
  const unresolved=conflicts.length?[]:eligibilities.flatMap(e=>e.checks.filter(c=>c.status==='unknown').map(c=>({...c,optionId:e.optionId})));
  return{
    status:conflicts.length?'conflict':'clear',
    enabled:true,activeConditions:active,conflicts,eligibilities,
    eligibleIds:conflicts.length?[]:pick('eligible'),
    conditionalIds:conflicts.length?[]:pick('conditional'),
    excludedIds:conflicts.length?[]:pick('excluded'),
    unresolved,
  };
}
