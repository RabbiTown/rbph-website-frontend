<script setup lang="ts">
const themeDev = useThemeDev();
const game = useGame();
const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const open = ref(false);
const uploading = ref(false);
const resetOpen = ref(false);
const modificationsOpen = ref(false);
const revertedModifications = ref<Record<string, Modification>>({});
const resetTarget = ref<RbThemeDevResetTarget>('published');

function isPlayerLayout() {
  return route.meta.layout === 'game' || route.meta.layout === 'game-full';
}

watch(
  () => [game.ref.value?.id, route.path, route.meta.layout, route.query.preview] as const,
  async ([gameId, path, , preview]) => {
    if (!gameId || !isPlayerLayout() || preview !== undefined) {
      themeDev.clear();
      return;
    }
    if (!/\/(?:rounds|puzzles)\/[^/]+/.test(path)) {
      try {
        await themeDev.initialize(gameId, true);
      } catch (error) {
        console.error('[RBPH theme dev initialization]', error);
      }
    }
  },
  { immediate: true },
);

const context = computed(() => themeDev.active.value);
const selectedMode = computed<RbThemeDevMode>({
  get: () => themeDev.mode.value,
  set: value => themeDev.setMode(value),
});
const modeItems = computed(
  () =>
    [
      { label: t('admin.frontend.common.onlineVersion'), value: 'published', icon: 'material-symbols:cloud-done-outline-rounded' },
      { label: t('admin.frontend.dev.developmentPreview'), value: 'development', icon: 'material-symbols:code-rounded' },
      { label: t('admin.frontend.common.builtinPage'), value: 'none', icon: 'material-symbols:block-outline' },
    ] satisfies Array<{ label: string; value: RbThemeDevMode; icon: string; disabled?: boolean }>,
);
const modeLabel = computed(() => modeItems.value.find(item => item.value === themeDev.mode.value)?.label ?? t('admin.frontend.dev.shortTitle'));
const canUpload = computed(() => themeDev.mode.value === 'development' && Boolean(context.value?.canWriteDraft && context.value.draftRevisionId));
const resetItems = computed(
  () =>
    [
      { label: t('admin.frontend.common.onlineVersion'), value: 'published', icon: 'material-symbols:cloud-done-outline-rounded' },
      { label: t('admin.frontend.common.builtinPage'), value: 'none', icon: 'material-symbols:block-outline' },
    ] satisfies Array<{ label: string; value: RbThemeDevResetTarget; icon: string; disabled?: boolean }>,
);
const resetDescription = computed(() => {
  const source = resetItems.value.find(item => item.value === resetTarget.value)?.label ?? t('admin.frontend.dev.selectedConfiguration');
  return t('admin.frontend.dev.resetDescription', { source });
});

const featureMeta = [
  { value: RbFrontendFeature.Locale, labelKey: 'admin.frontend.features.locale' },
  { value: RbFrontendFeature.Icons, labelKey: 'admin.frontend.features.icons' },
  { value: RbFrontendFeature.Ui, labelKey: 'admin.frontend.features.ui' },
];

const surfaceLabel = computed(() => (context.value?.surface === 'puzzle-page' ? t('admin.frontend.common.puzzlePage') : t('admin.frontend.common.roundPage')));
const scopeLabel = computed(() => (context.value?.scopeKind === 'puzzle' ? t('admin.frontend.common.puzzle') : t('admin.frontend.common.round')));
type Modification = {
  key: string;
  type: 'default' | 'round' | 'puzzle' | 'binding' | 'feature-base' | 'package-features';
  id?: number;
  binding?: RbThemeDevBinding;
  label: string;
  order: number;
};

