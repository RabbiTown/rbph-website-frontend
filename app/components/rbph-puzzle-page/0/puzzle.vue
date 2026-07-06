<script setup lang="ts">
const { puzzle, puzzleRoute } = usePuzzleContext();

const okSubmissionsComp = useTemplateRef('ok-submissions');
const submitResultComp = useTemplateRef('submit-result');
const currencies = useCurrency().getAllCurrent();
const unmetSubmitRequirements = computed(() => (puzzle.value?.data.submit_requirements ?? []).filter(requirement => (currencies.value[requirement.currency_id]?.current ?? 0) < requirement.minimum));
const submitRequirementHint = computed(() => {
  if (!unmetSubmitRequirements.value.length) return undefined;
  return unmetSubmitRequirements.value
    .map(requirement => {
      const current = currencies.value[requirement.currency_id]?.current ?? 0;
      return `${requirement.currency_name} ${intPrecString(current, requirement.currency_prec)} / ${intPrecString(requirement.minimum, requirement.currency_prec)}`;
    })
    .join('，');
});

function onSubmitSuccess(action: RbJudgeAction) {
  usePuzzle().updateState();
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

function onSelfSubmitSuccess(resp: RbJudgeResponse, answer: string) {
  onSubmitSuccess(resp.result.action);
  submitResultComp.value?.updateSuccess(resp.result, answer, resp.currency_penalty);

  if (resp.cooldown_till && puzzle.value) {
    puzzle.value.state.cooldown_till = resp.cooldown_till;
  }
  if (puzzle.value) {
    puzzle.value.state = mergePuzzleSubmitState(puzzle.value.state, resp.state, resp.result.action);
  }
  if (resp.currency?.length) {
    useCurrency().setData(resp.currency);
  }

  if (resp.solved && puzzle.value) {
    puzzle.value.state.state = RbTeamPuzzleState.Solved;
  }

  if (resp.unlocks && resp.unlocks.length > 0) {
    useGame().updateRoundState();
  }
}

function onSelfSubmitFailed(reason: string, answer: string) {
  submitResultComp.value?.updateFail(reason, answer);
}

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  if (useSid().consume(data.sid)) return;

  if (data.puzzle.id === puzzle.value?.data.id) {
    usePuzzle().updateState();
    if (puzzle.value) {
      puzzle.value.state = mergePuzzleSubmitState(puzzle.value.state, data.state, data.action);
    }
    if (data.currency?.length) {
      useCurrency().setData(data.currency);
    }
    if (data.action > 0) {
      okSubmissionsComp.value?.updateData();
    }
  }
});
</script>

<template>
  <div v-if="puzzle">
    <rbph-annoucements v-if="puzzle.data.announcements.length > 0" class="mb-4" :data="puzzle.data.announcements" :current-puzzle-id="puzzle.data.id" />
    <u-card variant="soft" :ui="{ body: 'py-4' }">
      <rbph-content-blocks :blocks="puzzle.data.contents" />
    </u-card>

    <template v-if="puzzle.data.submission_enabled">
      <u-separator class="mt-6" :ui="{ container: 'w-full', border: 'md:w-3/12 w-0' }">
        <rbph-submitter
          class="w-full"
          :puzzle="puzzle.data.id"
          :success="puzzle.state.state === RbTeamPuzzleState.Solved"
          :cooldown-till="puzzle.state.cooldown_till"
          :max-submit="puzzle.state.max_submit"
          :submit-count="puzzle.state.submit_count"
          :externally-blocked="unmetSubmitRequirements.length > 0"
          :blocked-hint="submitRequirementHint"
          @submit-success="onSelfSubmitSuccess"
          @submit-fail="onSelfSubmitFailed"
        />
      </u-separator>
      <rbph-submit-result ref="submit-result" />

      <div class="w-full" variant="soft">
        <div class="text-lg font-bold mb-4 mt-6">最近成功提交</div>
        <rbph-submissions ref="ok-submissions" :puzzle-id="puzzle.data.id" :only-ok="true" />
        <div class="flex justify-center mt-2">
          <nuxt-link :to="puzzleRoute('submissions')">
            <u-button class="cursor-pointer" variant="ghost" color="secondary" icon="material-symbols:more-horiz" trailing-icon="material-symbols:more-horiz">查看所有提交</u-button>
          </nuxt-link>
        </div>
      </div>
    </template>
  </div>
</template>
