<script setup lang="ts">
const isDesktop = useIsDesktop();
const { toasts } = useToast();
const viewport = shallowRef<HTMLElement | null>(null);
const reservedHeight = ref(0);
const route = useRoute();

useHead(() => ({
  htmlAttrs: { style: `--rb-toast-space: ${reservedHeight.value}px` },
}));

function updateHeight() {
  if (isDesktop.value || !toasts.value.length || !viewport.value) {
    reservedHeight.value = 0;
    return;
  }

  const rect = viewport.value.getBoundingClientRect();
  const bottom = Number.parseFloat(window.getComputedStyle(viewport.value).bottom);
  reservedHeight.value = Number.isFinite(bottom) ? Math.ceil(rect.height + bottom) : 0;
}

onMounted(async () => {
  await nextTick();
  viewport.value = document.querySelector<HTMLElement>('.rb-toast-viewport');
  updateHeight();
});

useResizeObserver(viewport, updateHeight);
useEventListener('resize', updateHeight);
watch([isDesktop, () => toasts.value.length], updateHeight, { flush: 'post' });
</script>

<template>
  <div v-if="route.meta.layout !== 'admin'" aria-hidden="true" class="pointer-events-none shrink-0" :style="{ height: `${reservedHeight}px` }" />
</template>
