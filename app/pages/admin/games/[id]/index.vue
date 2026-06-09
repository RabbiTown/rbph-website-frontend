<script setup lang="ts">
const gameMgr = useAdmin().useGame();
const game = gameMgr.ref;

const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const submitLoading = ref(false);

const state = reactive({
  title: '',
  is_shown: false,
  is_online: false,
  date: {
    start: new Date(),
    end: new Date(),
  },
});

function syncState() {
  state.title = game.value?.title ?? '';
  state.is_shown = game.value?.is_shown ?? false;
  state.is_online = game.value?.is_online ?? false;
  state.date.start = new Date(game.value?.start_at ?? '');
  state.date.end = new Date(game.value?.end_at ?? '');
}

function normalizeDate(date: Date | string | undefined) {
  return date ? new Date(date).toISOString() : undefined;
}

function makePatchBody() {
  const current = game.value;
  if (!current) return {};

  const body: Partial<Pick<RbGameModel, 'title' | 'is_shown' | 'is_online' | 'start_at' | 'end_at'>> = {};
  const startAt = normalizeDate(state.date.start);
  const endAt = normalizeDate(state.date.end);

  if (state.title !== current.title) body.title = state.title;
  if (state.is_shown !== current.is_shown) body.is_shown = state.is_shown;
  if (state.is_online !== current.is_online) body.is_online = state.is_online;
  if (startAt && startAt !== normalizeDate(current.start_at)) body.start_at = startAt;
  if (endAt && endAt !== normalizeDate(current.end_at)) body.end_at = endAt;

  return body;
}

const patchBody = computed(() => makePatchBody());
const hasPatch = computed(() => Object.keys(patchBody.value).length > 0);
const dirtyFields = computed(() => {
  const patch = patchBody.value;
  return {
    title: 'title' in patch,
    isShown: 'is_shown' in patch,
    isOnline: 'is_online' in patch,
    date: 'start_at' in patch || 'end_at' in patch,
  };
});

function syncDirtyToast() {
  if (!hasPatch.value) {
    dirtyToast.clear();
    return;
  }

  dirtyToast.show({
    guardOnLeave: true,
    apply: submitPatch,
    reset: resetPatch,
  });
}

function resetPatch() {
  syncState();
  dirtyToast.clear();
}

function resetField(field: keyof typeof dirtyFields.value) {
  const current = game.value;
  if (!current) return;

  if (field === 'title') {
    state.title = current.title;
  } else if (field === 'isShown') {
    state.is_shown = current.is_shown ?? false;
  } else if (field === 'isOnline') {
    state.is_online = current.is_online ?? false;
  } else if (field === 'date') {
    state.date.start = new Date(current.start_at);
    state.date.end = new Date(current.end_at);
  }
}

async function submitPatch() {
  const current = game.value;
  if (!current || submitLoading.value) return;

  const body = patchBody.value;

  if (Object.keys(body).length === 0) {
    toast.add({
      title: '没有需要保存的修改',
      icon: 'material-symbols:info-outline-rounded',
      color: 'neutral',
    });
    return;
  }

  submitLoading.value = true;

  try {
    type Response = { game: RbGameModel };
    const { data } = await api.patch<Response>(`/admin/games/${current.id}`, body, {
      errorHints: {
        [-2]: '比赛信息不合法。',
        [-1]: '比赛不存在。',
      },
    });

    gameMgr.updateCurrent(data.game);
    syncState();
    dirtyToast.clear();

    toast.add({
      title: '成功保存比赛信息',
      description: '信息即将更新。',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存比赛信息失败', true);
  } finally {
    submitLoading.value = false;
  }
}

watch(
  game,
  (newVal, oldVal) => {
    if (newVal?.id !== oldVal?.id) {
      dirtyToast.clear();
      syncState();
    }
  },
  { immediate: true },
);

watch(
  patchBody,
  () => {
    syncDirtyToast();
  },
  { deep: true },
);
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
    <u-form :state="state" @submit.prevent>
      <u-page-card title="比赛信息" variant="naked" orientation="horizontal" class="mb-4" />
      <u-page-card variant="subtle">
        <rb-form-field name="title" orientation="horizontal" label="比赛名称" required description="在平台上显示的名称" class="flex max-sm:flex-col justify-between items-center gap-4" :dirty="dirtyFields.title" :reset="() => resetField('title')">
          <u-input v-model="state.title" placeholder="输入比赛名称" class="w-full" />
        </rb-form-field>
        <u-separator />
        <rb-form-field
          name="is_shown"
          orientation="horizontal"
          label="展示比赛"
          description="控制比赛是否出现在公开列表和入口中"
          class="flex max-sm:flex-col justify-between items-center gap-4"
          :dirty="dirtyFields.isShown"
          :reset="() => resetField('isShown')"
        >
          <u-switch v-model="state.is_shown" />
        </rb-form-field>
        <u-separator />
        <rb-form-field
          name="is_online"
          orientation="horizontal"
          label="比赛在线"
          description="控制比赛是否允许正常访问"
          class="flex max-sm:flex-col justify-between items-center gap-4"
          :dirty="dirtyFields.isOnline"
          :reset="() => resetField('isOnline')"
        >
          <u-switch v-model="state.is_online" />
        </rb-form-field>
        <u-separator />
        <rb-form-field name="date" orientation="horizontal" label="比赛时间" required description="活动开始/结束时间" class="flex max-sm:flex-col justify-between items-center gap-4" :dirty="dirtyFields.date" :reset="() => resetField('date')">
          <rb-input-date-time-range v-model="state.date" class="w-full" icon="material-symbols:event-outline-rounded" />
        </rb-form-field>
      </u-page-card>
    </u-form>
  </div>
</template>
