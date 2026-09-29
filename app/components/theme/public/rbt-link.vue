<script setup lang="ts">
const props = withDefaults(defineProps<{
  to: string;
  external?: boolean;
  target?: string;
}>(), {
  external: false,
  target: undefined,
});
const rbph = useRbtContext();

async function navigate(event: MouseEvent) {
  if (props.external || props.target === '_blank' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  await rbph.actions.navigate?.(props.to);
}
</script>

<template>
  <a :href="to" :target="target" :rel="target === '_blank' ? 'noopener noreferrer' : undefined" @click="navigate"><slot /></a>
</template>
