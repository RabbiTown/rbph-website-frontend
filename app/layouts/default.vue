<script setup lang="ts">
const route = useRoute();
const isMaintenance = computed(() => route.path === '/maintenance');
</script>

<template>
  <rbph-page-shell footer-split :footer-inverted="isMaintenance" :class="{ 'bg-red-500': isMaintenance }">
    <slot />
  </rbph-page-shell>
</template>
