<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';

const { t } = useI18n();

const draft = defineModel<string>('draft');
const contentType = defineModel<RbContentType>('contentType', { default: RbContentType.UnsafeMarkdown });

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    loading?: boolean;
    contentTypes?: RbContentType[];
    placeholder?: string;
    canClose?: boolean;
    autofocus?: boolean;
  }>(),
  {
    contentTypes: undefined,
    placeholder: undefined,
    autofocus: true,
  },
);

const emit = defineEmits<{
  submit: [];
  submitClose: [];
}>();
const prompt = ref<{ textareaRef?: HTMLTextAreaElement }>();

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

defineExpose({
  focus: () => prompt.value?.textareaRef?.focus(),
});
</script>

<template>
  <div>
    <u-chat-prompt ref="prompt" v-model="draft" class="text-sm" variant="subtle" :placeholder="placeholder" :ui="{ footer: 'text-muted mt-1 justify-end' }" :rows="3" :submit-on-enter="false" :loading="loading" :autofocus="autofocus" @submit="emit('submit')">
      <!-- <u-chat-prompt-submit variant="soft" class="rounded-full cursor-pointer" :disabled="disabled" :loading="loading" /> -->
      <template #footer>
        <u-icon name="material-symbols:markdown-outline-rounded" />
        <span class="text-xs">{{ t('components.messageEdit.markdownHint') }}</span>
      </template>
    </u-chat-prompt>
    <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 flex-wrap gap-2">
        <u-select v-if="allowedTypeItems.length > 1" v-model="contentType" :items="allowedTypeItems" variant="soft" size="sm" class="w-40 max-w-full" />
        <slot name="tool" />
      </div>
      <div class="flex flex-wrap justify-end gap-2 self-end">
        <slot name="action" />
        <div class="flex shrink-0 gap-2">
          <u-button v-if="canClose" class="justify-center cursor-pointer" color="error" variant="subtle" :loading="loading" :disabled="disabled" icon="material-symbols:check-rounded" @click="emit('submitClose')">
            {{ draft && draft?.length > 0 ? t('components.messageEdit.closeWithReply') : t('components.messageEdit.closeTicket') }}
          </u-button>
          <u-button class="text-white min-w-20 justify-center cursor-pointer" :loading="loading" :disabled="disabled || !draft?.length" @click="emit('submit')">{{ t('components.messageEdit.send') }}</u-button>
        </div>
      </div>
    </div>
  </div>
</template>
