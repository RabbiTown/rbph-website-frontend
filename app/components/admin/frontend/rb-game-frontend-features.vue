<script setup lang="ts">
import { getIconData } from '@iconify/utils';
import { addIcon, getIcon } from '@iconify/vue';
import type { IconifyJSON } from '@iconify/types';
import type { Composer } from 'vue-i18n';

type LocaleMessages = Record<string, unknown>;
type FeatureSource = RbFrontendFeaturePackage;
type LoadedSource = FeatureSource & { manifest: RbThemeManifest };
type LocaleSource = { type: 'inline'; messages: LocaleMessages } | { type: 'json'; source: string } | { type: 'module'; source: string; development: boolean; hotMessages?: LocaleMessages };
type FeatureBundle = {
  iconOverrides: Record<string, string>;
  localeSources: Map<string, LocaleSource[]>;
  localeMessages: Map<string, Promise<LocaleMessages>>;
};

// Keep requests for the lifetime of this document. Published theme changes are deliberately
// picked up only by a full reload.
const bundles = new Map<string, Promise<FeatureBundle>>();

const game = useGame();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();
const i18n = useI18n() as Composer;
const frontendFeatures = useGameFrontendFeatures();
const themeDev = useThemeDev();
const originalMessages = new Map<string, LocaleMessages>();
let activeKey: string | undefined;
let activeBundle: FeatureBundle | undefined;
let activationId = 0;
let lastUpdateNotice: string | undefined;

function copy<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copy) as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = copy(item);
  return result as T;
}

function isMessageObject(value: unknown): value is LocaleMessages {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeMessages(base: LocaleMessages, overrides: LocaleMessages) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    result[key] = isMessageObject(value) && isMessageObject(result[key]) ? mergeMessages(result[key], value) : value;
  }
  return result;
}

function resolveUrl(path: string, manifestUrl: string) {
  return new URL(path, new URL(manifestUrl, window.location.href)).href;
}

function registerIcons(collection: IconifyJSON, replace = false) {
  for (const name of [...Object.keys(collection.icons), ...Object.keys(collection.aliases ?? {})]) {
    const fullName = `${collection.prefix}:${name}`;
    if (!replace && getIcon(fullName)) continue;
    const icon = getIconData(collection, name);
    if (icon) addIcon(fullName, icon);
  }
}

async function loadBundle(gameId: number, plan: RbThemeDevFeaturePlan) {
  const featureKey = plan.developmentFeatures.join(',');
  const key = `${gameId}:${plan.base}:${plan.previewRevision ?? 'published'}:${plan.developmentManifestUrl ?? 'no-dev-theme'}:${plan.developmentPackageName ?? 'no-dev-package'}:${featureKey}`;
  let request = bundles.get(key);
  if (request) return { key, bundle: await request };

  request = (async () => {
    const response = plan.base === 'none' ? { packages: [] } : await fetchFrontendFeaturesResponse(gameId, plan.base === 'draft' ? plan.previewRevision : undefined);
    const loadedBaseSources: LoadedSource[] = await Promise.all([...response.packages].sort((a, b) => a.packageId - b.packageId).map(async source => ({ ...source, manifest: await fetchThemeManifest(source.manifestUrl) })));
    const loadedSources = plan.developmentPackageName ? loadedBaseSources.filter(source => source.manifest.package.name !== plan.developmentPackageName) : loadedBaseSources;
    if (plan.developmentManifestUrl && plan.developmentFeatures.length) {
      loadedSources.push({
        packageId: Number.MAX_SAFE_INTEGER,
        manifestUrl: plan.developmentManifestUrl,
        features: plan.developmentFeatures,
        manifest: await fetchThemeManifest(plan.developmentManifestUrl),
      });
    }
    const bundle: FeatureBundle = {
      iconOverrides: {},
      localeSources: new Map(),
      localeMessages: new Map(),
    };

    for (const source of loadedSources) {
      const { manifest } = source;
      if (manifest.type !== 'rbph-theme' || manifest.apiVersion !== 1) continue;
      if (source.features.includes(RbFrontendFeature.Locale) && manifest.features?.locale) {
        for (const [locale, entry] of Object.entries(manifest.features.locale.locales)) {
          const sources = bundle.localeSources.get(locale) ?? [];
          sources.push(
            entry.type === 'inline'
              ? { type: 'inline', messages: entry.messages }
              : entry.type === 'json'
                ? { type: 'json', source: resolveUrl(entry.source, source.manifestUrl) }
                : { type: 'module', source: resolveUrl(entry.source, source.manifestUrl), development: source.packageId === Number.MAX_SAFE_INTEGER },
          );
          bundle.localeSources.set(locale, sources);
        }
      }
      if (source.features.includes(RbFrontendFeature.Icons) && manifest.features?.icons) {
        const isDevelopmentSource = source.packageId === Number.MAX_SAFE_INTEGER;
        for (const collection of manifest.features.icons.collections) {
          registerIcons(typeof collection === 'string' ? await fetchThemeJson<IconifyJSON>(resolveUrl(collection, source.manifestUrl)) : collection, isDevelopmentSource);
        }
      }
      if (source.features.includes(RbFrontendFeature.Ui) && manifest.features?.ui) {
        const ui = manifest.features.ui;
        Object.assign(bundle.iconOverrides, 'source' in ui ? (await fetchThemeJson<{ icons: Record<string, string> }>(resolveUrl(ui.source, source.manifestUrl))).icons : ui.icons);
      }
    }
    return bundle;
  })();
  bundles.set(key, request);
  return { key, bundle: await request };
}

function restoreMessages() {
  for (const [locale, messages] of originalMessages) i18n.setLocaleMessage(locale, copy(messages));
  originalMessages.clear();
}

