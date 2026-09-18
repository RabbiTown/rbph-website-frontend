<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const route = useRoute();
const gameId = computed(() => route.params.id as string);
const puzzleRef = computed(() => route.params.puzzle as string);
</script>

<template>
  <rbph-puzzle-route-page :game-id="gameId" :puzzle-ref="puzzleRef" />
</template>
