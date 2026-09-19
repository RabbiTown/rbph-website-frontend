<script setup lang="ts">
const STORAGE_KEY = 'rbph::puzzle-sidebar-collapsed';

const { t } = useI18n();
const route = useRoute();
const { puzzle, roundRoute } = usePuzzleContext();
const releaseRevision = useGameReleaseSync().revision;
const sidebarRounds = usePuzzleSidebarRounds();
const collapsed = useState('puzzle-sidebar-collapsed', () => false);
const storageReady = useState('puzzle-sidebar-storage-ready', () => false);
const loading = ref(false);
const failed = ref(false);
const wideScreen = useIsDesktop('lg');
let requestId = 0;

const roundId = computed(() => puzzle.value?.data.round.id);
const round = computed(() => {
  const id = roundId.value;
  return id ? sidebarRounds.rounds.value[id] : undefined;
});
const gameId = computed(() => puzzle.value?.data.game_id);
const currentPuzzleId = computed(() => puzzle.value?.data.id);
const routedPuzzleRef = computed(() => {
  const value = route.params.puzzle ?? route.params.id;
  return Array.isArray(value) ? value[0] : value;
});
const puzzles = computed(() => round.value?.state.puzzles ?? []);
const collapsedTooltipContent = computed(() => ({ side: wideScreen.value ? 'right' as const : 'bottom' as const }));
const roundBreadcrumb = computed(() => [
  {
    label: puzzle.value?.data.round.title,
    to: roundRoute(),
    icon: 'material-symbols:grid-view-outline-rounded',
    active: false,
  },
]);

function puzzleRoute(item: RbRoundInnerPuzzleData) {
  return gamePuzzleSimpleRoute(gameId.value, item);
}

function isCurrent(item: RbRoundInnerPuzzleData) {
  const target = routedPuzzleRef.value;
  if (target !== undefined) return target === String(item.id) || target === item.slug;
  return item.id === currentPuzzleId.value;
}

function isSolved(item: RbRoundInnerPuzzleData) {
  return item.state === RbTeamPuzzleState.Solved;
}

async function updateData(refresh = false) {
  const id = roundId.value;
  const currentRequest = ++requestId;
  if (!id) return;

  if (round.value && !refresh) {
    loading.value = false;
    failed.value = false;
    return;
  }

  loading.value = true;
  failed.value = false;
  try {
    await sidebarRounds.load(id, refresh);
  } catch {
    if (currentRequest === requestId) failed.value = true;
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

function refreshForUnlocks(unlocks?: { round_id: number }[]) {
  if (unlocks?.some(item => item.round_id === roundId.value)) updateData(true);
}

function updatePuzzleState(id: number, state: RbTeamPuzzleState | undefined) {
  if (state === undefined || !round.value) return;
  const item = round.value.state.puzzles.find(entry => entry.id === id);
  if (item) item.state = state;
}

watch(roundId, () => updateData(), { immediate: true });
watch(releaseRevision, () => updateData(true));
watch(
  () => [currentPuzzleId.value, puzzle.value?.state.state] as const,
  ([id, state]) => {
    if (id) updatePuzzleState(id, state);
  },
);

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  const solved = data.solved || data.action === RbJudgeAction.Correct || data.action === RbJudgeAction.FinishGame;
  const state = data.state?.state ?? (solved ? RbTeamPuzzleState.Solved : undefined);
  updatePuzzleState(data.puzzle.id, state);
  refreshForUnlocks(data.unlocks);
});

useSync().listen(SyncMessageType.PuzzleHintUnlocked, ({ data }) => {
  refreshForUnlocks(data.unlocks);
});

onMounted(() => {
  if (!storageReady.value) {
    collapsed.value = localStorage.getItem(STORAGE_KEY) === '1';
    storageReady.value = true;
  }
});

watch(collapsed, value => {
  if (import.meta.client && storageReady.value) localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
});
</script>

