<script setup lang="ts">
const props = defineProps<{
  data: RbPuzzleShowData;
}>();

const puzzle = usePuzzle().ref;

const okSubmissionsComp = useTemplateRef('ok-submissions');
const submitResultComp = useTemplateRef('submit-result');

function onSubmitSuccess(action: RbJudgeAction) {
  if (action > 0) {
    if (action === RbJudgeAction.Correct) {
      if (puzzle.value) puzzle.value.state.state = RbTeamPuzzleState.Solved;
      console.log(puzzle);
    }
    okSubmissionsComp.value?.updateData();
  }
}

const submitted: string[] = [];

function onSelfSubmitSuccess(result: RbJudgeResult, answer: string) {
  onSubmitSuccess(result.action);
  submitResultComp.value?.updateSuccess(result, answer);
}

function onSelfSubmitFailed(reason: string, answer: string) {
  submitResultComp.value?.updateFail(reason, answer);
  arrayRemove(submitted, answer);
}

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  console.log(data);
  if (data.puzzle.id === props.data.data.id && !arrayRemove(submitted, data.answer)) {
    onSubmitSuccess(data.action);
  }
});
</script>

<template>
  <div>
    <rbph-annoucements v-if="data.data.announcements.length > 0" class="mb-4" :data="data.data.announcements" />
    <u-card variant="soft" :ui="{ body: 'sm:py-2 py-2 sm:px-12 px-12' }">
      <rbph-content :content="data.data" />
    </u-card>

    <u-separator class="my-6" :ui="{ container: 'w-full', border: 'md:w-3/12 w-0' }">
      <rbph-submitter class="w-full" :puzzle="data.data.id" :success="data.state.state === RbTeamPuzzleState.Solved" @submit="x => submitted.push(x)" @submit-success="onSelfSubmitSuccess" @submit-fail="onSelfSubmitFailed" />
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
