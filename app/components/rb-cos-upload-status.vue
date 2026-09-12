<script setup lang="ts">
import type { CosTaskSummary } from '~/composables/use-cos-upload';

const props = defineProps<{ upload: ReturnType<typeof useCosUpload>; hideCompleted?: boolean; themePackage?: boolean; excludedTaskIds?: string[] }>();
const emit = defineEmits<{ resume: [task: CosTaskSummary, file: File]; completed: [] }>();

const { t } = useI18n();

const cancellingId = ref<string>();

function formatSpeed(bytes: number) {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB/s`;

  return `${Math.round(bytes)} B/s`;
}

async function resume() {
  try {
    await props.upload.resume();
    emit('completed');
  } catch {
    /* uploader retains retry state */
  }
}

async function cancel(id = props.upload.task.value?.id) {
  if (!id || cancellingId.value) return;

  cancellingId.value = id;

  try {
    await props.upload.cancel(id);
  } catch (e) {
    props.upload.reportError(e);
  } finally {
    cancellingId.value = undefined;
  }
}

function selected(task: CosTaskSummary, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) emit('resume', task, file);

  input.value = '';
}
</script>

<template>
  <div v-if="(upload.phase.value && (!hideCompleted || upload.phase.value !== 'complete')) || upload.tasks.value.some(item => item.id !== upload.task.value?.id && !excludedTaskIds?.includes(item.id))" :class="themePackage ? 'divide-y divide-default' : 'space-y-2'" aria-live="polite">
    <div v-if="upload.phase.value && (!hideCompleted || upload.phase.value !== 'complete')" :class="themePackage ? 'relative py-3 pl-12' : 'rounded-lg border border-warning/30 bg-warning/5 p-3 transition hover:bg-warning/10'">
      <div v-if="themePackage" class="absolute left-0 top-3 flex size-9 items-center justify-center rounded-md bg-warning/10">
        <u-icon name="material-symbols:deployed-code-outline" class="size-5 text-warning" />
      </div>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-highlighted" :title="upload.name.value">{{ upload.name.value }}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <u-badge :color="upload.phase.value === 'failed' ? 'error' : 'neutral'" variant="soft" size="sm">{{ t(`cosUpload.${upload.phase.value}`) }}</u-badge>
            <span v-if="upload.phase.value === 'uploading'" class="tabular-nums">{{ formatSpeed(upload.speed.value) }}</span>
            <div class="ml-auto flex shrink-0 items-center gap-3 tabular-nums">
              <span v-if="upload.totalFiles.value" :aria-label="t('cosUpload.fileProgress', { completed: upload.completedFiles.value, total: upload.totalFiles.value })">{{ upload.completedFiles.value }}/{{ upload.totalFiles.value }}</span>
              <span v-if="upload.total.value">{{ Math.min(100, Math.round((upload.bytes.value / upload.total.value) * 100)) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <u-progress
        class="mt-3"
        size="xs"
        :model-value="upload.phase.value === 'confirming' ? null : upload.bytes.value"
        :max="upload.total.value || 1"
        :color="upload.phase.value === 'failed' ? 'error' : 'primary'"
        :aria-label="t(`cosUpload.${upload.phase.value}`)"
      />
      <p v-if="upload.error.value" class="mt-2 wrap-break-word text-xs text-error">{{ upload.error.value }}</p>

      <div v-if="upload.phase.value !== 'complete'" class="mt-1 flex flex-wrap justify-end gap-1">
        <u-button v-if="upload.active.value" size="xs" color="neutral" variant="ghost" icon="material-symbols:pause-rounded" @click="upload.pause()">{{ t('cosUpload.pause') }}</u-button>
        <u-button v-else-if="['paused', 'failed'].includes(upload.phase.value)" size="xs" color="neutral" variant="ghost" icon="material-symbols:play-arrow-rounded" @click="resume">{{ t('cosUpload.resume') }}</u-button>
        <u-popover v-if="upload.task.value" arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
          <u-button size="xs" color="error" variant="ghost" icon="material-symbols:close-rounded" :loading="cancellingId === upload.task.value?.id">{{ t('cosUpload.cancel') }}</u-button>
          <template #content>
            <div class="w-64 p-3 text-sm">
              <div class="flex items-start gap-2">
                <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                <div class="min-w-0">
                  <div class="font-medium text-highlighted">{{ t('cosUpload.cancel') }}</div>
                  <div class="mt-1 wrap-break-word text-xs text-muted">{{ t('cosUpload.confirmCancel', { name: upload.name.value }) }}</div>
                </div>
              </div>
              <div class="mt-3 flex justify-end">
                <u-button size="xs" color="error" variant="soft" icon="material-symbols:close-rounded" :loading="cancellingId === upload.task.value?.id" :disabled="!!cancellingId" @click="cancel()">{{ t('cosUpload.cancel') }}</u-button>
              </div>
            </div>
          </template>
        </u-popover>
      </div>
    </div>

    <div v-for="task in upload.tasks.value.filter(item => item.id !== upload.task.value?.id && !excludedTaskIds?.includes(item.id))" :key="task.id" :class="themePackage ? 'relative py-3 pl-12' : 'rounded-lg border border-warning/30 bg-warning/5 p-3 transition hover:bg-warning/10'">
      <div v-if="themePackage" class="absolute left-0 top-3 flex size-9 items-center justify-center rounded-md bg-warning/10">
        <u-icon name="material-symbols:deployed-code-outline" class="size-5 text-warning" />
      </div>
      <div class="truncate text-sm font-medium text-highlighted" :title="task.request.original_name">{{ task.request.original_name }}</div>
      <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <u-badge color="neutral" variant="soft" size="sm">{{ t('cosUpload.paused') }}</u-badge>
        <span
          v-if="task.completed_files !== undefined || task.files"
          class="ml-auto tabular-nums"
          :aria-label="t('cosUpload.fileProgress', { completed: task.completed_files ?? task.files?.filter(file => file.complete).length, total: task.request.files.length })"
          >{{ task.completed_files ?? task.files?.filter(file => file.complete).length }}/{{ task.request.files.length }}</span
        >
      </div>
      <div class="mt-1 flex flex-wrap items-center justify-end gap-1">
        <label class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted hover:bg-elevated focus-within:ring-2 focus-within:ring-primary" :class="{ 'pointer-events-none opacity-50': upload.active.value }">
          {{ t('cosUpload.selectOriginal') }}
          <input type="file" class="sr-only" :disabled="upload.active.value" @change="selected(task, $event)" />
        </label>
        <u-popover arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
          <u-button size="xs" color="error" variant="ghost" icon="material-symbols:close-rounded" :disabled="upload.active.value" :loading="cancellingId === task.id">{{ t('cosUpload.cancel') }}</u-button>
          <template #content>
            <div class="w-64 p-3 text-sm">
              <div class="flex items-start gap-2">
                <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                <div class="min-w-0">
                  <div class="font-medium text-highlighted">{{ t('cosUpload.cancel') }}</div>
                  <div class="mt-1 wrap-break-word text-xs text-muted">{{ t('cosUpload.confirmCancel', { name: task.request.original_name }) }}</div>
                </div>
              </div>
              <div class="mt-3 flex justify-end">
                <u-button size="xs" color="error" variant="soft" icon="material-symbols:close-rounded" :loading="cancellingId === task.id" :disabled="!!cancellingId" @click="cancel(task.id)">{{ t('cosUpload.cancel') }}</u-button>
              </div>
            </div>
          </template>
        </u-popover>
      </div>
    </div>
  </div>
</template>
