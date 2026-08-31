export type RbThemeDevMode = 'development' | 'published' | 'none';
export type RbThemeDevBindingMode = 'inherit' | 'builtin' | 'published' | 'development' | 'package';
export type RbThemeDevResetTarget = 'published' | 'none';

export type RbThemeDevBinding = {
  mode: RbThemeDevBindingMode;
  packageName?: string;
  packageId?: number;
  rendererId?: string;
};

type FrontendPackage = {
  id: number;
  name: string;
  version: string;
  delete_pending: boolean;
  manifest_url?: string | null;
  manifest: RbThemeManifest;
};
type FrontendRevision = { id: number; revision: number; status: 'draft' | 'published' };
type FrontendBinding = { revision_id: number; surface: RbFrontendSurface; scope_kind: 'game' | 'round' | 'puzzle'; scope_id: number; package_id?: number | null; renderer_id?: string | null };
type FrontendFeatureActivation = { revision_id: number; package_id: number; feature: RbFrontendFeature };
type FrontendAdminState = {
  packages: FrontendPackage[];
  revisions: FrontendRevision[];
  draft: FrontendRevision;
  bindings: FrontendBinding[];
  published_bindings: FrontendBinding[];
  feature_activations: FrontendFeatureActivation[];
  published_feature_activations: FrontendFeatureActivation[];
};
type FrontendConfigBinding = { surface: RbFrontendSurface; scopeKind: 'game' | 'round' | 'puzzle'; scopeId: number; packageName: string | null; rendererId: string | null };
type FrontendConfig = { formatVersion: 1; bindings: FrontendConfigBinding[]; features: Array<{ packageName: string; features: RbFrontendFeature[] }> };
type ThemeDevGameConfig = {
  bindings: Record<string, RbThemeDevBinding>;
  packageFeatures: Record<string, RbFrontendFeature[]>;
  packageFeaturesInitialized: Record<string, boolean>;
  baseFeatures: 'published' | 'none';
};

type ThemeDevContext = {
  key: string;
  gameId: number;
  surface: RbFrontendSurface;
  scopeKind: 'game' | 'round' | 'puzzle';
  scopeId: number;
  currentPage: boolean;
  roundId?: number;
  manifestUrl: string;
  manifest: RbThemeManifest;
  published: RbFrontendRenderer;
  publishedManifest?: RbThemeManifest;
  draftRevisionId?: number;
  adminState?: FrontendAdminState;
  canWriteDraft: boolean;
  publishedDevelopmentFeatures: RbFrontendFeature[];
};

export type RbThemeDevFeaturePlan = {
  base: 'published' | 'draft' | 'none';
  previewRevision?: number;
  developmentManifestUrl?: string;
  developmentPackageName?: string;
  developmentFeatures: RbFrontendFeature[];
};

const MODE_STORAGE_KEY = 'rbph::theme-dev::mode-v2';
const CONFIG_STORAGE_KEY = 'rbph::theme-dev::binding-configs-v3';
const mode = ref<RbThemeDevMode>('published');
const configurations = ref<Record<string, ThemeDevGameConfig>>({});
const active = shallowRef<ThemeDevContext>();
const revision = ref(0);
const sourceRevision = ref(0);
const adminStateRequests = new Map<number, Promise<FrontendAdminState | undefined>>();
type DevelopmentSession = {
  adminState: FrontendAdminState;
  manifest: RbThemeManifest;
  manifestUrl: string;
  publishedDevelopmentFeatures: RbFrontendFeature[];
};
const developmentSessionRequests = new Map<number, Promise<DevelopmentSession | undefined>>();
let storageLoaded = false;

