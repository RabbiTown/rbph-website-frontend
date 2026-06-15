<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';

const model = defineModel<UnlockGateNode>({ required: true });

const props = defineProps<{
  puzzles: UnlockPuzzleOptionData[];
  rounds: UnlockRoundOptionData[];
  disabled?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{ change: [] }>();

const puzzleItems = computed<SelectItem[]>(() =>
  props.puzzles.map(item => ({
    label: item.slug ? `${item.title} (#${item.id}, ${item.slug})` : `${item.title} (#${item.id})`,
    value: unlockPuzzleRef(item),
  })),
);

const roundItems = computed<SelectItem[]>(() =>
  props.rounds.map(item => ({
    label: item.slug ? `${item.title} (#${item.id}, ${item.slug})` : `${item.title} (#${item.id})`,
    value: unlockRoundRef(item),
  })),
);
</script>

<template>
  <rbph-unlock-gate-block
    v-model="model"
    :puzzles="puzzles"
    :rounds="rounds"
    :puzzle-items="puzzleItems"
    :round-items="roundItems"
    :disabled="disabled"
    :loading="loading"
    @change="emit('change')"
  />
</template>
