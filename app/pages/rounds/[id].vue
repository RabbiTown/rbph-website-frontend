<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const api = useApi();
const route = useRoute();

const roundId = computed(() => route.params.id as string);
const preview = computed(() => route.query.preview);

const round = ref<RbRoundUserData>();
const rendererFailed = ref(false);
const { renderer } = useFrontendRenderer({ published: () => round.value?.renderer, gameId: () => round.value?.data.game_id, surface: 'round-page', roundId: () => round.value?.data.id, previewRevision: () => Number(route.query.preview) || undefined });

const game = useGame().ref;
const sidStore = useSid();
const releaseRevision = useGameReleaseSync().revision;
const { t } = useI18n();
const toast = useToast();
const judgeActions = useJudgeActionConsts();
const currentCurrencies = useCurrency().getAllCurrent();
const rendererCurrencies = computed<RbtCurrency[]>(() => Object.values(currentCurrencies.value).map(currency => ({
  id: currency.id,
  slug: currency.slug,
  name: currency.name,
  amount: currency.current,
  precision: currency.prec,
  growth: currency.growth,
})));

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: round.value?.data.title }, { text: game.value?.title, sep: ' - ' }])),
});

const okSubmissionsComp = useTemplateRef('ok-submissions');
const submitResultComp = useTemplateRef('submit-result');

