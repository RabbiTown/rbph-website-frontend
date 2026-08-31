<script setup lang="ts">
type FrontendPackage = {
  id: number;
  name: string;
  version: string;
  delete_pending: boolean;
  manifest: RbThemeManifest;
};
type FrontendRevision = { id: number; revision: number; status: 'draft' | 'published'; published_at?: string };
type FrontendBinding = { revision_id: number; surface: RbFrontendSurface; scope_kind: 'game' | 'round' | 'puzzle'; scope_id: number; package_id?: number | null; renderer_id?: string | null };
type FrontendFeatureActivation = { revision_id: number; package_id: number; feature: RbFrontendFeature };
type PageTitle = { id: number; title: string };
enum GamePageTitlesResult {
  NotFound = -1,
  Ok = 0,
}
type FrontendState = {
  packages: FrontendPackage[];
  revisions: FrontendRevision[];
  draft: FrontendRevision;
  bindings: FrontendBinding[];
  published_bindings: FrontendBinding[];
  feature_activations: FrontendFeatureActivation[];
};
type FrontendConfigBinding = { surface: RbFrontendSurface; scopeKind: 'game' | 'round' | 'puzzle'; scopeId: number; packageName: string | null; rendererId: string | null };
type FrontendConfig = {
  formatVersion: number;
  bindings: FrontendConfigBinding[];
  features: Array<{ packageName: string; features: RbFrontendFeature[] }>;
};

const api = useApi();
const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const dirtyToast = useDirtyToast();
const gameId = computed(() => Number(route.params.id));
const state = ref<FrontendState>();
const loading = ref(false);
const uploading = ref(false);
const publishing = ref(false);
const configSaving = ref(false);
const packageUpdating = ref<number>();
const themeFile = ref<File | null>(null);
const configFile = ref<File | null>(null);
const configImportOpen = ref(false);
const configUploading = ref(false);
const missingPackages = ref<string[]>([]);
const missingPackagesOpen = ref(false);
const roundTitles = ref<Map<number, string>>();
const puzzleTitles = ref<Map<number, string>>();
const pageTitlesGameId = ref<number>();
const originalConfig = ref<FrontendConfig>();
const workingConfig = ref<FrontendConfig>();
const removedBindingKeys = ref<Set<string>>(new Set());
const defaultSurfaces: RbFrontendSurface[] = ['round-page', 'puzzle-page'];
const publishedRevision = computed(() => state.value?.revisions.find(item => item.status === 'published'));
const configurationDirty = computed(() => Boolean(originalConfig.value && workingConfig.value && configSnapshot(serializedConfig()) !== configSnapshot(originalConfig.value)));
const busy = computed(() => uploading.value || configUploading.value || configSaving.value || publishing.value || packageUpdating.value !== undefined);
const errorHints = (keys: Record<number, string>) => localizeRbErrorHints(keys, key => t(key));

const featureMeta = [
  { value: RbFrontendFeature.Locale, key: 'locale' as const, labelKey: 'admin.frontend.features.locale', descriptionKey: 'admin.frontend.features.localeDescription' },
  { value: RbFrontendFeature.Icons, key: 'icons' as const, labelKey: 'admin.frontend.features.icons', descriptionKey: 'admin.frontend.features.iconsDescription' },
  { value: RbFrontendFeature.Ui, key: 'ui' as const, labelKey: 'admin.frontend.features.ui', descriptionKey: 'admin.frontend.features.uiDescription' },
];

