<script setup lang="ts">
const { t } = useI18n();

const props = defineProps<{
  page?: string;
}>();

const { puzzle } = usePuzzleContext();
const api = useApi();
const route = useRoute();
const sidStore = useSid();
const toast = useToast();
const judgeActions = useJudgeActionConsts();
const rendererFailed = ref(false);
const currentCurrencies = useCurrency().getAllCurrent();
const rendererCurrencies = computed<RbtCurrency[]>(() => Object.values(currentCurrencies.value).map(currency => ({
  id: currency.id,
  slug: currency.slug,
  name: currency.name,
  amount: currency.current,
  precision: currency.prec,
  growth: currency.growth,
})));
const { renderer } = useFrontendRenderer({ published: () => puzzle.value?.renderer, gameId: () => puzzle.value?.data.game_id, surface: 'puzzle-page', roundId: () => puzzle.value?.data.round.id, puzzleId: () => puzzle.value?.data.id, previewRevision: () => Number(route.query.preview) || undefined });

const UEmpty = resolveComponent('u-empty');
const USkeleton = resolveComponent('u-skeleton');

const page = computed(() => {
  if (!puzzle.value) return null;

  const type = puzzle.value.data.ptype;
  return defineAsyncComponent({
    loader: async () => {
      if (props.page) {
        return await import(`~/components/rbph-puzzle-page/${type}/${props.page}.vue`);
      } else {
        return await import(`~/components/rbph-puzzle-page/${type}.vue`);
      }
    },
    loadingComponent: h(USkeleton, { class: 'w-full min-h-24' }),
    errorComponent: h(UEmpty, {
      icon: 'material-symbols:extension-off-outline-rounded',
      title: t('components.puzzlePage.missingTitle'),
      description: t('components.puzzlePage.missingDescription'),
    }),
  });
});

async function submitAnswer(answer: string, options: { feedback?: 'host-toast' | 'none' } = {}) {
  const puzzleId = puzzle.value?.data.id;
  if (!puzzleId) throw new Error('Missing puzzle id');
  const sid = sidStore.create('puzzle-theme-submit');
  const useHostToast = (options.feedback ?? 'host-toast') === 'host-toast';
  let currentToast: ReturnType<typeof toast.add> | undefined;
  try {
    if (useHostToast) {
      const pending = judgeActions.value[RbJudgeAction.Pending];
      currentToast = toast.add({
        title: t('puzzleSubmit.submitting'),
        description: t('puzzleSubmit.submittingDesc'),
        color: pending.color,
        icon: pending.icon,
        duration: Infinity,
      });
    }
    const { data } = await api.post<RbJudgeResponse>(`/puzzles/${puzzleId}/submit`, { answer, sid }, { errorHints: { [-1]: t('puzzleSubmit.invalidAnswer'), [-2]: t('puzzleSubmit.duplicatedAnswer'), [-3]: t('puzzleSubmit.notAllowed') } });
    if (puzzle.value) puzzle.value.state = applyPuzzleSubmitState(puzzle.value.state, { action: data.result.action, cooldown_till: data.cooldown_till, solved: data.solved, state: data.state });
    if (data.currency?.length) useCurrency().setData(data.currency);
    if (data.result.action === RbJudgeAction.Correct || data.result.action === RbJudgeAction.FinishGame) useGame().updateRoundState();
    if (data.result.action === RbJudgeAction.FinishGame) useTeam().updateData();
    if (data.unlocks?.length) useGame().updateRoundState();
    if (data.content_changed) await usePuzzle().updateContents();
    if (useHostToast) {
      const action = judgeActions.value[data.result.action];
      const currencyPenaltySuffix = formatCurrencyPenaltySuffix(data.currency_penalty);
      const description = data.result.result || action.desc;
      const toastData = {
        title: h('span', [h('span', { class: `font-bold text-${action.color}` }, action.name), ` [${answer}]`]),
        description: currencyPenaltySuffix ? `${description} ${currencyPenaltySuffix}` : description,
        icon: action.icon,
        color: action.color,
        duration: 10000,
      };
      if (currentToast && toast.toasts.value.some(item => item.id === currentToast?.id)) toast.update(currentToast.id, toastData);
      else toast.add(toastData);
      if (data.unlocks?.length) {
        toast.add({
          title: t('puzzleSubmit.newPuzzleUnlocked'),
          actions: data.unlocks.map(unlock => ({ icon: 'material-symbols:arrow-forward-rounded', label: unlock.title, variant: 'soft' as const, to: gamePuzzleSimpleRoute(puzzle.value?.data.game_id, unlock) })),
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
  const puzzleId = puzzle.value?.data.id;
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
  submitAnswer,
  listSubmissions,
  refresh: async () => { if (puzzle.value?.data.id) await usePuzzle().updateState(String(puzzle.value.data.id)); },
  navigate: async (target: string) => navigateTo(target),
  toast: (options: Parameters<ReturnType<typeof useToast>['add']>[0]) => useToast().add(options),
};
const rendererRoutes = {
  round: () => puzzle.value ? gameRoundSimpleRoute(puzzle.value.data.game_id, puzzle.value.data.round) : '',
  puzzle: () => puzzle.value ? preferredPuzzleRoute(puzzle.value.data) : '',
  hints: () => puzzle.value ? preferredPuzzleRoute(puzzle.value.data, 'hints') : '',
  submissions: () => puzzle.value ? preferredPuzzleRoute(puzzle.value.data, 'submissions') : '',
  tickets: () => puzzle.value ? preferredPuzzleRoute(puzzle.value.data, 'tickets') : '',
};
const useCustomRenderer = computed(() => (props.page === 'puzzle') && renderer.value?.mode === 'package' && !rendererFailed.value);
watch(() => [renderer.value?.mode, renderer.value?.manifestUrl, renderer.value?.rendererId], () => { rendererFailed.value = false; });
watch(() => useCustomRenderer.value && renderer.value?.layout === 'game-full', full => setPageLayout(full ? 'game-full' : 'game'), { immediate: true });
</script>

<template>
  <rbph-page-renderer v-if="useCustomRenderer && puzzle && renderer" :renderer="renderer" :page-key="`puzzle:${puzzle.data.id}`" :page="puzzle" :actions="rendererActions" :routes="rendererRoutes" :content-blocks="puzzle.data.contents" :currencies="rendererCurrencies" @failed="rendererFailed = true" />
  <component :is="page" v-else />
</template>
