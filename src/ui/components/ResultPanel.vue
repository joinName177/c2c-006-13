<script setup lang="ts">
import{computed}from'vue';
import{METRIC_DOMAIN,METRIC_LABELS,type DecisionAnalysis,type ConditionsOutcome,type OptionAnalysis,type ConditionCheck}from'../../core/models';
import RegretCurve from'./RegretCurve.vue';
const props=defineProps<{analysis:DecisionAnalysis;stale:boolean}>();
const c=()=>props.analysis.conditions;
const conditions=computed(()=>c());
const tierLabel={eligible:'具备资格',conditional:'条件候选',excluded:'不具备资格'}as const;
function checksOf(item:OptionAnalysis):ConditionCheck[]{return conditions.value.enabled?item.eligibility?.checks??[]:[]}
function thresholdText(out:ConditionsOutcome,id:string){const cond=out.activeConditions.find(c=>c.id===id);if(!cond)return'';const d=METRIC_DOMAIN[cond.metric];return`${METRIC_LABELS[cond.metric]} ${cond.operator==='gte'?'≥':'≤'} ${cond.threshold}${d.unit}`}
</script>
<template>
  <section class="results">
    <div v-if="stale" class="stale-note">输入或条件已变化，下方是上一次分析结果，请重新计算。</div>
    <div class="recommendation" :class="analysis.recommendationKind">
      <span>THE LEAST REGRETFUL PATH</span>
      <h2>最不后悔建议</h2>
      <p>{{analysis.recommendation}}</p>
      <aside v-for="notice in analysis.notices" :key="notice">{{notice}}</aside>
    </div>

    <div v-if="conditions.status==='conflict'" class="condition-conflict">
      <h3>必须条件存在冲突，资格判断已暂停</h3>
      <ul><li v-for="(cf,i) in conditions.conflicts" :key="i">{{cf.message}}</li></ul>
      <p>下方分数为不启用门槛时的原始评分，可用于对照；冲突解决前不推荐任何方案。</p>
    </div>

    <div v-if="conditions.enabled && conditions.status==='clear'" class="condition-basis">
      <h3>必须满足条件（本次计算依据）</h3>
      <ul>
        <li v-for="cond in conditions.activeConditions" :key="cond.id">
          {{METRIC_LABELS[cond.metric]}} {{cond.operator==='gte'?'不低于':'不高于'}} {{cond.threshold}}{{METRIC_DOMAIN[cond.metric].unit}}
          <em v-if="cond.tolerance">（边界容忍带 ±{{cond.tolerance}}{{METRIC_DOMAIN[cond.metric].unit}}）</em>
        </li>
      </ul>
      <div v-if="analysis.recommendationKind==='none-qualified'" class="unresolved">
        <h4>待解决条件</h4>
        <p v-for="item in analysis.options" :key="item.option.id">
          <b>{{item.option.name}}：</b>
          <span v-for="(chk,i) in checksOf(item).filter(x=>x.status==='fail')" :key="chk.conditionId">{{chk.reason}}{{i?'　':''}}</span>
        </p>
      </div>
      <div v-if="analysis.recommendationKind==='conditional-only'" class="unresolved">
        <h4>补充以下信息后可重新判断</h4>
        <p v-for="(u,i) in conditions.unresolved" :key="i"><b>{{analysis.options.find(o=>o.option.id===u.optionId)?.option.name}}：</b>{{u.reason}}</p>
      </div>
    </div>

    <RegretCurve :options="analysis.options"/>
    <div class="score-grid">
      <article v-for="(item,index) in analysis.options" :key="item.option.id"
        :class="{excluded:conditions.enabled&&item.eligibility?.tier==='excluded',conditional:conditions.enabled&&item.eligibility?.tier==='conditional',winner:analysis.winnerId===item.option.id}">
        <span>#0{{index+1}}</span>
        <h3>{{item.option.name}}</h3>
        <b>{{item.total}}<small>/100</small></b>
        <em v-if="conditions.enabled&&item.eligibility" class="tier-badge" :class="item.eligibility.tier">{{tierLabel[item.eligibility.tier]}}</em>
        <div><i v-for="p in item.points" :key="p.horizon">{{p.horizon}}年 {{p.score}}</i></div>
        <p v-if="conditions.enabled&&item.eligibility?.tier==='excluded'" class="tier-note">总分仅作对照，不能直接推荐。</p>
        <details v-if="checksOf(item).length" class="checks">
          <summary>条件核对（{{checksOf(item).filter(x=>x.status==='pass').length}}/{{checksOf(item).length}} 满足）</summary>
          <ul>
            <li v-for="chk in checksOf(item)" :key="chk.conditionId" :class="chk.status">
              <b>{{thresholdText(conditions,chk.conditionId)}}</b> — <i>{{chk.status==='pass'?'满足':chk.status==='fail'?'不满足':'尚无法判断'}}</i>：{{chk.reason}}
            </li>
          </ul>
        </details>
      </article>
    </div>
    <p v-for="item in analysis.options.filter(o=>o.assumptions.length)" :key="'a'+item.option.id" class="assumption-note">
      <b>{{item.option.name}}：</b><span v-for="(t,i) in item.assumptions" :key="i">{{t}} </span>
    </p>
    <div class="rehearsals"><article v-for="item in analysis.options" :key="item.option.id"><h3>{{item.option.name}} · 后悔预演</h3><div v-for="card in item.cards" :key="card.horizon"><b>{{card.horizon}} 年后</b><p>{{card.regret}}</p><small>{{card.trigger}} {{card.reversibility}}；{{card.action}}</small></div></article></div>
  </section>
</template>
