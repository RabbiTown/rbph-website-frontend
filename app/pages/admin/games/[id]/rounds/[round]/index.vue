<script setup lang="ts">
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { round, refresh, contentEditor, focusTitle, headerDirty, applyHeader, resetHeader } = useAdmin().useRoundContext();

const state = reactive({
  content: '',
});

const saving = ref(false);

const contentDirty = computed(() => Boolean(round.value && state.content !== round.value.content));
const dirty = computed(() => headerDirty.value || contentDirty.value);

function syncFromRound() {
  state.content = round.value?.content ?? '';
}

function reset() {
  resetHeader();
  syncFromRound();
  dirtyToast.clear();
}

async function apply() {
  if (!round.value || !dirty.value || saving.value) return;

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
    type Response = { round: AdminRoundData };
    const response = await api.patch<Response>(`/admin/rounds/${round.value.id}`, body, {
      errorHints: {
        [-2]: '区域内容不合法。',
        [-1]: '区域不存在。',
      },
    });

    round.value = response.data.round;
    syncFromRound();
    dirtyToast.clear();
    await refresh();

    toast.add({
      title: '区域内容已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存区域内容失败');
  } finally {
    saving.value = false;
  }
}

watch(
  () => round.value?.id,
  () => {
    syncFromRound();
    dirtyToast.clear();
  },
  { immediate: true },
);

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '区域内容修改尚未保存。',
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
  <div v-if="round" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />

    <u-form :state="state" class="w-full min-w-0" @submit.prevent="apply">
      <rbph-content-editor ref="contentEditor" v-model="state.content" placeholder="请输入内容" aria-label="区域正文" :disabled="saving" @focus-title="focusTitle" />
    </u-form>

    <aside class="hidden xl:block" />
  </div>
</template>
