<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

type Code = 'en' | 'zh-CN' | 'zh-TW' | 'ja';

const { locale, locales, setLocale, t } = useI18n();
const warningLocales = new Set(['ja']);
const warningOpen = ref(false);
const pendingLocale = ref<Code | ''>('');

const pendingLocaleName = computed(() => locales.value.find(item => item.code === pendingLocale.value)?.name ?? pendingLocale.value);
const warningTitle = computed(() => t('common.switchLanguageTitle', { language: pendingLocaleName.value }));
const targetWarning = computed(() => (pendingLocale.value ? t('common.aiTranslationWarning', {}, { locale: pendingLocale.value }) : ''));
const currentWarning = computed(() => t('common.aiTranslationWarning'));

async function selectLocale(code: Code) {
  if (code === locale.value) return;
  if (warningLocales.has(code)) {
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
  <u-dropdown-menu :items="items">
    <u-button color="neutral" variant="ghost" icon="material-symbols:translate-rounded" :aria-label="t('common.language')" />
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
