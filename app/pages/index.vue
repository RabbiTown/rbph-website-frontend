<script setup lang="ts">
onMounted(() => {
  const sel_game = localStorage.getItem('rbph::select_game');
  if (sel_game) {
    navigateTo(`/games/${sel_game}`);
  } else {
    navigateTo('/transit');
  }
});
</script>

<template>
  <div></div>
</template>
