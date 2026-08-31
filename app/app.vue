<template>
  <div :class="localeClass">
    <UApp :locale="uiLocale">
      <rb-game-frontend-features />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <rb-sync-status />
      <rb-frontend-preview-session />
      <lazy-rb-theme-dev-tools v-if="themeDevEnabled" />
    </UApp>
  </div>
</template>

<script setup lang="ts">
import { en, ja, zh_cn, zh_tw } from '@nuxt/ui/locale';

const { locale } = useI18n();
const themeDevEnabled = import.meta.dev && Boolean(useRuntimeConfig().public.themeDevServer);
const localeClass = computed(() => {
  if (locale.value === 'zh-CN') return 'lang-zh-cn';
  if (locale.value === 'zh-TW') return 'lang-zh-tw';
  if (locale.value === 'ja') return 'lang-ja';
  return 'lang-en';
});
const uiLocale = computed(() => {
  if (locale.value === 'en') return en;
  if (locale.value === 'ja') return ja;
  if (locale.value === 'zh-TW') return zh_tw;
  return zh_cn;
});

useHead(() => ({
  htmlAttrs: { class: localeClass.value },
  bodyAttrs: { class: localeClass.value },
}));
</script>
