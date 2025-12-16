<script setup lang="ts">
defineProps<{
  data: RbPuzzleShowData;
}>();

const okSubmissionsComp = useTemplateRef('ok-submissions');
const submitResultComp = useTemplateRef('submit-result');

function onSubmitSuccess(result: RbJudgeResult, answer: string) {
  if (result.action > 0) {
    if (result.action == RbJudgeAction.Correct) {
      usePuzzle().then(v => {
        if (v.value) v.value.state.state = RbTeamPuzzleState.Solved;
      });
    }
    okSubmissionsComp.value?.updateData();
  }
  submitResultComp.value?.updateSuccess(result, answer);
}
</script>

<template>
  <div>
    <u-card variant="soft">
      <rbph-content :content="data.data" />
    </u-card>

    <u-separator class="my-6" :ui="{ container: 'w-full', border: 'md:w-3/12 w-0' }">
      <rbph-submitter class="w-full" :puzzle="data.data.id" :success="data.state.state == RbTeamPuzzleState.Solved" @submit-success="onSubmitSuccess" @submit-fail="submitResultComp?.updateFail" />
    </u-separator>
    <rbph-submit-result ref="submit-result" />

    <div class="w-full" variant="soft">
      <div class="text-lg font-bold mb-4">最近成功提交</div>
      <rbph-submissions ref="ok-submissions" :puzzle-id="data.data.id" :only-ok="true" />
      <div class="flex justify-center mt-2">
        <nuxt-link :to="`/puzzles/${data.data.id}/submissions`">
          <u-button class="cursor-pointer" variant="ghost" color="secondary" icon="material-symbols:more-horiz" trailing-icon="material-symbols:more-horiz">查看所有提交</u-button>
        </nuxt-link>
      </div>
    </div>
  </div>
</template>
