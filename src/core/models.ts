export const VALUE_KEYS=['stability','growth','freedom','money'] as const;
export type ValueKey=typeof VALUE_KEYS[number];
export type ValueWeights=Record<ValueKey,number>;
// 影响值允许 null：表示“未评估/数据缺失”，与明确给出的 0（中性影响）相区别。
export type ImpactRating=number|null;
export type Impacts=Record<ValueKey,ImpactRating>;
export interface DecisionOption{id:string;name:string;description:string;impacts:Impacts;reversibility:number}

// —— 必须满足条件（硬门槛）——
// operator: gte=不低于（下限），lte=不高于（上限）
export type ConditionOperator='gte'|'lte';
// metric: 四个价值维度的影响，或可逆性
export type ConditionMetric=ValueKey|'reversibility';
export interface MustCondition{
  id:string;
  metric:ConditionMetric;
  operator:ConditionOperator;
  threshold:number;
  enabled:boolean;
  // 容忍带：实际值距离阈值小于 tolerance 时判为“尚无法判断”，而非直接满足/不满足。
  // 省略或为 0 表示严格按阈值判断。
  tolerance?:number;
}
export interface ConditionSettings{enabled:boolean;conditions:MustCondition[]}

export interface DecisionDraft{id:string;title:string;background:string;options:DecisionOption[];weights:ValueWeights;conditions:ConditionSettings;updatedAt:string}
export type Horizon=1|5|10;
export interface RegretPoint{horizon:Horizon;score:number;breakdown:ValueWeights}
export interface RehearsalCard{horizon:Horizon;regret:string;trigger:string;reversibility:string;action:string}

// 单条件对单方案的判断
export type ConditionStatus='pass'|'fail'|'unknown';
export interface ConditionCheck{conditionId:string;status:ConditionStatus;actual:number|null;margin:number|null;reason:string}
// 待解决（unknown）判断，额外标注所属方案，供“需要补充哪些信息”报告使用
export interface UnresolvedCheck extends ConditionCheck{optionId:string}
// 方案资格：eligible=具备选择资格；conditional=条件候选（无明确违例，但信息不足或贴近边界）；excluded=明确不满足
export type EligibilityTier='eligible'|'conditional'|'excluded';
export interface OptionEligibility{optionId:string;tier:EligibilityTier;checks:ConditionCheck[]}
// 条件集整体状态：conflict=条件之间自相矛盾或超出取值域，资格判断暂停
export type ConditionsOutcomeStatus='clear'|'conflict';
export interface ConditionConflict{conditionIds:string[];metric:ConditionMetric;message:string}
export interface ConditionsOutcome{status:ConditionsOutcomeStatus;enabled:boolean;activeConditions:MustCondition[];conflicts:ConditionConflict[];eligibilities:OptionEligibility[];eligibleIds:string[];conditionalIds:string[];excludedIds:string[];unresolved:UnresolvedCheck[]}

export interface OptionAnalysis{option:DecisionOption;points:RegretPoint[];cards:RehearsalCard[];total:number;assumptions:string[];eligibility?:OptionEligibility}
export type RecommendationKind='winner'|'tie'|'conditional-only'|'none-qualified'|'condition-conflict'|'unconstrained-tie'|'unconstrained-winner';
export interface DecisionAnalysis{options:OptionAnalysis[];recommendation:string;winnerId?:string;recommendationKind:RecommendationKind;notices:string[];conditions:ConditionsOutcome}
export interface SavedCase{draft:DecisionDraft;analysis?:DecisionAnalysis}
export const VALUE_LABELS:Record<ValueKey,string>={stability:'稳定',growth:'成长',freedom:'自由',money:'金钱'};
export const METRIC_LABELS:Record<ConditionMetric,string>={stability:'稳定',growth:'成长',freedom:'自由',money:'金钱',reversibility:'可逆性'};
// 各指标取值域，用于边界与条件冲突判断
export const METRIC_DOMAIN:Record<ConditionMetric,{min:number;max:number;unit:string}>={stability:{min:-5,max:5,unit:''},growth:{min:-5,max:5,unit:''},freedom:{min:-5,max:5,unit:''},money:{min:-5,max:5,unit:''},reversibility:{min:0,max:100,unit:'%'}};
