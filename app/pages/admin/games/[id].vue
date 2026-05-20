<script setup lang="ts">
const game = useAdmin().useGame();

const route = useRoute();

const gameId = computed(() => route.params.id as string);

watch(
  [gameId, game.gameList],
  () => {
    const id = parseInt(gameId.value);
    if (isNaN(id)) game.upsert(undefined);
    game.selectById(id);
  },
  { immediate: true },
);
</script>

<template>
  <nuxt-page />
</template>
