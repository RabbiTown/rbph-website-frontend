<script setup lang="ts">
const { puzzle } = usePuzzleContext();

const currency = useCurrency().getAllCurrent();
</script>

<template>
  <div>
    <div v-if="Object.keys(currency).length > 0" class="mb-4">
      <rbph-currency-badges />
    </div>
    <div>
      <rbph-hints :puzzle-id="puzzle?.data.id" />
    </div>
  </div>
</template>
