<script setup lang="ts">
defineProps<{
  data: RbPuzzleShowData;
}>();
</script>

<template>
  <div>
    <rbph-submissions ref="ok-submissions" :puzzle-id="data.data.id" />
  </div>
</template>
