<script setup lang="ts">
import { RbTooltip } from '#components';

const props = withDefaults(
  defineProps<{
    solved: boolean;
    stats?: RbPuzzleSolveStats;
    size?: number;
  }>(),
  {
    size: 24,
    stats: undefined,
  },
);

const { t } = useI18n();

const normalizedStats = computed(() => {
  const unlocked = Math.max(0, props.stats?.unlocked ?? 0);
  const solved = Math.min(unlocked, Math.max(0, props.stats?.solved ?? 0));
  const tried = Math.min(unlocked, Math.max(solved, props.stats?.tried ?? 0));
  return { unlocked, solved, tried };
});

const solvedPercent = computed(() => (normalizedStats.value.unlocked > 0 ? (normalizedStats.value.solved / normalizedStats.value.unlocked) * 100 : 0));
const submittedPercent = computed(() => (normalizedStats.value.unlocked > 0 ? ((normalizedStats.value.tried - normalizedStats.value.solved) / normalizedStats.value.unlocked) * 100 : 0));
const iconSize = computed(() => Math.max(1, props.size));
const iconStyle = computed(() => ({ width: `${iconSize.value}px`, height: `${iconSize.value}px` }));
const checkStyle = computed(() => ({ width: `${(iconSize.value * 2) / 3}px`, height: `${(iconSize.value * 2) / 3}px` }));
const tooltip = computed(() =>
  t('puzzle.solveStats.display', {
    ...normalizedStats.value,
    solvedLabel: t('puzzle.solveStats.solved'),
    triedLabel: t('puzzle.solveStats.tried'),
    unlockedLabel: t('puzzle.solveStats.unlocked'),
  }),
);
</script>

<template>
  <u-icon v-if="!stats" :name="solved ? 'material-symbols:check-circle-outline' : 'material-symbols:circle-outline'" class="shrink-0" :style="iconStyle" />
  <rb-tooltip v-else class="inline-flex align-middle leading-none" :delay-duration="100">
    <span class="relative inline-grid shrink-0 cursor-help place-items-center" :style="iconStyle" role="img" :aria-label="tooltip" @click.stop.prevent>
      <svg class="absolute inset-0 size-full -rotate-90" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" pathLength="100" fill="none" stroke="white" stroke-width="3" />
        <circle
          v-if="submittedPercent > 0"
          cx="12"
          cy="12"
          r="10"
          pathLength="100"
          fill="none"
          stroke="var(--ui-color-warning-500)"
          stroke-width="3"
          :stroke-dasharray="`${submittedPercent} ${100 - submittedPercent}`"
          :stroke-dashoffset="-solvedPercent"
        />
        <circle v-if="solvedPercent > 0" cx="12" cy="12" r="10" pathLength="100" fill="none" stroke="var(--ui-color-success-500)" stroke-width="3" :stroke-dasharray="`${solvedPercent} ${100 - solvedPercent}`" />
      </svg>
      <svg v-if="solved" class="relative text-success" :style="checkStyle" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12.5 9.5 17 19 7.5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <template #content>
      <i18n-t keypath="puzzle.solveStats.display" tag="span" class="text-secondary">
        <template #solvedLabel>
          <span class="text-success">{{ t('puzzle.solveStats.solved') }}</span>
        </template>
        <template #triedLabel>
          <span class="text-warning">{{ t('puzzle.solveStats.tried') }}</span>
        </template>
        <template #unlockedLabel>
          <span class="text-white">{{ t('puzzle.solveStats.unlocked') }}</span>
        </template>
        <template #solved>
          <span class="text-success">{{ normalizedStats.solved }}</span>
        </template>
        <template #tried>
          <span class="text-warning">{{ normalizedStats.tried }}</span>
        </template>
        <template #unlocked>
          <span class="text-white">{{ normalizedStats.unlocked }}</span>
        </template>
      </i18n-t>
    </template>
  </rb-tooltip>
</template>
