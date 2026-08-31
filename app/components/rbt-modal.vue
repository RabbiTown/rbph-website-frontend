<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false });
withDefaults(defineProps<{
  title?: string;
  description?: string;
  dismissible?: boolean;
  fullscreen?: boolean;
}>(), {
  title: undefined,
  description: undefined,
  dismissible: true,
  fullscreen: false,
});
const rbph = useRbtContext();
onBeforeUnmount(() => { open.value = false; });
</script>

<template>
  <u-modal
    v-model:open="open"
    :portal="rbph.ui?.overlayRoot ?? true"
    :title="title"
    :description="description"
    :dismissible="dismissible"
    :fullscreen="fullscreen"
  >
    <template #body><slot /></template>
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </u-modal>
</template>
