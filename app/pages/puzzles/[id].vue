<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const route = useRoute();

const puzzle = usePuzzle().ref;

const puzzle_id = computed(() => route.params.id as string);

watch(
  puzzle_id,
  async new_id => {
    updatePuzzleState(new_id);
  },
  { immediate: true }
);
</script>

<template>
  <div>
    <rbph-puzzle-page :data="puzzle" />
  </div>
</template>