const surfaceMeta: Record<RbFrontendSurface, { labelKey: string; icon: string }> = {
  'round-page': { labelKey: 'admin.frontend.common.roundPage', icon: 'material-symbols:grid-view-outline-rounded' },
  'puzzle-page': { labelKey: 'admin.frontend.common.puzzlePage', icon: 'material-symbols:extension-outline-rounded' },
};
function publishedBindingTarget(binding: FrontendConfigBinding) {
  const published = state.value?.published_bindings.find(item => item.surface === binding.surface && item.scope_kind === binding.scopeKind && item.scope_id === binding.scopeId);
  if (!published) return binding.scopeKind === 'game' ? 'builtin' : 'inherit';
  if (!published.package_id || !published.renderer_id) return 'builtin';
  const publishedPackage = state.value?.packages.find(item => item.id === published.package_id);
  const packageItem = state.value?.packages.find(item => item.name === publishedPackage?.name && !item.delete_pending) ?? publishedPackage;
  return packageItem ? `${packageItem.id}:${published.renderer_id}` : undefined;
}

function bindingItems(binding: FrontendConfigBinding) {
  const publishedTarget = publishedBindingTarget(binding);
  return [
    ...(binding.scopeKind !== 'game' ? [{ label: t('admin.frontend.common.inheritParent'), value: 'inherit', icon: 'material-symbols:account-tree-outline-rounded', published: publishedTarget === 'inherit' }] : []),
    { label: t('admin.frontend.common.builtinPage'), value: 'builtin', icon: 'material-symbols:web-asset', published: publishedTarget === 'builtin' },
    ...(state.value?.packages ?? []).flatMap(item =>
      Object.entries(item.manifest.features?.renderers ?? {})
        .filter(([, renderer]) => renderer.surface === binding.surface)
        .map(([rendererId]) => ({
          label: t('admin.frontend.common.rendererFromPackage', { renderer: rendererId, package: item.name }),
          value: `${item.id}:${rendererId}`,
          icon: 'material-symbols:deployed-code-outline',
          disabled: item.delete_pending,
          published: publishedTarget === `${item.id}:${rendererId}`,
        })),
    ),
  ];
}

function bindingKey(binding: Pick<FrontendConfigBinding, 'surface' | 'scopeKind' | 'scopeId'>) {
  return `${binding.surface}:${binding.scopeKind}:${binding.scopeId}`;
}

function cloneConfig(config: FrontendConfig): FrontendConfig {
  return JSON.parse(JSON.stringify(config)) as FrontendConfig;
}

function normalizeConfig(config: FrontendConfig) {
  const normalized = cloneConfig(config);
  normalized.formatVersion = 1;
  for (const surface of defaultSurfaces) {
    if (!normalized.bindings.some(binding => binding.surface === surface && binding.scopeKind === 'game' && binding.scopeId === 0)) {
      normalized.bindings.push({ surface, scopeKind: 'game', scopeId: 0, packageName: null, rendererId: null });
    }
  }
  return normalized;
}

function serializedConfig(): FrontendConfig {
  const config = workingConfig.value ? cloneConfig(workingConfig.value) : { formatVersion: 1, bindings: [], features: [] };
  config.bindings = config.bindings.filter(binding => !removedBindingKeys.value.has(bindingKey(binding)));
  return config;
}

function configSnapshot(config: FrontendConfig) {
  const normalized = cloneConfig(config);
  normalized.bindings.sort((left, right) => bindingKey(left).localeCompare(bindingKey(right)));
  normalized.features = normalized.features
    .map(item => ({ ...item, features: [...item.features].sort((left, right) => left - right) }))
    .filter(item => item.features.length)
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
  return JSON.stringify(normalized);
}

function setWorkingConfig(config: FrontendConfig, retainRemovedOriginals = false) {
  const next = normalizeConfig(config);
  const removed = new Set<string>();
  if (retainRemovedOriginals && originalConfig.value) {
    const nextKeys = new Set(next.bindings.map(bindingKey));
    for (const binding of originalConfig.value.bindings) {
      const key = bindingKey(binding);
      if (binding.scopeKind !== 'game' && !nextKeys.has(key)) {
        next.bindings.push({ ...binding });
        removed.add(key);
      }
    }
  }
  workingConfig.value = next;
  removedBindingKeys.value = removed;
}

