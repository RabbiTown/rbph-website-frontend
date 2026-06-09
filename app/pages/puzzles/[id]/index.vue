<script setup lang="ts">
const puzzle = usePuzzle().ref;
const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: puzzle.value?.data.title }, { text: game.value?.title, sep: ' - ' }])),
});
</script>

<template>
  <rbph-puzzle-page page="puzzle" />
</template>
