<script setup lang="ts">const { t } = useI18n();


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

type CurrencyDraft = Pick<AdminCurrencyData, 'name' | 'slug' | 'growth' | 'init_amount' | 'init_hidden' | 'prec' | 'max_amount'>;
type CurrencyItem = AdminCurrencyData & { local?: boolean };
type CurrencyEditItem = {
  currency: CurrencyItem;
  draft: CurrencyDraft;
  dirty: boolean;
  deletePending: boolean;
};
type GameSettingsPatchBody = Partial<Pick<RbGameModel, 'title' | 'is_listed' | 'is_active'>> & {
  settings?: {
    team?: {
      max_members?: number | null;
    };
  };
};

const currencyDrafts = reactive<Record<number, CurrencyDraft>>({});
const currencyAmountMax = Number.MAX_SAFE_INTEGER;
let nextCurrencyLocalId = -1;

function unsetRecordKey<T>(record: Record<number, T>, key: number) {
  Reflect.deleteProperty(record, key);
}

const state = reactive({
  title: '',
  is_listed: false,
  is_active: false,
  max_members: null as number | null,
});

function syncState() {
  state.title = game.value?.title ?? '';
  state.is_listed = game.value?.is_listed ?? false;
  state.is_active = game.value?.is_active ?? false;
  state.max_members = game.value?.settings?.team.max_members ?? null;
}