const modifications = computed<Modification[]>(() => {
  const changes = themeDev.exportedDevelopmentConfig.value as {
    bindings?: Record<string, RbThemeDevBinding>;
    baseFeatures?: 'none';
    packageFeatures?: Record<string, RbFrontendFeature[]>;
  };
  const bindings = changes.bindings ?? {};
  const items: Modification[] = [];
  for (const [key, binding] of Object.entries(bindings)) {
    const [surface, scope, rawId] = key.split(':');
    const id = Number(rawId);
    if (scope === 'game' && id === 0 && (surface === 'round-page' || surface === 'puzzle-page')) {
      items.push({
        key,
        type: 'default',
        binding,
        label: t('admin.frontend.dev.gameDefaultModification', { surface: surface === 'round-page' ? t('admin.frontend.common.roundPage') : t('admin.frontend.common.puzzlePage') }),
        order: surface === 'round-page' ? 0 : 1,
      });
      continue;
    }
    if (Number.isInteger(id) && id > 0 && surface === 'round-page' && scope === 'round') {
      items.push({ key, type: 'round', id, binding, label: t('admin.frontend.dev.roundModification', { id }), order: 10 });
    } else if (Number.isInteger(id) && id > 0 && surface === 'puzzle-page' && scope === 'puzzle') {
      items.push({ key, type: 'puzzle', id, binding, label: t('admin.frontend.dev.puzzleModification', { id }), order: 11 });
    } else {
      items.push({ key, type: 'binding', binding, label: t('admin.frontend.dev.bindingModification', { key }), order: 12 });
    }
  }
  if (changes.baseFeatures) {
    items.push({
      key: 'baseFeatures',
      type: 'feature-base',
      label: t('admin.frontend.dev.baseFeaturesModification'),
      order: 2,
    });
  }
  for (const packageName of Object.keys(changes.packageFeatures ?? {})) {
    items.push({
      key: `packageFeatures:${packageName}`,
      type: 'package-features',
      label: t('admin.frontend.dev.packageFeaturesModification', { package: packageName }),
      order: 3,
    });
  }
  return items.sort((a, b) => a.order - b.order || (a.id ?? 0) - (b.id ?? 0) || a.key.localeCompare(b.key));
});

const displayedModifications = computed(() => {
  const activeKeys = new Set(modifications.value.map(item => item.key));
  return [
    ...modifications.value.map(item => ({ ...item, reverted: false })),
    ...Object.values(revertedModifications.value)
      .filter(item => !activeKeys.has(item.key))
      .map(item => ({ ...item, reverted: true })),
  ].sort((a, b) => a.order - b.order || (a.id ?? 0) - (b.id ?? 0) || a.key.localeCompare(b.key));
});

function openModifications() {
  open.value = false;
  revertedModifications.value = {};
  modificationsOpen.value = true;
}

async function openModifiedPage(item: (typeof modifications.value)[number]) {
  const current = context.value;
  if (!current || !item.id || (item.type !== 'round' && item.type !== 'puzzle')) return;
  modificationsOpen.value = false;
  await navigateTo(`/games/${current.gameId}/${item.type === 'round' ? 'rounds' : 'puzzles'}/${item.id}`);
}

function modificationIcon(item: (typeof modifications.value)[number]) {
  if (item.type === 'round') return 'material-symbols:category-outline-rounded';
  if (item.type === 'puzzle') return 'material-symbols:extension-outline-rounded';
  if (item.type === 'feature-base' || item.type === 'package-features') return 'material-symbols:widgets-outline-rounded';
  return 'material-symbols:settings-applications-outline-rounded';
}

function modificationSurface(item: (typeof modifications.value)[number]): RbFrontendSurface | undefined {
  if (item.key.startsWith('round-page:')) return 'round-page';
  if (item.key.startsWith('puzzle-page:')) return 'puzzle-page';
}

function modificationBindingItems(item: (typeof modifications.value)[number]) {
  const surface = modificationSurface(item);
  return surface ? bindingItems(surface, item.type !== 'default', item.key === context.value?.key, item.key) : [];
}

function updateModificationBinding(item: (typeof modifications.value)[number], target: string) {
  const reverted = target === 'published' ? { ...item, binding: { mode: 'published' } as RbThemeDevBinding } : undefined;
  const { [item.key]: _, ...remaining } = revertedModifications.value;
  revertedModifications.value = remaining;
  themeDev.setDevelopmentBinding(item.key, bindingFromTarget(target));
  if (reverted && !modifications.value.some(change => change.key === item.key)) {
    revertedModifications.value = { ...revertedModifications.value, [item.key]: reverted };
  }
}

