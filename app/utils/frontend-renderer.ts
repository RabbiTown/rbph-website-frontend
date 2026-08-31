import type { MaybeRefOrGetter } from 'vue';
import type { IconifyJSON } from '@iconify/types';

export type RbFrontendSurface = 'round-page' | 'puzzle-page';
export enum RbFrontendFeature {
  Locale = 0,
  Icons = 1,
  Ui = 2,
}

export enum RbFrontendConfigResult {
  InvalidFormat = -1,
  MissingPackage = -2,
  InvalidBinding = -3,
  InvalidPackageManifest = -4,
  RendererRequired = -5,
  RendererUnavailable = -6,
  InvalidFeature = -7,
  Ok = 0,
}

export enum RbFrontendPackageResult {
  GameNotFound = -1,
  ArchiveTooLarge = -2,
  ZipRequired = -3,
  InvalidArchive = -4,
  EmptyArchive = -5,
  InvalidManifest = -6,
  StorageFailed = -8,
  NameConflict = -9,
  PackageNotFound = -10,
  AssetNotFound = -11,
  NewerPackageExists = -12,
  NotPendingDeletion = -13,
  Ok = 0,
}

export enum RbFrontendBindingResult {
  InvalidRevision = -1,
  InvalidSurface = -2,
  InvalidScope = -3,
  PackageNotFound = -4,
  PackagePendingDeletion = -5,
  InvalidPackageManifest = -6,
  RendererRequired = -7,
  RendererUnavailable = -8,
  UnexpectedRenderer = -9,
  Ok = 0,
}

export enum RbFrontendFeatureResult {
  PackageNotFound = -1,
  PackagePendingDeletion = -2,
  InvalidPackageManifest = -3,
  InvalidRevision = -4,
  UnsupportedFeature = -5,
  Ok = 0,
}

export enum RbFrontendPublishResult {
  RevisionNotFound = -1,
  Ok = 0,
}

export enum RbFrontendRendererResult {
  InvalidQuery = -1,
  ResourceNotFound = -2,
  PreviewForbidden = -3,
  Ok = 0,
}

export enum RbFrontendFeaturesResult {
  PreviewForbidden = -1,
  Ok = 0,
}

export const rbFrontendConfigErrorKeys: Record<number, string> = {
  [RbFrontendConfigResult.InvalidFormat]: 'admin.frontend.errors.config.invalidFormat',
  [RbFrontendConfigResult.MissingPackage]: 'admin.frontend.errors.config.missingPackage',
  [RbFrontendConfigResult.InvalidBinding]: 'admin.frontend.errors.config.invalidBinding',
  [RbFrontendConfigResult.InvalidPackageManifest]: 'admin.frontend.errors.common.invalidPackageManifest',
  [RbFrontendConfigResult.RendererRequired]: 'admin.frontend.errors.common.rendererRequired',
  [RbFrontendConfigResult.RendererUnavailable]: 'admin.frontend.errors.common.rendererUnavailable',
  [RbFrontendConfigResult.InvalidFeature]: 'admin.frontend.errors.config.invalidFeature',
};

export const rbFrontendPackageErrorKeys: Record<number, string> = {
  [RbFrontendPackageResult.GameNotFound]: 'admin.frontend.errors.package.gameNotFound',
  [RbFrontendPackageResult.ArchiveTooLarge]: 'admin.frontend.errors.package.archiveTooLarge',
  [RbFrontendPackageResult.ZipRequired]: 'admin.frontend.errors.package.zipRequired',
  [RbFrontendPackageResult.InvalidArchive]: 'admin.frontend.errors.package.invalidArchive',
  [RbFrontendPackageResult.EmptyArchive]: 'admin.frontend.errors.package.emptyArchive',
  [RbFrontendPackageResult.InvalidManifest]: 'admin.frontend.errors.package.invalidManifest',
  [RbFrontendPackageResult.StorageFailed]: 'admin.frontend.errors.package.storageFailed',
  [RbFrontendPackageResult.NameConflict]: 'admin.frontend.errors.package.nameConflict',
  [RbFrontendPackageResult.PackageNotFound]: 'admin.frontend.errors.common.packageNotFound',
  [RbFrontendPackageResult.AssetNotFound]: 'admin.frontend.errors.package.assetNotFound',
  [RbFrontendPackageResult.NewerPackageExists]: 'admin.frontend.errors.package.newerPackageExists',
  [RbFrontendPackageResult.NotPendingDeletion]: 'admin.frontend.errors.package.notPendingDeletion',
};

