<script setup lang="ts">
const puzzle = usePuzzle().ref;
const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: puzzle.value?.data.title, end: ' @ ' }, { text: '提示' }, { text: game.value?.title, sep: ' - ' }])),
});
</script>

<template>
  <rbph-puzzle-page v-model="puzzle" page="hints" />
</template>
