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
  <u-button v-if="to" :to="to" variant="subtle" :color="solved ? 'success' : 'neutral'" class="py-2.5 rounded-sm w-full" :disabled="disabled" @click="emit('open', puzzle)">
    <div class="flex items-center">
      <u-icon :name="solved ? 'material-symbols:check-circle-outline' : 'material-symbols:circle-outline'" class="size-5 mx-2 mt-0.5" />
      <div class="text-lg">{{ puzzle.title }}</div>
    </div>
    <template v-if="showAnswer && puzzle.answer" #trailing>
      <div class="flex-1 flex justify-end text-[1.2em]">{{ puzzle.answer }}</div>
    </template>
  </u-button>
  <u-button v-else variant="subtle" :color="solved ? 'success' : 'neutral'" class="py-2.5 rounded-sm w-full" :disabled="disabled" @click="open">
    <div class="flex items-center">
      <u-icon :name="solved ? 'material-symbols:check-circle-outline' : 'material-symbols:circle-outline'" class="size-5 mx-2 mt-0.5" />
      <div class="text-lg">{{ puzzle.title }}</div>
    </div>
    <template v-if="showAnswer && puzzle.answer" #trailing>
      <div class="flex-1 flex justify-end text-[1.2em]">{{ puzzle.answer }}</div>
    </template>
  </u-button>
</template>
