<script setup lang="ts">
const route = useRoute();

const props = defineProps<{
  puzzleId?: string;
  gameId?: string;
  puzzleRef?: string;
}>();

const puzzle = usePuzzle().ref;
providePuzzleContext(puzzle);

const preview = computed(() => route.query.preview);
const source = computed(() => [props.puzzleId, props.gameId, props.puzzleRef] as const);

async function updateState() {
  if (props.puzzleId) {
    await usePuzzle().updateState(props.puzzleId);
  } else if (props.gameId && props.puzzleRef) {
    await usePuzzle().updateStateByGameRef(props.gameId, props.puzzleRef);
  } else {
    throw new Error('Invalid puzzle route');
  }
}

watch(
  [source, preview],
  async () => {
    updateState().catch(e => showError({ status: 400, statusText: String(e) }));
  },
  { immediate: true },
);

useSync().listen(SyncMessageType.GameNewAnnouncement, ({ data }) => {
  const currentGameId = puzzle.value?.data.game_id;
  if (data.game_id === null || data.game_id === currentGameId) {
    updateState().catch(e => showError({ status: 400, statusText: String(e) }));
  }
});
</script>

<template>
  <div>
    <rbph-puzzle-page />
  </div>
</template>
