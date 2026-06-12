<script setup lang="ts">
interface AdminAssetGroupData {
  id: number;
  game_id: number;
  puzzle_id?: number | null;
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

const api = useApi();
const toast = useToast();
const { puzzle } = useAdmin().usePuzzleContext();

const loading = ref(false);
const uploading = ref(false);
const deletingId = ref<number | null>(null);
const deleteConfirmOpen = ref(false);
const uploadConfirmOpen = ref(false);
const uploadChoice = ref<'group' | 'file'>('group');
const deleteTarget = ref<AdminAssetGroupItem | null>(null);
const groups = ref<AdminAssetGroupItem[]>([]);
const files = ref<File | null>(null);

const accept = '*';

const gameId = computed(() => puzzle.value?.game_id ?? null);
const puzzleId = computed(() => puzzle.value?.id ?? null);

function formatBytes(size: number) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const value = size / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function fileUrl(item: AdminAssetGroupItem, file: AdminAssetFileData) {
  return `/assets/${item.group.object_key}/${file.relative_path}`;
}

function onAssetDragStart(event: DragEvent, item: AdminAssetGroupItem, file: AdminAssetFileData) {
  setRbAssetDragData(event, {
    url: fileUrl(item, file),
    mimeType: file.mime_type,
    originalName: file.relative_path,
    assetId: file.id,
  });
}

function refreshAssets() {
  if (!gameId.value || !puzzleId.value) {
    groups.value = [];
    return Promise.resolve();
  }

  loading.value = true;

  return api
    .get<{ groups: AdminAssetGroupItem[] }>('/admin/assets', {
      query: {
        game_id: gameId.value,
        puzzle_id: puzzleId.value,
      },
      errorHints: {
        [-1]: '资产不存在。',
      },
    })
    .then(({ data }) => {
      groups.value = data.groups;
    })
    .catch(error => {
      handleError(error, '获取资产列表失败');
    })
    .finally(() => {
      loading.value = false;
    });
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.add({
      title: '已复制资产链接',
      icon: 'material-symbols:content-copy-outline-rounded',
      color: 'success',
    });
  } catch {
    toast.add({
      title: '复制失败',
      description: '请手动复制链接。',
      icon: 'material-symbols:error-outline-rounded',
      color: 'error',
    });
  }
}

function promptDelete(item: AdminAssetGroupItem) {
  deleteTarget.value = item;
  deleteConfirmOpen.value = true;
}