function removeModificationBinding(item: (typeof modifications.value)[number]) {
  themeDev.setDevelopmentBinding(item.key, { mode: 'published' });
}

function updateBaseFeatures(value: string) {
  if (value !== 'published' && value !== 'none') return;
  const item = displayedModifications.value.find(change => change.key === 'baseFeatures');
  const { baseFeatures: _, ...remaining } = revertedModifications.value;
  revertedModifications.value = remaining;
  themeDev.setBaseFeatures(value);
  if (value === 'published' && item && !modifications.value.some(change => change.key === 'baseFeatures')) {
    revertedModifications.value = {
      ...revertedModifications.value,
      baseFeatures: item,
    };
  }
}

function updatePackageFeature(item: Modification, feature: RbFrontendFeature, enabled: boolean) {
  const { [item.key]: _, ...remaining } = revertedModifications.value;
  revertedModifications.value = remaining;
  themeDev.setFeatureEnabled(feature, enabled);
  if (!modifications.value.some(change => change.key === item.key)) {
    revertedModifications.value = {
      ...revertedModifications.value,
      [item.key]: item,
    };
  }
}

const baseFeatureItems = computed(() => [
  { label: t('admin.frontend.common.onlineVersion'), value: 'published', icon: 'material-symbols:cloud-done-outline-rounded' },
  { label: t('admin.frontend.dev.disableAllFeatures'), value: 'none', icon: 'material-symbols:block-outline' },
]);

function closeModifications() {
  modificationsOpen.value = false;
  revertedModifications.value = {};
}

function bindingTarget(binding: RbThemeDevBinding) {
  if (binding.mode === 'development') return `development:${binding.rendererId ?? ''}`;
  if (binding.mode === 'package') return `package:${binding.packageId ?? ''}:${binding.rendererId ?? ''}`;
  return binding.mode;
}

type PublishedChoice = {
  mode: 'inherit' | 'builtin' | 'package';
  packageId?: number;
  name?: string;
  rendererId?: string;
};

function publishedChoice(surface: RbFrontendSurface, currentPage: boolean, bindingKey?: string): PublishedChoice | undefined {
  const current = context.value;
  if (!current) return;
  if (current.adminState) {
    const resolvedKey = bindingKey ?? (currentPage ? `${surface}:${current.scopeKind}:${current.scopeId}` : undefined);
    const [, scopeKind, rawScopeId] = resolvedKey?.split(':') ?? [];
    const scopeId = Number(rawScopeId);
    const hasPageScope = (scopeKind === 'round' || scopeKind === 'puzzle') && Number.isInteger(scopeId) && scopeId > 0;
    const scopedBinding = hasPageScope ? current.adminState.published_bindings.find(item => item.surface === surface && item.scope_kind === scopeKind && item.scope_id === scopeId) : undefined;
    if (hasPageScope && !scopedBinding) return { mode: 'inherit' };
    const binding = scopedBinding ?? current.adminState.published_bindings.find(item => item.surface === surface && item.scope_kind === 'game' && item.scope_id === 0);
    if (!binding?.package_id) return { mode: 'builtin' };
    const pkg = current.adminState.packages.find(item => item.id === binding.package_id);
    return { mode: 'package', packageId: binding.package_id, name: pkg?.name, rendererId: binding.renderer_id ?? undefined };
  }
  if (currentPage && surface === current.surface) {
    return current.published.mode === 'builtin'
      ? { mode: 'builtin' }
      : {
          mode: 'package',
          packageId: current.published.packageId ?? undefined,
          name: current.publishedManifest?.package.name,
          rendererId: current.published.rendererId ?? undefined,
        };
  }
}

