<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const route = useRoute();
const path = computed(() => {
  const gameId = Number(route.params.id);
  if (!Number.isInteger(gameId)) return '';
  return `/games/${gameId}/rounds/${encodeURIComponent(route.params.round as string)}`;
});
</script>

<template>
  <rbph-round-page :path="path" />
</template>