export const rbFrontendBindingErrorKeys: Record<number, string> = {
  [RbFrontendBindingResult.InvalidRevision]: 'admin.frontend.errors.common.invalidRevision',
  [RbFrontendBindingResult.InvalidSurface]: 'admin.frontend.errors.binding.invalidSurface',
  [RbFrontendBindingResult.InvalidScope]: 'admin.frontend.errors.binding.invalidScope',
  [RbFrontendBindingResult.PackageNotFound]: 'admin.frontend.errors.common.packageNotFound',
  [RbFrontendBindingResult.PackagePendingDeletion]: 'admin.frontend.errors.common.packagePendingDeletion',
  [RbFrontendBindingResult.InvalidPackageManifest]: 'admin.frontend.errors.common.invalidPackageManifest',
  [RbFrontendBindingResult.RendererRequired]: 'admin.frontend.errors.common.rendererRequired',
  [RbFrontendBindingResult.RendererUnavailable]: 'admin.frontend.errors.common.rendererUnavailable',
  [RbFrontendBindingResult.UnexpectedRenderer]: 'admin.frontend.errors.binding.unexpectedRenderer',
};

export const rbFrontendFeatureErrorKeys: Record<number, string> = {
  [RbFrontendFeatureResult.PackageNotFound]: 'admin.frontend.errors.common.packageNotFound',
  [RbFrontendFeatureResult.PackagePendingDeletion]: 'admin.frontend.errors.common.packagePendingDeletion',
  [RbFrontendFeatureResult.InvalidPackageManifest]: 'admin.frontend.errors.common.invalidPackageManifest',
  [RbFrontendFeatureResult.InvalidRevision]: 'admin.frontend.errors.common.invalidRevision',
  [RbFrontendFeatureResult.UnsupportedFeature]: 'admin.frontend.errors.feature.unsupportedFeature',
};

export const rbFrontendPublishErrorKeys: Record<number, string> = {
  [RbFrontendPublishResult.RevisionNotFound]: 'admin.frontend.errors.publish.revisionNotFound',
};

export function localizeRbErrorHints(keys: Record<number, string>, t: (key: string) => string) {
  return Object.fromEntries(Object.entries(keys).map(([code, key]) => [Number(code), t(key)]));
}
export interface RbFrontendRenderer {
  mode: 'builtin' | 'package';
  layout: 'game' | 'game-full';
  surface: RbFrontendSurface;
  revision?: number | null;
  packageId?: number | null;
  rendererId?: string | null;
  manifestUrl?: string | null;
}

export interface RbThemeRendererManifest {
  surface: RbFrontendSurface;
  layout?: 'game' | 'game-full';
  entry: string;
  styles?: string[];
}

export type RbThemeLocaleEntry =
  | { type: 'inline'; messages: Record<string, unknown> }
  | { type: 'json' | 'module'; source: string };

export interface RbThemeFeatures {
  renderers?: Record<string, RbThemeRendererManifest>;
  locale?: { locales: Record<string, RbThemeLocaleEntry> };
  icons?: { collections: Array<IconifyJSON | string> };
  ui?: { icons: Record<string, string>; source?: never } | { source: string; icons?: never };
}

export interface RbThemePermissions {
  sync?: 'all' | SyncMessageType[];
}

