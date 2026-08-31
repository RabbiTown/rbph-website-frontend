<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const route = useRoute();

const puzzle = usePuzzle().ref;
providePuzzleContext(puzzle);

const puzzle_id = computed(() => route.params.id as string);
const preview = computed(() => route.query.preview);

watch(
  [puzzle_id, preview],
  async ([new_id]) => {
    usePuzzle()
      .updateState(new_id)
      .catch(e => showError({ status: 400, statusText: e }));
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <rbph-puzzle-page />
  </div>
</template>
