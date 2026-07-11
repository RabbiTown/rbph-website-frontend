<script setup lang="ts">const { t } = useI18n();


const props = defineProps<{
  blocks: RbContentBlock[];
}>();

const contentCache = new Map<string, string>();
const loaded = reactive<Record<string, string>>({});
const loading = reactive<Record<string, boolean>>({});
const failed = reactive<Record<string, boolean>>({});

function cacheKey(block: RbContentBlock) {
  return `${block.content_url ?? ''}:${block.revision}`;
}

function blockContent(block: RbContentBlock): RbContentBlock {
  if (!block.content_url) return block;
  const key = cacheKey(block);
  return { ...block, content: loaded[key] ?? '' };
}

async function loadBlock(block: RbContentBlock, force = false) {
  if (!block.content_url) return;
  const key = cacheKey(block);
  if (!force && loaded[key] !== undefined) return;
  if (!force && contentCache.has(key)) {
    loaded[key] = contentCache.get(key) ?? '';
    return;
  }
  if (loading[key]) return;
  loading[key] = true;
  failed[key] = false;
  try {
    const response = await fetch(block.content_url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    contentCache.set(key, content);
    loaded[key] = content;
  } catch {
    failed[key] = true;
  } finally {
    loading[key] = false;
  }
}

watch(
  () => props.blocks.map(block => [block.id, block.revision, block.content_url] as const),
  () => {
    for (const block of props.blocks) {
      loadBlock(block);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-6">
    <section v-for="block in blocks" :key="`${block.id}:${block.revision}`">
      <u-alert
        v-if="block.content_url && failed[cacheKey(block)]"
        color="error"
        variant="soft"
        icon="material-symbols:error-outline-rounded"
        :title="t('components.rbphContentBlocks.loadFailedTitle')"
        :description="t('components.rbphContentBlocks.loadFailedDescription')"
        :actions="[{ label: t('components.rbphContentBlocks.retry'), icon: 'material-symbols:refresh-rounded', color: 'error', variant: 'soft', onClick: () => loadBlock(block, true) }]"
      />
      <u-skeleton v-else-if="block.content_url && loaded[cacheKey(block)] === undefined" class="h-24 w-full" />
      <rbph-content v-else :content="blockContent(block)" />
    </section>
  </div>
</template>
