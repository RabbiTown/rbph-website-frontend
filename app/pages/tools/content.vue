<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui/runtime/components/Select.vue.js';

useHead({
  titleTemplate: '内容测试页 - RBPH',
});

const content = reactive<RbContent>({
  content: '',
  content_type: RbContentType.Markdown,
});

const typeItems = [
  {
    label: 'Markdown',
    value: RbContentType.Markdown,
    icon: 'material-symbols:markdown-outline-rounded',
  },
  {
    label: 'Html',
    value: RbContentType.Html,
    icon: 'material-symbols:code-blocks-outline-rounded',
  },
  {
    label: 'Markdown (Safe)',
    value: RbContentType.UnsafeMarkdown,
    icon: 'material-symbols:bookmark-check-outline-rounded',
  },
] satisfies SelectItem[];

const full = ref(false);
</script>

<template>
  <u-container class="h-screen flex flex-col">
    <div class="py-6">
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div class="text-3xl font-bold">内容测试页</div>
      </div>
    </div>
    <div class="flex flex-1 pb-6 gap-4">
      <div :class="['flex flex-1 flex-col gap-2 px-2.5 py-2', full && 'hidden']">
        <div>
          <u-select v-model="content.content_type" :items="typeItems" variant="soft" class="w-56" />
        </div>
        <u-textarea v-model="content.content" size="lg" variant="none" autoresize placeholder="Start writing..." class="flex-1 rounded-lg backdrop-blur bg-elevated/50 ring ring-default items-start code" />
      </div>

      <div class="flex flex-1 flex-col gap-2 px-2.5 py-2">
        <u-switch v-model="full" label="Full Screen" class="px-2.5 py-1.5 justify-end" />
        <u-card class="flex-1" variant="soft" :ui="{ body: 'py-4' }">
          <rbph-content :content="content" :debounce="500" />
        </u-card>
      </div>
    </div>
  </u-container>
</template>

<style scoped>
.code {
  font-family: 'Roboto Mono', monospace;
}
</style>
