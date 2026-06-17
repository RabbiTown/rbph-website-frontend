<script setup lang="ts">
const gameMgr = useAdmin().useGame();
const game = gameMgr.ref;

const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const submitLoading = ref(false);
const currencyLoading = ref(false);
const currencySubmitting = ref(false);
const currencies = ref<CurrencyItem[]>([]);
const currencyDeletePending = reactive<Record<number, boolean>>({});

type CurrencyDraft = Pick<AdminCurrencyData, 'name' | 'slug' | 'growth' | 'init_amount' | 'prec' | 'max_amount'>;
type CurrencyItem = AdminCurrencyData & { local?: boolean };
type CurrencyEditItem = {
  currency: CurrencyItem;
  draft: CurrencyDraft;
  dirty: boolean;
  deletePending: boolean;
};

const currencyDrafts = reactive<Record<number, CurrencyDraft>>({});
let nextCurrencyLocalId = -1;

function unsetRecordKey<T>(record: Record<number, T>, key: number) {
  Reflect.deleteProperty(record, key);
}

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

const currencySlugPattern = /^[a-z0-9_-]{1,40}$/;
const currencyDirty = computed(() => {
  const result: Record<number, boolean> = {};
  for (const currency of currencies.value) {
    const draft = currencyDrafts[currency.id];
    result[currency.id] = Boolean(
      currency.local ||
      currencyDeletePending[currency.id] ||
      (draft && (draft.name !== currency.name || draft.slug !== currency.slug || draft.growth !== currency.growth || draft.init_amount !== currency.init_amount || draft.prec !== currency.prec || draft.max_amount !== currency.max_amount)),
    );
  }
  return result;
});
const currencyEditItems = computed<CurrencyEditItem[]>(() =>
  currencies.value.flatMap(currency => {
    const draft = currencyDrafts[currency.id];
    if (!draft) return [];
    return [
      {
        currency,
        draft,
        dirty: Boolean(currencyDirty.value[currency.id]),
        deletePending: Boolean(currencyDeletePending[currency.id]),
      },
    ];
  }),
);
const hasCurrencyPatch = computed(() => Object.values(currencyDirty.value).some(Boolean));
const hasDirty = computed(() => hasPatch.value || hasCurrencyPatch.value);

function syncDirtyToast() {
  if (!hasDirty.value) {
    dirtyToast.clear();
    return;
  }

  dirtyToast.show({
    description: '比赛设置修改尚未保存。',
    guardOnLeave: true,
    apply: submitChanges,
    reset: resetChanges,
  });
}

function toCurrencyDraft(currency: AdminCurrencyData): CurrencyDraft {
  return {
    name: currency.name,
    slug: currency.slug,
    growth: currency.growth,
    init_amount: currency.init_amount,
    prec: currency.prec,
    max_amount: currency.max_amount,
  };
}

function resetCurrencyDraft(currency: AdminCurrencyData) {
  currencyDrafts[currency.id] = toCurrencyDraft(currency);
  unsetRecordKey(currencyDeletePending, currency.id);
}

function syncCurrencyDrafts(next: CurrencyItem[]) {
  for (const currency of next) {
    resetCurrencyDraft(currency);
  }

  for (const key of Object.keys(currencyDrafts)) {
    if (!next.some(currency => currency.id === Number(key))) {
      unsetRecordKey(currencyDrafts, Number(key));
      unsetRecordKey(currencyDeletePending, Number(key));
    }
  }
}

function isCurrencyDraftValid(draft: CurrencyDraft) {
  return draft.name.trim().length > 0 && draft.name.trim().length <= 40 && currencySlugPattern.test(draft.slug.trim()) && draft.prec >= 0 && draft.prec <= 6 && draft.init_amount >= 0 && draft.max_amount >= 0 && draft.init_amount <= draft.max_amount;
}

function currencyErrorHints() {
  return {
    [-3]: '货币标识已存在。',
    [-2]: '货币信息不合法。',
    [-1]: '比赛或货币不存在。',
  };
}

async function fetchCurrencies(gameId: number | undefined) {
  if (!gameId) {
    currencies.value = [];
    syncCurrencyDrafts([]);
    return;
  }

  currencyLoading.value = true;
  try {
    type Response = { currencies: AdminCurrencyData[] };
    const { data } = await api.get<Response>(`/admin/games/${gameId}/currencies`);
    currencies.value = data.currencies;
    syncCurrencyDrafts(data.currencies);
  } catch (error) {
    currencies.value = [];
    syncCurrencyDrafts([]);
    handleError(error, '获取货币列表失败');
  } finally {
    currencyLoading.value = false;
  }
}

function addCurrencyDraft() {
  const currency: CurrencyItem = {
    id: nextCurrencyLocalId--,
    name: '',
    slug: '',
    growth: 0,
    init_amount: 0,
    prec: 0,
    max_amount: 1000000,
    local: true,
  };
  currencies.value = [...currencies.value, currency];
  resetCurrencyDraft(currency);
}

