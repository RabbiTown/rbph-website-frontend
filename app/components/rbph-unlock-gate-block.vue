<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';
import type { UnlockGateNode, UnlockGateType, UnlockPuzzleOptionData, UnlockRoundOptionData } from '~/utils/unlock-condition';

const node = defineModel<UnlockGateNode>({ required: true });

const props = defineProps<{
  puzzles: UnlockPuzzleOptionData[];
  rounds: UnlockRoundOptionData[];
  puzzleItems: SelectItem[];
  roundItems: SelectItem[];
  disabled?: boolean;
  loading?: boolean;
  depth?: number;
}>();

const emit = defineEmits<{ change: [] }>();

const gateTypeItems = [
  [
    { label: '默认解锁', value: 'default', icon: 'material-symbols:lock-open-right-outline-rounded' },
    { label: '队伍开始游戏', value: 'game-started', icon: 'material-symbols:flag-outline-rounded' },
    { label: '解出谜题', value: 'solved', icon: 'material-symbols:extension-outline-rounded' },
    { label: '全部解出', value: 'all-solved', icon: 'material-symbols:done-all-rounded' },
    { label: '任一解出', value: 'any-solved', icon: 'material-symbols:rule-rounded' },
  ],
  [
    { label: '比较', value: 'cmp', icon: 'material-symbols:function-rounded' },
    { label: '并且', value: 'and', icon: 'material-symbols:join-inner-rounded' },
    { label: '或者', value: 'or', icon: 'material-symbols:join-full-rounded' },
    { label: '非', value: 'not', icon: 'material-symbols:close-rounded' },
  ],
  [{ label: '源码', value: 'source', icon: 'material-symbols:code-rounded' }],
] satisfies SelectItem[][];

const compareOpItems = [
  { label: '大于或等于', value: 'ge', icon: 'tabler:math-equal-greater' },
  { label: '大于', value: 'gt', icon: 'tabler:math-greater' },
  { label: '小于或等于', value: 'le', icon: 'tabler:math-equal-lower' },
  { label: '小于', value: 'lt', icon: 'tabler:math-lower' },
  { label: '等于', value: 'eq', icon: 'tabler:equal' },
  { label: '不等于', value: 'ne', icon: 'tabler:equal-not' },
] satisfies SelectItem[];

function selectedIcon(items: SelectItem[], value: string | number | null | undefined) {
  return items.find(item => item.value === value)?.icon;
}

function setType(type: string) {
  if (type === 'source') {
    node.value = { type: 'source', source: serializeUnlockGate(node.value) || 'default' };
  } else {
    node.value = defaultUnlockGate(type as UnlockGateType, props.puzzles, props.rounds);
  }
  emit('change');
}

function addChild() {
  if (node.value.type !== 'and' && node.value.type !== 'or') return;
  node.value.children.push(defaultUnlockGate('game-started', props.puzzles, props.rounds));
  emit('change');
}

function removeChild(index: number) {
  if (node.value.type !== 'and' && node.value.type !== 'or') return;
  node.value.children.splice(index, 1);
  if (node.value.children.length === 0) node.value.children.push(defaultUnlockGate('game-started', props.puzzles, props.rounds));
  emit('change');
}
</script>

<template>
  <div class="rounded-md bg-default/60 p-3 ring ring-default" :class="(depth ?? 0) > 0 ? 'ms-4' : ''">
    <div class="flex flex-wrap items-center gap-2">
      <u-select :model-value="node.type" :items="gateTypeItems" :leading-icon="selectedIcon(gateTypeItems.flat(), node.type)" variant="subtle" class="w-44" :disabled="disabled" @update:model-value="value => setType(String(value))" />

      <template v-if="node.type === 'solved'">
        <u-select v-model="node.ref" :items="puzzleItems" :leading-icon="selectedIcon(puzzleItems, node.ref)" variant="subtle" class="min-w-72 flex-1" :loading="loading" :disabled="disabled" @update:model-value="emit('change')" />
      </template>

      <template v-else-if="node.type === 'all-solved' || node.type === 'any-solved'">
        <rbph-unlock-set-block v-model="node.set" :puzzles="puzzles" :rounds="rounds" :puzzle-items="puzzleItems" :round-items="roundItems" :disabled="disabled" :loading="loading" @change="emit('change')" />
      </template>

      <template v-else-if="node.type === 'cmp'">
        <rbph-unlock-value-block v-model="node.lhs" :puzzles="puzzles" :rounds="rounds" :puzzle-items="puzzleItems" :round-items="roundItems" :disabled="disabled" :loading="loading" @change="emit('change')" />
        <u-select v-model="node.op" :items="compareOpItems" :leading-icon="selectedIcon(compareOpItems, node.op)" variant="subtle" class="w-36" :disabled="disabled" @update:model-value="emit('change')" />
        <rbph-unlock-value-block v-model="node.rhs" :puzzles="puzzles" :rounds="rounds" :puzzle-items="puzzleItems" :round-items="roundItems" :disabled="disabled" :loading="loading" @change="emit('change')" />
      </template>

      <template v-else-if="node.type === 'source'">
        <u-textarea v-model="node.source" :rows="3" autoresize variant="subtle" class="min-w-80 flex-1 font-mono text-sm" :disabled="disabled" @update:model-value="emit('change')" />
      </template>
    </div>

    <div v-if="node.type === 'and' || node.type === 'or'" class="mt-3 space-y-2">
      <div v-for="(_, index) in node.children" :key="index" class="flex gap-2">
        <rbph-unlock-gate-block
          v-model="node.children[index]"
          class="min-w-0 flex-1"
          :puzzles="puzzles"
          :rounds="rounds"
          :puzzle-items="puzzleItems"
          :round-items="roundItems"
          :disabled="disabled"
          :loading="loading"
          :depth="(depth ?? 0) + 1"
          @change="emit('change')"
        />
        <u-button v-if="node.children.length > 1" icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="sm" :disabled="disabled" @click="removeChild(index)" />
      </div>
      <div class="flex justify-end">
        <u-button size="xs" variant="soft" icon="material-symbols:add-rounded" label="添加条件" :disabled="disabled" @click="addChild" />
      </div>
    </div>

    <div v-else-if="node.type === 'not'" class="mt-3">
      <rbph-unlock-gate-block v-model="node.child" :puzzles="puzzles" :rounds="rounds" :puzzle-items="puzzleItems" :round-items="roundItems" :disabled="disabled" :loading="loading" :depth="(depth ?? 0) + 1" @change="emit('change')" />
    </div>
  </div>
</template>
