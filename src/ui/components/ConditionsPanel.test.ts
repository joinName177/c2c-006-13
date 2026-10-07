import{describe,it,expect}from'vitest';
import{mount}from'@vue/test-utils';
import ConditionsPanel from'./ConditionsPanel.vue';
import{normalizeDraft}from'../../core/draft-normalize';
import{createSampleDraft}from'../../core/sample-data';
import type{ConditionSettings as CS}from'../../core/models';

describe('ConditionsPanel',()=>{
  it('关闭状态不渲染条件行，勾选开关后发出 toggle(true)',async()=>{
    const settings:CS={enabled:false,conditions:createSampleDraft().conditions.conditions};
    const wrapper=mount(ConditionsPanel,{props:{settings}});
    expect(wrapper.findAll('.condition-row').length).toBe(0);
    await wrapper.find('.conditions-switch input').setValue(true);
    expect(wrapper.emitted('toggle')![0]).toEqual([true]);
  });
  it('修改阈值数字框时按条件 id 发出 update',async()=>{
    const settings=normalizeDraft(createSampleDraft()).conditions;settings.enabled=true;
    const wrapper=mount(ConditionsPanel,{props:{settings}});
    await wrapper.find('input.cond-number').setValue('90');
    const update=wrapper.emitted('update')![0]as[string,{threshold:number}];
    expect(update[0]).toBe(settings.conditions[0].id);
    expect(update[1].threshold).toBe(90);
  });
  it('点击删除发出 remove',async()=>{
    const settings=normalizeDraft(createSampleDraft()).conditions;settings.enabled=true;
    const wrapper=mount(ConditionsPanel,{props:{settings}});
    await wrapper.find('.cond-remove').trigger('click');
    expect(wrapper.emitted('remove')![0]).toEqual([settings.conditions[0].id]);
  });
});