function normalizeMaxMembers(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function makePatchBody() {
  const current = game.value;
  if (!current) return {};

  const body: GameSettingsPatchBody = {};
  const maxMembers = normalizeMaxMembers(state.max_members);
  const currentMaxMembers = current.settings?.team.max_members ?? null;

  if (state.title !== current.title) body.title = state.title;
  if (state.is_listed !== current.is_listed) body.is_listed = state.is_listed;
  if (state.is_active !== current.is_active) body.is_active = state.is_active;
  if (maxMembers !== currentMaxMembers) body.settings = { team: { max_members: maxMembers } };

  return body;
}

const patchBody = computed(() => makePatchBody());
const hasPatch = computed(() => Object.keys(patchBody.value).length > 0);
const dirtyFields = computed(() => {
  const patch = patchBody.value;
  return {
    title: 'title' in patch,
    isListed: 'is_listed' in patch,
    isActive: 'is_active' in patch,
    maxMembers: Boolean(patch.settings?.team && 'max_members' in patch.settings.team),
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
      (draft &&
        (draft.name !== currency.name ||
          draft.slug !== currency.slug ||
          draft.growth !== currency.growth ||
          draft.init_amount !== currency.init_amount ||
          draft.init_hidden !== currency.init_hidden ||
          draft.prec !== currency.prec ||
          draft.max_amount !== currency.max_amount)),
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
    description: t('admin.pages.game.settings.gameSettingsUpdateNotYetSave'),
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
    init_hidden: currency.init_hidden,
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
  return (
    draft.name.trim().length > 0 &&
    draft.name.trim().length <= 40 &&
    currencySlugPattern.test(draft.slug.trim()) &&
    draft.prec >= 0 &&
    draft.prec <= 6 &&
    Math.abs(draft.growth) <= currencyAmountMax &&
    draft.init_amount >= 0 &&
    draft.init_amount <= currencyAmountMax &&
    draft.max_amount >= 0 &&
    draft.max_amount <= currencyAmountMax &&
    draft.init_amount <= draft.max_amount
  );
}

function currencyErrorHints() {
  return {
    [-3]: t('admin.pages.game.settings.currencySlugExists'),
    [-2]: t('admin.pages.game.settings.currencyInfoInvalid'),
    [-1]: t('admin.pages.game.settings.gameOrCurrencyNotFound'),
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
    handleError(error, t('admin.common.loadCurrencyListFailed'));
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
    init_hidden: false,
    prec: 0,
    max_amount: currencyAmountMax,
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
  } else if (field === 'isListed') {
    state.is_listed = current.is_listed ?? false;
  } else if (field === 'isActive') {
    state.is_active = current.is_active ?? false;
  } else if (field === 'maxMembers') {
    state.max_members = current.settings?.team.max_members ?? null;
  }
}

async function submitChanges() {
  const current = game.value;
  if (!current || submitLoading.value || currencySubmitting.value) return;

  const body = patchBody.value;
  const maxMembers = normalizeMaxMembers(state.max_members);

  if (Object.keys(body).length === 0 && !hasCurrencyPatch.value) {
    toast.add({
      title: t('admin.pages.game.settings.saveUpdate'),
      icon: 'material-symbols:info-outline-rounded',
      color: 'neutral',
    });
    return;
  }

  if (maxMembers !== null && maxMembers <= 0) {
    toast.add({
      title: t('admin.pages.game.settings.teamMemberLimitInvalid'),
      description: t('admin.pages.game.settings.enterGreaterThanOrEmptyUnlimited'),
      icon: 'material-symbols:error-outline-rounded',
      color: 'error',
    });
    return;
  }

  for (const currency of currencies.value) {
    const draft = currencyDrafts[currency.id];
    if (!draft) continue;
    if (!currencyDeletePending[currency.id] && !isCurrencyDraftValid(draft)) {
      toast.add({
        title: t('admin.pages.game.settings.currencyInfoInvalidLabel'),
        description: t('admin.pages.game.settings.currencyValidationHint'),
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
          [-2]: t('admin.pages.game.settings.gameInfoInvalid'),
          [-1]: t('admin.common.gameNotFound'),
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
      title: t('admin.pages.game.settings.successSaveGameSettings'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('admin.pages.game.settings.saveGameSettingsFailed'), true);
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
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.gameInfo') }}</h2>
          </div>
          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
            <rb-form-field name="title" row :label="t('admin.common.gameName')" required :description="t('admin.pages.game.settings.platformShowName')" :dirty="dirtyFields.title" :reset="() => resetField('title')" :ui="{ container: 'w-full sm:w-96' }">
              <u-input v-model="state.title" :placeholder="t('admin.common.enterGameName')" class="w-full" />
            </rb-form-field>
            <u-separator />
            <rb-form-field name="is_listed" row :label="t('admin.pages.game.settings.public')" :description="t('admin.pages.game.settings.publicListingDescription')" :dirty="dirtyFields.isListed" :reset="() => resetField('isListed')">
              <u-switch v-model="state.is_listed" />
            </rb-form-field>
            <u-separator />
            <rb-form-field name="is_active" row :label="t('admin.pages.game.settings.gameOpen')" :description="t('admin.pages.game.settings.controlNormalPlayerGameFeatures')" :dirty="dirtyFields.isActive" :reset="() => resetField('isActive')">
              <u-switch v-model="state.is_active" />
            </rb-form-field>
            <u-separator />
            <rb-form-field name="max_members" row :label="t('admin.pages.game.settings.teamMemberLimit')" :description="t('admin.pages.game.settings.perTeamTeamJoinMemberCount')" :dirty="dirtyFields.maxMembers" :reset="() => resetField('maxMembers')">
              <div class="flex flex-wrap items-center gap-3">
                <u-input-number v-model="state.max_members" :min="1" :step="1" orientation="vertical" :placeholder="t('admin.pages.game.settings.unlimited')" class="w-32" />
              </div>
            </rb-form-field>
          </div>
        </section>

        <u-separator class="my-2" />

        <section class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.currencyManagement') }}</h2>
              <p class="mt-1 text-sm text-muted">{{ t('admin.pages.game.settings.currencySectionDescription') }}</p>
            </div>
            <u-button size="sm" variant="ghost" icon="material-symbols:refresh-rounded" :loading="currencyLoading" :disabled="hasDirty || currencySubmitting" @click="fetchCurrencies(game?.id)" />
          </div>

          <div v-if="currencyLoading" class="space-y-2">
            <u-skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
          </div>

          <u-empty v-if="!currencyLoading && currencies.length === 0" icon="material-symbols:money-bag-outline-rounded" :title="t('admin.pages.game.settings.emptyCurrency')" :description="t('admin.pages.game.settings.currencyDescription')" />

          <div v-if="!currencyLoading && currencyEditItems.length > 0" class="space-y-3">
            <template v-for="item in currencyEditItems" :key="item.currency.id">
              <div
                class="relative transition-colors"
                :class="[
                  item.deletePending ? 'opacity-55 before:content-[\'\'] before:pointer-events-none before:absolute before:-inset-s-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-error' : '',
                  !item.deletePending && item.dirty ? 'before:content-[\'\'] before:pointer-events-none before:absolute before:-inset-s-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-warning' : '',
                ]"
              >
                <div class="relative rounded-lg bg-elevated/60 px-4 py-3 ring ring-default">
                  <div class="absolute right-3 top-3 z-10 flex items-center justify-end gap-1">
                    <u-badge v-if="item.currency.local" color="primary" variant="soft">{{ t('admin.pages.game.settings.currencyStatus.pendingCreate') }}</u-badge>
                    <u-badge v-else-if="item.deletePending" color="error" variant="soft">{{ t('admin.pages.game.settings.currencyStatus.pendingDeletion') }}</u-badge>
                    <u-button v-else-if="item.dirty" size="xs" variant="soft" color="warning" class="group relative h-5 w-12 overflow-hidden px-0 text-[11px]" :disabled="currencySubmitting" @click="resetCurrencyChange(item.currency)">
                      <span class="absolute inset-0 inline-flex items-center justify-center transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-0">{{ t('admin.pages.game.settings.currencyStatus.updated') }}</span>
                      <span class="absolute inset-0 inline-flex translate-y-1 items-center justify-center gap-0.5 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                        <u-icon name="material-symbols:restart-alt-rounded" class="size-3" /> {{ t('admin.common.reset') }} </span>
                    </u-button>
                    <u-button v-if="item.deletePending" icon="material-symbols:undo-rounded" color="neutral" variant="ghost" size="sm" :disabled="currencySubmitting" @click="restoreCurrency(item.currency)" />
                    <u-popover v-else arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
                      <u-button icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="sm" :disabled="currencySubmitting" />
                      <template #content>
                        <div class="w-64 p-3 text-sm">
                          <div class="flex items-start gap-2">
                            <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                            <div class="min-w-0">
                              <div class="font-medium text-highlighted">{{ t('admin.pages.game.settings.deleteCurrency') }}</div>
                              <div class="mt-1 text-xs text-muted">{{ t('admin.pages.game.settings.confirmDeleteCurrency', { currency: item.currency.name }) }}</div>
                            </div>
                          </div>
                          <div class="mt-3 flex justify-end">
                            <u-button size="xs" color="error" variant="soft" icon="material-symbols:delete-outline-rounded" @click="markCurrencyDeleting(item.currency)">{{ t('admin.pages.game.settings.markDelete') }}</u-button>
                          </div>
                        </div>
                      </template>
                    </u-popover>
                  </div>
                  <div class="flex flex-col gap-3">
                    <div class="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                      <rb-form-field :label="t('admin.common.name')">
                        <u-input v-model="item.draft.name" :placeholder="t('admin.pages.game.settings.exampleHint')" class="w-full" :disabled="currencySubmitting || item.deletePending" />
                      </rb-form-field>
                      <rb-form-field :label="t('admin.pages.game.settings.internalId')">
                        <u-input v-model="item.draft.slug" :placeholder="t('admin.pages.game.settings.exampleHintLabel')" class="w-full font-mono" :disabled="currencySubmitting || item.deletePending" />
                      </rb-form-field>
                    </div>
                    <div class="grid gap-3 md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem]">
                      <rb-form-field :label="t('admin.pages.game.settings.precision')">
                        <u-input-number v-model="item.draft.prec" :min="0" :max="6" :step="1" orientation="vertical" class="w-full" :disabled="currencySubmitting || item.deletePending" />
                      </rb-form-field>
                      <rb-form-field :label="t('admin.pages.game.settings.initialValue')">
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
                      <rb-form-field :label="t('admin.common.growthPerMinute')">
                        <rb-input-number v-model="item.draft.growth" :prec="item.draft.prec" :max="currencyAmountMax" :step="10 ** item.draft.prec" orientation="vertical" class="w-full" :disabled="currencySubmitting || item.deletePending" />
                      </rb-form-field>
                      <rb-form-field :label="t('admin.pages.game.settings.limit')">
                        <rb-input-number
                          v-model="item.draft.max_amount"
                          :prec="item.draft.prec"
                          :min="0"
                          :max="currencyAmountMax"
                          :step="10 ** item.draft.prec"
                          orientation="vertical"
                          class="w-full"
                          :disabled="currencySubmitting || item.deletePending"
                        />
                      </rb-form-field>
                      <rb-form-field :label="t('admin.pages.game.settings.hide')">
                        <u-switch v-model="item.draft.init_hidden" :disabled="currencySubmitting || item.deletePending" class="mt-2.5" />
                      </rb-form-field>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div v-if="!currencyLoading" class="flex justify-end">
            <u-button icon="material-symbols:add-rounded" :label="t('admin.pages.game.settings.createCurrency')" :disabled="currencySubmitting" @click="addCurrencyDraft" />
          </div>
        </section>
      </u-form>
    </div>

    <aside class="hidden xl:block" />
  </div>
</template>
