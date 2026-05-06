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
    usePuzzle()
      .updateState(new_id)
      .catch(e => showError({ status: 400, statusText: e }));
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <rbph-puzzle-page v-model="puzzle" />
  </div>
</template>