function loadStorage() {
  if (!import.meta.dev || !import.meta.client || storageLoaded) return;
  storageLoaded = true;
  const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
  if (savedMode === 'development' || savedMode === 'published' || savedMode === 'none') mode.value = savedMode;
  else if (savedMode === 'draft') localStorage.setItem(MODE_STORAGE_KEY, 'published');
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) ?? '{}') as unknown;
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) configurations.value = saved as Record<string, ThemeDevGameConfig>;
  } catch {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fallbackKey(surface: RbFrontendSurface) {
  return `${surface}:game:0`;
}

function currentKey(context: ThemeDevContext) {
  return `${context.surface}:${context.scopeKind}:${context.scopeId}`;
}

function availableFeatures(manifest: RbThemeManifest) {
  return [
    manifest.features?.locale && RbFrontendFeature.Locale,
    manifest.features?.icons && RbFrontendFeature.Icons,
    manifest.features?.ui && RbFrontendFeature.Ui,
  ].filter((value): value is RbFrontendFeature => typeof value === 'number');
}

function rendererDefinition(manifest: RbThemeManifest | undefined, rendererId: string | null | undefined, surface: RbFrontendSurface) {
  const definition = rendererId ? manifest?.features?.renderers?.[rendererId] : undefined;
  return definition?.surface === surface ? definition : undefined;
}

function renderersForSurface(manifest: RbThemeManifest, surface: RbFrontendSurface) {
  return Object.entries(manifest.features?.renderers ?? {}).filter(([, renderer]) => renderer.surface === surface);
}

function saveStorage() {
  if (import.meta.client) localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configurations.value));
}

async function matchingPackageFeatures(gameId: number, packageName: string, previewRevision?: number) {
  try {
    const response = await fetchFrontendFeaturesResponse(gameId, previewRevision);
    const matches = await Promise.all(response.packages.map(async source => {
      const manifest = await fetchThemeManifest(source.manifestUrl);
      return manifest.package.name === packageName ? source.features : [];
    }));
    return [...new Set(matches.flat())].sort((a, b) => a - b);
  } catch (error) {
    console.error('[RBPH theme dev feature defaults]', error);
    return [];
  }
}

function ensureGameConfig(context: ThemeDevContext) {
  const stored = configurations.value[String(context.gameId)];
  const config: ThemeDevGameConfig = stored && typeof stored === 'object'
    ? stored
    : { bindings: {}, packageFeatures: {}, packageFeaturesInitialized: {}, baseFeatures: 'published' };
  let changed = config !== stored;
  if (!config.bindings) {
    config.bindings = {};
    changed = true;
  }
  if (!config.packageFeatures) {
    config.packageFeatures = {};
    changed = true;
  }
  if (!config.packageFeaturesInitialized) {
    config.packageFeaturesInitialized = {};
    changed = true;
  }
  if (!config.baseFeatures) {
    config.baseFeatures = 'published';
    changed = true;
  }
  if ((config.baseFeatures as string) === 'draft') {
    config.baseFeatures = 'published';
    changed = true;
  }
  for (const surface of ['round-page', 'puzzle-page'] as const) {
    const key = fallbackKey(surface);
    if (!config.bindings[key]) {
      config.bindings[key] = { mode: 'published' };
      changed = true;
    }
  }
  for (const [key, binding] of Object.entries(config.bindings)) {
    const legacy = binding as RbThemeDevBinding & { config?: unknown };
    if ('config' in legacy) {
      delete legacy.config;
      changed = true;
    }
    if ((binding.mode as string) === 'draft') {
      binding.mode = 'published';
      changed = true;
    }
    if (binding.mode === 'package') {
      const pkg = context.adminState?.packages.find(item => item.id === binding.packageId);
      if (pkg?.name === context.manifest.package.name) {
        binding.mode = 'development';
        binding.packageName = context.manifest.package.name;
        delete binding.packageId;
        changed = true;
      }
    }
    if ((binding.mode === 'development' || binding.mode === 'package') && !binding.rendererId) {
      const manifest = binding.mode === 'development'
        ? context.manifest
        : context.adminState?.packages.find(item => item.id === binding.packageId)?.manifest;
      const surface = key.startsWith('puzzle-page:') ? 'puzzle-page' : 'round-page';
      const rendererId = manifest ? renderersForSurface(manifest, surface)[0]?.[0] : undefined;
      if (rendererId) {
        binding.rendererId = rendererId;
        changed = true;
      }
    }
  }
  if (!config.packageFeaturesInitialized[context.manifest.package.name]) {
    const supported = new Set(availableFeatures(context.manifest));
    config.packageFeatures[context.manifest.package.name] = context.publishedDevelopmentFeatures.filter(feature => supported.has(feature));
    config.packageFeaturesInitialized[context.manifest.package.name] = true;
    changed = true;
  }
  if (changed) {
    configurations.value = { ...configurations.value, [context.gameId]: config };
    saveStorage();
  }
  return config;
}

