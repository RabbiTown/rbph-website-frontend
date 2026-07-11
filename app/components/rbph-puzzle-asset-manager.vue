<script setup lang="ts">const { t } = useI18n();


interface AdminAssetGroupData {
  id: number;
  game_id: number;
  puzzle_id?: number | null;
  round_id?: number | null;
  backend: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size: number;
  sha256: string;
  ctime_at: string;
}

interface AdminAssetFileData {
  id: number;
  group_id: number;
  relative_path: string;
  mime_type: string;
  size: number;
  sha256: string;
  ctime_at: string;
}

interface AdminAssetGroupItem {
  group: AdminAssetGroupData;
  files: AdminAssetFileData[];
}

interface AssetStorageBackendData {
  backend: string;
  kind: 'local' | 'cos';
  label: string;
  recommended: boolean;
}

interface AssetTreeItem {
  label: string;
  path: string;
  icon: string;
  defaultExpanded?: boolean;
  file?: AdminAssetFileData;
  children?: AssetTreeItem[];
}

const props = defineProps<{
  gameId?: number | null;
  puzzleId?: number | null;
  roundId?: number | null;
}>();

const api = useApi();
const toast = useToast();
const puzzleContext = useAdmin().useOptionalPuzzleContext();

const loading = ref(false);
const uploading = ref(false);
const deletingId = ref<number | null>(null);
const savingInfo = ref(false);
const renamingFileId = ref<number | null>(null);
const renamingFolderPath = ref<string | null>(null);
const deletingFileId = ref<number | null>(null);
const uploadConfirmOpen = ref(false);
const infoOpen = ref(false);
const uploadChoice = ref<'group' | 'file'>('group');
const uploadBackend = ref('local');
const storageBackends = ref<AssetStorageBackendData[]>([
  { backend: 'local', kind: 'local', label: t('components.rbphPuzzleAssetManager.storage.local.label'), recommended: true },
]);
const infoTarget = ref<AdminAssetGroupItem | null>(null);
const groups = ref<AdminAssetGroupItem[]>([]);
const files = ref<File | null>(null);
const infoState = reactive({
  originalName: '',
});
const fileRenameState = reactive({
  fileName: '',
});
const folderRenameState = reactive({
  name: '',
});

const accept = '*';

const gameId = computed(() => props.gameId ?? puzzleContext?.puzzle.value?.game_id ?? null);
const roundId = computed(() => props.roundId ?? null);
const puzzleId = computed(() => props.puzzleId ?? (roundId.value ? null : puzzleContext?.puzzle.value?.id ?? null));
const hasScope = computed(() => Boolean(gameId.value) && !(puzzleId.value && roundId.value));
const infoDirty = computed(() => Boolean(infoTarget.value && infoState.originalName.trim() !== infoTarget.value.group.original_name));
const infoFileTree = computed(() => (infoTarget.value ? buildAssetFileTree(infoTarget.value.files) : []));
const infoFileTreeKey = computed(() => infoTarget.value?.files.map(file => `${file.id}:${file.relative_path}`).join('|') ?? 'empty');
const uploadIsZip = computed(() => Boolean(files.value && shouldUploadAsGroup(files.value)));

const storageKindMeta = {
  local: {
    label: t('components.rbphPuzzleAssetManager.storage.local.label'),
    icon: 'material-symbols:hard-drive-outline',
    description: t('components.rbphPuzzleAssetManager.storage.local.description'),
  },
  cos: {
    label: t('components.rbphPuzzleAssetManager.storage.cos.label'),
    icon: 'material-symbols:cloud-outline',
    description: t('components.rbphPuzzleAssetManager.storage.cos.description'),
  },
} as const;

function storageLabel(backend: string) {
  return storageBackends.value.find(item => item.backend === backend)?.label ?? backend;
}

function storageIcon(backend: string) {
  const kind = storageBackends.value.find(item => item.backend === backend)?.kind;
  return kind ? storageKindMeta[kind].icon : 'material-symbols:storage-rounded';
}

const selectedStorageBackend = computed(() => storageBackends.value.find(item => item.backend === uploadBackend.value));

