<script setup lang="ts">
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { puzzle, backend, refresh } = useAdmin().usePuzzleContext();

const state = reactive({
  enabled: false,
  source: '',
});

const saving = ref(false);
const backendLoaded = ref(false);
const scriptEditorHeight = '32rem';
const scriptEditor = ref<{ focus: () => void }>();

const backendEnabled = computed(() => state.enabled);
const enabledDirty = computed(() => Boolean(puzzle.value && backendLoaded.value && backendEnabled.value !== (backend.value?.enabled ?? false)));
const sourceDirty = computed(() => Boolean(puzzle.value && backendLoaded.value && state.source !== (backend.value?.source ?? '')));
const dirty = computed(() => enabledDirty.value || sourceDirty.value);

function syncFromBackend() {
  state.enabled = backend.value?.enabled ?? false;
  state.source = backend.value?.source ?? '';
}

function reset() {
  syncFromBackend();
  dirtyToast.clear();
}

function resetEnabled() {
  state.enabled = backend.value?.enabled ?? false;
}

function resetSource() {
  state.source = backend.value?.source ?? '';
}

async function apply() {
  if (!puzzle.value || !dirty.value || saving.value) return;

  saving.value = true;
  try {
    type Response = { backend: AdminPuzzleBackendData | null };
    const { data } = await api.put<Response>(
      `/admin/puzzles/${puzzle.value.id}/backend`,
      {
        enabled: state.enabled,
        source: state.source,
      },
      {
        errorHints: {
          [-2]: '后端脚本不合法。',
          [-1]: '谜题不存在。',
        },
      },
    );

    backend.value = data.backend ?? undefined;
    backendLoaded.value = true;
    syncFromBackend();
    dirtyToast.clear();
    await refresh();

    toast.add({
      title: '后端脚本已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存后端脚本失败');
  } finally {
    saving.value = false;
  }
}

async function saveSource() {
  if (!puzzle.value || !backendLoaded.value || saving.value) return;

  saving.value = true;
  try {
    type Response = { backend: AdminPuzzleBackendData | null };
    const { data } = await api.patch<Response>(
      `/admin/puzzles/${puzzle.value.id}/backend/source`,
      {
        source: state.source,
      },
      {
        errorHints: {
          [-2]: '后端脚本不合法。',
          [-1]: '谜题不存在。',
        },
      },
    );

    backend.value = data.backend ?? undefined;
    state.source = backend.value?.source ?? '';
    backendLoaded.value = true;
    await nextTick();
    scriptEditor.value?.focus();
    toast.add({
      title: '后端脚本已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存后端脚本源码失败');
    toast.add({
      title: '后端脚本保存失败',
      icon: 'material-symbols:error-rounded',
      color: 'error',
    });
  } finally {
    saving.value = false;
  }
}

async function saveBackendSection() {
  if (!puzzle.value || !dirty.value || saving.value) return;

  await apply();
}

watch(
  () => backend.value?.puzzle_id,
  () => {
    backendLoaded.value = true;
    syncFromBackend();
    dirtyToast.clear();
  },
  { immediate: true },
);

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '后端功能修改尚未保存。',
      guardOnLeave: true,
      apply,
      reset,
    });
  } else {
    dirtyToast.clear();
  }
});

</script>

<template>
  <div v-if="puzzle" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />

    <div class="flex min-w-0 flex-col gap-4">
      <u-form :state="state" class="flex flex-col gap-4" @submit.prevent="apply">
        <section class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-highlighted">后端脚本</h3>
              <p class="mt-1 text-sm text-muted">自定义题目后端，可以在 Vue SFC 中调用。</p>
            </div>
            <u-badge variant="soft" color="neutral">JavaScript</u-badge>
          </div>

          <div class="space-y-3 rounded-md border border-default bg-default/60 p-4 shadow-xs">
            <rb-form-field name="enabled" row label="启用状态" :dirty="enabledDirty" :reset="resetEnabled">
              <u-switch v-model="state.enabled" class="mt-1.5" label="启用后端" :disabled="saving" />
            </rb-form-field>
            <u-separator v-if="state.enabled" />
            <rb-form-field v-if="state.enabled" name="source" label="脚本源码" class="space-y-3" :dirty="sourceDirty" :reset="resetSource">
              <rb-code-editor
                ref="scriptEditor"
                v-model="state.source"
                language="javascript"
                :indent="2"
                aria-label="后端脚本源码"
                :disabled="saving"
                :min-height="scriptEditorHeight"
                :max-height="scriptEditorHeight"
                :on-save="saveBackendSection"
              />
            </rb-form-field>
          </div>
        </section>
      </u-form>
    </div>

    <aside class="hidden xl:block" />
  </div>
</template>
