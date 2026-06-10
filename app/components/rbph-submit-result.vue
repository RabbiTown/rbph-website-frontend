<script setup lang="ts">
const showResult = ref(false);
const lastAnswer = ref<string>();
const lastJudge = ref<RbJudgeResult>();
const lastJudgeAction = ref<JudgeActionConst>();
const lastExtra = ref('');

function updateSuccess(result: RbJudgeResult, answer: string, currencyPenalty?: RbCurrencyPenalty[]) {
  lastAnswer.value = answer;
  lastJudge.value = result;
  lastJudgeAction.value = judgeActionConsts[result.action];
  lastExtra.value = formatCurrencyPenaltySuffix(currencyPenalty);

  showResult.value = true;
}

function updateFail(reason: string, answer: string) {
  lastAnswer.value = answer;
  lastJudge.value = undefined;
  lastJudgeAction.value = {
    ...judgeActionConsts[RbJudgeAction.Error],
    name: '提交失败',
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
        <span class="font-bold"> {{ lastJudgeAction?.name }}： </span>
        <span> {{ lastJudge?.result || lastJudgeAction?.desc }} [{{ lastAnswer }}]{{ lastExtra ? ` ${lastExtra}` : '' }} </span>
      </template>
    </u-alert>
  </div>
</template>
