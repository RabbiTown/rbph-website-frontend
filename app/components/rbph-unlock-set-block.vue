<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';
import type { UnlockPuzzleOptionData, UnlockRoundOptionData, UnlockSetNode } from '~/utils/unlock-condition';

const node = defineModel<UnlockSetNode>({ required: true });

defineProps<{
  puzzles: UnlockPuzzleOptionData[];
  rounds: UnlockRoundOptionData[];
  puzzleItems: SelectItem[];
  roundItems: SelectItem[];
  disabled?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{ change: [] }>();

const puzzleSearch = ref('');
const roundSearch = ref('');

const setTypeItems = [
  { label: '指定谜题', value: 'puzzles', icon: 'material-symbols:extension-outline-rounded' },
  { label: '区域所有谜题', value: 'round', icon: 'material-symbols:grid-view-outline-rounded' },
] satisfies SelectItem[];

function setType(type: string) {
  if (type === 'puzzle-range') {
    node.value = { type, start: 1, end: 1 };
  } else if (type === 'round') {
    node.value = { type, ref: '' };
  } else {
    node.value = { type: 'puzzles', refs: [] };
  }
  emit('change');
}
</script>

<template>
  <div class="inline-flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-elevated px-2 py-1 ring ring-default">
    <u-select :model-value="node.type" :items="setTypeItems" :leading-icon="setTypeItems.find(item => item.value === node.type)?.icon" variant="subtle" class="w-40" :disabled="disabled" @update:model-value="value => setType(String(value))" />

    <u-select-menu
      v-if="node.type === 'puzzles'"
      v-model="node.refs"
      v-model:search-term="puzzleSearch"
      multiple
      :items="puzzleItems"
      value-key="value"
      :filter-fields="['label']"
      leading-icon="material-symbols:extension-outline-rounded"
      placeholder="选择或输入关键字过滤谜题"
      search-input
      variant="subtle"
      class="min-w-72"
      :loading="loading"
      :disabled="disabled"
      @update:model-value="emit('change')"
    />

    <template v-else-if="node.type === 'puzzle-range'">
      <u-input-number v-model="node.start" :min="1" :step="1" orientation="vertical" variant="subtle" class="w-28" :disabled="disabled" @update:model-value="emit('change')" />
      <span class="text-sm text-muted">到</span>
      <u-input-number v-model="node.end" :min="1" :step="1" orientation="vertical" variant="subtle" class="w-28" :disabled="disabled" @update:model-value="emit('change')" />
    </template>

    <u-select-menu
      v-else
      v-model="node.ref"
      v-model:search-term="roundSearch"
      :items="roundItems"
      value-key="value"
      :filter-fields="['label']"
      leading-icon="material-symbols:grid-view-outline-rounded"
      placeholder="选择或输入关键字过滤区域"
      search-input
      variant="subtle"
      class="min-w-72"
      :loading="loading"
      :disabled="disabled"
      @update:model-value="emit('change')"
    />
  </div>
</template>
