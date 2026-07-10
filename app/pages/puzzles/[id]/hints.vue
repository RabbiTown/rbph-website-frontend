<script setup lang="ts">
const { t } = useI18n();
const puzzle = usePuzzle().ref;
const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: puzzle.value?.data.title, end: ' @ ' }, { text: t('pages.puzzlePage.hints') }, { text: game.value?.title, sep: ' - ' }])),
});
</script>

<template>
  <rbph-puzzle-page page="hints" />
</template>
