<script setup lang="ts">
const puzzle = defineModel<RbPuzzleShowData | undefined>();

const okSubmissionsComp = useTemplateRef('ok-submissions');
const submitResultComp = useTemplateRef('submit-result');

function onSubmitSuccess(action: RbJudgeAction) {
  if (action > 0) {
    if (action === RbJudgeAction.Correct || action === RbJudgeAction.FinishGame) {
      if (puzzle.value) puzzle.value.state.state = RbTeamPuzzleState.Solved;
      useGame().updateRoundState();
      if (action === RbJudgeAction.FinishGame) {
        useTeam().updateData();
      }
    }
    okSubmissionsComp.value?.updateData();
  }
}

const submitted: string[] = [];

function onSelfSubmitSuccess(resp: RbJudgeResponse, answer: string) {
  onSubmitSuccess(resp.result.action);
  submitResultComp.value?.updateSuccess(resp.result, answer);

  if (resp.cooldown_till && puzzle.value) {
    puzzle.value.state.cooldown_till = resp.cooldown_till;
  }
}

function onSelfSubmitFailed(reason: string, answer: string) {
  submitResultComp.value?.updateFail(reason, answer);
  arrayRemove(submitted, answer);
}

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  if (data.puzzle.id === puzzle.value?.data.id && !arrayRemove(submitted, data.answer)) {
    if (data.action > 0) {
      okSubmissionsComp.value?.updateData();
    }
  }
});
</script>

<template>
  <div v-if="puzzle">
    <rbph-annoucements v-if="puzzle.data.announcements.length > 0" class="mb-4" :data="puzzle.data.announcements" />
    <u-card variant="soft" :ui="{ body: 'sm:py-2 py-2 sm:px-12 px-12' }">
      <rbph-content :content="puzzle.data" />
    </u-card>

    <u-separator class="my-6" :ui="{ container: 'w-full', border: 'md:w-3/12 w-0' }">
      <rbph-submitter
        class="w-full"
        :puzzle="puzzle.data.id"
        :success="puzzle.state.state === RbTeamPuzzleState.Solved"
        :cooldown-till="puzzle.state.cooldown_till"
        :max-submit="puzzle.state.max_submit"
        @submit="x => submitted.push(x)"
        @submit-success="onSelfSubmitSuccess"
        @submit-fail="onSelfSubmitFailed"
      />
    </u-separator>
    <rbph-submit-result ref="submit-result" />

    <div class="w-full" variant="soft">
      <div class="text-lg font-bold mb-4">最近成功提交</div>
      <rbph-submissions ref="ok-submissions" :puzzle-id="puzzle.data.id" :only-ok="true" />
      <div class="flex justify-center mt-2">
        <nuxt-link :to="`/puzzles/${puzzle.data.id}/submissions`">
          <u-button class="cursor-pointer" variant="ghost" color="secondary" icon="material-symbols:more-horiz" trailing-icon="material-symbols:more-horiz">查看所有提交</u-button>
        </nuxt-link>
      </div>
    </div>
  </div>
</template>
