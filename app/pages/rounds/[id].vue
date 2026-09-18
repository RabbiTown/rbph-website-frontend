<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const route = useRoute();
const path = computed(() => `/rounds/${encodeURIComponent(route.params.id as string)}`);
</script>

<template>
  <rbph-round-page :path="path" />
</template>