async function localeMessages(bundle: FeatureBundle, locale: string) {
  let request = bundle.localeMessages.get(locale);
  if (!request) {
    request = (async () => {
      let messages: LocaleMessages = {};
      for (const source of bundle.localeSources.get(locale) ?? []) {
        let loaded: unknown;
        if (source.type === 'inline') loaded = source.messages;
        else if (source.type === 'json') loaded = await fetchThemeJson<LocaleMessages>(source.source);
        else if (source.hotMessages) loaded = source.hotMessages;
        else loaded = (await import(/* @vite-ignore */ source.source)).default;
        if (!isMessageObject(loaded)) throw new TypeError(`Theme locale ${locale} did not export a message object`);
        messages = mergeMessages(messages, loaded);
      }
      return messages;
    })();
    bundle.localeMessages.set(locale, request);
  }
  return request;
}

async function applyLocale(bundle: FeatureBundle, locale: string, id: number) {
  if (!bundle.localeSources.has(locale)) return;
  const messages = await localeMessages(bundle, locale);
  if (id !== activationId || bundle !== activeBundle) return;
  const original = originalMessages.get(locale);
  if (original) i18n.setLocaleMessage(locale, copy(original));
  else originalMessages.set(locale, copy(i18n.getLocaleMessage(locale) as LocaleMessages));
  i18n.mergeLocaleMessage(locale, copy(messages));
}

function handleLocaleUpdate(event: Event) {
  if (!(event instanceof CustomEvent) || !activeBundle) return;
  const detail = event.detail as { locale?: unknown; messages?: unknown };
  if (typeof detail.locale !== 'string' || !isMessageObject(detail.messages)) return;
  const sources = activeBundle.localeSources.get(detail.locale);
  const developmentSource = sources?.find(source => source.type === 'module' && source.development);
  if (!developmentSource || developmentSource.type !== 'module') return;
  developmentSource.hotMessages = detail.messages;
  activeBundle.localeMessages.delete(detail.locale);
  if (detail.locale === i18n.locale.value) {
    void applyLocale(activeBundle, detail.locale, activationId).catch(error => console.error('[RBPH theme locale HMR]', error));
  }
}

onMounted(() => window.addEventListener('rbph-theme-locale-update-v1', handleLocaleUpdate));
onBeforeUnmount(() => window.removeEventListener('rbph-theme-locale-update-v1', handleLocaleUpdate));

function isPlayerLayout() {
  return route.meta.layout === 'game' || route.meta.layout === 'game-full';
}

async function activate() {
  if (!import.meta.client) return;
  const gameId = game.ref.value?.id;
  if (!gameId || !isPlayerLayout()) {
    if (activeKey) {
      activationId++;
      activeKey = undefined;
      activeBundle = undefined;
      restoreMessages();
      frontendFeatures.replaceIconOverrides({});
    }
    return;
  }
  const previewValue = typeof route.query.preview === 'string' ? Number(route.query.preview) : undefined;
  const previewRevision = Number.isFinite(previewValue) ? previewValue : undefined;
  const plan: RbThemeDevFeaturePlan = previewRevision ? { base: 'draft', previewRevision, developmentFeatures: [] } : themeDev.enabled.value ? themeDev.featurePlan.value : { base: 'published', developmentFeatures: [] };
  const nextKey = `${gameId}:${plan.base}:${plan.previewRevision ?? 'published'}:${plan.developmentManifestUrl ?? 'no-dev-theme'}:${plan.developmentPackageName ?? 'no-dev-package'}:${plan.developmentFeatures.join(',')}`;
  if (nextKey === activeKey) return;

  const id = ++activationId;
  restoreMessages();
  frontendFeatures.replaceIconOverrides({});
  activeKey = nextKey;
  activeBundle = undefined;
  try {
    const loaded = await loadBundle(gameId, plan);
    if (id !== activationId || loaded.key !== activeKey) return;
    activeBundle = loaded.bundle;
    frontendFeatures.replaceIconOverrides({ ...loaded.bundle.iconOverrides });
    await applyLocale(loaded.bundle, i18n.locale.value, id);
  } catch (error) {
    if (id === activationId) console.error('[RBPH theme features]', error);
  }
}

watch(
  () => [
    game.ref.value?.id,
    route.meta.layout,
    route.query.preview,
    themeDev.enabled.value,
    themeDev.featurePlan.value.base,
    themeDev.featurePlan.value.previewRevision,
    themeDev.featurePlan.value.developmentManifestUrl,
    themeDev.featurePlan.value.developmentPackageName,
    themeDev.featurePlan.value.developmentFeatures.join(','),
  ],
  activate,
  { immediate: true },
);
watch(
  () => i18n.locale.value,
  async locale => {
    await nextTick();
    if (activeBundle) await applyLocale(activeBundle, locale, activationId);
  },
);
useSync().listen(SyncMessageType.GameFrontendUpdated, ({ data }) => {
  if (!isPlayerLayout() || data.game_id !== game.ref.value?.id) return;
  const noticeKey = `${data.game_id}:${data.revision}`;
  if (noticeKey === lastUpdateNotice) return;
  lastUpdateNotice = noticeKey;
  toast.add({
    title: t('globalSync.frontendTheme.updated'),
    description: t('globalSync.frontendTheme.reloadDescription'),
    icon: 'material-symbols:system-update-alt-rounded',
    color: 'primary',
    duration: Infinity,
    actions: [
      {
        label: t('globalSync.frontendTheme.reload'),
        icon: 'material-symbols:refresh-rounded',
        onClick: () => window.location.reload(),
      },
    ],
  });
});
onBeforeUnmount(() => {
  activationId++;
  restoreMessages();
  frontendFeatures.replaceIconOverrides({});
});
</script>

<template><span hidden /></template>
