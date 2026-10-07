<script setup lang="ts">
import{METRIC_DOMAIN,METRIC_LABELS,VALUE_KEYS,type ConditionMetric,type ConditionOperator,type ConditionSettings,type MustCondition}from'../../core/models';
const props=defineProps<{settings:ConditionSettings}>();
const emit=defineEmits<{
  toggle:[enabled:boolean];add:[];update:[id:string,patch:Partial<MustCondition>];remove:[id:string];
}>();
const metrics:ConditionMetric[]=[...VALUE_KEYS,'reversibility'];
const operators:{value:ConditionOperator;label:string}[]=[{value:'gte',label:'不低于'},{value:'lte',label:'不高于'}];
function domain(metric:ConditionMetric){return METRIC_DOMAIN[metric]}
function num(e:Event){return Number((e.target as HTMLInputElement).value)}
</script>
<template>
  <section class="paper-panel conditions">
    <span class="index">03 / MUST</span>
    <h2>哪些条件必须满足？</h2>
    <p>硬门槛只判断“能不能选”，不能被其他维度的高分抵消。总分高低只在具备资格的方案之间比较。</p>
    <label class="conditions-switch">
      <input type="checkbox" :checked="settings.enabled" @change="emit('toggle',($event.target as HTMLInputElement).checked)">
      <span>启用必须满足条件（关闭后回到纯评分结果）</span>
    </label>
    <div v-if="settings.enabled" class="condition-list">
      <article v-for="c in settings.conditions" :key="c.id" class="condition-row" :class="{off:!c.enabled}">
        <label class="cond-enable"><input type="checkbox" :checked="c.enabled" @change="emit('update',c.id,{enabled:($event.target as HTMLInputElement).checked})"></label>
        <select :value="c.metric" @change="emit('update',c.id,{metric:($event.target as HTMLSelectElement).value as ConditionMetric})">
          <option v-for="m in metrics" :key="m" :value="m">{{METRIC_LABELS[m]}}</option>
        </select>
        <select :value="c.operator" @change="emit('update',c.id,{operator:($event.target as HTMLSelectElement).value as ConditionOperator})">
          <option v-for="op in operators" :key="op.value" :value="op.value">{{op.label}}</option>
        </select>
        <label class="cond-threshold">
          <input type="range" :min="domain(c.metric).min" :max="domain(c.metric).max" :value="c.threshold"
            @input="emit('update',c.id,{threshold:num($event)})">
          <input class="cond-number" type="number" :min="domain(c.metric).min" :max="domain(c.metric).max" :value="c.threshold"
            @input="emit('update',c.id,{threshold:num($event)})">
          <span>{{domain(c.metric).unit}}</span>
        </label>
        <label class="cond-tolerance" title="实际值落在阈值±容忍带内时，判为“尚无法判断”而非直接满足或不满足">
          边界容忍带
          <input type="number" min="0" :value="c.tolerance??0" @input="emit('update',c.id,{tolerance:num($event)})">
          <span>{{domain(c.metric).unit}}</span>
        </label>
        <button type="button" class="cond-remove" @click="emit('remove',c.id)">×</button>
      </article>
      <button type="button" class="cond-add" @click="emit('add')">＋ 添加必须条件</button>
      <p class="condition-hint">判断规则：明确越过阈值（含容忍带）才排除；数据缺失（影响值标为“未评估”）或落在容忍带内，记为<b>尚无法判断</b>，方案保留为条件候选，不会被直接推荐。同指标“不低于”高于“不高于”等冲突会在结果页报告并暂停资格判断。</p>
    </div>
  </section>
</template>
