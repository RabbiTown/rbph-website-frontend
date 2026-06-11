<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';
import type { UnlockPuzzleOptionData, UnlockRoundOptionData, UnlockValueNode } from '~/utils/unlock-condition';

const node = defineModel<UnlockValueNode>({ required: true });

defineProps<{
  puzzles: UnlockPuzzleOptionData[];
  rounds: UnlockRoundOptionData[];
  puzzleItems: SelectItem[];
  roundItems: SelectItem[];
  disabled?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{ change: [] }>();

const valueTypeItems = [
  { label: '常数', value: 'number', icon: 'material-symbols:pin-outline-rounded' },
  { label: '解出数量', value: 'solved-count', icon: 'material-symbols:checklist-rounded' },
] satisfies SelectItem[];

function setType(type: string) {
  node.value = type === 'solved-count' ? { type, set: { type: 'puzzles', refs: [] } } : { type: 'number', value: 1 };
  emit('change');
}
</script>

<template>
  <div class="inline-flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-elevated px-2 py-1 ring ring-default">
    <u-select :model-value="node.type" :items="valueTypeItems" :leading-icon="valueTypeItems.find(item => item.value === node.type)?.icon" variant="subtle" class="w-32" :disabled="disabled" @update:model-value="value => setType(String(value))" />

    <u-input-number v-if="node.type === 'number'" v-model="node.value" :min="0" :step="1" orientation="vertical" variant="subtle" class="w-28" :disabled="disabled" @update:model-value="emit('change')" />

    <rbph-unlock-set-block v-else v-model="node.set" :puzzles="puzzles" :rounds="rounds" :puzzle-items="puzzleItems" :round-items="roundItems" :disabled="disabled" :loading="loading" @change="emit('change')" />
  </div>
</template>