function gameConfig(context = active.value) {
  return context ? configurations.value[String(context.gameId)] : undefined;
}

function currentBinding(context = active.value): RbThemeDevBinding {
  if (!context) return { mode: 'published' };
  return clone(gameConfig(context)?.bindings[currentKey(context)] ?? { mode: 'published' });
}

function fallbackBinding(surface: RbFrontendSurface, context = active.value): RbThemeDevBinding {
  if (!context) return { mode: 'published' };
  return clone(gameConfig(context)?.bindings[fallbackKey(surface)] ?? { mode: 'published' });
}

function publishedPageInherits(context: ThemeDevContext) {
  return !context.adminState?.published_bindings.some(binding =>
    binding.surface === context.surface
    && binding.scope_kind === context.scopeKind
    && binding.scope_id === context.scopeId,
  );
}

function effectiveBinding(context: ThemeDevContext) {
  const binding = currentBinding(context);
  return binding.mode === 'inherit' || (binding.mode === 'published' && publishedPageInherits(context))
    ? fallbackBinding(context.surface, context)
    : binding;
}

function packageFor(binding: RbThemeDevBinding, context: ThemeDevContext) {
  return binding.mode === 'package' ? context.adminState?.packages.find(item => item.id === binding.packageId) : undefined;
}

function builtinRenderer(context: ThemeDevContext): RbFrontendRenderer {
  return { mode: 'builtin', layout: 'game', surface: context.surface, revision: revision.value };
}

function rendererForBinding(binding: RbThemeDevBinding, context: ThemeDevContext): RbFrontendRenderer {
  if (binding.mode === 'published') {
    const definition = context.publishedManifest?.package.name === context.manifest.package.name
      ? rendererDefinition(context.manifest, context.published.rendererId, context.surface)
      : undefined;
    if (definition) {
      return { mode: 'package', layout: definition.layout === 'game-full' ? 'game-full' : 'game', surface: context.surface, revision: revision.value, packageId: context.published.packageId, rendererId: context.published.rendererId, manifestUrl: context.manifestUrl };
    }
    return { ...context.published };
  }
  if (binding.mode === 'development') {
    const definition = binding.packageName === context.manifest.package.name ? rendererDefinition(context.manifest, binding.rendererId, context.surface) : undefined;
    if (!definition) return builtinRenderer(context);
    return { mode: 'package', layout: definition.layout === 'game-full' ? 'game-full' : 'game', surface: context.surface, revision: revision.value, rendererId: binding.rendererId, manifestUrl: context.manifestUrl };
  }
  if (binding.mode === 'package') {
    const pkg = packageFor(binding, context);
    const definition = rendererDefinition(pkg?.manifest, binding.rendererId, context.surface);
    if (!pkg?.manifest_url || !definition) return builtinRenderer(context);
    return { mode: 'package', layout: definition.layout === 'game-full' ? 'game-full' : 'game', surface: context.surface, revision: revision.value, packageId: pkg.id, rendererId: binding.rendererId, manifestUrl: pkg.manifest_url };
  }
  return builtinRenderer(context);
}

function rendererFor(context: ThemeDevContext): RbFrontendRenderer {
  if (mode.value === 'none') return builtinRenderer(context);
  if (mode.value === 'published') return { ...context.published };
  return rendererForBinding(effectiveBinding(context), context);
}

function setMode(value: RbThemeDevMode) {
  mode.value = value;
  if (import.meta.client) localStorage.setItem(MODE_STORAGE_KEY, value);
  revision.value++;
}

function setBinding(key: string, value: RbThemeDevBinding) {
  const context = active.value;
  const config = gameConfig(context);
  if (!context || !config || mode.value !== 'development') return;
  config.bindings[key] = clone(value);
  configurations.value = { ...configurations.value, [context.gameId]: config };
  saveStorage();
  revision.value++;
}

function setCurrentBinding(value: RbThemeDevBinding) {
  const context = active.value;
  if (context) setBinding(currentKey(context), value);
}

