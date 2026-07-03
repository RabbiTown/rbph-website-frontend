<script setup lang="ts">
const props = defineProps<{
  data?: (Partial<RbAnnouncementInfo> & Pick<RbAnnouncementInfo, 'id' | 'content' | 'content_type' | 'utime_at'>)[];
  tag?: string;
  currentPuzzleId?: number;
}>();

const processedData = computed(() => {
  if (!props.data) return undefined;
  return props.data
    .map(x => {
      return {
        ...x,
        utime_at: new Date(x.utime_at),
      };
    })
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }

      return b.utime_at.getTime() - a.utime_at.getTime();
    });
});

function puzzleRoute(anmt: Partial<RbAnnouncementInfo>, puzzle: RbAnnouncementPuzzle) {
  const gameId = anmt.game_id ?? undefined;
  if (puzzle.is_round_puzzle) {
    return gameRoundSimpleRoute(gameId, { id: puzzle.round_id, slug: puzzle.round_slug });
  }
  return gamePuzzleSimpleRoute(gameId, puzzle);
}
</script>

<template>
  <div v-if="processedData && processedData?.length > 0" class="flex flex-wrap gap-4">
    <u-card v-for="anmt in processedData" :key="anmt.id" class="w-full" variant="subtle" :ui="{ body: 'sm:p-0 p-0' }">
      <u-collapsible :default-open="true" :unmount-on-hide="false">
        <div class="px-5 py-3 flex items-center group dark:bg-slate-800 bg-slate-100 cursor-pointer">
          <u-icon class="align-middle me-2 text-primary" name="material-symbols:campaign-outline-rounded" />
          <div class="text-sm flex-1 flex flex-wrap justify-between">
            <div>
              {{ anmt.title }}
              <u-badge v-if="anmt.game_id === null" variant="soft" color="error" class="ms-1">全站</u-badge>
              <u-badge v-if="anmt.is_pinned" variant="soft" color="warning" class="ms-1">置顶</u-badge>
            </div>
            <div v-if="anmt.utime_at" class="text-secondary text-xs flex items-center ms-1">
              <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle me-0.5" />
              更新于 {{ formatDate(anmt.utime_at) }}
            </div>
          </div>
          <u-button
            v-if="!currentPuzzleId && anmt.puzzles?.length === 1"
            variant="soft"
            size="xs"
            class="-my-8 mx-2"
            icon="material-symbols:arrow-forward-rounded"
            :to="puzzleRoute(anmt, anmt.puzzles[0]!)"
          >
            <span class="hidden md:inline">前往题目</span>
          </u-button>
          <u-icon name="material-symbols:expand-more-rounded" class="-me-1 size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
        </div>
        <template #content>
          <div class="px-4 py-4 border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
            <rbph-content :content="anmt" />
            <div v-if="anmt.puzzles && anmt.puzzles.length > 1" class="mt-4 flex flex-wrap gap-2">
              <u-button
                v-for="puzzle in anmt.puzzles"
                :key="puzzle.id"
                size="xs"
                variant="soft"
                :icon="puzzle.id === currentPuzzleId ? 'material-symbols:location-on-outline-rounded' : 'material-symbols:arrow-forward-rounded'"
                :label="puzzle.title"
                :disabled="puzzle.id === currentPuzzleId"
                :to="puzzle.id === currentPuzzleId ? undefined : puzzleRoute(anmt, puzzle)"
              />
            </div>
          </div>
        </template>
      </u-collapsible>
    </u-card>
  </div>
  <u-empty v-else-if="processedData" icon="material-symbols:contact-support-outline-rounded" title="暂无公告" description="请等待主办方发布" />
</template>