export interface RbThemeManifest {
  type: 'rbph-theme';
  apiVersion: 1;
  package: { name: string; version: string };
  permissions?: RbThemePermissions;
  features?: RbThemeFeatures;
}

export interface RbFrontendFeaturePackage {
  packageId: number;
  manifestUrl: string;
  features: RbFrontendFeature[];
}

export interface RbFrontendFeaturesResponse {
  revision?: number | null;
  packages: RbFrontendFeaturePackage[];
}

function fetchFrontendRenderer(options: {
  gameId: number;
  surface: RbFrontendSurface;
  roundId?: number;
  puzzleId?: number;
  previewRevision: number;
}) {
  return useApi()
    .get<RbFrontendRenderer>(`/games/${options.gameId}/frontend/renderer`, {
      query: {
        surface: options.surface,
        round_id: options.roundId,
        puzzle_id: options.puzzleId,
        preview: options.previewRevision,
      },
    })
    .then(response => response.data);
}

// Feature responses are immutable for the lifetime of the document. A published
// update is announced through sync and takes effect after the user reloads.
const frontendFeatureResponses = new Map<string, Promise<RbFrontendFeaturesResponse>>();

export function fetchFrontendFeaturesResponse(gameId: number, previewRevision?: number) {
  const key = `${gameId}:${previewRevision ?? 'published'}`;
  let request = frontendFeatureResponses.get(key);
  if (!request) {
    request = useApi()
      .get<RbFrontendFeaturesResponse>(`/games/${gameId}/frontend/features`, {
        query: { preview: previewRevision },
      })
      .then(response => response.data);
    frontendFeatureResponses.set(key, request);
  }
  return request;
}

export function useFrontendRenderer(options: {
  published: MaybeRefOrGetter<RbFrontendRenderer | undefined>;
  gameId: MaybeRefOrGetter<number | undefined>;
  surface: RbFrontendSurface;
  roundId?: MaybeRefOrGetter<number | undefined>;
  puzzleId?: MaybeRefOrGetter<number | undefined>;
  previewRevision?: MaybeRefOrGetter<number | undefined>;
}) {
  const themeDev = useThemeDev();
  const renderer = shallowRef<RbFrontendRenderer>();
  const loading = ref(false);
  let requestId = 0;

  async function refresh() {
    const published = toValue(options.published);
    const gameId = toValue(options.gameId);
    const roundId = options.roundId === undefined ? undefined : toValue(options.roundId);
    const puzzleId = options.puzzleId === undefined ? undefined : toValue(options.puzzleId);
    const previewRevision = options.previewRevision === undefined ? undefined : toValue(options.previewRevision);
    if (!published || !gameId || (options.surface === 'round-page' && !roundId) || (options.surface === 'puzzle-page' && !puzzleId)) {
      renderer.value = undefined;
      return;
    }
    const current = ++requestId;
    loading.value = true;
    try {
      let resolved = previewRevision
        ? await fetchFrontendRenderer({ gameId, surface: options.surface, roundId, puzzleId, previewRevision })
        : published;
      try {
        resolved = await themeDev.resolve({ gameId, surface: options.surface, roundId, puzzleId, previewRevision, published: resolved });
      } catch (error) {
        console.error('[RBPH theme dev]', error);
      }
      if (current === requestId) renderer.value = resolved;
    } catch (error) {
      if (current === requestId) renderer.value = undefined;
      console.error('[RBPH frontend renderer]', error);
    } finally {
      if (current === requestId) loading.value = false;
    }
  }

  watch(() => [toValue(options.published), toValue(options.gameId), options.roundId === undefined ? undefined : toValue(options.roundId), options.puzzleId === undefined ? undefined : toValue(options.puzzleId), options.previewRevision === undefined ? undefined : toValue(options.previewRevision), themeDev.enabled.value, themeDev.sourceRevision.value], refresh, { immediate: true });
  watch(() => themeDev.revision.value, refresh);
  return { renderer, loading, refresh };
}