function syncConfig(config: FrontendConfig) {
  const normalized = normalizeConfig(config);
  originalConfig.value = cloneConfig(normalized);
  setWorkingConfig(normalized);
}

function rendererSelection(key?: string) {
  if (!key) return {};
  const separator = key.indexOf(':');
  if (separator < 1) return {};
  return { packageId: Number(key.slice(0, separator)), rendererId: key.slice(separator + 1) };
}

function bindingTarget(binding: FrontendConfigBinding) {
  if (removedBindingKeys.value.has(bindingKey(binding))) return 'inherit';
  if (!binding.packageName || !binding.rendererId) return 'builtin';
  const pkg = state.value?.packages.find(item => item.name === binding.packageName && !item.delete_pending) ?? state.value?.packages.find(item => item.name === binding.packageName);
  return pkg ? `${pkg.id}:${binding.rendererId}` : 'builtin';
}

function updateBinding(binding: FrontendConfigBinding, target: string) {
  const key = bindingKey(binding);
  const removed = new Set(removedBindingKeys.value);
  if (target === 'inherit' && binding.scopeKind !== 'game') {
    removed.add(key);
    removedBindingKeys.value = removed;
    return;
  }
  removed.delete(key);
  removedBindingKeys.value = removed;
  if (target === 'builtin') {
    binding.packageName = null;
    binding.rendererId = null;
    return;
  }
  const selection = rendererSelection(target);
  const pkg = state.value?.packages.find(item => item.id === selection.packageId);
  if (!pkg || !selection.rendererId) return;
  binding.packageName = pkg.name;
  binding.rendererId = selection.rendererId;
}

const defaultConfigBindings = computed(() => defaultSurfaces.flatMap(surface => workingConfig.value?.bindings.filter(binding => binding.surface === surface && binding.scopeKind === 'game' && binding.scopeId === 0) ?? []));

function scopedBindingOrder(binding: FrontendConfigBinding) {
  if (binding.scopeKind === 'round' && binding.surface === 'round-page') return 0;
  if (binding.scopeKind === 'round' && binding.surface === 'puzzle-page') return 1;
  if (binding.scopeKind === 'puzzle') return 2;
  return 3;
}

const scopedConfigBindings = computed(() =>
  (workingConfig.value?.bindings ?? [])
    .filter(binding => binding.scopeKind !== 'game')
    .sort((left, right) => scopedBindingOrder(left) - scopedBindingOrder(right) || left.scopeId - right.scopeId || left.surface.localeCompare(right.surface)),
);

function bindingScopeLabel(binding: FrontendConfigBinding) {
  const title = binding.scopeKind === 'round' ? roundTitles.value?.get(binding.scopeId) : puzzleTitles.value?.get(binding.scopeId);
  if (title !== undefined) return title;
  return binding.scopeKind === 'round' ? t('admin.frontend.configFile.roundScope', { id: binding.scopeId }) : t('admin.frontend.configFile.puzzleScope', { id: binding.scopeId });
}

function bindingDescription(binding: FrontendConfigBinding) {
  if (binding.scopeKind === 'round' && binding.surface === 'puzzle-page') return t('admin.frontend.configFile.roundDefaultPuzzlePage');
  return t(surfaceMeta[binding.surface].labelKey);
}

function bindingIcon(binding: FrontendConfigBinding) {
  if (binding.scopeKind === 'round' && binding.surface === 'puzzle-page') return 'material-symbols:send-time-extension-outline-rounded';
  return surfaceMeta[binding.surface].icon;
}

function bindingPagePath(binding: FrontendConfigBinding) {
  if (binding.scopeKind === 'round') return `/admin/games/${gameId.value}/rounds/${binding.scopeId}/settings`;
  if (binding.scopeKind === 'puzzle') return `/admin/games/${gameId.value}/puzzles/${binding.scopeId}/settings`;
}

function packageFeatures(item: FrontendPackage) {
  return featureMeta.filter(feature => item.manifest.features?.[feature.key]);
}

