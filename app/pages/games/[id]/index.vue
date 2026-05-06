<script setup lang="ts">
definePageMeta({
  layout: 'game-full',
});

const game = useGame().ref;

useHead({
  titleTemplate: computed(() => game.value?.title ?? 'RBPH'),
});
</script>

<template>
  <u-main class="flex items-center justify-end bg-no-repeat bg-cover bg-center" :style="{ backgroundImage: `url(${game?.cover})` }">
    <div class="text-shadow-lg mr-48 mb-12">
      <div class="text-4xl font-bold">
        {{ game?.title }}
      </div>
    </div>
  </u-main>
</template>

<style lang="css" scoped></style>