function setDevelopmentBinding(key: string, value: RbThemeDevBinding) {
  setBinding(key, value);
}

function setFallbackBinding(surface: RbFrontendSurface, value: RbThemeDevBinding) {
  setBinding(fallbackKey(surface), value);
}

function featureEnabled(feature: RbFrontendFeature, context = active.value) {
  if (!context) return false;
  return gameConfig(context)?.packageFeatures[context.manifest.package.name]?.includes(feature) ?? false;
}

function setFeatureEnabled(feature: RbFrontendFeature, enabled: boolean) {
  const context = active.value;
  const config = gameConfig(context);
  if (!context || !config || mode.value !== 'development') return;
  const name = context.manifest.package.name;
  const current = new Set(config.packageFeatures[name] ?? []);
  if (enabled) current.add(feature);
  else current.delete(feature);
  config.packageFeatures[name] = [...current].sort((a, b) => a - b);
  configurations.value = { ...configurations.value, [context.gameId]: config };
  saveStorage();
}

function setBaseFeatures(value: 'published' | 'none') {
  const context = active.value;
  const config = gameConfig(context);
  if (!context || !config || mode.value !== 'development') return;
  config.baseFeatures = value;
  configurations.value = { ...configurations.value, [context.gameId]: config };
  saveStorage();
}

function resetDevelopmentConfig(target: RbThemeDevResetTarget) {
  const context = active.value;
  if (!context) return;
  const bindingMode = target === 'none' ? 'builtin' : target;
  const defaults = target === 'none' ? [] : context.publishedDevelopmentFeatures;
  const supported = new Set(availableFeatures(context.manifest));
  const config: ThemeDevGameConfig = {
    bindings: {
      [fallbackKey('round-page')]: { mode: bindingMode },
      [fallbackKey('puzzle-page')]: { mode: bindingMode },
    },
    packageFeatures: { [context.manifest.package.name]: defaults.filter(feature => supported.has(feature)) },
    packageFeaturesInitialized: { [context.manifest.package.name]: true },
    baseFeatures: target,
  };
  configurations.value = { ...configurations.value, [context.gameId]: config };
  saveStorage();
  mode.value = target;
  if (import.meta.client) localStorage.setItem(MODE_STORAGE_KEY, target);
  revision.value++;
}

function sameFeatures(left: RbFrontendFeature[], right: RbFrontendFeature[]) {
  return left.length === right.length && left.every((feature, index) => feature === right[index]);
}

function exportedDevelopmentConfig(context = active.value) {
  const config = gameConfig(context);
  if (!context || !config) return {};
  const bindings: Record<string, RbThemeDevBinding> = {};
  for (const [key, binding] of Object.entries(config.bindings)) {
    const [surface, scope] = key.split(':');
    if (scope === 'game') {
      if (binding.mode !== 'published') bindings[key] = clone(binding);
      continue;
    }
    const fallback = surface === 'round-page'
      ? config.bindings[fallbackKey('round-page')]
      : surface === 'puzzle-page'
        ? config.bindings[fallbackKey('puzzle-page')]
        : undefined;
    if (binding.mode === 'published' && fallback?.mode === 'published') continue;
    bindings[key] = clone(binding);
  }

  const result: Record<string, unknown> = {};
  if (Object.keys(bindings).length) result.bindings = bindings;
  if (config.baseFeatures !== 'published') result.baseFeatures = config.baseFeatures;
  const name = context.manifest.package.name;
  const supported = new Set(availableFeatures(context.manifest));
  const currentFeatures = [...(config.packageFeatures[name] ?? [])].filter(feature => supported.has(feature)).sort((a, b) => a - b);
  const publishedFeatures = [...context.publishedDevelopmentFeatures].filter(feature => supported.has(feature)).sort((a, b) => a - b);
  if (!sameFeatures(currentFeatures, publishedFeatures)) result.packageFeatures = { [name]: currentFeatures };
  return result;
}

function developmentServer() {
  if (!import.meta.dev) return;
  const configured = String(useRuntimeConfig().public.themeDevServer || '').trim();
  if (!configured) return;
  try {
    const base = new URL(configured.endsWith('/') ? configured : `${configured}/`);
    if (base.protocol !== 'http:' && base.protocol !== 'https:') return;
    return base;
  } catch {
    return;
  }
}

