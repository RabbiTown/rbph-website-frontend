<script setup lang="ts">
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { puzzle, refresh, contentEditor, focusTitle, headerDirty, applyHeader, resetHeader } = useAdmin().usePuzzleContext();

const state = reactive({
  content: '',
});

const saving = ref(false);
const assetManagerShell = ref<HTMLElement>();
const assetManagerHeight = ref('calc(100vh - 3rem)');
let assetManagerHeightFrame: number | null = null;

const contentDirty = computed(() => Boolean(puzzle.value && state.content !== puzzle.value.content));
const dirty = computed(() => headerDirty.value || contentDirty.value);

function syncFromPuzzle() {
  state.content = puzzle.value?.content ?? '';
}

function reset() {
  resetHeader();
  syncFromPuzzle();
  dirtyToast.clear();
}

function updateAssetManagerHeight() {
  if (!import.meta.client) return;

  const element = assetManagerShell.value;
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const bottomGap = 24;
  const minHeight = 320;
  const height = Math.max(minHeight, window.innerHeight - rect.top - bottomGap);
  assetManagerHeight.value = `${height}px`;
}

function scheduleAssetManagerHeightUpdate() {
  if (!import.meta.client || assetManagerHeightFrame !== null) return;

  assetManagerHeightFrame = window.requestAnimationFrame(() => {
    assetManagerHeightFrame = null;
    updateAssetManagerHeight();
  });
}

async function apply() {
  if (!puzzle.value || !dirty.value || saving.value) return;

  if (headerDirty.value) {
    const headerSaved = await applyHeader();
    if (!headerSaved) return;
  }

  if (!contentDirty.value) {
    dirtyToast.clear();
    return;
  }

  const body: {
    content?: string;
    content_type?: RbContentType;
  } = {};

  if (contentDirty.value) {
    body.content = state.content;
    body.content_type = RbContentType.Markdown;
  }

  saving.value = true;

  try {
    type Response = { puzzle: AdminPuzzleData };
    const response = await api.patch<Response>(`/admin/puzzles/${puzzle.value.id}`, body, {
      errorHints: {
        [-2]: '谜题内容不合法。',
        [-1]: '谜题不存在。',
      },
    });

    puzzle.value = response.data.puzzle;
    syncFromPuzzle();
    dirtyToast.clear();
    await refresh();

    toast.add({
      title: '谜题内容已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存谜题内容失败');
  } finally {
    saving.value = false;
  }
}

watch(
  () => puzzle.value?.id,
  () => {
    syncFromPuzzle();
    dirtyToast.clear();
  },
  { immediate: true },
);

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '谜题内容修改尚未保存。',
      guardOnLeave: true,
      apply,
      reset,
    });
  } else {
    dirtyToast.clear();
  }
});

onMounted(() => {
  nextTick(updateAssetManagerHeight);
  window.addEventListener('resize', scheduleAssetManagerHeightUpdate);
  document.addEventListener('scroll', scheduleAssetManagerHeightUpdate, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleAssetManagerHeightUpdate);
  document.removeEventListener('scroll', scheduleAssetManagerHeightUpdate, true);

  if (assetManagerHeightFrame !== null) {
    window.cancelAnimationFrame(assetManagerHeightFrame);
    assetManagerHeightFrame = null;
  }
});

watch(
  () => puzzle.value?.id,
  () => {
    nextTick(updateAssetManagerHeight);
  },
);
</script>

<template>
  <div v-if="puzzle" class="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(18rem,22rem)]">
    <aside class="hidden xl:block" />

    <u-form :state="state" class="w-full min-w-0 min-h-0" @submit.prevent="apply">
      <rbph-content-editor ref="contentEditor" v-model="state.content" placeholder="请输入内容" aria-label="谜题正文" :disabled="saving" @focus-title="focusTitle" @save="apply" />
    </u-form>

    <aside class="hidden min-h-0 xl:block">
      <div ref="assetManagerShell" class="sticky top-6 flex min-h-0 min-w-0 overflow-hidden" :style="{ height: assetManagerHeight }">
        <rbph-puzzle-asset-manager class="h-full max-h-full min-w-0" />
      </div>
    </aside>
  </div>
</template>