function markCurrencyDeleting(currency: CurrencyItem) {
  if (currency.local) {
    removeLocalCurrency(currency);
    return;
  }
  currencyDeletePending[currency.id] = true;
}

function restoreCurrency(currency: CurrencyItem) {
  unsetRecordKey(currencyDeletePending, currency.id);
}

function resetCurrencyChange(currency: CurrencyItem) {
  if (currency.local) return;
  resetCurrencyDraft(currency);
}

function removeLocalCurrency(currency: CurrencyItem) {
  currencies.value = currencies.value.filter(item => item.id !== currency.id);
  unsetRecordKey(currencyDrafts, currency.id);
  unsetRecordKey(currencyDeletePending, currency.id);
}

function resetCurrencyChanges() {
  currencies.value = currencies.value.filter(currency => !currency.local);
  syncCurrencyDrafts(currencies.value);
}

function resetChanges() {
  syncState();
  resetCurrencyChanges();
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

async function submitChanges() {
  const current = game.value;
  if (!current || submitLoading.value || currencySubmitting.value) return;

  const body = patchBody.value;

  if (Object.keys(body).length === 0 && !hasCurrencyPatch.value) {
    toast.add({
      title: '没有需要保存的修改',
      icon: 'material-symbols:info-outline-rounded',
      color: 'neutral',
    });
    return;
  }

  for (const currency of currencies.value) {
    const draft = currencyDrafts[currency.id];
    if (!draft) continue;
    if (!currencyDeletePending[currency.id] && !isCurrencyDraftValid(draft)) {
      toast.add({
        title: '货币信息不合法',
        description: '请检查名称、Slug、精度、初始值和上限。',
        icon: 'material-symbols:error-outline-rounded',
        color: 'error',
      });
      return;
    }
  }

  submitLoading.value = true;
  currencySubmitting.value = true;

  try {
    if (Object.keys(body).length > 0) {
      type Response = { game: RbGameModel };
      const { data } = await api.patch<Response>(`/admin/games/${current.id}`, body, {
        errorHints: {
          [-2]: '比赛信息不合法。',
          [-1]: '比赛不存在。',
        },
      });
      gameMgr.updateCurrent(data.game);
      syncState();
    }

    for (const currency of currencies.value.filter(item => !item.local && currencyDeletePending[item.id])) {
      await api.del(`/admin/games/${current.id}/currencies/${currency.id}`, {
        errorHints: currencyErrorHints(),
      });
    }

    for (const currency of currencies.value.filter(item => !item.local && currencyDirty.value[item.id] && !currencyDeletePending[item.id])) {
      const draft = currencyDrafts[currency.id];
      if (!draft) continue;
      await api.patch(
        `/admin/games/${current.id}/currencies/${currency.id}`,
        {
          ...draft,
          name: draft.name.trim(),
          slug: draft.slug.trim(),
        },
        { errorHints: currencyErrorHints() },
      );
    }

    for (const currency of currencies.value.filter(item => item.local)) {
      const draft = currencyDrafts[currency.id];
      if (!draft) continue;
      await api.post(
        `/admin/games/${current.id}/currencies`,
        {
          ...draft,
          name: draft.name.trim(),
          slug: draft.slug.trim(),
        },
        { errorHints: currencyErrorHints() },
      );
    }

    await fetchCurrencies(current.id);
    dirtyToast.clear();

    toast.add({
      title: '成功保存比赛设置',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存比赛设置失败', true);
  } finally {
    submitLoading.value = false;
    currencySubmitting.value = false;
  }
}

watch(
  game,
  (newVal, oldVal) => {
    if (newVal?.id !== oldVal?.id) {
      dirtyToast.clear();
      syncState();
      fetchCurrencies(newVal?.id);
    }
  },
  { immediate: true },
);

watch(
  hasDirty,
  () => {
    syncDirtyToast();
  },
  { deep: true },
);
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />

    <div class="flex min-w-0 flex-col gap-4">
      <u-form :state="state" class="flex flex-col gap-4" @submit.prevent>
        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">比赛信息</h2>
          </div>
          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
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
          </div>
        </section>

        <u-separator class="my-2" />

        <section class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-semibold text-highlighted">货币管理</h2>
              <p class="mt-1 text-sm text-muted">配置当前比赛可用的货币体系。</p>
            </div>
            <u-button size="sm" variant="ghost" icon="material-symbols:refresh-rounded" :loading="currencyLoading" :disabled="hasDirty || currencySubmitting" @click="fetchCurrencies(game?.id)" />
          </div>

          <div v-if="currencyLoading" class="space-y-2">
            <u-skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
          </div>

          <u-empty v-if="!currencyLoading && currencies.length === 0" icon="material-symbols:money-bag-outline-rounded" title="暂无货币" description="添加一个货币后，可用于提示消耗、提交处罚和自定义后端。" />

          <div v-if="!currencyLoading && currencyEditItems.length > 0" class="space-y-3">
            <template v-for="item in currencyEditItems" :key="item.currency.id">
              <div
                class="relative transition-colors"
                :class="[
                  item.deletePending ? 'opacity-55 before:content-[\'\'] before:pointer-events-none before:absolute before:-inset-s-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-error' : '',
                  !item.deletePending && item.dirty
                    ? 'before:content-[\'\'] before:pointer-events-none before:absolute before:-inset-s-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-warning'
                    : '',
                ]"
              >
                <div class="relative rounded-lg bg-elevated/60 px-4 py-3 ring ring-default">
                  <div class="absolute right-3 top-3 z-10 flex items-center justify-end gap-1">
                    <u-badge v-if="item.currency.local" color="primary" variant="soft">待创建</u-badge>
                    <u-badge v-else-if="item.deletePending" color="error" variant="soft">待删除</u-badge>
                    <u-button v-else-if="item.dirty" size="xs" variant="soft" color="warning" class="group relative h-5 w-12 overflow-hidden px-0 text-[11px]" :disabled="currencySubmitting" @click="resetCurrencyChange(item.currency)">
                      <span class="absolute inset-0 inline-flex items-center justify-center transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-0">已修改</span>
                      <span class="absolute inset-0 inline-flex translate-y-1 items-center justify-center gap-0.5 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                        <u-icon name="material-symbols:restart-alt-rounded" class="size-3" />
                        重置
                      </span>
                    </u-button>
                    <u-button v-if="item.deletePending" icon="material-symbols:undo-rounded" color="neutral" variant="ghost" size="sm" :disabled="currencySubmitting" @click="restoreCurrency(item.currency)" />
                    <u-popover v-else arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
                      <u-button icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="sm" :disabled="currencySubmitting" />
                      <template #content>
                        <div class="w-64 p-3 text-sm">
                          <div class="flex items-start gap-2">
                            <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                            <div class="min-w-0">
                              <div class="font-medium text-highlighted">删除货币？</div>
                              <div class="mt-1 text-xs text-muted">确认将「{{ item.currency.name }}」标记为待删除？保存后相关队伍余额、提示消耗和处罚配置会被清除或置空。</div>
                            </div>
                          </div>
                          <div class="mt-3 flex justify-end">
                            <u-button size="xs" color="error" variant="soft" icon="material-symbols:delete-outline-rounded" @click="markCurrencyDeleting(item.currency)">标记删除</u-button>
                          </div>
                        </div>
                      </template>
                    </u-popover>
                  </div>
                  <div class="flex flex-col gap-3">
                    <div class="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                      <rb-form-field label="名称">
                        <u-input v-model="item.draft.name" placeholder="例如 提示点" class="w-full" :disabled="currencySubmitting || item.deletePending" />
                      </rb-form-field>
                      <rb-form-field label="内部 ID">
                        <u-input v-model="item.draft.slug" placeholder="例如 hint" class="w-full font-mono" :disabled="currencySubmitting || item.deletePending" />
                      </rb-form-field>
                    </div>
                    <div class="grid gap-3 md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <rb-form-field label="精度">
                        <u-input-number v-model="item.draft.prec" :min="0" :max="6" :step="1" orientation="vertical" class="w-full" :disabled="currencySubmitting || item.deletePending" />
                      </rb-form-field>
                      <rb-form-field label="初始值">
                        <rb-input-number
                          v-model="item.draft.init_amount"
                          :prec="item.draft.prec"
                          :min="0"
                          :max="item.draft.max_amount"
                          :step="10 ** item.draft.prec"
                          orientation="vertical"
                          class="w-full"
                          :disabled="currencySubmitting || item.deletePending"
                        />
                      </rb-form-field>
                      <rb-form-field label="增长/分钟">
                        <rb-input-number
                          v-model="item.draft.growth"
                          :prec="item.draft.prec"
                          :step="10 ** item.draft.prec"
                          orientation="vertical"
                          class="w-full"
                          :disabled="currencySubmitting || item.deletePending"
                        />
                      </rb-form-field>
                      <rb-form-field label="上限">
                        <rb-input-number
                          v-model="item.draft.max_amount"
                          :prec="item.draft.prec"
                          :min="0"
                          :step="10 ** item.draft.prec"
                          orientation="vertical"
                          class="w-full"
                          :disabled="currencySubmitting || item.deletePending"
                        />
                      </rb-form-field>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div v-if="!currencyLoading" class="flex justify-end">
            <u-button icon="material-symbols:add-rounded" label="新建货币" :disabled="currencySubmitting" @click="addCurrencyDraft" />
          </div>
        </section>
      </u-form>
    </div>

    <aside class="hidden xl:block" />
  </div>
</template>
