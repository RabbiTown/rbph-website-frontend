<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

type Code = 'en' | 'zh-CN' | 'zh-TW' | 'ja';

const props = defineProps<{
  sidebar?: boolean;
  collapsed?: boolean;
}>();

const { locale, locales, setLocale, t } = useI18n();
const targetWarnings: Partial<Record<Code, string>> = {
  ja: 'この言語はAIによって翻訳されているため、内容が正確でない可能性があります。',
};
const warningOpen = ref(false);
const pendingLocale = ref<Code | ''>('');

const pendingLocaleName = computed(() => locales.value.find(item => item.code === pendingLocale.value)?.name ?? pendingLocale.value);
const currentLocaleName = computed(() => locales.value.find(item => item.code === locale.value)?.name ?? locale.value);
const warningTitle = computed(() => t('common.switchLanguageTitle', { language: pendingLocaleName.value }));
const targetWarning = computed(() => (pendingLocale.value ? (targetWarnings[pendingLocale.value] ?? '') : ''));
const currentWarning = computed(() => t('common.aiTranslationWarning'));

async function selectLocale(code: Code) {
  if (code === locale.value) return;
  if (targetWarnings[code]) {
    pendingLocale.value = code;
    warningOpen.value = true;
    return;
  }
  await setLocale(code);
}

async function confirmLocale() {
  const code = pendingLocale.value;
  warningOpen.value = false;
  pendingLocale.value = '';
  if (code) await setLocale(code);
}

const items = computed<DropdownMenuItem[][]>(() => [
  locales.value.map(item => ({
    label: item.name ?? item.code,
    icon: locale.value === item.code ? 'material-symbols:check-rounded' : 'material-symbols:translate-rounded',
    active: locale.value === item.code,
    onSelect: () => selectLocale(item.code),
  })),
]);
</script>

<template>
  <u-dropdown-menu :items="items" :ui="props.sidebar ? { content: props.collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' } : undefined">
    <button
      v-if="props.sidebar"
      type="button"
      :aria-label="t('common.language')"
      :class="[
        'group relative flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 text-sm font-medium text-muted transition-colors hover:bg-elevated/50 hover:text-highlighted data-[state=open]:bg-elevated',
        props.collapsed ? 'justify-center px-1.5' : 'px-2.5',
      ]"
    >
      <u-icon name="material-symbols:translate-rounded" class="size-5 shrink-0 text-dimmed transition-colors group-hover:text-default" />
      <template v-if="!props.collapsed">
        <span class="min-w-0 flex-1 truncate text-left">{{ t('common.language') }}</span>
        <span class="ms-auto inline-flex shrink-0 items-center gap-1.5 leading-5 text-muted mt-0.5">
          <span class="truncate text-xs">{{ currentLocaleName }}</span>
          <u-icon name="material-symbols:expand-more-rounded" class="block size-5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </template>
    </button>
    <u-button v-else color="neutral" variant="ghost" icon="material-symbols:translate-rounded" :aria-label="t('common.language')" />
  </u-dropdown-menu>
  <rb-confirm-modal v-model:open="warningOpen" :title="warningTitle" :confirm-label="t('common.switchLanguageConfirm')" confirm-color="warning" confirm-icon="material-symbols:translate-rounded" @confirm="confirmLocale">
    <template #body>
      <div class="space-y-3">
        <p>{{ targetWarning }}</p>
        <template v-if="locale !== pendingLocale">
          <u-separator />
          <p class="text-muted">{{ currentWarning }}</p>
        </template>
      </div>
    </template>
  </rb-confirm-modal>
</template>
