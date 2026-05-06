<script setup lang="ts">
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui';

const puzzle = defineModel<RbPuzzleShowData | undefined>();

const puzzleId = computed(() => puzzle.value?.data.id);

const navItems = computed<NavigationMenuItem[]>(() =>
  puzzleId.value
    ? [
        {
          label: '题目',
          icon: 'material-symbols:extension-outline-rounded',
          to: `/puzzles/${puzzleId.value}`,
          exact: true,
        },
        {
          label: '提示',
          icon: 'material-symbols:lightbulb-outline-rounded',
          to: `/puzzles/${puzzleId.value}/hints`,
        },
        {
          label: '提交记录',
          icon: 'material-symbols:history-rounded',
          to: `/puzzles/${puzzleId.value}/submissions`,
        },
        {
          label: '人工提示',
          icon: 'material-symbols:near-me-outline-rounded',
          to: `/puzzles/${puzzleId.value}/tickets`,
        },
      ]
    : []
);

const breadItems = computed<BreadcrumbItem[]>(() => [
  {
    label: puzzle.value?.data.round.title,
    to: `/rounds/${puzzle.value?.data.round.id}`,
    icon: 'material-symbols:grid-view-outline-rounded',
  },
  {
    label: puzzle.value?.data.title,
    to: `/puzzles/${puzzleId.value}`,
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
  if (useSid().consume(data.sid)) return;

  if (data.puzzle.id === puzzle.value?.data.id) {
    onSubmitSuccess(data.action);

    if (data.cooldown_till && puzzle.value) {
      puzzle.value.state.cooldown_till = data.cooldown_till;
    }
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
        <icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
        解锁于 {{ formatDate(puzzle?.state.utime_at) }}
      </div>
    </div>

    <u-navigation-menu :items="navItems" class="w-full py-2" :ui="{ linkLeadingIcon: 'xs:inline-block hidden' }" />

    <NuxtPage />
  </div>
</template>
