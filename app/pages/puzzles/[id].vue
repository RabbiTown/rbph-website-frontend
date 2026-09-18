<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const route = useRoute();
const puzzleId = computed(() => route.params.id as string);
</script>

<template>
  <rbph-puzzle-route-page :puzzle-id="puzzleId" />
</template>
