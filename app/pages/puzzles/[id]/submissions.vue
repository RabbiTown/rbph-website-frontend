<script setup lang="ts">
const puzzle = usePuzzle().ref;
const game = useGame().ref;

useHead({
  titleTemplate: computed(() => `${puzzle.value?.data.title} @ 提交记录 - ${game.value?.title}`),
});
</script>

<template>
  <rbph-puzzle-page :data="puzzle" page="submissions" />
</template>
