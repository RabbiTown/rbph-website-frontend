<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const route = useRoute();

const puzzle = usePuzzle().ref;
providePuzzleContext(puzzle);

const gameId = computed(() => route.params.id as string);
const puzzleRef = computed(() => route.params.puzzle as string);

watch(
  [gameId, puzzleRef],
  async ([newGameId, newPuzzleRef]) => {
    usePuzzle()
      .updateStateByGameRef(newGameId, newPuzzleRef)
      .catch(e => showError({ status: 400, statusText: e }));
  },
  { immediate: true },
);

useSync().listen(SyncMessageType.GameNewAnnouncement, ({ data }) => {
  const currentGameId = Number(gameId.value);
  if (data.game_id === null || data.game_id === currentGameId) {
    usePuzzle().updateStateByGameRef(gameId.value, puzzleRef.value);
  }
});
</script>

<template>
  <div>
    <rbph-puzzle-page />
  </div>
</template>