function bindingItems(surface: RbFrontendSurface, inherit: boolean, currentPage = false, bindingKey?: string) {
  const current = context.value;
  if (!current) return [];
  const published = publishedChoice(surface, currentPage, bindingKey);
  const publishedIsInherit = published?.mode === 'inherit';
  const publishedIsBuiltin = published?.mode === 'builtin';
  const developmentIsPublished = published?.mode === 'package' && published.name === current.manifest.package.name;
  const items = [
    ...(inherit ? [{ label: t('admin.frontend.dev.inheritGameDefault'), value: publishedIsInherit ? 'published' : 'inherit', icon: 'material-symbols:account-tree-outline-rounded', published: publishedIsInherit }] : []),
    { label: t('admin.frontend.common.builtinPage'), value: publishedIsBuiltin ? 'published' : 'builtin', icon: 'material-symbols:block-outline', published: publishedIsBuiltin },
    ...Object.entries(current.manifest.features?.renderers ?? {})
      .filter(([, renderer]) => renderer.surface === surface)
      .map(([rendererId]) => {
        const isPublished = developmentIsPublished && published.rendererId === rendererId;
        return {
          label: t('admin.frontend.common.rendererFromPackage', { renderer: rendererId, package: current.manifest.package.name }),
          value: isPublished ? 'published' : `development:${rendererId}`,
          icon: 'material-symbols:code-rounded',
          development: true,
          published: isPublished,
        };
      }),
    ...(current.adminState?.packages ?? [])
      .filter(item => !item.delete_pending && item.name !== current.manifest.package.name && item.manifest_url)
      .flatMap(item =>
        Object.entries(item.manifest.features?.renderers ?? {})
          .filter(([, renderer]) => renderer.surface === surface)
          .map(([rendererId]) => {
            const isPublished = published?.packageId === item.id && published.rendererId === rendererId;
            return {
              label: t('admin.frontend.common.rendererFromPackage', { renderer: rendererId, package: item.name }),
              value: isPublished ? 'published' : `package:${item.id}:${rendererId}`,
              icon: 'material-symbols:deployed-code-outline',
              published: isPublished,
            };
          }),
      ),
  ];
  if (published?.mode === 'package' && !items.some(item => item.published)) {
    items.push({
      label: published.name ? (published.rendererId ? t('admin.frontend.common.rendererFromPackage', { renderer: published.rendererId, package: published.name }) : published.name) : t('admin.frontend.dev.onlineThemePackage'),
      value: 'published',
      icon: 'material-symbols:deployed-code-outline',
      published: true,
    });
  }
  if (!published) {
    items.push({ label: t('admin.frontend.common.onlineVersion'), value: 'published', icon: 'material-symbols:cloud-done-outline-rounded', published: true });
  }
  return items;
}

const currentBindingItems = computed(() => (context.value ? bindingItems(context.value.surface, true, true) : []));
const roundBindingItems = computed(() => bindingItems('round-page', false));
const puzzleBindingItems = computed(() => bindingItems('puzzle-page', false));
const availableFeatureMeta = computed(() => {
  const available = new Set(themeDev.availableFeatures.value);
  return featureMeta.filter(item => available.has(item.value));
});

function bindingFromTarget(target: string): RbThemeDevBinding {
  if (target.startsWith('development:')) {
    return { mode: 'development', packageName: context.value?.manifest.package.name, rendererId: target.slice('development:'.length) };
  }
  if (target.startsWith('package:')) {
    const [packageId, rendererId] = target.slice('package:'.length).split(':', 2);
    return { mode: 'package', packageId: Number(packageId), rendererId };
  }
  return { mode: target as 'inherit' | 'builtin' | 'published' };
}

const currentTarget = computed({
  get: () => bindingTarget(themeDev.currentBinding.value),
  set: value => context.value && themeDev.setCurrentBinding(bindingFromTarget(value)),
});
const roundFallbackTarget = computed({
  get: () => bindingTarget(themeDev.roundFallback.value),
  set: value => themeDev.setFallbackBinding('round-page', bindingFromTarget(value)),
});
const puzzleFallbackTarget = computed({
  get: () => bindingTarget(themeDev.puzzleFallback.value),
  set: value => themeDev.setFallbackBinding('puzzle-page', bindingFromTarget(value)),
});
async function uploadConfig() {
  uploading.value = true;
  try {
    await themeDev.uploadDevelopmentConfig();
    toast.add({ title: t('admin.frontend.dev.applied'), color: 'success', icon: 'material-symbols:cloud-upload-outline-rounded' });
  } catch (error) {
    handleError(error, t('admin.frontend.errorTitles.applyDevelopmentConfig'), true);
  } finally {
    uploading.value = false;
  }
}

