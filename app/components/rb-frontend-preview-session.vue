<script setup lang="ts">
const route = useRoute();
const { t } = useI18n();
const exiting = useState('frontend-preview-exiting', () => false);

const preview = computed(() => {
  const raw = Array.isArray(route.query.preview) ? route.query.preview[0] : route.query.preview;
  if (typeof raw !== 'string') return;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : undefined;
});
const visible = computed(() => preview.value !== undefined && (route.meta.layout === 'game' || route.meta.layout === 'game-full'));

async function exitPreview() {
  const query = { ...route.query };
  delete query.preview;
  exiting.value = true;
  try {
    await navigateTo({ path: route.path, query, hash: route.hash }, { replace: true });
  } finally {
    exiting.value = false;
  }
}
</script>

<template>
  <div v-if="visible" class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
    <div class="flex max-w-full items-center gap-2 rounded-full bg-default px-3 py-2 shadow-lg ring ring-default pointer-events-auto">
      <u-icon name="material-symbols:preview-outline-rounded" class="size-5 shrink-0 text-primary" />
      <span class="truncate text-sm font-medium text-highlighted">{{ t('components.previewSession.active') }}</span>
      <u-button size="xs" color="neutral" variant="soft" icon="material-symbols:close-rounded" :label="t('components.previewSession.exit')" @click="exitPreview" />
    </div>
  </div>
</template>
