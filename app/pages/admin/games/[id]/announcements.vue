<script setup lang="ts">
const route = useRoute();
const gameId = computed(() => Number(route.params.id));
</script>

<template>
  <rbph-announcement-manager :game-id="gameId" />
</template>