function confirmReset() {
  themeDev.resetDevelopmentConfig(resetTarget.value);
  resetOpen.value = false;
  toast.add({ title: t('admin.frontend.dev.resetComplete'), color: 'success', icon: 'material-symbols:restart-alt-rounded' });
}

function openReset() {
  resetOpen.value = true;
}
</script>

<template>
  <div v-if="themeDev.enabled.value && context" class="fixed bottom-4 right-4 z-50">
    <u-popover v-model:open="open" arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
      <u-button size="sm" color="warning" variant="soft" icon="material-symbols:developer-mode-tv-outline-rounded" :label="modeLabel" />
      <template #content>
        <div class="flex max-h-[min(48rem,calc(100vh-6rem))] w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden">
          <div class="flex items-start justify-between gap-3 border-b border-default p-4">
            <div>
              <div class="font-medium text-highlighted">{{ t('admin.frontend.dev.title') }}</div>
              <div class="mt-1 text-xs text-muted">
                {{ context.currentPage ? t('admin.frontend.dev.pagePackageContext', { surface: surfaceLabel, scope: scopeLabel, id: context.scopeId, package: context.manifest.package.name }) : t('admin.frontend.dev.gamePackageContext', { package: context.manifest.package.name }) }}
              </div>
            </div>
            <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:refresh-rounded" @click="themeDev.refresh" />
          </div>

          <div class="space-y-5 overflow-y-auto p-4">
            <u-form-field :label="t('admin.frontend.dev.previewSource')">
              <u-select v-model="selectedMode" :items="modeItems" class="w-full" />
            </u-form-field>

            <template v-if="themeDev.mode.value === 'development'">
              <section v-if="context.currentPage" class="space-y-3 rounded-md bg-elevated/60 p-3 ring ring-default">
                <div>
                  <div class="text-sm font-medium text-highlighted">{{ t('admin.frontend.dev.currentPage') }}</div>
                </div>
                <rb-theme-dev-binding-select v-model="currentTarget" :items="currentBindingItems" class="w-full" />
              </section>

              <section class="space-y-4 rounded-md bg-elevated/60 p-3 ring ring-default">
                <div>
                  <div class="text-sm font-medium text-highlighted">{{ t('admin.frontend.dev.gameDefaults') }}</div>
                  <div class="text-xs text-muted">{{ t('admin.frontend.dev.gameDefaultsDescription') }}</div>
                </div>
                <div class="space-y-2">
                  <div class="text-xs font-medium text-toned">{{ t('admin.frontend.common.roundPage') }}</div>
                  <rb-theme-dev-binding-select v-model="roundFallbackTarget" :items="roundBindingItems" class="w-full" />
                </div>
                <u-separator />
                <div class="space-y-2">
                  <div class="text-xs font-medium text-toned">{{ t('admin.frontend.common.puzzlePage') }}</div>
                  <rb-theme-dev-binding-select v-model="puzzleFallbackTarget" :items="puzzleBindingItems" class="w-full" />
                </div>
              </section>

              <section v-if="themeDev.availableFeatures.value.length" class="space-y-3 rounded-md bg-elevated/60 p-3 ring ring-default">
                <div>
                  <div class="text-sm font-medium text-highlighted">{{ t('admin.frontend.dev.packageFeatures') }}</div>
                  <div class="text-xs text-muted">{{ t('admin.frontend.dev.packageFeaturesDescription') }}</div>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-2">
                  <label v-for="feature in availableFeatureMeta" :key="feature.value" class="flex items-center gap-2 text-xs text-toned">
                    <span>{{ t(feature.labelKey) }}</span>
                    <u-switch :model-value="themeDev.featureEnabled(feature.value)" @update:model-value="themeDev.setFeatureEnabled(feature.value, $event)" />
                  </label>
                </div>
              </section>
            </template>

            <u-alert v-if="!context.canWriteDraft" color="neutral" variant="subtle" icon="material-symbols:lock-outline-rounded" :description="t('admin.frontend.dev.adminUnavailable')" />
          </div>

          <div class="flex flex-wrap justify-end gap-2 border-t border-default p-3">
            <u-button
              size="sm"
              color="neutral"
              variant="soft"
              icon="material-symbols:list-alt-outline-rounded"
              :label="t('admin.frontend.dev.modificationCount', { count: modifications.length })"
              :disabled="themeDev.mode.value !== 'development'"
              @click="openModifications"
            />
            <u-button size="sm" color="warning" variant="soft" icon="material-symbols:restart-alt-rounded" :label="t('admin.frontend.dev.reset')" :disabled="themeDev.mode.value !== 'development'" @click="openReset" />
            <u-button size="sm" icon="material-symbols:cloud-upload-outline-rounded" :label="t('admin.frontend.common.applyToDraft')" :loading="uploading" :disabled="!canUpload" @click="uploadConfig" />
          </div>
        </div>
      </template>
    </u-popover>
  </div>

  <u-modal v-model:open="modificationsOpen" :title="t('admin.frontend.dev.modifications')" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div v-if="displayedModifications.length" class="space-y-2">
        <div v-for="item in displayedModifications" :key="item.key" class="flex items-center gap-3 rounded-md bg-elevated/60 p-3 ring ring-default transition-opacity" :class="item.reverted ? 'opacity-45 grayscale' : ''">
          <u-icon :name="modificationIcon(item)" class="size-5 shrink-0 text-muted" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1 text-sm font-medium text-highlighted">
              <span class="truncate">{{ item.label }}</span>
              <u-button
                v-if="item.type === 'round' || item.type === 'puzzle'"
                size="xs"
                color="neutral"
                variant="link"
                icon="material-symbols:open-in-new-rounded"
                class="mt-0.5"
                :aria-label="t('admin.frontend.dev.openPage')"
                @click="openModifiedPage(item)"
              />
            </div>
          </div>
          <rb-theme-dev-binding-select
            v-if="item.binding && modificationSurface(item)"
            :model-value="bindingTarget(item.binding)"
            :items="modificationBindingItems(item)"
            class="w-64 shrink-0"
            @update:model-value="updateModificationBinding(item, $event)"
          />
          <u-button v-else-if="item.type === 'binding'" size="xs" color="neutral" variant="soft" icon="material-symbols:undo-rounded" :label="t('admin.frontend.dev.removeModification')" @click="removeModificationBinding(item)" />
          <u-select v-else-if="item.type === 'feature-base'" :model-value="item.reverted ? 'published' : 'none'" :items="baseFeatureItems" class="w-64 shrink-0" @update:model-value="updateBaseFeatures" />
          <div v-else-if="item.type === 'package-features'" class="flex shrink-0 flex-wrap justify-end gap-x-4 gap-y-2">
            <label v-for="feature in availableFeatureMeta" :key="feature.value" class="flex items-center gap-2 text-xs text-toned">
              <span>{{ t(feature.labelKey) }}</span>
              <u-switch :model-value="themeDev.featureEnabled(feature.value)" @update:model-value="updatePackageFeature(item, feature.value, $event)" />
            </label>
          </div>
        </div>
      </div>
      <u-empty v-else icon="material-symbols:find-in-page-outline-rounded" :title="t('admin.frontend.dev.noModifications')" />
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <u-button color="neutral" variant="soft" :label="t('admin.frontend.common.close')" @click="closeModifications" />
      </div>
    </template>
  </u-modal>

  <rb-confirm-modal
    v-model:open="resetOpen"
    :title="t('admin.frontend.dev.resetTitle')"
    :description="resetDescription"
    :confirm-label="t('admin.frontend.dev.confirmReset')"
    confirm-color="warning"
    confirm-icon="material-symbols:restart-alt-rounded"
    @confirm="confirmReset"
  >
    <template #body>
      <u-form-field :label="t('admin.frontend.dev.resetTarget')">
        <u-select v-model="resetTarget" :items="resetItems" class="w-full" />
      </u-form-field>
    </template>
  </rb-confirm-modal>
</template>