async function fetchAdminState(gameId: number) {
  let request = adminStateRequests.get(gameId);
  if (!request) {
    request = useApi().get<FrontendAdminState>(`/admin/games/${gameId}/frontend`)
      .then(response => Array.isArray(response.data.published_bindings) ? response.data : undefined)
      .catch(() => undefined);
    adminStateRequests.set(gameId, request);
  }
  return request;
}

type ThemeDevTranslate = (key: string, params: Record<string, string | number>) => string;

async function loadDevelopmentSession(gameId: number, translate: ThemeDevTranslate) {
  const user = await useUser().waitUpdate();
  if ((user.value?.urole ?? RbUserRole.User) < RbUserRole.Admin) return;
  const server = developmentServer();
  if (!server) return;
  let request = developmentSessionRequests.get(gameId);
  if (!request) {
    request = (async () => {
      const adminState = await fetchAdminState(gameId);
      if (!adminState) return;
      loadStorage();
      const manifestUrl = new URL('rbph-theme.json', server).href;
      const response = await fetch(manifestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(translate('admin.frontend.dev.manifestFetchFailed', { status: response.status }));
      const manifest = await response.json() as RbThemeManifest;
      if (manifest.type !== 'rbph-theme' || manifest.apiVersion !== 1) throw new Error(translate('admin.frontend.dev.manifestInvalid', {}));
      cacheThemeManifest(manifestUrl, manifest);
      return {
        adminState,
        manifest,
        manifestUrl,
        publishedDevelopmentFeatures: await matchingPackageFeatures(gameId, manifest.package.name),
      };
    })();
    developmentSessionRequests.set(gameId, request);
  }
  try {
    return await request;
  } catch (error) {
    if (developmentSessionRequests.get(gameId) === request) developmentSessionRequests.delete(gameId);
    throw error;
  }
}

async function initialize(gameId: number, forceGeneral: boolean, translate: ThemeDevTranslate) {
  const session = await loadDevelopmentSession(gameId, translate);
  if (!session) {
    active.value = undefined;
    return;
  }
  if (!forceGeneral && active.value?.gameId === gameId && active.value.currentPage) return;
  const context: ThemeDevContext = {
    key: `${gameId}:game`,
    gameId,
    surface: 'round-page',
    scopeKind: 'game',
    scopeId: 0,
    currentPage: false,
    manifestUrl: session.manifestUrl,
    manifest: session.manifest,
    published: { mode: 'builtin', layout: 'game', surface: 'round-page', revision: revision.value },
    draftRevisionId: session.adminState.draft.id,
    adminState: session.adminState,
    canWriteDraft: true,
    publishedDevelopmentFeatures: session.publishedDevelopmentFeatures,
  };
  active.value = context;
  ensureGameConfig(context);
}

async function resolve(options: { gameId: number; surface: RbFrontendSurface; roundId?: number; puzzleId?: number; previewRevision?: number; published: RbFrontendRenderer }, translate: ThemeDevTranslate): Promise<RbFrontendRenderer> {
  if (options.previewRevision) {
    active.value = undefined;
    return options.published;
  }
  const session = await loadDevelopmentSession(options.gameId, translate);
  if (!session) {
    active.value = undefined;
    return options.published;
  }
  let publishedManifest = options.published.packageId
    ? session.adminState.packages.find(item => item.id === options.published.packageId)?.manifest
    : undefined;
  if (!publishedManifest && options.published.mode === 'package' && options.published.manifestUrl) {
    try {
      publishedManifest = await fetchThemeManifest(options.published.manifestUrl);
    } catch (error) {
      console.error('[RBPH theme dev published package]', error);
    }
  }

  const scopeKind = options.surface === 'puzzle-page' ? 'puzzle' : 'round';
  const scopeId = scopeKind === 'puzzle' ? options.puzzleId : options.roundId;
  if (!scopeId) throw new Error(translate('admin.frontend.dev.missingScopeId', { scope: scopeKind === 'puzzle' ? translate('admin.frontend.common.puzzle', {}) : translate('admin.frontend.common.round', {}) }));
  const context: ThemeDevContext = {
    key: `${options.gameId}:${options.surface}:${scopeKind}:${scopeId}`,
    gameId: options.gameId,
    surface: options.surface,
    scopeKind,
    scopeId,
    currentPage: true,
    roundId: options.roundId,
    manifestUrl: session.manifestUrl,
    manifest: session.manifest,
    published: options.published,
    publishedManifest,
    draftRevisionId: session.adminState.draft.id,
    adminState: session.adminState,
    canWriteDraft: true,
    publishedDevelopmentFeatures: session.publishedDevelopmentFeatures,
  };
  active.value = context;
  ensureGameConfig(context);
  return rendererFor(context);
}

function productionConfig(context: ThemeDevContext, translate: ThemeDevTranslate): FrontendConfig {
  const admin = context.adminState;
  const changes = exportedDevelopmentConfig(context) as {
    bindings?: Record<string, RbThemeDevBinding>;
    baseFeatures?: 'none';
    packageFeatures?: Record<string, RbFrontendFeature[]>;
  };
  if (!admin) throw new Error(translate('admin.frontend.errors.config.draftUnavailable', {}));
  const activePackages = admin.packages.filter(item => !item.delete_pending);
  const activePackageById = new Map(activePackages.map(item => [item.id, item]));
  const packageByName = new Map(activePackages.map(item => [item.name, item]));
  const missingPackageError = (name: string) => new Error(translate('admin.frontend.errors.config.missingNamedPackage', { name }));
  const packageById = new Map(admin.packages.flatMap(item => {
    const effective = item.delete_pending ? packageByName.get(item.name) : item;
    return effective ? [[item.id, effective] as const] : [];
  }));
  const bindings = new Map<string, FrontendConfigBinding>();
  const serialize = (binding: FrontendBinding): FrontendConfigBinding | undefined => {
    const pkg = binding.package_id ? packageById.get(binding.package_id) : undefined;
    if (binding.package_id && !pkg) return;
    return {
      surface: binding.surface,
      scopeKind: binding.scope_kind,
      scopeId: binding.scope_id,
      packageName: pkg?.name ?? null,
      rendererId: binding.renderer_id ?? null,
    };
  };
  for (const binding of admin.published_bindings) {
    const value = serialize(binding);
    if (value) bindings.set(`${binding.surface}:${binding.scope_kind}:${binding.scope_id}`, value);
  }
  const publishedValue = (surface: RbFrontendSurface, scopeKind: string, scopeId: number) => {
    const exact = admin.published_bindings.find(item => item.surface === surface && item.scope_kind === scopeKind && item.scope_id === scopeId);
    if (exact) return serialize(exact);
    const fallback = admin.published_bindings.find(item => item.surface === surface && item.scope_kind === 'game' && item.scope_id === 0);
    const serializedFallback = fallback ? serialize(fallback) : undefined;
    return serializedFallback
      ? { ...serializedFallback, scopeKind: scopeKind as 'game' | 'round' | 'puzzle', scopeId }
      : { surface, scopeKind: scopeKind as 'game' | 'round' | 'puzzle', scopeId, packageName: null, rendererId: null };
  };
  for (const [key, binding] of Object.entries(changes.bindings ?? {})) {
    const [surface, scopeKind, rawScopeId] = key.split(':') as [RbFrontendSurface, 'game' | 'round' | 'puzzle', string];
    const scopeId = Number(rawScopeId);
    if (binding.mode === 'inherit') {
      bindings.delete(key);
      continue;
    }
    if (binding.mode === 'published') {
      const value = publishedValue(surface, scopeKind, scopeId);
      if (value) bindings.set(key, value);
      else bindings.delete(key);
      continue;
    }
    if (binding.mode === 'builtin') {
      bindings.set(key, { surface, scopeKind, scopeId, packageName: null, rendererId: null });
      continue;
    }
    const pkg = binding.mode === 'development'
      ? packageByName.get(context.manifest.package.name)
      : activePackageById.get(binding.packageId ?? 0);
    if (!pkg) {
      const packageName = binding.mode === 'development'
        ? context.manifest.package.name
        : admin.packages.find(item => item.id === binding.packageId)?.name ?? binding.packageName ?? `#${binding.packageId}`;
      throw missingPackageError(packageName);
    }
    bindings.set(key, { surface, scopeKind, scopeId, packageName: pkg.name, rendererId: binding.rendererId ?? null });
  }

  const features = new Map<string, Set<RbFrontendFeature>>();
  if (!changes.baseFeatures) {
    for (const activation of admin.published_feature_activations) {
      const pkg = packageById.get(activation.package_id);
      if (pkg) {
        const selected = features.get(pkg.name) ?? new Set<RbFrontendFeature>();
        selected.add(activation.feature);
        features.set(pkg.name, selected);
      }
    }
  }
  for (const [name, selected] of Object.entries(changes.packageFeatures ?? {})) {
    if (!packageByName.has(name)) throw missingPackageError(name);
    features.set(name, new Set(selected));
  }
  return {
    formatVersion: 1,
    bindings: [...bindings.values()].sort((a, b) => `${a.surface}:${a.scopeKind}:${a.scopeId}`.localeCompare(`${b.surface}:${b.scopeKind}:${b.scopeId}`)),
    features: [...features.entries()].filter(([, selected]) => selected.size).map(([packageName, selected]) => ({ packageName, features: [...selected].sort((a, b) => a - b) })),
  };
}

async function uploadDevelopmentConfig(errorHints: Record<number, string>, translate: ThemeDevTranslate) {
  const context = active.value;
  if (!context?.canWriteDraft || !context.draftRevisionId) throw new Error(translate('admin.frontend.errors.config.draftUnavailable', {}));
  await useApi().put(`/admin/games/${context.gameId}/frontend/config`, productionConfig(context, translate), { errorHints });
  adminStateRequests.delete(context.gameId);
  developmentSessionRequests.delete(context.gameId);
  sourceRevision.value++;
}

function featurePlan(): RbThemeDevFeaturePlan {
  const context = active.value;
  if (mode.value === 'none') return { base: 'none', developmentFeatures: [] };
  if (mode.value !== 'development' || !context) return { base: 'published', developmentFeatures: [] };
  const requestedBase = gameConfig(context)?.baseFeatures ?? 'published';
  return {
    base: requestedBase,
    developmentManifestUrl: context.manifestUrl,
    developmentPackageName: context.manifest.package.name,
    developmentFeatures: availableFeatures(context.manifest).filter(feature => featureEnabled(feature, context)),
  };
}

export function useThemeDev() {
  const user = useUser();
  const { t } = useI18n();
  const translate: ThemeDevTranslate = (key, params) => t(key, params);
  return {
    enabled: computed(() => (user.ref.value?.urole ?? RbUserRole.User) >= RbUserRole.Admin && Boolean(developmentServer())),
    mode: readonly(mode),
    active: readonly(active),
    revision: readonly(revision),
    sourceRevision: readonly(sourceRevision),
    currentBinding: computed(() => currentBinding()),
    roundFallback: computed(() => fallbackBinding('round-page')),
    puzzleFallback: computed(() => fallbackBinding('puzzle-page')),
    developmentConfig: computed(() => gameConfig() ? clone(gameConfig()!) : undefined),
    exportedDevelopmentConfig: computed(() => exportedDevelopmentConfig()),
    availableFeatures: computed(() => active.value ? availableFeatures(active.value.manifest) : []),
    featurePlan: computed(() => featurePlan()),
    setMode,
    setCurrentBinding,
    setDevelopmentBinding,
    setFallbackBinding,
    featureEnabled: (feature: RbFrontendFeature) => featureEnabled(feature),
    setFeatureEnabled,
    setBaseFeatures,
    resetDevelopmentConfig,
    initialize: (gameId: number, forceGeneral = false) => initialize(gameId, forceGeneral, translate),
    clear: () => { active.value = undefined; },
    resolve: (options: Parameters<typeof resolve>[0]) => resolve(options, translate),
    refresh: () => { adminStateRequests.clear(); developmentSessionRequests.clear(); sourceRevision.value++; },
    uploadDevelopmentConfig: () => uploadDevelopmentConfig(localizeRbErrorHints(rbFrontendConfigErrorKeys, key => t(key)), translate),
  };
}
