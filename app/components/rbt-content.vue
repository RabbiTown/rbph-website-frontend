<script setup lang="ts">
const props = defineProps<{ block: RbtContentBlock }>();
const rbph = useRbtContext();
const host = useTemplateRef<HTMLElement>('host');
let cleanup: (() => void) | undefined;

function renderContent() {
  cleanup?.();
  cleanup = host.value ? rbph.content.mount(host.value, [props.block]) : undefined;
}

watch(() => props.block, renderContent, { deep: true, flush: 'post' });
onMounted(renderContent);
onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <div ref="host" />
</template>
