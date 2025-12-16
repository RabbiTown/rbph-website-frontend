<script setup lang="ts">
const puzzle = await usePuzzle();
</script>

<template>
  <rbph-puzzle-page :data="puzzle" page="help" />
</template>
