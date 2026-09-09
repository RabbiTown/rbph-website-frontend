<script setup lang="ts">
const props = defineProps<{
  split?: boolean;
  inverted?: boolean;
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
  <u-footer :ui="footerUi" :class="{ 'rbph-footer-inverted': props.inverted }">
    <template #left>
      <div v-if="props.split" class="rbph-footer-content flex w-full min-w-0 flex-col items-center gap-2 sm:flex-row sm:gap-4 break-words text-muted text-sm">
        <p class="min-w-0 flex-1" :class="footerAdditionalInfo ? 'text-center sm:text-left' : 'text-center'">rbph-website · Copyright © {{ new Date().getFullYear() }}</p>
        <div v-if="footerAdditionalInfo" class="w-full min-w-0 flex-1 text-center sm:w-auto sm:text-right">
          <rbph-content :content="{ content: footerAdditionalInfo, content_type: RbContentType.Markdown }">
            <template #loading>
              <u-skeleton class="mx-auto h-5 w-40 max-w-full sm:mr-0" />
            </template>
          </rbph-content>
        </div>
      </div>
      <div v-else class="rbph-footer-content flex min-w-0 flex-col gap-2 break-words text-center text-muted text-sm sm:gap-0 sm:text-left">
        <div v-if="footerAdditionalInfo" class="order-2 min-w-0 sm:order-none">
          <rbph-content :content="{ content: footerAdditionalInfo, content_type: RbContentType.Markdown }">
            <template #loading>
              <u-skeleton class="mx-auto h-5 w-40 max-w-full sm:ml-0" />
            </template>
          </rbph-content>
        </div>
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

.rbph-footer-inverted {
  --ui-text-muted: rgb(255 255 255 / 0.8);
  --ui-text: rgb(255 255 255 / 0.9);
  --ui-text-highlighted: white;
  --ui-primary: white;
}
</style>
