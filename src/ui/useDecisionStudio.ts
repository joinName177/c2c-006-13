import{reactive,ref}from'vue';import{analyzeDecision}from'../core/analysis-service';import{createSampleDraft}from'../core/sample-data';import{validateDraft}from'../core/validation';import{normalizeDraft,emptyImpacts}from'../core/draft-normalize';
import type{DecisionAnalysis,DecisionDraft,DecisionOption,MustCondition,SavedCase,ValueWeights}from'../core/models';import type{CaseRepository}from'../ports/case-repository.port';import type{PrintPort}from'../ports/print.port';
export function useDecisionStudio(repository:CaseRepository,printer:PrintPort){const draft=reactive<DecisionDraft>(createSampleDraft());const analysis=ref<DecisionAnalysis>();const errors=ref<string[]>([]);const stale=ref(false);const cases=ref<SavedCase[]>(repository.list());const touch=()=>{stale.value=Boolean(analysis.value);draft.updatedAt=new Date().toISOString()};function setWeights(weights:ValueWeights){draft.weights={...weights};touch()}function addOption(){if(draft.options.length>=4)return;draft.options.push({id:`option-${Date.now()}`,name:'新选项',description:'',impacts:emptyImpacts(0),reversibility:70});touch()}function removeOption(id:string){if(draft.options.length<=2)return;draft.options=draft.options.filter(o=>o.id!==id);touch()}function updateOption(id:string,patch:Partial<DecisionOption>){const target=draft.options.find(o=>o.id===id);if(target)Object.assign(target,patch);touch()}
// —— 必须条件 ——
function setConditionsEnabled(enabled:boolean){draft.conditions.enabled=enabled;touch()}
function addCondition(partial?:Partial<MustCondition>){draft.conditions.conditions.push({id:`condition-${Date.now()}`,metric:'reversibility',operator:'gte',threshold:60,tolerance:5,enabled:true,...partial});touch()}
function updateCondition(id:string,patch:Partial<MustCondition>){const target=draft.conditions.conditions.find(c=>c.id===id);if(target)Object.assign(target,patch);touch()}
function removeCondition(id:string){draft.conditions.conditions=draft.conditions.conditions.filter(c=>c.id!==id);touch()}
function setImpactUnassessed(id:string,key:keyof DecisionOption['impacts'],unassessed:boolean){const target=draft.options.find(o=>o.id===id);if(target)target.impacts[key]=unassessed?null:0;touch()}
function analyze(){errors.value=validateDraft(draft);if(errors.value.length)return;analysis.value=analyzeDecision(draft);stale.value=false}function save(){repository.save({draft:JSON.parse(JSON.stringify(draft)),analysis:analysis.value});cases.value=repository.list()}function load(item:SavedCase){
  const next=normalizeDraft(JSON.parse(JSON.stringify(item.draft)));
  Object.assign(draft,next);
  // 旧版本分析结果没有 conditions 依据，直接展示会渲染错配：只保留输入并标记过期，引导重新推演。
  const saved=item.analysis&&'conditions'in item.analysis?item.analysis:undefined;
  analysis.value=saved;stale.value=!saved;
}function remove(id:string){repository.delete(id);cases.value=repository.list()}return{draft,analysis,errors,stale,cases,touch,setWeights,addOption,removeOption,updateOption,setImpactUnassessed,setConditionsEnabled,addCondition,updateCondition,removeCondition,analyze,save,load,remove,print:()=>printer.print()}}