function packageRenderers(item: FrontendPackage) {
  return Object.entries(item.manifest.features?.renderers ?? {}).map(([id, renderer]) => ({ id, ...renderer }));
}

function featureEnabled(packageId: number, feature: RbFrontendFeature) {
  const name = state.value?.packages.find(item => item.id === packageId)?.name;
  return workingConfig.value?.features.find(item => item.packageName === name)?.features.includes(feature) ?? false;
}

function setFeature(item: FrontendPackage, feature: RbFrontendFeature, enabled: boolean) {
  if (!workingConfig.value) return;
  let selection = workingConfig.value.features.find(value => value.packageName === item.name);
  if (!selection && enabled) {
    selection = { packageName: item.name, features: [] };
    workingConfig.value.features.push(selection);
  }
  if (!selection) return;
  const features = new Set(selection.features);
  if (enabled) features.add(feature);
  else features.delete(feature);
  selection.features = [...features].sort((left, right) => left - right);
  if (!selection.features.length) workingConfig.value.features = workingConfig.value.features.filter(value => value !== selection);
}

async function loadPageTitles() {
  const requestedGameId = gameId.value;
  if (pageTitlesGameId.value === requestedGameId && roundTitles.value && puzzleTitles.value) return;
  const response = await api.get<{ rounds: PageTitle[]; puzzles: PageTitle[] }>(`/admin/games/${requestedGameId}/page-titles`, {
    errorHints: { [GamePageTitlesResult.NotFound]: t('admin.common.gameNotFound') },
  });
  pageTitlesGameId.value = requestedGameId;
  roundTitles.value = new Map(response.data.rounds.map(item => [item.id, item.title]));
  puzzleTitles.value = new Map(response.data.puzzles.map(item => [item.id, item.title]));
}

async function refresh(force = false) {
  if ((busy.value || configurationDirty.value) && !force) return;
  loading.value = true;
  try {
    const [frontendResponse, configResponse] = await Promise.all([api.get<FrontendState>(`/admin/games/${gameId.value}/frontend`), api.get<FrontendConfig>(`/admin/games/${gameId.value}/frontend/config`), loadPageTitles()]);
    state.value = frontendResponse.data;
    syncConfig(configResponse.data);
    dirtyToast.clear();
  } catch (error) {
    handleError(error, t('admin.frontend.errorTitles.loadSettings'));
  } finally {
    loading.value = false;
  }
}
async function uploadPackage() {
  const file = themeFile.value;
  if (!file || uploading.value || configurationDirty.value) return;
  uploading.value = true;
  try {
    const body = new FormData();
    body.append('file', file, file.name);
    await api.post(`/admin/games/${gameId.value}/frontend/packages`, body, { errorHints: errorHints(rbFrontendPackageErrorKeys) });
    toast.add({ title: t('admin.frontend.notifications.packageUploaded'), color: 'success' });
    themeFile.value = null;
    await refresh(true);
  } catch (error) {
    themeFile.value = null;
    handleError(error, t('admin.frontend.errorTitles.uploadPackage'), true);
  } finally {
    uploading.value = false;
  }
}
async function deletePackage(item: FrontendPackage) {
  if (configurationDirty.value) return;
  packageUpdating.value = item.id;
  try {
    const response = await api.del<{ deleted: boolean; deletePending: boolean }>(`/admin/games/${gameId.value}/frontend/packages/${item.id}`, { errorHints: errorHints(rbFrontendPackageErrorKeys) });
    toast.add({ title: response.data.deletePending ? t('admin.frontend.notifications.packagePendingDeletion') : t('admin.frontend.notifications.packageDeleted'), icon: 'material-symbols:check-rounded', color: 'success' });
    await refresh(true);
  } catch (error) {
    handleError(error, t('admin.frontend.errorTitles.deletePackage'), true);
  } finally {
    packageUpdating.value = undefined;
  }
}
async function restorePackage(item: FrontendPackage) {
  if (configurationDirty.value) return;
  packageUpdating.value = item.id;
  try {
    await api.post(`/admin/games/${gameId.value}/frontend/packages/${item.id}/restore`, undefined, { errorHints: errorHints(rbFrontendPackageErrorKeys) });
    toast.add({ title: t('admin.frontend.notifications.packageRestored'), icon: 'material-symbols:restore-from-trash-outline-rounded', color: 'success' });
    await refresh(true);
  } catch (error) {
    handleError(error, t('admin.frontend.errorTitles.restorePackage'), true);
  } finally {
    packageUpdating.value = undefined;
  }
}

