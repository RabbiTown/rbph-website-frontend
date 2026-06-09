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
  <nuxt-link :to="to">
    <u-button variant="subtle" :color="solved ? 'success' : 'neutral'" class="py-2.5 rounded-sm w-full" :to="to">
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
