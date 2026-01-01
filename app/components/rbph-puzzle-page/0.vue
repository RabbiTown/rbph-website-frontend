<script setup lang="ts">
const puzzle = defineModel<RbPuzzleShowData | undefined>();
</script>

<template>
  <div>
    {{ puzzle }}
  </div>
</template>
