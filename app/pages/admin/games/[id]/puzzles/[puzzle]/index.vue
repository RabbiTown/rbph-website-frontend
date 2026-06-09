<script setup lang="ts">
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { puzzle, refresh } = useAdmin().usePuzzleContext();

const state = reactive({
  title: '',
  content: '',
});

const saving = ref(false);
const contentEditor = ref<{ focus: () => void }>();
const titleInput = ref<HTMLInputElement>();

const titleDirty = computed(() => Boolean(puzzle.value && state.title !== puzzle.value.title));
const contentDirty = computed(() => Boolean(puzzle.value && state.content !== puzzle.value.content));
const dirty = computed(() => titleDirty.value || contentDirty.value);

function syncFromPuzzle() {
  state.title = puzzle.value?.title ?? '';
  state.content = puzzle.value?.content ?? '';
}

function reset() {
  syncFromPuzzle();
  dirtyToast.clear();
}

function focusContentEditor() {
  contentEditor.value?.focus();
}

function focusTitle() {
  titleInput.value?.focus();
  titleInput.value?.setSelectionRange(state.title.length, state.title.length);
}

async function apply() {
  if (!puzzle.value || !dirty.value || saving.value) return;

  const body: {
    title?: string;
    content?: string;
    content_type?: RbContentType;
  } = {};

  if (titleDirty.value) body.title = state.title;
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
  <div v-if="puzzle" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />

    <u-form :state="state" class="w-full min-w-0 space-y-1" @submit.prevent="apply">
      <label class="flex min-w-0 items-center gap-3 px-4 py-2.5 sm:px-5 lg:pe-76">
        <span class="shrink-0 text-3xl/10 font-bold text-muted">#</span>
        <input
          ref="titleInput"
          v-model="state.title"
          class="min-w-0 flex-1 bg-transparent text-3xl/10 font-bold text-highlighted outline-none placeholder:text-dimmed disabled:cursor-not-allowed disabled:opacity-75"
          placeholder="谜题标题"
          aria-label="谜题标题"
          :disabled="saving"
          @keydown.enter.prevent="focusContentEditor"
          @keydown.down.prevent="focusContentEditor"
        >
      </label>

      <rbph-content-editor ref="contentEditor" v-model="state.content" placeholder="请输入内容" aria-label="谜题正文" :disabled="saving" @focus-title="focusTitle" />
    </u-form>

    <aside class="hidden xl:block" />
  </div>
</template>
