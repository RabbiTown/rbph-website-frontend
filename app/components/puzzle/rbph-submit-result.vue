<script setup lang="ts">
const showResult = ref(false);
const lastAnswer = ref<string>();
const lastJudge = ref<RbJudgeResult>();
const lastJudgeAction = ref<JudgeActionConst>();
const lastExtra = ref('');
const { t } = useI18n();
const judgeActions = useJudgeActionConsts();
const resultDetail = computed(() => `${lastJudge.value?.result || lastJudgeAction.value?.desc} [${lastAnswer.value}]${lastExtra.value ? ` ${lastExtra.value}` : ''}`);

function updateSuccess(result: RbJudgeResult, answer: string, currencyPenalty?: RbCurrencyPenalty[]) {
  lastAnswer.value = answer;
  lastJudge.value = result;
  lastJudgeAction.value = judgeActions.value[result.action];
  lastExtra.value = formatCurrencyPenaltySuffix(currencyPenalty);

  showResult.value = true;
}

function updateFail(reason: string, answer: string) {
  lastAnswer.value = answer;
  lastJudge.value = undefined;
  lastJudgeAction.value = {
    ...judgeActions.value[RbJudgeAction.Error],
    name: t('judge.submitFailed'),
    desc: reason,
  };
  lastExtra.value = '';

  showResult.value = true;
}

defineExpose({ updateSuccess, updateFail });
</script>

<template>
  <div v-if="showResult" class="flex mb-6 justify-center w-full">
    <u-alert class="md:w-7/12 w-full py-3" variant="subtle" :icon="lastJudgeAction?.icon" :color="lastJudgeAction?.color">
      <template #description>
        <i18n-t keypath="judge.resultDisplay" tag="span">
          <template #action><span class="font-bold">{{ lastJudgeAction?.name }}</span></template>
          <template #detail><span>{{ resultDetail }}</span></template>
        </i18n-t>
      </template>
    </u-alert>
  </div>
</template>
