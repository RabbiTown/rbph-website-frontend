<script setup lang="ts">
const puzzle = usePuzzle().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: puzzle.value?.data.title }, { text: puzzle.value?.data.round.title, sep: ' - ' }])),
});
</script>

<template>
  <rbph-puzzle-page page="puzzle" />
</template>
