<script setup lang="ts">
defineProps<{
  blocks: RbContentBlock[];
}>();
</script>

<template>
  <div class="space-y-6">
    <section v-for="block in blocks" :key="`${block.id}:${block.revision}`">
      <rbph-content :content="block" />
    </section>
  </div>
</template>
