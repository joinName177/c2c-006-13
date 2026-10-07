import type{DecisionDraft,DecisionOption,MustCondition}from'./models';
const option=(id:string,name:string,description:string,impacts:DecisionOption['impacts'],reversibility:number):DecisionOption=>({id,name,description,impacts,reversibility});
const condition=(id:string,metric:MustCondition['metric'],operator:MustCondition['operator'],threshold:number,tolerance:number|undefined=undefined,enabled=false):MustCondition=>({id,metric,operator,threshold,tolerance,enabled});
export function createSampleDraft():DecisionDraft{return{id:'case-career',title:'要不要离开现在的工作？',background:'现岗位稳定但成长变慢，新机会更有挑战，也意味着短期不确定。',weights:{stability:30,growth:35,freedom:20,money:15},
  // 示例默认给两条可开启的门槛：可逆性下限（带 5% 容忍带）、成长不能为负。用户可在面板中开关、增删、调阈值。
  conditions:{enabled:false,conditions:[
    condition('c-rev','reversibility','gte',60,5),
    condition('c-growth','growth','gte',0),
    condition('c-money','money','gte',2,undefined,false),
  ]},
  updatedAt:new Date().toISOString(),options:[
    option('stay','留下来','维持熟悉的团队与节奏',{stability:4,growth:-1,freedom:0,money:2},75),
    option('leave','接受新机会','进入更具挑战的新环境',{stability:-2,growth:5,freedom:2,money:3},55),
    option('prepare','再准备半年','设定期限补足能力后再行动',{stability:2,growth:3,freedom:1,money:1},85),
  ]}}
