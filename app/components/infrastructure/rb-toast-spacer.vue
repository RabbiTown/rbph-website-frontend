<script setup lang="ts">
const isDesktop = useIsDesktop();
const { toasts } = useToast();
const viewport = shallowRef<HTMLElement | null>(null);
const reservedHeight = ref(0);
const route = useRoute();
let heightFrame: number | undefined;

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

async function scheduleHeightUpdate() {
  await nextTick();
  if (heightFrame !== undefined) window.cancelAnimationFrame(heightFrame);
  heightFrame = window.requestAnimationFrame(() => {
    heightFrame = undefined;
    updateHeight();
  });
}

onMounted(async () => {
  await nextTick();
  viewport.value = document.querySelector<HTMLElement>('.rb-toast-viewport');
  updateHeight();
});

useResizeObserver(viewport, updateHeight);
useEventListener('resize', scheduleHeightUpdate);
watch([isDesktop, () => toasts.value.map(toast => `${toast.id}:${toast.open}`)], scheduleHeightUpdate, { flush: 'post' });

onBeforeUnmount(() => {
  if (heightFrame !== undefined) window.cancelAnimationFrame(heightFrame);
});
</script>

<template>
  <div v-if="route.meta.layout !== 'admin'" aria-hidden="true" class="pointer-events-none shrink-0" :style="{ height: `${reservedHeight}px` }" />
</template>
