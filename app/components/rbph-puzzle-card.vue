<script setup lang="ts">
const props = defineProps<{
  puzzle: RbRoundInnerPuzzleData;
  gameId?: number;
}>();

const solved = computed(() => props.puzzle.state == RbTeamPuzzleState.Solved);
const game = useGame().ref;
const to = computed(() => gamePuzzleSimpleRoute(props.gameId ?? game.value?.id, props.puzzle));
</script>

<template>
  <u-button variant="subtle" :color="solved ? 'success' : 'neutral'" class="w-full rounded-sm py-3" :to="to">
    <div class="flex h-6 items-center">
      <rbph-puzzle-progress-icon :solved="solved" :stats="puzzle.solve_stats" class="ml-1 mr-2" />
      <div class="text-lg leading-6">
        {{ puzzle.title }}
      </div>
    </div>
    <template v-if="puzzle.answer" #trailing>
      <div class="flex-1 flex justify-end text-[1.2em]">
        {{ puzzle.answer }}
      </div>
    </template>
  </u-button>
</template>