let fetchToken = 0;
async function updateData(id: string | undefined = undefined, clearExisting = true) {
  const token = ++fetchToken;

  const newId = id || roundId.value;
  if (newId) {
    if (clearExisting) round.value = undefined;
    try {
      const { data } = await api.get<RbRoundUserData>(`/rounds/${newId}`);
      const contents = await api.get<{ contents: RbContentBlock[] }>(`/rounds/${data.data.id}/contents`);
      data.data.contents = contents.data.contents;
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

async function updateContents() {
  const id = round.value?.data.id;
  if (!id) return;

  try {
    const { data } = await api.get<{ contents: RbContentBlock[] }>(`/rounds/${id}/contents`);
    if (round.value?.data.id === id) {
      round.value.data.contents = data.contents;
    }
  } catch (error) {
    showError(error instanceof Error ? error : String(error));
  }
}

async function updateRoundState() {
  const id = round.value?.data.id;
  if (!id) return;

  try {
    const { data } = await api.get<RbRoundUserData>(`/rounds/${id}`);
    if (round.value?.data.id === id) {
      round.value.state = data.state;
    }
  } catch (error) {
    showError(error instanceof Error ? error : String(error));
  }
}

watch(
  [roundId, preview],
  async ([newId]) => {
    await updateData(newId);
  },
  { immediate: true },
);

watch(releaseRevision, () => updateData());

function onSubmitSuccess(action: RbJudgeAction) {
  if (action > 0) {
    if (action == RbJudgeAction.StartGame) {
      useGame().updateRoundState();
    }
    okSubmissionsComp.value?.updateData();
  }
}

function onSelfSubmitSuccess(resp: RbJudgeResponse, answer: string) {
  onSubmitSuccess(resp.result.action);
  submitResultComp.value?.updateSuccess(resp.result, answer, resp.currency_penalty);

  if (round.value?.state.puzzle) {
    round.value.state.puzzle = applyPuzzleSubmitState(round.value.state.puzzle, {
      action: resp.result.action,
      cooldown_till: resp.cooldown_till,
      solved: resp.solved,
      state: resp.state,
    });
  }
  if (resp.currency?.length) {
    useCurrency().setData(resp.currency);
  }

  if (resp.unlocks && resp.unlocks.length > 0) {
    useGame().updateRoundState();
  }
  if (resp.content_changed) {
    updateContents();
  }
  if (hasPuzzleUnlockInRound(resp.unlocks, round.value?.data.id)) {
    updateRoundState();
  }
}

function onSelfSubmitFailed(reason: string, answer: string) {
  submitResultComp.value?.updateFail(reason, answer);
}

async function themeSubmitAnswer(answer: string, options: { feedback?: 'host-toast' | 'none' } = {}) {
  const puzzleId = round.value?.data.puzzle;
  if (!puzzleId) throw new Error('This round has no round puzzle');
  const sid = sidStore.create('round-theme-submit');
  const useHostToast = (options.feedback ?? 'host-toast') === 'host-toast';
  let currentToast: ReturnType<typeof toast.add> | undefined;
  try {
    if (useHostToast) {
      const pending = judgeActions.value[RbJudgeAction.Pending];
      currentToast = toast.add({ title: t('puzzleSubmit.submitting'), description: t('puzzleSubmit.submittingDesc'), color: pending.color, icon: pending.icon, duration: Infinity });
    }
    const { data } = await api.post<RbJudgeResponse>(`/puzzles/${puzzleId}/submit`, { answer, sid }, { errorHints: { [-1]: t('puzzleSubmit.invalidAnswer'), [-2]: t('puzzleSubmit.duplicatedAnswer'), [-3]: t('puzzleSubmit.notAllowed') } });
    onSelfSubmitSuccess(data, answer);
    if (useHostToast) {
      const action = judgeActions.value[data.result.action];
      const penalty = formatCurrencyPenaltySuffix(data.currency_penalty);
      const toastData = { title: h('span', [h('span', { class: `font-bold text-${action.color}` }, action.name), ` [${answer}]`]), description: penalty ? `${data.result.result || action.desc} ${penalty}` : data.result.result || action.desc, icon: action.icon, color: action.color, duration: 10000 };
      if (currentToast && toast.toasts.value.some(item => item.id === currentToast?.id)) toast.update(currentToast.id, toastData);
      else toast.add(toastData);
      if (data.unlocks?.length) {
        toast.add({
          title: t('puzzleSubmit.newPuzzleUnlocked'),
          actions: data.unlocks.map(unlock => ({ icon: 'material-symbols:arrow-forward-rounded', label: unlock.title, variant: 'soft' as const, to: gamePuzzleSimpleRoute(round.value?.data.game_id, unlock) })),
          color: 'success',
          icon: 'material-symbols:extension-outline-rounded',
          duration: 10000,
          ui: { actions: 'flex-wrap' },
        });
      }
    }
    return data;
  } catch (error) {
    sidStore.clear(sid);
    const toastData = { duration: 5000, ...getErrorToast(error, t('puzzleSubmit.submitFailed', { answer }), true) };
    toastData.description = toastData.description || t('puzzleSubmit.retryLater');
    if (useHostToast) {
      if (currentToast) toast.update(currentToast.id, toastData);
      else toast.add(toastData);
    }
    throw toastData.description;
  }
}

async function listSubmissions(options: { onlySuccessful?: boolean; page?: number } = {}): Promise<RbtSubmissionPage> {
  const puzzleId = round.value?.data.puzzle;
  if (!puzzleId) return { data: [], total: 0 };
  const { data } = await api.get<RbSubmissionPage>(`/puzzles/${puzzleId}/submissions`, {
    query: { only_ok: options.onlySuccessful ?? false, page: options.page ?? 0 },
  });
  return {
    total: data.total,
    data: data.data.map(submission => ({
      userName: (submission as RbSubmission & { user_name?: string }).user_name,
      answer: submission.user_answer,
      normalizedAnswer: submission.norm_answer,
      action: submission.saction,
      message: submission.sresult,
      createdAt: submission.ctime_at,
    })),
  };
}

const rendererActions = {
  openPuzzle: async (puzzle: RbRoundInnerPuzzleData) => navigateTo(gamePuzzleSimpleRoute(round.value?.data.game_id, puzzle)),
  submitAnswer: themeSubmitAnswer,
  listSubmissions,
  refresh: async () => updateData(undefined, false),
  navigate: async (target: string) => navigateTo(target),
  toast: (options: Parameters<ReturnType<typeof useToast>['add']>[0]) => useToast().add(options),
};
const rendererRoutes = {
  round: () => round.value ? preferredRoundRoute(round.value.data) : '',
  puzzle: (puzzle: RbRoundInnerPuzzleData) => gamePuzzleSimpleRoute(round.value?.data.game_id, puzzle),
};
const useCustomRenderer = computed(() => renderer.value?.mode === 'package' && !rendererFailed.value);
watch(() => [renderer.value?.mode, renderer.value?.manifestUrl, renderer.value?.rendererId], () => { rendererFailed.value = false; });
watch(() => useCustomRenderer.value && renderer.value?.layout === 'game-full', full => setPageLayout(full ? 'game-full' : 'game'), { immediate: true });

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  const isSelfEcho = sidStore.consume(data.sid);

  if (data.puzzle.id === round.value?.data.puzzle && !isSelfEcho) {
    if (round.value.state.puzzle) {
      round.value.state.puzzle = applyPuzzleSubmitState(round.value.state.puzzle, data);
    }
    if (data.currency?.length) {
      useCurrency().setData(data.currency);
    }
    onSubmitSuccess(data.action);
  }
  if (!isSelfEcho && data.content_changed) {
    updateContents();
  }
  if (!isSelfEcho && (data.content_changed || hasPuzzleUnlockInRound(data.unlocks, round.value?.data.id))) {
    updateRoundState();
  }
});
</script>

<template>
  <div v-if="round && useCustomRenderer">
    <rbph-page-renderer :renderer="renderer" :page-key="`round:${round.data.id}`" :page="round" :actions="rendererActions" :routes="rendererRoutes" :content-blocks="round.data.contents" :currencies="rendererCurrencies" @failed="rendererFailed = true" />
  </div>
  <div v-else-if="round">
    <div class="py-6">
      <span class="text-3xl font-bold">
        {{ round?.data.title }}
      </span>
    </div>

    <u-card variant="soft" :ui="{ body: 'py4' }">
      <rbph-content-blocks :blocks="round.data.contents" />

      <template v-if="round.state.puzzles.length > 0">
        <u-separator icon="material-symbols:extension-outline-rounded" class="mt-6 mb-2" />
        <div class="text-3xl font-bold text-center">{{ t('puzzle.puzzles') }}</div>
        <div class="flex justify-center gap-2 my-4 flex-wrap">
          <rbph-puzzle-card v-for="puzzle in round.state.puzzles" :key="puzzle.id" class="md:max-w-7/12 w-full" :puzzle="puzzle" :game-id="round.data.game_id" />
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
          :submit-count="round.state.puzzle.submit_count"
          @submit-success="onSelfSubmitSuccess"
          @submit-fail="onSelfSubmitFailed"
        />
      </u-separator>
      <rbph-submit-result ref="submit-result" />

      <div class="mt-6 w-full" variant="soft">
        <div class="text-lg font-bold mb-4">{{ t('puzzle.recentSuccessfulSubmissions') }}</div>
        <rbph-submissions ref="ok-submissions" :puzzle-id="round.data.puzzle" :only-ok="true" />
      </div>
    </template>
  </div>
  <div v-else class="py-6">
    <u-skeleton class="h-24 w-full" />
  </div>
</template>
