<script setup lang="ts">
interface AdminPuzzleCardData {
  id: number;
  slug?: string | null;
  title: string;
  ptype: number;
  unlock_cond: string;
  release_phase_id: number;
}

const props = defineProps<{
  puzzle: AdminPuzzleCardData;
  releasePhase?: AdminReleasePhaseData;
  isRoundPuzzle?: boolean;
  title?: string;
  slug?: string | null;
}>();

const puzzleTypeMap: Record<number, { label: string; icon: string; color: 'primary' | 'neutral' | 'warning' }> = {
  0: {
    label: '普通',
    icon: 'material-symbols:extension-outline-rounded',
    color: 'primary',
  },
  1: {
    label: '剧情',
    icon: 'material-symbols:article-outline-rounded',
    color: 'warning',
  },
};

const puzzleType = computed(() =>
  props.isRoundPuzzle
    ? {
        label: '区域谜题',
        icon: 'material-symbols:grid-view-outline-rounded',
        color: 'primary' as const,
      }
    : (puzzleTypeMap[props.puzzle.ptype] ?? {
        label: `类型 ${props.puzzle.ptype}`,
        icon: 'material-symbols:help-outline-rounded',
        color: 'neutral' as const,
      }),
);

const unlockConditionText = computed(() => translateUnlockCondition(props.puzzle.unlock_cond));
const displayedTitle = computed(() => props.title ?? props.puzzle.title);
const displayedSlug = computed(() => props.slug ?? props.puzzle.slug);
</script>

<template>
  <u-card variant="subtle" class="h-full min-h-32" :ui="{ body: 'p-3 sm:p-3 pb-1 sm:pb-1 h-full' }">
    <div class="flex h-full flex-col gap-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1.5">
            <u-badge size="sm" variant="soft" color="neutral">#{{ puzzle.id }}</u-badge>
            <u-badge v-if="displayedSlug" size="sm" variant="soft" color="primary" icon="material-symbols:tag-rounded">
              {{ displayedSlug }}
            </u-badge>
          </div>
          <h3 class="mt-1.5 line-clamp-2 text-md font-semibold leading-snug">
            {{ displayedTitle }}
          </h3>
        </div>

        <u-badge size="sm" :color="puzzleType.color" variant="soft" :icon="puzzleType.icon" class="shrink-0">
          {{ puzzleType.label }}
        </u-badge>
      </div>

      <div class="mt-auto flex items-end gap-2 mb-1.5">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="truncate text-xs text-muted" :title="puzzle.unlock_cond">
            <u-icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle mb-0.5 me-0.5" />
            {{ unlockConditionText }}
          </div>
          <div v-if="releasePhase" class="truncate text-xs text-muted" :title="formatDate(releasePhase.release_at)">
            <u-icon name="material-symbols:event-available-outline-rounded" class="align-middle mb-0.5 me-0.5" />
            {{ releasePhase.title }} · {{ formatDate(releasePhase.release_at) }}
          </div>
        </div>
        <slot name="actions" />
      </div>
    </div>
  </u-card>
</template>
