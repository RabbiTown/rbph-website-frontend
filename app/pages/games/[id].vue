<script setup lang="ts">
const route = useRoute();

const game_id = computed(() => route.params.id as string);

watch(
  game_id,
  async new_id => {
    updateGameState(new_id).catch(e => showError(e));
  },
  { immediate: true }
);
</script>

<template>
  <NuxtPage />
</template>
