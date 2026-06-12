<script setup lang="ts">
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { puzzle, refresh, contentEditor, focusTitle, headerDirty, applyHeader, resetHeader } = useAdmin().usePuzzleContext();

const state = reactive({
  content: '',
});

const saving = ref(false);

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
</script>

<template>
  <div v-if="puzzle" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(18rem,22rem)]">
    <aside class="hidden xl:block" />

    <u-form :state="state" class="w-full min-w-0" @submit.prevent="apply">
      <rbph-content-editor ref="contentEditor" v-model="state.content" placeholder="请输入内容" aria-label="谜题正文" :disabled="saving" @focus-title="focusTitle" />
    </u-form>

    <aside class="hidden xl:block min-h-0">
      <div class="sticky top-6 min-h-0 min-w-0">
        <rbph-puzzle-asset-manager class="h-full min-w-0" />
      </div>
    </aside>
  </div>
</template>