function downloadBlob(contents: string, name: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadConfig() {
  if (!workingConfig.value) return;
  downloadBlob(`${JSON.stringify(serializedConfig(), null, 2)}\n`, `rbph-frontend-${gameId.value}.json`);
}

function openConfigImport() {
  if (configurationDirty.value || configUploading.value) return;
  configFile.value = null;
  configImportOpen.value = true;
}

function isFrontendConfig(value: unknown): value is FrontendConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<FrontendConfig>;
  if (config.formatVersion !== 1 || !Array.isArray(config.bindings) || !Array.isArray(config.features)) return false;
  const keys = new Set<string>();
  const bindingsValid = config.bindings.every(binding => {
    if (!binding || typeof binding !== 'object') return false;
    if (!defaultSurfaces.includes(binding.surface)) return false;
    if (!['game', 'round', 'puzzle'].includes(binding.scopeKind)) return false;
    if (!Number.isInteger(binding.scopeId) || binding.scopeId < 0) return false;
    if (binding.packageName !== null && typeof binding.packageName !== 'string') return false;
    if (binding.rendererId !== null && typeof binding.rendererId !== 'string') return false;
    const key = bindingKey(binding);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  return bindingsValid && config.features.every(selection => Boolean(selection) && typeof selection.packageName === 'string' && Array.isArray(selection.features) && selection.features.every(feature => typeof feature === 'number'));
}

function findMissingPackages(config: FrontendConfig) {
  const referenced = new Set([...config.bindings.map(binding => binding.packageName).filter((name): name is string => typeof name === 'string'), ...config.features.map(selection => selection.packageName)]);
  const available = new Set((state.value?.packages ?? []).filter(item => !item.delete_pending).map(item => item.name));
  return [...referenced].filter(name => !available.has(name)).sort();
}

function rejectMissingPackages(config: FrontendConfig) {
  missingPackages.value = findMissingPackages(config);
  if (!missingPackages.value.length) return false;
  missingPackagesOpen.value = true;
  return true;
}

async function uploadConfig() {
  if (!configFile.value || !state.value || configurationDirty.value) return;
  configUploading.value = true;
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await configFile.value.text());
    } catch {
      throw new Error(t('admin.frontend.errors.config.invalidFile'));
    }
    if (!isFrontendConfig(parsed)) throw new Error(t('admin.frontend.errors.config.invalidFile'));
    if (rejectMissingPackages(parsed)) {
      configImportOpen.value = false;
      configFile.value = null;
      return;
    }
    setWorkingConfig(parsed, true);
    configImportOpen.value = false;
    configFile.value = null;
    toast.add({ title: t('admin.frontend.notifications.configLoaded'), icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    configFile.value = null;
    handleError(error, t('admin.frontend.errorTitles.uploadConfig'), true);
  } finally {
    configUploading.value = false;
  }
}

async function applyConfig() {
  if (!state.value || !workingConfig.value || !configurationDirty.value || configSaving.value) return;
  const config = serializedConfig();
  if (rejectMissingPackages(config)) return;
  configSaving.value = true;
  try {
    await api.put(`/admin/games/${gameId.value}/frontend/config`, config, { errorHints: errorHints(rbFrontendConfigErrorKeys) });
    toast.add({ title: t('admin.frontend.notifications.configApplied'), icon: 'material-symbols:check-rounded', color: 'success' });
    await refresh(true);
  } catch (error) {
    handleError(error, t('admin.frontend.errorTitles.uploadConfig'), true);
  } finally {
    configSaving.value = false;
  }
}

function resetConfig() {
  if (originalConfig.value) setWorkingConfig(originalConfig.value);
  dirtyToast.clear();
}

async function publishDraft() {
  if (!state.value || configurationDirty.value) return;
  publishing.value = true;
  try {
    await api.post(`/admin/games/${gameId.value}/frontend/revisions/${state.value.draft.id}/publish`, undefined, { errorHints: errorHints(rbFrontendPublishErrorKeys) });
    toast.add({ title: t('admin.frontend.notifications.published'), color: 'success' });
    await refresh(true);
  } catch (error) {
    handleError(error, t('admin.frontend.errorTitles.publish'), true);
  } finally {
    publishing.value = false;
  }
}

watch(configurationDirty, dirty => {
  if (!dirty) {
    dirtyToast.clear();
    return;
  }
  dirtyToast.show({
    description: t('admin.frontend.configFile.unsavedChanges'),
    guardOnLeave: true,
    apply: applyConfig,
    reset: resetConfig,
  });
});
watch(configImportOpen, open => {
  if (!open) configFile.value = null;
});
onMounted(refresh);
</script>

<template>
  <div>
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]">
      <aside class="hidden xl:block" />

      <main class="flex min-w-0 flex-col gap-8">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.frontend.title') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('admin.frontend.description') }}</p>
          </div>
          <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" :disabled="busy || configurationDirty" @click="refresh()" />
        </div>

        <div v-if="loading && !state" class="space-y-3">
          <u-skeleton class="h-40 w-full" />
          <u-skeleton class="h-80 w-full" />
          <u-skeleton class="h-48 w-full" />
        </div>

        <template v-else-if="state">
          <section class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.frontend.packages.title') }}</h3>
              <p class="mt-1 text-sm text-muted">{{ t('admin.frontend.packages.description') }}</p>
            </div>

            <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
              <u-file-upload
                v-model="themeFile"
                accept=".zip,application/zip,application/x-zip-compressed"
                size="md"
                layout="list"
                class="w-full"
                icon="material-symbols:upload-file-outline-rounded"
                :label="t('admin.frontend.packages.selectZip')"
                :description="t('admin.frontend.common.fileDrop')"
                :disabled="uploading || configurationDirty"
                @change="uploadPackage"
              />

              <template v-if="state.packages.length">
                <u-separator />
                <div class="divide-y divide-default">
                  <div v-for="item in state.packages" :key="item.id" class="py-3 transition-opacity first:pt-0 last:pb-0" :class="item.delete_pending ? 'opacity-50 grayscale' : ''">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex min-w-0 items-start gap-3">
                        <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-default"><u-icon name="material-symbols:deployed-code-outline" class="size-5 text-muted" /></div>
                        <div class="min-w-0 pt-1.5">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="truncate font-medium text-highlighted">{{ item.name }}</span>
                            <u-badge color="neutral" variant="soft">{{ item.version }}</u-badge>
                            <u-badge v-if="item.delete_pending" color="warning" variant="soft">{{ t('admin.frontend.common.pendingAutomaticDeletion') }}</u-badge>
                          </div>
                        </div>
                      </div>
                      <u-popover arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
                        <u-button
                          size="sm"
                          :color="item.delete_pending ? 'warning' : 'error'"
                          variant="ghost"
                          :icon="item.delete_pending ? 'material-symbols:restore-from-trash-outline-rounded' : 'material-symbols:delete-outline-rounded'"
                          :loading="packageUpdating === item.id"
                          :disabled="configurationDirty || configSaving"
                        />
                        <template #content>
                          <div class="w-64 p-3 text-sm">
                            <template v-if="item.delete_pending">
                              <div class="font-medium text-highlighted">{{ t('admin.frontend.packages.cancelDeletion') }}</div>
                              <p class="mt-1 text-xs text-muted">{{ t('admin.frontend.packages.cancelDeletionDescription') }}</p>
                              <div class="mt-3 flex justify-end">
                                <u-button size="xs" color="warning" variant="soft" icon="material-symbols:restore-from-trash-outline-rounded" @click="restorePackage(item)">{{ t('admin.frontend.packages.cancelDeletion') }}</u-button>
                              </div>
                            </template>
                            <template v-else>
                              <div class="font-medium text-highlighted">{{ t('admin.frontend.packages.delete') }}</div>
                              <p class="mt-1 text-xs text-muted">{{ t('admin.frontend.packages.deleteDescription') }}</p>
                              <div class="mt-3 flex justify-end">
                                <u-button size="xs" color="error" variant="soft" icon="material-symbols:delete-outline-rounded" @click="deletePackage(item)">{{ t('admin.frontend.packages.confirmDelete') }}</u-button>
                              </div>
                            </template>
                          </div>
                        </template>
                      </u-popover>
                    </div>

                    <div v-if="packageRenderers(item).length || packageFeatures(item).length" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div v-for="renderer in packageRenderers(item)" :key="`renderer:${renderer.id}`" class="flex min-w-0 items-start gap-3 rounded-md bg-default/60 px-3 py-2">
                        <u-icon :name="surfaceMeta[renderer.surface]?.icon ?? 'material-symbols:deployed-code-outline'" class="mt-0.5 size-5 shrink-0 text-muted" />
                        <div class="min-w-0">
                          <div class="truncate text-sm font-medium text-highlighted">{{ renderer.id }}</div>
                          <div class="text-xs text-muted">{{ surfaceMeta[renderer.surface] ? t(surfaceMeta[renderer.surface].labelKey) : renderer.surface }}</div>
                        </div>
                      </div>
                      <div v-for="feature in packageFeatures(item)" :key="`feature:${feature.value}`" class="flex min-w-0 items-center justify-between gap-4 rounded-md bg-default/60 px-3 py-2">
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-highlighted">{{ t(feature.labelKey) }}</div>
                          <div class="text-xs text-muted">{{ t(feature.descriptionKey) }}</div>
                        </div>
                        <u-switch class="shrink-0" :model-value="featureEnabled(item.id, feature.value)" :disabled="configSaving || item.delete_pending" @update:model-value="setFeature(item, feature.value, $event)" />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </section>

          <u-separator />

          <section class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.frontend.configFile.title') }}</h3>
              <p class="mt-1 text-sm text-muted">{{ t('admin.frontend.configFile.description') }}</p>
            </div>
            <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
              <div class="text-sm font-medium text-highlighted">{{ t('admin.frontend.configFile.gameDefaults') }}</div>
              <template v-for="binding in defaultConfigBindings" :key="bindingKey(binding)">
                <rb-form-field row :label="t(surfaceMeta[binding.surface].labelKey)" :icon="surfaceMeta[binding.surface].icon">
                  <rb-theme-dev-binding-select :model-value="bindingTarget(binding)" :items="bindingItems(binding)" class="w-full sm:w-80" :disabled="configSaving" @update:model-value="updateBinding(binding, String($event))" />
                </rb-form-field>
              </template>
              <u-separator />
              <div class="text-sm font-medium text-highlighted">{{ t('admin.frontend.configFile.pageOverrides') }}</div>
              <template v-if="scopedConfigBindings.length">
                <div v-for="binding in scopedConfigBindings" :key="bindingKey(binding)" class="transition-opacity" :class="removedBindingKeys.has(bindingKey(binding)) ? 'opacity-45 grayscale' : ''">
                  <rb-form-field row :label="bindingScopeLabel(binding)" :description="bindingDescription(binding)" :icon="bindingIcon(binding)">
                    <template #label>
                      <nuxt-link :to="bindingPagePath(binding)" class="transition-colors hover:text-primary">
                        {{ bindingScopeLabel(binding) }}
                      </nuxt-link>
                    </template>
                    <rb-theme-dev-binding-select :model-value="bindingTarget(binding)" :items="bindingItems(binding)" class="w-full sm:w-80" :disabled="configSaving" @update:model-value="updateBinding(binding, String($event))" />
                  </rb-form-field>
                </div>
              </template>
              <p v-else class="py-2 text-sm text-muted">{{ t('admin.frontend.configFile.noPageOverrides') }}</p>
              <u-separator />
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <u-button block color="neutral" variant="soft" icon="material-symbols:upload-file-outline-rounded" :disabled="configurationDirty || configUploading || configSaving" @click="openConfigImport">
                  {{ t('admin.frontend.configFile.upload') }}
                </u-button>
                <u-button block color="neutral" variant="soft" icon="material-symbols:download-rounded" :disabled="!workingConfig || configSaving" @click="downloadConfig">
                  {{ t('admin.frontend.configFile.download') }}
                </u-button>
              </div>
            </div>
          </section>

          <u-separator />

          <section class="space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.frontend.publish.title') }}</h3>
                <p class="mt-1 text-sm text-muted">{{ t('admin.frontend.publish.description') }}</p>
              </div>
              <u-button size="sm" icon="material-symbols:publish-rounded" :loading="publishing" :disabled="configurationDirty || configSaving" @click="publishDraft">{{ t('admin.frontend.publish.action') }}</u-button>
            </div>

            <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
              <rb-form-field row :label="t('admin.frontend.publish.currentDraft')" icon="material-symbols:edit-document-outline-rounded" :description="t('admin.frontend.publish.bindingCount', { count: state.bindings.length })"
                ><u-badge color="warning" variant="soft">{{ t('admin.frontend.common.version', { version: state.draft.revision }) }}</u-badge></rb-form-field
              >
              <u-separator />
              <rb-form-field row :label="t('admin.frontend.common.onlineVersion')" icon="material-symbols:cloud-done-outline-rounded" :description="t('admin.frontend.publish.onlineDescription')"
                ><u-badge :color="publishedRevision ? 'success' : 'neutral'" variant="soft">{{
                  publishedRevision ? t('admin.frontend.common.version', { version: publishedRevision.revision }) : t('admin.frontend.publish.notPublished')
                }}</u-badge></rb-form-field
              >
            </div>
          </section>
        </template>
      </main>

      <aside class="hidden xl:block" />
    </div>

    <u-modal v-model:open="configImportOpen" :title="t('admin.frontend.configFile.upload')" :dismissible="!configUploading" :close="!configUploading">
      <template #body>
        <u-file-upload v-model="configFile" accept=".json,application/json" size="md" layout="list" class="w-full" icon="material-symbols:upload-file-outline-rounded" :label="t('admin.frontend.configFile.selectJson')" :disabled="configUploading" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <u-button color="neutral" variant="soft" :disabled="configUploading" @click="configImportOpen = false">{{ t('common.cancel') }}</u-button>
          <u-button icon="material-symbols:upload-rounded" :loading="configUploading" :disabled="!configFile" @click="uploadConfig">{{ t('admin.frontend.configFile.loadJson') }}</u-button>
        </div>
      </template>
    </u-modal>

    <u-modal v-model:open="missingPackagesOpen" :title="t('admin.frontend.errors.config.missingPackagesTitle')">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-toned">{{ t('admin.frontend.errors.config.missingPackagesDescription') }}</p>
          <div class="flex flex-wrap gap-2">
            <u-badge v-for="name in missingPackages" :key="name" color="warning" variant="soft">{{ name }}</u-badge>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end"><u-button :label="t('admin.frontend.errors.config.close')" @click="missingPackagesOpen = false" /></div>
      </template>
    </u-modal>
  </div>
</template>
