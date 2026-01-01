<script setup lang="ts">
const puzzle = usePuzzle().ref;
const game = useGame().ref;

useHead({
  titleTemplate: computed(() => `${puzzle.value?.data.title} - ${game.value?.title}`),
});
</script>

<template>
  <rbph-puzzle-page v-model="puzzle" page="puzzle" />
</template>
