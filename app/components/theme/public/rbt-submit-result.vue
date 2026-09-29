<script setup lang="ts">
const showResult = ref(false);
const lastAnswer = ref<string>();
const lastJudge = ref<{ action: RbJudgeAction; result?: string }>();
const lastJudgeAction = ref<RbtJudgeActionConst>();
const lastExtra = ref('');
const rbph = useRbtContext();
const resultDetail = computed(() => `${lastJudge.value?.result || lastJudgeAction.value?.desc} [${lastAnswer.value}]${lastExtra.value ? ` ${lastExtra.value}` : ''}`);

function updateSuccess(result: { action: RbJudgeAction; result?: string }, answer: string, currencyPenalty?: RbtCurrencyPenalty[]) {
  lastAnswer.value = answer;
  lastJudge.value = result;
  lastJudgeAction.value = rbph.judgeActionConsts.value[result.action];
  lastExtra.value = rbph.utils.formatCurrencyPenaltySuffix(currencyPenalty);
  showResult.value = true;
}

function updateFail(reason: string, answer: string) {
  lastAnswer.value = answer;
  lastJudge.value = undefined;
  lastJudgeAction.value = {
    ...rbph.judgeActionConsts.value[RbJudgeAction.Error],
    name: rbph.i18n.t('judge.submitFailed'),
    desc: reason,
  };
  lastExtra.value = '';
  showResult.value = true;
}

defineExpose({ updateSuccess, updateFail });
</script>

<template>
  <div v-if="showResult" class="flex mb-6 justify-center w-full">
    <u-alert
      class="md:w-7/12 w-full py-3"
      variant="subtle"
      :color="lastJudgeAction?.color"
      :icon="lastJudgeAction?.icon"
    >
      <template #description>
        <i18n-t keypath="judge.resultDisplay" tag="span">
          <template #action><span class="font-bold">{{ lastJudgeAction?.name }}</span></template>
          <template #detail><span>{{ resultDetail }}</span></template>
        </i18n-t>
      </template>
    </u-alert>
  </div>
</template>
