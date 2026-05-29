<script setup lang="ts">
const gameMgr = useAdmin().useGame();
const game = gameMgr.ref;

const api = useApi();
const toast = useToast();
const submitLoading = ref(false);

const state = reactive({
  title: '',
  is_shown: false,
  is_online: false,
  date: {
    start: new Date(),
    end: new Date()
  }
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

    gameMgr.upsert(data.game);
    syncState();

    toast.add({
      title: '成功保存比赛信息',
      description: '请等待信息更新。',
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
    if (newVal?.id !== oldVal?.id) syncState();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
    <u-form :state="state" @submit="submitPatch">
      <u-page-card title="比赛信息" variant="naked" orientation="horizontal" class="mb-4">
        <u-button type="submit" :loading="submitLoading" :disabled="!hasPatch || submitLoading" color="success" variant="subtle" class="cursor-pointer w-fit lg:ms-auto" icon="material-symbols:save-outline-rounded"> 保存修改 </u-button>
      </u-page-card>
      <u-page-card variant="subtle">
        <u-form-field name="title" orientation="horizontal" label="比赛名称" required description="平台显示的名称" class="flex max-sm:flex-col justify-between items-center gap-4">
          <u-input v-model="state.title" placeholder="输入比赛名称" class="w-full" />
        </u-form-field>
        <u-separator />
        <u-form-field name="date" orientation="horizontal" label="比赛时间" required description="活动开始/结束时间" class="flex max-sm:flex-col justify-between items-center gap-4">
          <rb-input-date-time-range v-model="state.date" class="w-full" icon="material-symbols:event-outline-rounded" />
        </u-form-field>
      </u-page-card>
    </u-form>
  </div>
</template>
