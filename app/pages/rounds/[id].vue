<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const api = useApi();
const route = useRoute();

const roundId = computed(() => route.params.id as string);

const round = ref<RbRoundUserData>();

const game = useGame().ref;
const sidStore = useSid();

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: round.value?.data.title }, { text: game.value?.title, sep: ' - ' }])),
});

const okSubmissionsComp = useTemplateRef('ok-submissions');
const submitResultComp = useTemplateRef('submit-result');

let fetchToken = 0;
async function updateData(id: string | undefined = undefined) {
  const token = ++fetchToken;

  const newId = id || roundId.value;
  if (newId) {
    round.value = undefined;
    try {
      const { data } = await api.get<RbRoundUserData>(`/rounds/${newId}`);
      if (token !== fetchToken) return;

      round.value = data;
      if (data.data.game_id) {
        updateGameState(data.data.game_id.toString());
      }
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
    }
  }
}

watch(
  roundId,
  async newId => {
    await updateData(newId);
  },
  { immediate: true },
);

function onSubmitSuccess(action: RbJudgeAction) {
  if (action > 0) {
    if (action == RbJudgeAction.StartGame) {
      updateData();
      useCurrency().updateData();
      useGame().updateRoundState();
    }
    okSubmissionsComp.value?.updateData();
  }
}

function onSelfSubmitSuccess(resp: RbJudgeResponse, answer: string) {
  onSubmitSuccess(resp.result.action);
  submitResultComp.value?.updateSuccess(resp.result, answer);

  if (resp.cooldown_till && round.value?.state.puzzle) {
    round.value.state.puzzle.cooldown_till = resp.cooldown_till;
  }

  if (resp.solved && round.value?.state.puzzle) {
    round.value.state.puzzle.state = RbTeamPuzzleState.Solved;
  }

  if (resp.unlocks?.some(x => x.round_id === round.value?.data.id)) {
    updateData();
  }

  if (resp.unlocks && resp.unlocks.length > 0) {
    useGame().updateRoundState();
  }
}

function onSelfSubmitFailed(reason: string, answer: string) {
  submitResultComp.value?.updateFail(reason, answer);
}

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  const isSelfEcho = sidStore.consume(data.sid);

  if (data.puzzle.id === round.value?.data.puzzle && !isSelfEcho) {
    onSubmitSuccess(data.action);

    if (data.cooldown_till && round.value.state.puzzle) {
      round.value.state.puzzle.cooldown_till = data.cooldown_till;
    }
  }
  if (!isSelfEcho && ((data.solved && round.value?.state.puzzles.find(x => x.id === data.puzzle.id)) || data.unlocks?.find(x => x.round_id === round.value?.data.id))) {
    updateData();
  }
});
</script>

<template>
  <div v-if="round">
    <div class="py-6">
      <span class="text-3xl font-bold">
        {{ round?.data.title }}
      </span>
    </div>

    <u-card variant="soft" :ui="{ body: 'sm:py-2 py-2' }">
      <rbph-content :content="round?.data" />

      <template v-if="round.state.puzzles.length > 0">
        <u-separator icon="material-symbols:extension-outline-rounded" class="mt-6 mb-2" />
        <div class="text-3xl font-bold text-center">谜题</div>
        <div class="flex justify-center gap-2 my-4 flex-wrap">
          <rbph-puzzle-card v-for="puzzle in round.state.puzzles" :key="puzzle.id" class="md:max-w-7/12 w-full" :puzzle="puzzle" />
        </div>
      </template>
    </u-card>

    <template v-if="round.data.puzzle && round.state.puzzle">
      <u-separator class="my-6" :ui="{ container: 'w-full', border: 'md:w-3/12 w-0' }">
        <rbph-submitter
          class="w-full"
          :puzzle="round.data.puzzle"
          :success="round.state.puzzle.state === RbTeamPuzzleState.Solved"
          :cooldown-till="round.state.puzzle.cooldown_till"
          :max-submit="round.state.puzzle.max_submit"
          @submit-success="onSelfSubmitSuccess"
          @submit-fail="onSelfSubmitFailed"
        />
      </u-separator>
      <rbph-submit-result ref="submit-result" />

      <div class="mt-6 w-full" variant="soft">
        <div class="text-lg font-bold mb-4">最近成功提交</div>
        <rbph-submissions ref="ok-submissions" :puzzle-id="round.data.puzzle" :only-ok="true" />
      </div>
    </template>
  </div>
  <div v-else class="py-6">
    <u-skeleton class="h-24 w-full" />
  </div>
</template>
