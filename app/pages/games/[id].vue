<script setup lang="ts">
const route = useRoute();

const gameId = computed(() => route.params.id as string);

watch(
  gameId,
  async newId => {
    updateGameState(newId).catch(e => showError({ status: 400, statusText: e }));
  },
  { immediate: true },
);
</script>

<template>
  <NuxtPage />
</template>
