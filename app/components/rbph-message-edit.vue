<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';

const draft = defineModel<string>('draft');
const contentType = defineModel<RbContentType>('contentType', { default: RbContentType.UnsafeMarkdown });

const props = defineProps<{
  disabled?: boolean;
  loading?: boolean;
  contentTypes?: RbContentType[];
  placeholder?: string;
  canClose?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
  submitClose: [];
}>();

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

const allowedTypeItems = computed(() => typeItems.filter(item => props.contentTypes?.includes(item.value)));

watch(
  () => props.contentTypes,
  contentTypes => {
    if (contentTypes?.length && !contentTypes.includes(contentType.value)) {
      contentType.value = contentTypes[0]!;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <u-chat-prompt v-model="draft" class="text-sm" variant="subtle" :placeholder="placeholder" :ui="{ footer: 'text-muted mt-1 justify-end' }" :rows="3" :submit-on-enter="false" :loading="loading" @submit="emit('submit')">
      <!-- <u-chat-prompt-submit variant="soft" class="rounded-full cursor-pointer" :disabled="disabled" :loading="loading" /> -->
      <template #footer>
        <u-icon name="material-symbols:markdown-outline-rounded" />
        <span class="text-xs">支持 Markdown 语法</span>
      </template>
    </u-chat-prompt>
    <div class="flex mt-2 gap-2 justify-between">
      <div class="flex gap-2">
        <u-select v-if="allowedTypeItems.length > 1" v-model="contentType" :items="allowedTypeItems" variant="soft" size="sm" class="w-40" />
        <slot name="tool" />
      </div>
      <div class="flex gap-2">
        <slot name="action" />
        <u-button v-if="canClose" class="justify-center cursor-pointer" color="error" variant="subtle" :loading="loading" :disabled="disabled" icon="material-symbols:check-rounded" @click="emit('submitClose')">
          {{ draft && draft?.length > 0 ? '回复并关闭工单' : '关闭工单' }}
        </u-button>
        <u-button class="text-white min-w-20 justify-center cursor-pointer" :loading="loading" :disabled="disabled || !draft?.length" @click="emit('submit')">发送</u-button>
      </div>
    </div>
  </div>
</template>
