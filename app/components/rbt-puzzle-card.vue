<script setup lang="ts">
const props = withDefaults(defineProps<{
  puzzle: RbtPuzzleSummary;
  showAnswer?: boolean;
  disabled?: boolean;
}>(), {
  showAnswer: true,
  disabled: false,
});

const emit = defineEmits<{ open: [puzzle: RbtPuzzleSummary] }>();
const rbph = useRbtContext();
const solved = computed(() => rbtPuzzleSolved(props.puzzle.state));
const to = computed(() => rbph.routes.puzzle?.(props.puzzle));

async function open() {
  if (props.disabled) return;
  emit('open', props.puzzle);
  await rbph.actions.openPuzzle?.(props.puzzle);
}
</script>

<template>
  <u-button v-if="to" :to="to" variant="subtle" :color="solved ? 'success' : 'neutral'" class="w-full rounded-sm py-3" :disabled="disabled" @click="emit('open', puzzle)">
    <div class="flex h-6 items-center">
      <rbph-puzzle-progress-icon :solved="solved" :stats="puzzle.solve_stats" class="ml-1 mr-2" />
      <div class="text-lg leading-6">{{ puzzle.title }}</div>
    </div>
    <template v-if="showAnswer && puzzle.answer" #trailing>
      <div class="flex-1 flex justify-end text-[1.2em]">{{ puzzle.answer }}</div>
    </template>
  </u-button>
  <u-button v-else variant="subtle" :color="solved ? 'success' : 'neutral'" class="w-full rounded-sm py-3" :disabled="disabled" @click="open">
    <div class="flex h-6 items-center">
      <rbph-puzzle-progress-icon :solved="solved" :stats="puzzle.solve_stats" class="ml-1 mr-2" />
      <div class="text-lg leading-6">{{ puzzle.title }}</div>
    </div>
    <template v-if="showAnswer && puzzle.answer" #trailing>
      <div class="flex-1 flex justify-end text-[1.2em]">{{ puzzle.answer }}</div>
    </template>
  </u-button>
</template>
