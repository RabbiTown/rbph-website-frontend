<script setup lang="ts">
const props = defineProps<{
  puzzle: RbRoundInnerPuzzleData;
}>();

const solved = computed(() => props.puzzle.state == RbTeamPuzzleState.Solved);
</script>

<template>
  <nuxt-link :to="`/puzzles/${puzzle.id}`">
    <u-button variant="subtle" :color="solved ? 'success' : 'neutral'" class="py-2.5 rounded-sm w-full" :to="`/puzzles/${puzzle.id}`">
      <div class="flex items-center">
        <u-icon :name="solved ? 'material-symbols:check-circle-outline' : 'material-symbols:circle-outline'" class="size-5 mx-2 mt-0.5" />
        <div class="text-lg">
          {{ puzzle.title }}
        </div>
      </div>
      <template v-if="puzzle.answer" #trailing>
        <div class="flex-1 flex justify-end text-[1.2em]">
          {{ puzzle.answer }}
        </div>
      </template>
    </u-button>
  </nuxt-link>
</template>
