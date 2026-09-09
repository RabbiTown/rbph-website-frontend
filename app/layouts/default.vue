<script setup lang="ts">
const route = useRoute();
const isAdmin = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'));
</script>

<template>
  <div v-if="isAdmin">
    <slot />
  </div>
  <rbph-page-shell v-else footer-split>
    <slot />
  </rbph-page-shell>
</template>
