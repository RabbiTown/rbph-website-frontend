<script setup lang="ts">
const props = defineProps<{ blocks: RbtContentBlock[] }>();
const rbph = useRbtContext();
const host = useTemplateRef<HTMLElement>('host');
let cleanup: (() => void) | undefined;

function renderContent() {
  cleanup?.();
  cleanup = host.value ? rbph.content.mount(host.value, props.blocks) : undefined;
}

watch(() => props.blocks, renderContent, { deep: true, flush: 'post' });
onMounted(renderContent);
onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <div ref="host" />
</template>