function formatBytes(size: number) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const value = size / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function buildAssetFileTree(files: AdminAssetFileData[]) {
  const roots: AssetTreeItem[] = [];
  const dirs = new Map<string, AssetTreeItem>();

  function ensureDir(path: string, label: string, parent?: AssetTreeItem) {
    const existing = dirs.get(path);
    if (existing) return existing;

    const item: AssetTreeItem = {
      label,
      path,
      icon: 'material-symbols:folder-outline-rounded',
      defaultExpanded: true,
      children: [],
    };
    dirs.set(path, item);

    if (parent) {
      parent.children ??= [];
      parent.children.push(item);
    } else {
      roots.push(item);
    }

    return item;
  }

  for (const file of files) {
    const parts = file.relative_path.split('/').filter(Boolean);
    let parent: AssetTreeItem | undefined;
    let currentPath = '';

    for (const part of parts.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      parent = ensureDir(currentPath, part, parent);
    }

    const label = parts.at(-1) ?? file.relative_path;
    const item: AssetTreeItem = {
      label,
      path: file.relative_path,
      icon: 'material-symbols:description-outline-rounded',
      file,
    };

    if (parent) {
      parent.children ??= [];
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  }

  const sortItems = (items: AssetTreeItem[]) => {
    items.sort((a, b) => Number(Boolean(b.children?.length)) - Number(Boolean(a.children?.length)) || a.label.localeCompare(b.label));
    for (const item of items) {
      if (item.children?.length) sortItems(item.children);
    }
  };

  sortItems(roots);
  return roots;
}

function assetTreeKey(item: AssetTreeItem) {
  return item.file ? `file:${item.file.id}` : `dir:${item.path}`;
}

function isFolderTreeItem(item: AssetTreeItem) {
  return !item.file;
}

function basename(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

function encodeAssetPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function fileUrl(item: AdminAssetGroupItem, file: AdminAssetFileData) {
  return `/assets/${encodeURIComponent(item.group.object_key)}/${encodeAssetPath(file.relative_path)}`;
}

function groupUrl(item: AdminAssetGroupItem) {
  return `/assets/${encodeURIComponent(item.group.object_key)}/`;
}

function primaryFile(item: AdminAssetGroupItem) {
  return item.files[0];
}

function isSingleAsset(item: AdminAssetGroupItem) {
  return item.files.length === 1;
}

function assetDisplaySize(item: AdminAssetGroupItem) {
  const file = primaryFile(item);
  return file && isSingleAsset(item) ? file.size : item.group.size;
}

function assetDisplayMimeType(item: AdminAssetGroupItem) {
  const file = primaryFile(item);
  return file && isSingleAsset(item) ? file.mime_type : item.group.mime_type;
}

function assetUrl(item: AdminAssetGroupItem) {
  const file = primaryFile(item);
  if (file && isSingleAsset(item)) return fileUrl(item, file);
  return groupUrl(item);
}

function assetMimeType(item: AdminAssetGroupItem) {
  const file = primaryFile(item);
  if (file && isSingleAsset(item)) return file.mime_type;
  return item.group.mime_type;
}

function assetOriginalName(item: AdminAssetGroupItem) {
  const file = primaryFile(item);
  if (file && isSingleAsset(item)) return file.relative_path;
  return item.group.original_name;
}

function onAssetDragStart(event: DragEvent, item: AdminAssetGroupItem) {
  setRbAssetDragData(event, {
    url: assetUrl(item),
    mimeType: assetMimeType(item),
    originalName: assetOriginalName(item),
    assetId: isSingleAsset(item) ? primaryFile(item)?.id : undefined,
    groupId: item.group.id,
    objectKey: item.group.object_key,
    kind: isSingleAsset(item) ? 'file' : 'group',
    files: item.files.map(file => ({
      relativePath: file.relative_path,
      mimeType: file.mime_type,
      size: file.size,
    })),
  });
}

function refreshAssets() {
  if (!gameId.value || !hasScope.value) {
    groups.value = [];
    return Promise.resolve();
  }

  loading.value = true;
  const query: Record<string, number> = {
    game_id: gameId.value,
  };
  if (puzzleId.value) query.puzzle_id = puzzleId.value;
  if (roundId.value) query.round_id = roundId.value;

  return api
    .get<{ groups: AdminAssetGroupItem[] }>('/admin/assets', {
      query,
      errorHints: {
        [-2]: t('components.rbphPuzzleAssetManager.invalidScope'),
        [-1]: t('components.rbphPuzzleAssetManager.scopeNotFound'),
      },
    })
    .then(({ data }) => {
      groups.value = data.groups;
    })
    .catch(error => {
      handleError(error, t('components.rbphPuzzleAssetManager.loadFailed'));
    })
    .finally(() => {
      loading.value = false;
    });
}

async function fetchStorageBackends() {
  try {
    const { data } = await api.get<{ backends: AssetStorageBackendData[] }>('/admin/assets/storage-backends');
    if (!data.backends.length) return;
    storageBackends.value = data.backends;
    uploadBackend.value = data.backends.find(item => item.recommended)?.backend ?? data.backends[0]!.backend;
  } catch (error) {
    handleError(error, t('components.rbphPuzzleAssetManager.loadStorageBackendsFailed'));
  }
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.add({
      title: t('components.rbphPuzzleAssetManager.linkCopied'),
      icon: 'material-symbols:content-copy-outline-rounded',
      color: 'success',
    });
  } catch {
    toast.add({
      title: t('components.rbphPuzzleAssetManager.copyFailed'),
      description: t('components.rbphPuzzleAssetManager.copyManually'),
      icon: 'material-symbols:error-outline-rounded',
      color: 'error',
    });
  }
}

function openAssetInfo(item: AdminAssetGroupItem) {
  infoTarget.value = item;
  infoState.originalName = item.group.original_name;
  cancelFileRename();
  cancelFolderRename();
  infoOpen.value = true;
}

function resetAssetInfoName() {
  if (!infoTarget.value) return;
  infoState.originalName = infoTarget.value.group.original_name;
}

async function saveAssetInfo() {
  const item = infoTarget.value;
  const originalName = infoState.originalName.trim();
  if (!item || savingInfo.value || !infoDirty.value) return;

  savingInfo.value = true;
  try {
    type Response = { group: AdminAssetGroupData; files: AdminAssetFileData[] };
    const { data } = await api.patch<Response>(
      `/admin/assets/${item.group.id}`,
      { original_name: originalName },
      {
        errorHints: {
          [-2]: t('components.rbphPuzzleAssetManager.invalidGroupName'),
          [-1]: t('components.rbphPuzzleAssetManager.assetNotFound'),
        },
      },
    );

    updateAssetInfoTarget(data.group, data.files);

    toast.add({
      title: t('components.rbphPuzzleAssetManager.saved'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('components.rbphPuzzleAssetManager.saveFailed'));
  } finally {
    savingInfo.value = false;
  }
}

function updateAssetInfoTarget(group: AdminAssetGroupData, files: AdminAssetFileData[]) {
  const nextItem = { group, files };
  const index = groups.value.findIndex(current => current.group.id === group.id);
  if (index >= 0) groups.value[index] = nextItem;
  infoTarget.value = nextItem;
  infoState.originalName = group.original_name;
}

function startFileRename(file: AdminAssetFileData) {
  renamingFileId.value = file.id;
  renamingFolderPath.value = null;
  fileRenameState.fileName = basename(file.relative_path);
}

function cancelFileRename() {
  renamingFileId.value = null;
  fileRenameState.fileName = '';
}

function startFolderRename(item: AssetTreeItem) {
  renamingFolderPath.value = item.path;
  renamingFileId.value = null;
  folderRenameState.name = item.label;
}

function cancelFolderRename() {
  renamingFolderPath.value = null;
  folderRenameState.name = '';
}

async function saveFileRename(file: AdminAssetFileData) {
  const item = infoTarget.value;
  const fileName = fileRenameState.fileName.trim();
  if (!item || renamingFileId.value !== file.id || !fileName || fileName === basename(file.relative_path)) {
    cancelFileRename();
    return;
  }

  renamingFileId.value = file.id;
  try {
    type Response = { group: AdminAssetGroupData; files: AdminAssetFileData[] };
    const { data } = await api.patch<Response>(
      `/admin/assets/${item.group.id}/files/${file.id}`,
      { file_name: fileName },
      {
        errorHints: {
          [-2]: t('components.rbphPuzzleAssetManager.invalidOrDuplicateFileName'),
          [-1]: t('components.rbphPuzzleAssetManager.fileNotFound'),
        },
      },
    );

    updateAssetInfoTarget(data.group, data.files);
    cancelFileRename();
    toast.add({
      title: t('components.rbphPuzzleAssetManager.fileRenamed'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('components.rbphPuzzleAssetManager.renameFileFailed'));
  } finally {
    if (renamingFileId.value === file.id) renamingFileId.value = null;
  }
}

async function saveFolderRename(folder: AssetTreeItem) {
  const item = infoTarget.value;
  const name = folderRenameState.name.trim();
  if (!item || renamingFolderPath.value !== folder.path || !name || name === folder.label) {
    cancelFolderRename();
    return;
  }

  try {
    type Response = { group: AdminAssetGroupData; files: AdminAssetFileData[] };
    const { data } = await api.patch<Response>(
      `/admin/assets/${item.group.id}/folders`,
      { path: folder.path, name },
      {
        errorHints: {
          [-2]: t('components.rbphPuzzleAssetManager.invalidOrDuplicateFolderName'),
          [-1]: t('components.rbphPuzzleAssetManager.folderNotFound'),
        },
      },
    );

    updateAssetInfoTarget(data.group, data.files);
    cancelFolderRename();
    toast.add({
      title: t('components.rbphPuzzleAssetManager.folderRenamed'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('components.rbphPuzzleAssetManager.renameFolderFailed'));
  } finally {
    if (renamingFolderPath.value === folder.path) renamingFolderPath.value = null;
  }
}

async function deleteAssetFile(file: AdminAssetFileData) {
  const item = infoTarget.value;
  if (!item || deletingFileId.value === file.id) return;

  deletingFileId.value = file.id;
  try {
    type Response = {
      deleted_group: boolean;
      group?: AdminAssetGroupData | null;
      files: AdminAssetFileData[];
    };
    const { data } = await api.del<Response>(`/admin/assets/${item.group.id}/files/${file.id}`, {
      errorHints: {
        [-1]: t('components.rbphPuzzleAssetManager.fileNotFound'),
      },
    });

    if (data.deleted_group || !data.group) {
      groups.value = groups.value.filter(current => current.group.id !== item.group.id);
      infoOpen.value = false;
      infoTarget.value = null;
    } else {
      updateAssetInfoTarget(data.group, data.files);
    }

    toast.add({
      title: data.deleted_group ? t('components.rbphPuzzleAssetManager.assetDeleted') : t('components.rbphPuzzleAssetManager.fileDeleted'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('components.rbphPuzzleAssetManager.deleteFileFailed'));
  } finally {
    deletingFileId.value = null;
  }
}

async function deleteAsset(item: AdminAssetGroupItem) {
  if (!item || deletingId.value === item.group.id) return;

  deletingId.value = item.group.id;
  try {
    await api.del(`/admin/assets/${item.group.id}`, {
      errorHints: {
        [-1]: t('components.rbphPuzzleAssetManager.assetNotFound'),
      },
    });
    await refreshAssets();
    toast.add({
      title: t('components.rbphPuzzleAssetManager.groupDeleted'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('components.rbphPuzzleAssetManager.deleteGroupFailed'));
  } finally {
    deletingId.value = null;
  }
}

async function uploadFiles() {
  const value = files.value;
  if (!value || !gameId.value || !hasScope.value || uploading.value) return;

  uploading.value = true;

  try {
    const form = new FormData();
    form.append('game_id', String(gameId.value));
    if (puzzleId.value) form.append('puzzle_id', String(puzzleId.value));
    if (roundId.value) form.append('round_id', String(roundId.value));
    form.append('mode', uploadChoice.value);
    form.append('backend', uploadBackend.value);
    form.append('file', value, value.name);

    await api.post('/admin/assets', form, {
      errorHints: {
        [-2]: t('components.rbphPuzzleAssetManager.invalidUpload'),
        [-1]: t('components.rbphPuzzleAssetManager.scopeNotFound'),
      },
    });

    files.value = null;
    uploadConfirmOpen.value = false;
    await refreshAssets();
    toast.add({
      title: t('components.rbphPuzzleAssetManager.groupUploaded'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    files.value = null;
    uploadConfirmOpen.value = false;
    handleError(error, t('components.rbphPuzzleAssetManager.uploadGroupFailed'));
  } finally {
    uploading.value = false;
  }
}

function shouldUploadAsGroup(file: File) {
  return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
}

function onUploadChange() {
  const value = files.value;
  if (!value || uploading.value) return;
  uploadChoice.value = shouldUploadAsGroup(value) ? 'group' : 'file';
  uploadConfirmOpen.value = true;
}

function clearUpload() {
  files.value = null;
  uploadConfirmOpen.value = false;
}

function onUploadModalOpenChange(open: boolean) {
  if (!open && !uploading.value) clearUpload();
}

watch(
  () => [gameId.value, puzzleId.value, roundId.value] as const,
  () => {
    void refreshAssets();
  },
  { immediate: true },
);

onMounted(fetchStorageBackends);
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain pb-6 pr-1 scroll-pb-6">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-md font-semibold text-highlighted">{{ t('components.rbphPuzzleAssetManager.assetManager') }}</h2>
        <p class="text-sm text-muted">{{ t('components.rbphPuzzleAssetManager.description') }}</p>
      </div>
      <u-button color="neutral" variant="ghost" size="xs" icon="material-symbols:refresh-rounded" :loading="loading" @click="refreshAssets" />
    </div>

    <u-file-upload
      v-model="files"
      :accept="accept"
      size="md"
      class="w-full"
      icon="material-symbols:upload-file-outline-rounded"
      :label="t('components.rbphPuzzleAssetManager.uploadFile')"
      :description="t('components.rbphPuzzleAssetManager.dropzone')"
      :disabled="uploading || !gameId || !hasScope"
      @change="onUploadChange"
    />

    <div class="mt-4 pb-2">
      <div v-if="loading" class="space-y-2">
        <u-skeleton v-for="i in 3" :key="i" class="h-16 w-full" />
      </div>
      <div v-else class="space-y-2">
        <div v-for="item in groups" :key="item.group.id" class="rounded-lg border border-default bg-elevated/60 p-3 transition hover:bg-elevated" draggable="true" @dragstart="onAssetDragStart($event, item)">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-highlighted">{{ item.group.original_name }}</div>
              <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <u-badge color="neutral" variant="soft" size="sm" :icon="storageIcon(item.group.backend)">{{ storageLabel(item.group.backend) }}</u-badge>
                <span>{{ formatBytes(assetDisplaySize(item)) }}</span>
                <span>·</span>
                <span class="truncate">{{ assetDisplayMimeType(item) }}</span>
                <span v-if="!isSingleAsset(item)">·</span>
                <span v-if="!isSingleAsset(item)">{{ t('components.rbphPuzzleAssetManager.fileCount', { count: item.files.length }) }}</span>
              </div>
              <div class="mt-1 flex justify-end gap-1">
                <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:info-outline-rounded" @click="openAssetInfo(item)" />
                <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:content-copy-outline-rounded" @click="copyUrl(assetUrl(item))" />
                <template v-if="isSingleAsset(item)">
                  <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:open-in-new-rounded" :href="assetUrl(item)" external target="_blank" />
                </template>
                <u-popover arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
                  <u-button size="xs" color="error" variant="ghost" icon="material-symbols:delete-outline-rounded" :loading="deletingId === item.group.id" />
                  <template #content>
                    <div class="w-64 p-3 text-sm">
                      <div class="flex items-start gap-2">
                        <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                        <div class="min-w-0">
                          <div class="font-medium text-highlighted">{{ t('components.rbphPuzzleAssetManager.deleteAssetGroup') }}</div>
                          <div class="mt-1 text-xs text-muted">{{ t('components.rbphPuzzleAssetManager.confirmDelete', { name: item.group.original_name }) }}</div>
                        </div>
                      </div>
                      <div class="mt-3 flex justify-end">
                        <u-button size="xs" color="error" variant="soft" icon="material-symbols:delete-outline-rounded" :loading="deletingId === item.group.id" @click="deleteAsset(item)">{{ t('admin.common.delete') }}</u-button>
                      </div>
                    </div>
                  </template>
                </u-popover>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <u-modal v-model:open="infoOpen" :title="t('components.rbphPuzzleAssetManager.infoTitle')" :dismissible="!savingInfo" :close="!savingInfo">
      <template #body>
        <u-form :state="infoState" class="space-y-4" @submit.prevent="saveAssetInfo">
          <rb-form-field name="originalName" row narrow-label :label="t('admin.common.name')" required class="w-full gap-4" :dirty="infoDirty" :reset="resetAssetInfoName" :ui="{ container: 'w-full' }">
            <div class="w-full min-w-0">
              <u-input v-model="infoState.originalName" :placeholder="t('components.rbphPuzzleAssetManager.groupName')" :disabled="savingInfo" maxlength="255" class="w-full" />
            </div>
          </rb-form-field>

          <div v-if="infoTarget" class="space-y-3 rounded-md bg-elevated/50 p-3 text-sm">
            <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
              <span class="text-muted">{{ t('components.rbphPuzzleAssetManager.storageBackend') }}</span>
              <u-badge color="neutral" variant="soft" class="w-fit" :icon="storageIcon(infoTarget.group.backend)">{{ storageLabel(infoTarget.group.backend) }}</u-badge>
            </div>
            <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
              <span class="text-muted">Object Key</span>
              <code class="truncate font-mono text-xs text-highlighted">{{ infoTarget.group.object_key }}</code>
            </div>
            <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
              <span class="text-muted">MIME</span>
              <span class="truncate text-highlighted">{{ infoTarget.group.mime_type }}</span>
            </div>
            <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
              <span class="text-muted">{{ t('components.rbphPuzzleAssetManager.size') }}</span>
              <span class="text-highlighted">{{ formatBytes(infoTarget.group.size) }}</span>
            </div>
            <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
              <span class="text-muted">SHA256</span>
              <code class="truncate font-mono text-xs text-highlighted">{{ infoTarget.group.sha256 }}</code>
            </div>
          </div>

          <div v-if="infoTarget" class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium text-highlighted">{{ t('components.rbphPuzzleAssetManager.file') }}</h3>
              <u-badge color="neutral" variant="soft">{{ infoTarget.files.length }}</u-badge>
            </div>

            <u-tree :key="infoFileTreeKey" :items="infoFileTree" :get-key="assetTreeKey" size="sm" class="max-h-72 overflow-y-auto rounded-md bg-elevated/40 p-1 ring ring-default" :ui="{ link: 'w-full min-w-0' }">
              <template #item-wrapper="{ item, expanded, handleToggle }">
                <div role="treeitem" :aria-expanded="isFolderTreeItem(item) ? expanded : undefined">
                  <div class="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-elevated" @click="isFolderTreeItem(item) && handleToggle()">
                    <u-icon v-if="isFolderTreeItem(item)" :name="expanded ? 'material-symbols:folder-open-outline-rounded' : 'material-symbols:folder-outline-rounded'" class="size-4 shrink-0 text-muted" />
                    <u-icon v-else name="material-symbols:description-outline-rounded" class="size-4 shrink-0 text-muted" />

                    <template v-if="isFolderTreeItem(item) && renamingFolderPath === item.path">
                      <u-input v-model="folderRenameState.name" size="xs" class="min-w-0 flex-1" autofocus @click.stop @keydown.enter.prevent.stop="saveFolderRename(item)" @keydown.esc.prevent.stop="cancelFolderRename" />
                      <u-button size="xs" color="primary" variant="ghost" icon="material-symbols:check-rounded" :disabled="!folderRenameState.name.trim()" @click.stop="saveFolderRename(item)" />
                      <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:close-rounded" @click.stop="cancelFolderRename" />
                    </template>

                    <template v-else-if="item.file && renamingFileId === item.file.id">
                      <u-input
                        v-model="fileRenameState.fileName"
                        size="xs"
                        class="min-w-0 flex-1"
                        autofocus
                        :disabled="renamingFileId !== item.file.id"
                        @click.stop
                        @keydown.enter.prevent.stop="saveFileRename(item.file)"
                        @keydown.esc.prevent.stop="cancelFileRename"
                      />
                      <u-button size="xs" color="primary" variant="ghost" icon="material-symbols:check-rounded" :disabled="!fileRenameState.fileName.trim()" @click.stop="saveFileRename(item.file)" />
                      <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:close-rounded" @click.stop="cancelFileRename" />
                    </template>

                    <template v-else>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm text-highlighted">{{ item.label }}</div>
                      </div>

                      <div v-if="isFolderTreeItem(item)" class="ms-auto flex shrink-0 items-center gap-1">
                        <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:edit-outline-rounded" @click.stop="startFolderRename(item)" />
                      </div>

                      <div v-else-if="item.file" class="ms-auto flex shrink-0 items-center gap-1">
                        <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:content-copy-outline-rounded" @click.stop="copyUrl(fileUrl(infoTarget, item.file))" />
                        <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:open-in-new-rounded" :href="fileUrl(infoTarget, item.file)" external target="_blank" @click.stop />
                        <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:edit-outline-rounded" @click.stop="startFileRename(item.file)" />
                        <u-popover arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
                          <u-button size="xs" color="error" variant="ghost" icon="material-symbols:delete-outline-rounded" :loading="deletingFileId === item.file.id" @click.stop />
                          <template #content>
                            <div class="w-64 p-3 text-sm">
                              <div class="flex items-start gap-2">
                                <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                                <div class="min-w-0">
                                  <div class="font-medium text-highlighted">{{ t('components.rbphPuzzleAssetManager.deleteFile') }}</div>
                                  <div class="mt-1 break-all text-xs text-muted">{{ t('components.rbphPuzzleAssetManager.confirmDelete', { name: item.file.relative_path }) }}</div>
                                  <div v-if="infoTarget.files.length <= 1" class="mt-1 text-xs text-error">{{ t('components.rbphPuzzleAssetManager.lastFileWarning') }}</div>
                                </div>
                              </div>
                              <div class="mt-3 flex justify-end">
                                <u-button size="xs" color="error" variant="soft" icon="material-symbols:delete-outline-rounded" :loading="deletingFileId === item.file.id" @click="deleteAssetFile(item.file)">{{ t('admin.common.delete') }}</u-button>
                              </div>
                            </div>
                          </template>
                        </u-popover>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </u-tree>
          </div>
        </u-form>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <u-button color="neutral" variant="soft" :disabled="savingInfo" @click="infoOpen = false">{{ t('admin.common.cancel') }}</u-button>
          <u-button color="primary" icon="material-symbols:save-outline-rounded" :loading="savingInfo" :disabled="!infoDirty || !infoState.originalName.trim()" @click="saveAssetInfo">{{ t('admin.common.save') }}</u-button>
        </div>
      </template>
    </u-modal>

    <u-modal
      v-model:open="uploadConfirmOpen"
      :title="t('components.rbphPuzzleAssetManager.uploadAsset')"
      :description="files ? t('components.rbphPuzzleAssetManager.uploadDescription', { name: files.name }) : ''"
      :dismissible="!uploading"
      :close="!uploading"
      @update:open="onUploadModalOpenChange"
    >
      <template #body>
        <div class="space-y-5">
          <div v-if="uploadIsZip" class="space-y-2">
            <div class="text-sm font-medium text-highlighted">{{ t('components.rbphPuzzleAssetManager.uploadMethod') }}</div>
            <u-field-group class="w-full">
              <u-button
                color="neutral"
                variant="soft"
                active-color="primary"
                icon="material-symbols:folder-zip-outline-rounded"
                :label="t('components.rbphPuzzleAssetManager.assetGroup')"
                class="flex-1 justify-center"
                :active="uploadChoice === 'group'"
                :disabled="uploading"
                @click="uploadChoice = 'group'"
              />
              <u-button
                color="neutral"
                variant="soft"
                active-color="primary"
                icon="material-symbols:upload-file-outline-rounded"
                :label="t('components.rbphPuzzleAssetManager.regularFile')"
                class="flex-1 justify-center"
                :active="uploadChoice === 'file'"
                :disabled="uploading"
                @click="uploadChoice = 'file'"
              />
            </u-field-group>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium text-highlighted">{{ t('components.rbphPuzzleAssetManager.storageBackend') }}</div>
            <u-field-group class="flex w-full">
              <u-button
                v-for="backend in storageBackends"
                :key="backend.backend"
                color="neutral"
                variant="soft"
                active-color="primary"
                :icon="storageKindMeta[backend.kind].icon"
                :label="backend.label"
                class="flex-1 justify-center"
                :active="uploadBackend === backend.backend"
                :disabled="uploading"
                @click="uploadBackend = backend.backend"
              />
            </u-field-group>
            <p v-if="selectedStorageBackend" class="text-xs text-muted">{{ storageKindMeta[selectedStorageBackend.kind].description }}</p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <u-button color="neutral" variant="soft" :disabled="uploading" @click="clearUpload"> {{ t('admin.common.cancel') }} </u-button>
          <u-button color="primary" icon="material-symbols:upload-2-outline-rounded" :loading="uploading" :disabled="uploading || !files" @click="uploadFiles">{{ t('components.rbphPuzzleAssetManager.upload') }}</u-button>
        </div>
      </template>
    </u-modal>
  </div>
</template>
