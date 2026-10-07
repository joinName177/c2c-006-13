export const VALUE_KEYS=['stability','growth','freedom','money'] as const;
export type ValueKey=typeof VALUE_KEYS[number];
export type ValueWeights=Record<ValueKey,number>;
export type ConditionMetric=ValueKey|'reversibility';
export type ConditionDirection='atLeast'|'atMost';
export interface MustCondition{id:string;metric:ConditionMetric;direction:ConditionDirection;value:number;enabled:boolean;note:string}
export interface DecisionOption{id:string;name:string;description:string;impacts:ValueWeights;reversibility:number;uncertain:ConditionMetric[]}
export interface DecisionDraft{id:string;title:string;background:string;options:DecisionOption[];weights:ValueWeights;conditions:MustCondition[];updatedAt:string}
export type Horizon=1|5|10;
export interface RegretPoint{horizon:Horizon;score:number;breakdown:ValueWeights}
export interface RehearsalCard{horizon:Horizon;regret:string;trigger:string;reversibility:string;action:string}
export type ConditionVerdict='pass'|'borderline'|'unknown'|'fail';
export interface ConditionCheck{condition:MustCondition;verdict:ConditionVerdict;actual:number|null;reason:string}
export type Eligibility='eligible'|'conditional'|'ineligible';
export interface OptionGate{eligibility:Eligibility;checks:ConditionCheck[]}
export interface ConditionGap{optionId:string;optionName:string;actual:number|null;gap:number|null}
export interface PendingCondition{condition:MustCondition;label:string;gaps:ConditionGap[];closestOption:string;closestGap:number|null}
export interface OptionAnalysis{option:DecisionOption;points:RegretPoint[];cards:RehearsalCard[];total:number;gate?:OptionGate}
export interface DecisionAnalysis{options:OptionAnalysis[];recommendation:string;winnerId?:string;notices:string[];tentative?:boolean;conflicts?:string[];gateNotes?:string[];pending?:PendingCondition[]}
export interface SavedCase{draft:DecisionDraft;analysis?:DecisionAnalysis}
export const VALUE_LABELS:Record<ValueKey,string>={stability:'稳定',growth:'成长',freedom:'自由',money:'金钱'};
