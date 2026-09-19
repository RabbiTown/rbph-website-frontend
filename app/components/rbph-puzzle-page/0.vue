<script setup lang="ts">
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui';

const { t } = useI18n();

const props = defineProps<{
  routeLoading?: boolean;
}>();

const { puzzle, puzzleRoute, roundRoute } = usePuzzleContext();
const sidebarCollapsed = useState('puzzle-sidebar-collapsed', () => false);

const puzzleId = computed(() => puzzle.value?.data.id);

const navItems = computed<NavigationMenuItem[]>(() =>
  puzzleId.value
    ? [
        {
          label: t('pages.puzzlePage.puzzle'),
          icon: 'material-symbols:extension-outline-rounded',
          to: puzzleRoute(),
          exact: true,
        },
        {
          label: t('pages.puzzlePage.hints'),
          icon: 'material-symbols:lightbulb-outline-rounded',
          to: puzzleRoute('hints'),
        },
        {
          label: t('pages.puzzlePage.submissions'),
          icon: 'material-symbols:history-rounded',
          to: puzzleRoute('submissions'),
        },
        {
          label: t('pages.puzzlePage.tickets'),
          icon: 'material-symbols:near-me-outline-rounded',
          to: puzzleRoute('tickets'),
        },
      ]
    : [],
);

const breadItems = computed<BreadcrumbItem[]>(() => [
  {
    label: puzzle.value?.data.round.title,
    to: roundRoute(),
    icon: 'material-symbols:grid-view-outline-rounded',
  },
  {
    label: puzzle.value?.data.title,
    to: puzzleRoute(),
    icon: 'material-symbols:extension-outline-rounded',
  },
]);

function onSubmitSuccess(action: RbJudgeAction) {
  if (action > 0) {
    if (action === RbJudgeAction.Correct || action === RbJudgeAction.FinishGame) {
      if (puzzle.value) puzzle.value.state.state = RbTeamPuzzleState.Solved;
      useGame().updateRoundState();
      if (action === RbJudgeAction.FinishGame) {
        useTeam().updateData();
      }
    }
  }
}

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  const isSelfEcho = useSid().consume(data.sid);

  if (data.puzzle.id === puzzle.value?.data.id && !isSelfEcho) {
    if (puzzle.value) {
      puzzle.value.state = applyPuzzleSubmitState(puzzle.value.state, data);
    }
    if (data.currency?.length) {
      useCurrency().setData(data.currency);
    }
    onSubmitSuccess(data.action);
  }
  if (!isSelfEcho && data.content_changed) {
    usePuzzle().updateContents();
  }
});
</script>

<template>
  <div v-if="puzzle" class="flex min-w-0 flex-col gap-4 py-6 lg:flex-row lg:items-start lg:gap-6">
    <rbph-puzzle-sidebar />

    <main class="min-w-0 flex-1">
      <div
        class="grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out"
        :class="sidebarCollapsed ? 'mb-6 grid-rows-[1fr] opacity-100' : 'mb-0 grid-rows-[0fr] opacity-0'"
        :aria-hidden="!sidebarCollapsed"
      >
        <div class="overflow-hidden">
          <u-breadcrumb v-if="!props.routeLoading" :items="breadItems" />
          <u-skeleton v-else class="my-1 h-6 w-52 max-w-2/3" />
        </div>
      </div>
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div v-if="!props.routeLoading" class="text-3xl font-bold">
          {{ puzzle?.data.title }}
        </div>
        <u-skeleton v-else class="h-9 w-72 max-w-3/4" />
        <div v-if="!props.routeLoading" class="mt-2 text-secondary ms-0.5 text-xs">
          <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
          {{ t('pages.puzzlePage.unlockedAt', { time: formatDate(puzzle?.state.utime_at) }) }}
        </div>
        <u-skeleton v-else class="mt-2 h-4 w-32" />
      </div>

      <u-navigation-menu v-if="!props.routeLoading" :items="navItems" class="w-full py-2" :ui="{ linkLeadingIcon: 'xs:inline-block hidden' }" />
      <div v-else class="flex gap-2 py-2" aria-hidden="true">
        <u-skeleton v-for="item in 4" :key="item" class="h-8 w-24" />
      </div>

      <NuxtPage v-if="!props.routeLoading" />
      <div v-else class="space-y-3 pt-2" aria-busy="true">
        <u-skeleton class="h-5 w-4/5" />
        <u-skeleton class="h-5 w-full" />
        <u-skeleton class="h-5 w-2/3" />
        <u-skeleton class="mt-5 h-32 w-full" />
      </div>
    </main>
  </div>
</template>
