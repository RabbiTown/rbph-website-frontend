<script setup lang="ts">
const puzzle = usePuzzle().ref;
const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: puzzle.value?.data.title, end: ' @ ' }, { text: '人工提示' }, { text: game.value?.title, sep: ' - ' }])),
});
</script>

<template>
  <rbph-puzzle-page v-model="puzzle" page="tickets" />
</template>
