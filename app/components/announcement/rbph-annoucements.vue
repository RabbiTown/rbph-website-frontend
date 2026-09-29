<script setup lang="ts">
const { t } = useI18n();

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
    <rbph-collapsible-content-card v-for="anmt in processedData" :key="anmt.id" icon="material-symbols:campaign-outline-rounded" default-open>
      <template #title>{{ anmt.title }}</template>
      <template #badges>
        <u-badge v-if="anmt.game_id === null" variant="soft" color="error">{{ t('components.announcement.allSite') }}</u-badge>
        <u-badge v-if="anmt.is_pinned" variant="soft" color="warning">{{ t('components.announcement.pinned') }}</u-badge>
        <div v-if="anmt.utime_at" class="text-secondary text-xs flex items-center">
          <u-icon name="material-symbols:schedule-outline-rounded" class="shrink-0 me-0.5" />
          {{ t('common.updatedAt', { time: formatDate(anmt.utime_at) }) }}
        </div>
      </template>
      <template #actions>
        <u-button v-if="!currentPuzzleId && anmt.puzzles?.length === 1" variant="soft" size="xs" icon="material-symbols:arrow-forward-rounded" :to="puzzleRoute(anmt, anmt.puzzles[0]!)">
          <span class="hidden md:inline">{{ t('components.announcement.goToPuzzle') }}</span>
        </u-button>
      </template>
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
    </rbph-collapsible-content-card>
  </div>
  <u-empty v-else-if="processedData" icon="material-symbols:contact-support-outline-rounded" :title="t('components.announcement.noAnnouncements')" :description="t('components.announcement.waitForPublish')" />
</template>