<template>
  <aside class="rbph-puzzle-sidebar w-full shrink-0 overflow-x-clip" :class="{ 'rbph-puzzle-sidebar--collapsed': collapsed }">
    <div class="mb-1 flex h-10 items-center gap-1 lg:hidden">
      <div class="min-w-0 flex-1">
        <transition
          mode="out-in"
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="-translate-y-1 opacity-0"
          enter-to-class="translate-y-0 opacity-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="translate-y-0 opacity-100"
          leave-to-class="translate-y-1 opacity-0"
        >
          <u-breadcrumb
            v-if="!collapsed"
            key="round"
            class="min-w-0 px-1"
            :items="roundBreadcrumb"
            :ui="{ list: 'h-8 items-center', item: 'h-8 items-center', link: 'h-8 items-center', linkLeadingIcon: 'size-5', linkLabel: 'leading-5' }"
          />
          <div v-else key="puzzles" class="flex min-w-0 gap-1 overflow-x-auto pb-1">
            <u-tooltip v-for="item in puzzles" :key="item.id" :text="item.title" :content="collapsedTooltipContent" :delay-duration="100">
              <u-button
                :to="puzzleRoute(item)"
                color="neutral"
                variant="ghost"
                size="sm"
                class="shrink-0"
                :icon="isSolved(item) ? 'material-symbols:check-circle-outline-rounded' : 'material-symbols:circle-outline'"
                :class="[isCurrent(item) ? 'bg-primary/10 text-primary' : '', isSolved(item) && !isCurrent(item) ? 'text-success' : '']"
                :aria-label="item.title"
                :aria-current="isCurrent(item) ? 'page' : undefined"
              />
            </u-tooltip>
          </div>
        </transition>
      </div>
      <u-tooltip :text="t(collapsed ? 'pages.puzzlePage.sidebar.expand' : 'pages.puzzlePage.sidebar.collapse')" :content="collapsedTooltipContent">
        <u-button
          color="neutral"
          variant="ghost"
          size="md"
          class="size-8 shrink-0 justify-center p-0"
          :icon="collapsed ? 'material-symbols:keyboard-arrow-down-rounded' : 'material-symbols:keyboard-arrow-up-rounded'"
          :ui="{ leadingIcon: 'size-5' }"
          :aria-label="t(collapsed ? 'pages.puzzlePage.sidebar.expand' : 'pages.puzzlePage.sidebar.collapse')"
          @click="collapsed = !collapsed"
        />
      </u-tooltip>
    </div>

    <div class="mb-1 hidden h-10 items-center gap-2 lg:flex" :class="collapsed ? 'w-14 justify-center' : 'w-72'">
      <u-breadcrumb
        v-if="!collapsed"
        class="min-w-0 flex-1 px-1"
        :items="roundBreadcrumb"
        :ui="{ list: 'h-8 items-center', item: 'h-8 items-center', link: 'h-8 items-center', linkLeadingIcon: 'size-5', linkLabel: 'leading-5' }"
      />
      <u-tooltip :text="t(collapsed ? 'pages.puzzlePage.sidebar.expand' : 'pages.puzzlePage.sidebar.collapse')" :content="collapsedTooltipContent">
        <u-button
          :key="collapsed ? 'expand' : 'collapse'"
          color="neutral"
          variant="ghost"
          size="md"
          class="size-8 shrink-0 justify-center p-0"
          :icon="collapsed ? 'material-symbols:keyboard-double-arrow-right-rounded' : 'material-symbols:keyboard-double-arrow-left-rounded'"
          :ui="{ leadingIcon: 'size-5' }"
          :aria-label="t(collapsed ? 'pages.puzzlePage.sidebar.expand' : 'pages.puzzlePage.sidebar.collapse')"
          @click="collapsed = !collapsed"
        />
      </u-tooltip>
    </div>

    <div
      class="rbph-puzzle-sidebar-panel grid transition-[grid-template-rows,opacity] duration-200 ease-out lg:block"
      :class="collapsed ? 'pointer-events-none grid-rows-[0fr] opacity-0 lg:hidden' : 'grid-rows-[1fr] opacity-100'"
    >
      <div class="overflow-hidden lg:h-full lg:min-h-0">
        <div class="space-y-1 lg:h-full lg:w-72 lg:overflow-y-auto">
          <template v-if="loading && !round">
            <u-skeleton v-for="item in 3" :key="item" class="h-10 w-full" />
          </template>
          <div v-else-if="failed && !round" class="space-y-2 p-2 text-center">
            <div class="text-xs text-muted">{{ t('pages.puzzlePage.sidebar.loadFailed') }}</div>
            <u-button size="xs" color="neutral" variant="soft" icon="material-symbols:refresh-rounded" @click="updateData()">
              {{ t('pages.puzzlePage.sidebar.retry') }}
            </u-button>
          </div>
          <nuxt-link
            v-for="item in puzzles"
            v-else
            :key="item.id"
            :to="puzzleRoute(item)"
            class="group flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/70"
            :class="isCurrent(item) ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''"
            :aria-current="isCurrent(item) ? 'page' : undefined"
          >
            <u-icon
              :name="isSolved(item) ? 'material-symbols:check-circle-outline-rounded' : 'material-symbols:circle-outline'"
              class="size-5 shrink-0"
              :class="isSolved(item) ? 'text-success' : 'text-muted'"
            />
            <div class="min-w-0 flex-1 truncate text-sm font-medium" :title="item.title">{{ item.title }}</div>
            <u-icon v-if="isCurrent(item)" name="material-symbols:location-on-outline-rounded" class="size-4 shrink-0 text-primary" />
          </nuxt-link>
        </div>
      </div>
    </div>

    <div v-if="collapsed" class="rbph-puzzle-sidebar-panel hidden w-14 flex-col items-center gap-1 lg:flex">
      <div class="flex h-full min-h-0 w-14 flex-col items-center gap-1 overflow-y-auto">
        <u-tooltip v-for="item in puzzles" :key="item.id" :text="item.title" :content="collapsedTooltipContent" :delay-duration="100">
          <u-button
            :to="puzzleRoute(item)"
            color="neutral"
            variant="ghost"
            size="sm"
            class="shrink-0"
            :icon="isSolved(item) ? 'material-symbols:check-circle-outline-rounded' : 'material-symbols:circle-outline'"
            :class="[isCurrent(item) ? 'bg-primary/10 text-primary' : '', isSolved(item) && !isCurrent(item) ? 'text-success' : '']"
            :aria-label="item.title"
            :aria-current="isCurrent(item) ? 'page' : undefined"
          />
        </u-tooltip>
      </div>
    </div>
  </aside>
</template>

<style scoped>
@media (min-width: 64rem) {
  .rbph-puzzle-sidebar {
    position: sticky;
    top: calc(var(--ui-header-height) + 1.5rem);
    display: flex;
    height: calc(100dvh - var(--ui-header-height) - 3rem);
    max-height: calc(100vh - var(--ui-header-height) - 3rem);
    flex-direction: column;
    overflow: hidden;
    width: 18rem;
    transition: width 200ms ease-out;
    will-change: width;
  }

  .rbph-puzzle-sidebar-panel {
    min-height: 0;
    flex: 1 1 0%;
  }

  .rbph-puzzle-sidebar--collapsed {
    width: 3.5rem;
  }
}
</style>
