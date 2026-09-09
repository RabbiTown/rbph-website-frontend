<script setup lang="ts">
const props = defineProps<{
  split?: boolean;
}>();

const footerUi = computed(() => props.split ? {
  left: 'w-full mt-0 justify-start lg:justify-start',
  center: 'hidden',
  right: 'hidden',
} : undefined);

const systemStatus = useSystemStatus();
onMounted(() => {
  void systemStatus.refresh().catch(() => undefined);
});

const footerAdditionalInfo = computed(() => systemStatus.ref.value?.footer_additional_info?.trim());
</script>

<template>
  <u-footer :ui="footerUi">
    <template #left>
      <div v-if="props.split" class="rbph-footer-content flex w-full min-w-0 items-center gap-4 break-words text-muted text-sm">
        <p class="min-w-0 flex-1" :class="footerAdditionalInfo ? 'text-left' : 'text-center'">rbph-website · Copyright © {{ new Date().getFullYear() }}</p>
        <rbph-content v-if="footerAdditionalInfo" class="min-w-0 flex-1 text-right" :content="{ content: footerAdditionalInfo, content_type: RbContentType.Markdown }" />
      </div>
      <div v-else class="rbph-footer-content min-w-0 break-words text-muted text-sm">
        <rbph-content v-if="footerAdditionalInfo" :content="{ content: footerAdditionalInfo, content_type: RbContentType.Markdown }" />
        <p>rbph-website · Copyright © {{ new Date().getFullYear() }}</p>
      </div>
    </template>
  </u-footer>
</template>

<style scoped>
.rbph-footer-content :deep(a) {
  color: var(--ui-text-muted);
  border-bottom: 0;
  text-decoration: none;
}

.rbph-footer-content :deep(a:hover) {
  color: var(--ui-primary);
}
</style>
