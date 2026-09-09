<script setup lang="ts">
defineProps<{
  footerSplit?: boolean;
}>();
</script>

<template>
  <div class="flex min-h-dvh min-w-0 flex-col">
    <slot name="header" />
    <div class="flex min-w-0 flex-1 flex-col *:flex-1">
      <slot />
    </div>
    <rbph-footer :split="footerSplit" class="shrink-0 bg-default" />
  </div>
</template>
