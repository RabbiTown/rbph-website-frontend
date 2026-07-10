<script setup lang="ts">
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui';

const { t } = useI18n();

const { puzzle, puzzleRoute, roundRoute } = usePuzzleContext();

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
});
</script>

<template>
  <div v-if="puzzle" class="py-6">
    <u-breadcrumb class="mb-6" :items="breadItems" />
    <div class="flex items-baseline justify-between md:flex-row flex-col">
      <div class="text-3xl font-bold">
        {{ puzzle?.data.title }}
      </div>
      <div class="mt-2 text-secondary ms-0.5 text-xs">
        <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
        {{ t('pages.puzzlePage.unlockedAt', { time: formatDate(puzzle?.state.utime_at) }) }}
      </div>
    </div>

    <u-navigation-menu :items="navItems" class="w-full py-2" :ui="{ linkLeadingIcon: 'xs:inline-block hidden' }" />

    <NuxtPage />
  </div>
</template>
