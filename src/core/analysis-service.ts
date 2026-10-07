import{normalizeWeights}from'./weight-service';import{VALUE_KEYS,VALUE_LABELS,type DecisionAnalysis,type DecisionDraft,type Horizon,type OptionAnalysis,type RegretPoint,type RehearsalCard,type ValueKey}from'./models';import{evaluateConditions}from'./condition-service';
const timeFactor:Record<Horizon,Record<ValueKey,number>>={1:{stability:1.2,growth:.75,freedom:.8,money:1.15},5:{stability:1,growth:1,freedom:1,money:1},10:{stability:.8,growth:1.25,freedom:1.2,money:.85}};
// 未评估（null）的影响值在评分中按中性 0 计入；该假设会随结果报告，不参与门槛判断。
const rating=(v:number|null)=>v??0;
function point(option:DecisionDraft['options'][number],weights:ReturnType<typeof normalizeWeights>,horizon:Horizon):RegretPoint{const breakdown={}as RegretPoint['breakdown'];let total=0;for(const key of VALUE_KEYS){const negative=(5-rating(option.impacts[key]))/10;const value=negative*weights[key]*timeFactor[horizon][key];breakdown[key]=Math.round(value*10)/10;total+=value}const irreversible=(100-option.reversibility)*.08*(horizon/10);return{horizon,score:Math.max(0,Math.min(100,Math.round(total+irreversible))),breakdown}}
function card(option:DecisionDraft['options'][number],p:RegretPoint,weights:ReturnType<typeof normalizeWeights>):RehearsalCard{const key=VALUE_KEYS.slice().sort((a,b)=>weights[b]*(5-rating(option.impacts[b]))-weights[a]*(5-rating(option.impacts[a])))[0];const label=VALUE_LABELS[key];return{horizon:p.horizon,regret:`${p.horizon} 年后，你可能遗憾「${option.name}」没有更好照顾${label}。`,trigger:`当${label}需求持续得不到满足，后悔感可能升高。`,reversibility:option.reversibility>=60?'仍有较大调整空间':'改变成本可能随时间增加',action:`现在就为${label}设一个可检查的阶段目标。`}}
export function safetyNoticesFor(text:string):string[]{const notices:string[]=[];if(/医疗|诊断|治疗|medical/i.test(text))notices.push('涉及医疗，请同时咨询合格医疗专业人士。');if(/法律|诉讼|合同|legal/i.test(text))notices.push('涉及法律，请同时咨询合格法律专业人士。');if(/投资|股票|理财|investment/i.test(text))notices.push('涉及投资，请评估承受能力并咨询持牌专业人士。');return notices}
function assumptionsFor(option:DecisionDraft['options'][number]):string[]{return VALUE_KEYS.filter(k=>option.impacts[k]===null).map(k=>`「${option.name}」的${VALUE_LABELS[k]}影响未评估，分数暂按中性（0）计入；资格判断不把缺失当作不满足，但需要补齐信息后才能下结论。`)}
export function analyzeDecision(draft:DecisionDraft):DecisionAnalysis{
  const weights=normalizeWeights(draft.weights);
  const conditions=evaluateConditions(draft);
  const eligibilityById=new Map(conditions.eligibilities.map(e=>[e.optionId,e]));
  const options:OptionAnalysis[]=draft.options.map(option=>{
    const points=([1,5,10]as Horizon[]).map(h=>point(option,weights,h));
    return{option,points,cards:points.map(p=>card(option,p,weights)),total:Math.round(points[0].score*.3+points[1].score*.4+points[2].score*.3),
      assumptions:assumptionsFor(option),eligibility:eligibilityById.get(option.id)};
  }).sort((a,b)=>a.total-b.total);
  const nameOf=(id:string)=>draft.options.find(o=>o.id===id)?.name??'';
  let recommendation:string;
  let winnerId:string|undefined;
  let recommendationKind:DecisionAnalysis['recommendationKind'];
  if(conditions.enabled&&conditions.status==='conflict'){
    recommendationKind='condition-conflict';
    recommendation=`必须满足的条件之间存在冲突，资格判断已暂停，暂不推荐任何方案。请先解决：${conditions.conflicts.map(c=>c.message).join('；')}。以下分数为条件关闭时的原始评分，仅供对照。`;
  }else if(!conditions.enabled){
    // 未启用硬条件：保持原有“低分胜出 / 前两名接近则不下强结论”的逻辑。
    const close=options[1]&&options[1].total-options[0].total<5;
    recommendationKind=close?'unconstrained-tie':'unconstrained-winner';
    recommendation=close?`「${options[0].option.name}」与「${options[1].option.name}」非常接近，建议补充信息后再决定。`:`目前看，「${options[0].option.name}」是更不容易后悔的方向。`;
    if(!close)winnerId=options[0].option.id;
  }else{
    const eligible=options.filter(o=>conditions.eligibleIds.includes(o.option.id));
    const close=eligible[1]&&eligible[1].total-eligible[0].total<5;
    if(eligible.length&&close){
      recommendationKind='tie';
      winnerId=undefined;
      recommendation=`满足全部必须条件的方案中，「${eligible[0].option.name}」与「${eligible[1].option.name}」分数非常接近，建议补充信息后再在二者之间决定。`;
    }else if(eligible.length){
      recommendationKind='winner';
      winnerId=eligible[0].option.id;
      recommendation=`在满足全部必须条件的前提下，「${eligible[0].option.name}」是更不容易后悔的方向。其他方案即使总分相近，也未获得选择资格。`;
    }else if(conditions.conditionalIds.length){
      recommendationKind='conditional-only';
      const needs=conditions.unresolved.map(u=>`「${nameOf(u.optionId)}」${u.reason}`).join(' ');
      recommendation=`没有方案能确认满足全部必须条件，但 ${conditions.conditionalIds.map(nameOf).map(n=>`「${n}」`).join('、')} 尚无明确违例，仅保留为条件候选，暂不推荐。需要补充的信息：${needs||'请核实贴近边界的数据。'}`;
    }else{
      recommendationKind='none-qualified';
      const blockers=conditions.eligibilities.map(e=>{const fails=e.checks.filter(c=>c.status==='fail');return fails.length?`「${nameOf(e.optionId)}」：${fails.map(f=>f.reason).join('；')}`:''}).filter(Boolean).join(' ');
      recommendation=`全部方案都明确不满足必须条件，本次不选出勉强胜者。待解决条件：${blockers}。可调整方案事实使其达标，或修改/关闭对应条件后重新计算。`;
    }
  }
  return{options,recommendation,winnerId,recommendationKind,notices:safetyNoticesFor(`${draft.title} ${draft.background}`),conditions};
}