async function deleteAsset() {
  const item = deleteTarget.value;
  if (!item || deletingId.value === item.group.id) return;

  deletingId.value = item.group.id;
  try {
    await api.del(`/admin/assets/${item.group.id}`, {
      errorHints: {
        [-1]: '资产不存在。',
      },
    });
    deleteConfirmOpen.value = false;
    deleteTarget.value = null;
    await refreshAssets();
    toast.add({
      title: '资产组已删除',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '删除资产组失败');
  } finally {
    deletingId.value = null;
  }
}

async function uploadFiles() {
  const value = files.value;
  if (!value || !gameId.value || !puzzleId.value || uploading.value) return;

  uploading.value = true;

  try {
    const form = new FormData();
    form.append('game_id', String(gameId.value));
    form.append('puzzle_id', String(puzzleId.value));
    form.append('mode', uploadChoice.value);
    form.append('file', value, value.name);

    await api.post('/admin/assets', form, {
      errorHints: {
        [-2]: '上传文件不合法。',
        [-1]: '谜题不存在。',
      },
    });

    files.value = null;
    await refreshAssets();
    toast.add({
      title: '资产组已上传',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '上传资产组失败');
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
  if (shouldUploadAsGroup(value)) {
    uploadChoice.value = 'group';
    uploadConfirmOpen.value = true;
  } else {
    uploadChoice.value = 'file';
    void uploadFiles();
  }
}

async function confirmUploadAsGroup() {
  uploadConfirmOpen.value = false;
  uploadChoice.value = 'group';
  await uploadFiles();
}

async function confirmUploadAsFile() {
  uploadConfirmOpen.value = false;
  uploadChoice.value = 'file';
  await uploadFiles();
}

watch(
  puzzle,
  () => {
    void refreshAssets();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-md font-semibold text-highlighted">资产管理器</h2>
        <p class="text-sm text-muted">用于上传和管理谜题需要的静态资产。</p>
      </div>
      <u-button color="neutral" variant="ghost" size="xs" icon="material-symbols:refresh-rounded" :loading="loading" @click="refreshAssets" />
    </div>

    <u-file-upload
      v-model="files"
      :accept="accept"
      size="md"
      class="w-full"
      icon="material-symbols:upload-file-rounded"
      label="上传文件"
      description="拖入文件或点击选择"
      :disabled="uploading || !gameId || !puzzleId"
      @change="onUploadChange"
    />

    <div class="mt-4">
      <div v-if="loading" class="space-y-2">
        <u-skeleton v-for="i in 3" :key="i" class="h-16 w-full" />
      </div>
      <div v-else class="space-y-2">
        <div v-for="item in groups" :key="item.group.id" class="rounded-lg border border-default bg-elevated/60 p-3 transition hover:bg-elevated">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-highlighted">{{ item.group.original_name }}</div>
              <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>{{ item.files.length }} 个文件</span>
                <span>·</span>
                <span>{{ formatBytes(item.group.size) }}</span>
                <span>·</span>
                <span class="truncate">{{ item.group.mime_type }}</span>
              </div>
              <div class="mt-3 space-y-1.5">
                <div
                  v-for="file in item.files"
                  :key="file.id"
                  draggable="true"
                  class="flex items-center gap-2 rounded-md border border-default/70 bg-default/50 px-2 py-1.5 text-xs transition hover:bg-default"
                  @dragstart="onAssetDragStart($event, item, file)"
                >
                  <span class="min-w-0 flex-1 truncate font-mono">{{ file.relative_path }}</span>
                  <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:content-copy-outline-rounded" @click="copyUrl(fileUrl(item, file))" />
                  <u-button size="xs" color="neutral" variant="ghost" icon="material-symbols:open-in-new-rounded" :href="fileUrl(item, file)" external target="_blank" />
                </div>
              </div>
            </div>
            <div class="flex shrink-0 flex-col gap-1">
              <u-button size="xs" color="error" variant="ghost" icon="material-symbols:delete-outline-rounded" :loading="deletingId === item.group.id" @click="promptDelete(item)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <rb-confirm-modal
      v-model:open="deleteConfirmOpen"
      title="删除资产组"
      :description="deleteTarget ? `确认删除资产组「${deleteTarget.group.original_name}」？此操作不可恢复。` : ''"
      confirm-label="删除资产组"
      confirm-color="error"
      confirm-icon="material-symbols:delete-outline-rounded"
      :busy="deletingId !== null"
      @confirm="deleteAsset"
    />

    <rb-confirm-modal
      v-model:open="uploadConfirmOpen"
      title="上传 ZIP"
      :description="files ? `检测到 ZIP 文件「${files.name}」，请选择上传方式。` : ''"
      confirm-label="作为资产组上传"
      confirm-color="primary"
      confirm-icon="material-symbols:folder-zip-outline-rounded"
      @confirm="confirmUploadAsGroup"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <u-button color="neutral" variant="soft" :disabled="uploading" @click="uploadConfirmOpen = false"> 取消 </u-button>
          <u-button color="neutral" variant="soft" icon="material-symbols:insert-drive-file-outline-rounded" :disabled="uploading" @click="confirmUploadAsFile"> 作为普通文件上传 </u-button>
          <u-button color="primary" icon="material-symbols:folder-zip-outline-rounded" :loading="uploading" :disabled="uploading" @click="confirmUploadAsGroup"> 作为资产组上传 </u-button>
        </div>
      </template>
    </rb-confirm-modal>
  </div>
</template>
