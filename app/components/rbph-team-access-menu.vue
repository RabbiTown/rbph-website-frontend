<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const props = withDefaults(
  defineProps<{
    gameId: number;
    teamId: number;
    teamName: string;
    size?: 'sm' | 'md';
    statusFeature?: Extract<RbTeamFeature, 'direct_message' | 'puzzle_ticket'>;
  }>(),
  { size: 'sm', statusFeature: undefined },
);
const emit = defineEmits<{
  statusChange: [banned: boolean];
}>();

const { t } = useI18n();
const api = useApi();
const toast = useToast();
const modalOpen = ref(false);
const currencyModalOpen = ref(false);
const historyOpen = ref(false);
const loading = ref(false);
const saving = ref(false);
const currencyLoading = ref(false);
const currencySaving = ref(false);
const response = ref<StaffTeamAccessResponse>();
const reason = ref('');
const currencies = ref<RbTeamCurrency[]>([]);
const selectedCurrencyId = ref<number>();
const currencyOperation = ref<'add' | 'deduct'>('add');
const currencyAmount = ref(0);
const currencyReason = ref('');
const currencyConflict = ref('');
const draft = reactive({
  is_banned: false,
  is_locked: false,
  features: {} as Record<RbTeamFeature, boolean>,
});

const featureMeta = computed<Record<RbTeamFeature, { label: string; icon: string; enabled: string; disabled: string }>>(() => ({
  direct_message: {
    label: t('admin.common.directMessage'),
    icon: 'material-symbols:mail-outline-rounded',
    enabled: t('admin.pages.team.featureAccessDescription.directMessage.enabled'),
    disabled: t('admin.pages.team.featureAccessDescription.directMessage.disabled'),
  },
  puzzle_ticket: {
    label: t('admin.common.ticket'),
    icon: 'material-symbols:near-me-outline-rounded',
    enabled: t('admin.pages.team.featureAccessDescription.puzzleTicket.enabled'),
    disabled: t('admin.pages.team.featureAccessDescription.puzzleTicket.disabled'),
  },
  leaderboard: {
    label: t('admin.common.leaderboard'),
    icon: 'material-symbols:leaderboard-outline-rounded',
    enabled: t('admin.pages.team.featureAccessDescription.leaderboard.enabled'),
    disabled: t('admin.pages.team.featureAccessDescription.leaderboard.disabled'),
  },
}));

function syncDraft(next: StaffTeamAccessResponse) {
  response.value = next;
  draft.is_banned = next.access.is_banned;
  draft.is_locked = next.access.is_locked;
  draft.features = Object.fromEntries(next.access.features.map(feature => [feature.feature, feature.enabled])) as Record<RbTeamFeature, boolean>;
  if (props.statusFeature) {
    emit('statusChange', next.access.features.find(feature => feature.feature === props.statusFeature)?.enabled === false);
  }
}

async function loadAccess(forEditor = true) {
  const teamId = props.teamId;
  if (forEditor) {
    loading.value = true;
    response.value = undefined;
    reason.value = '';
  } else {
    emit('statusChange', false);
  }
  try {
    const { data } = await api.get<StaffTeamAccessResponse>(`/games/${props.gameId}/tickets/staff/teams/${teamId}/access`);
    if (teamId === props.teamId) syncDraft(data);
  } catch (error) {
    if (forEditor) {
      modalOpen.value = false;
      handleError(error, t('components.teamAccessMenu.loadFailed'));
    }
  } finally {
    if (forEditor) loading.value = false;
  }
}

function openEditor() {
  modalOpen.value = true;
  void loadAccess();
}

const selectedCurrency = computed(() => currencies.value.find(currency => currency.id === selectedCurrencyId.value));
const selectedCurrentAmount = computed(() => selectedCurrency.value?.current_amount ?? selectedCurrency.value?.amount ?? 0);
const currencyDelta = computed(() => currencyAmount.value * (currencyOperation.value === 'add' ? 1 : -1));
const currencyAfter = computed(() => selectedCurrentAmount.value + currencyDelta.value);
const currencyValidation = computed(() => {
  const currency = selectedCurrency.value;
  if (!currency) return t('components.teamAccessMenu.currencySelectRequired');
  if (!Number.isSafeInteger(currencyAmount.value) || currencyAmount.value <= 0) return t('components.teamAccessMenu.currencyAmountInvalid');
  if (currencyAfter.value > currency.max_amount) return t('components.teamAccessMenu.currencyAboveMax');
  return '';
});
const currencyItems = computed(() => currencies.value.map(currency => ({ label: currency.name, value: currency.id })));

async function openCurrencyEditor() {
  currencyModalOpen.value = true;
  currencyLoading.value = true;
  currencies.value = [];
  selectedCurrencyId.value = undefined;
  currencyOperation.value = 'add';
  currencyAmount.value = 0;
  currencyReason.value = '';
  currencyConflict.value = '';
  try {
    const { data } = await api.get<StaffTeamCurrencyListResponse>(`/games/${props.gameId}/tickets/staff/teams/${props.teamId}/currencies`);
    currencies.value = data.currencies;
    selectedCurrencyId.value = data.currencies[0]?.id;
  } catch (error) {
    currencyModalOpen.value = false;
    handleError(error, t('components.teamAccessMenu.currencyLoadFailed'));
  } finally {
    currencyLoading.value = false;
  }
}

async function saveCurrency() {
  const currency = selectedCurrency.value;
  if (!currency || currencyValidation.value || currencySaving.value) return;
  currencySaving.value = true;
  currencyConflict.value = '';
  try {
    const body: StaffTeamCurrencyAdjustRequest = { delta: currencyDelta.value };
    const trimmedReason = currencyReason.value.trim();
    if (trimmedReason) body.reason = trimmedReason;
    const { data } = await api.post<StaffTeamCurrencyAdjustResponse>(
      `/games/${props.gameId}/tickets/staff/teams/${props.teamId}/currencies/${currency.id}/adjust`,
      body,
    );
    currencies.value = currencies.value.map(item => (item.id === data.currency.id ? data.currency : item));
    currencyModalOpen.value = false;
    toast.add({ title: t('components.teamAccessMenu.currencySaved'), icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
  } catch (error) {
    const errorData = (error as { data?: { code?: number; payload?: { code?: number; currency?: RbTeamCurrency } } }).data;
    const payload = errorData?.payload;
    if (payload?.currency && payload.code === -1) {
      currencies.value = currencies.value.map(item => (item.id === payload.currency!.id ? payload.currency! : item));
      currencyConflict.value = t('components.teamAccessMenu.currencyChangedAboveMax');
    } else {
      handleError(error, t('components.teamAccessMenu.currencySaveFailed'), true);
    }
  } finally {
    currencySaving.value = false;
  }
}

defineExpose({ openEditor });

watch(
  () => [props.gameId, props.teamId, props.statusFeature] as const,
  () => {
    if (props.statusFeature) void loadAccess(false);
  },
  { immediate: true },
);

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('components.teamAccessMenu.edit'),
      icon: 'material-symbols:admin-panel-settings-outline-rounded',
      onSelect: openEditor,
    },
    {
      label: t('components.teamAccessMenu.adjustCurrency'),
      icon: 'material-symbols:account-balance-wallet-outline-rounded',
      onSelect: openCurrencyEditor,
    },
  ],
  [
    {
      label: t('components.teamAccessMenu.history'),
      icon: 'material-symbols:history-rounded',
      onSelect: () => (historyOpen.value = true),
    },
  ],
]);

const changedFeatures = computed(() => {
  const current = response.value;
  if (!current) return [];
  return current.editable.features.filter(feature => draft.features[feature] !== current.access.features.find(item => item.feature === feature)?.enabled);
});

const dirty = computed(() => {
  const current = response.value;
  if (!current) return false;
  return (current.editable.team_ban && draft.is_banned !== current.access.is_banned) || (current.editable.team_lock && draft.is_locked !== current.access.is_locked) || changedFeatures.value.length > 0;
});

const changes = computed(() => {
  const current = response.value;
  if (!current) return [];
  const result: Array<{ key: string; label: string; icon: string; color: 'primary' | 'error' | 'warning' }> = [];
  if (current.editable.team_ban && draft.is_banned !== current.access.is_banned) {
    result.push({
      key: 'team-banned',
      label: draft.is_banned ? t('admin.pages.team.accessChange.ban') : t('admin.pages.team.accessChange.unban'),
      icon: draft.is_banned ? 'material-symbols:block-outline' : 'material-symbols:check-rounded',
      color: draft.is_banned ? 'error' : 'primary',
    });
  }
  if (current.editable.team_lock && draft.is_locked !== current.access.is_locked) {
    result.push({
      key: 'team-locked',
      label: draft.is_locked ? t('admin.pages.team.accessChange.lock') : t('admin.pages.team.accessChange.unlock'),
      icon: draft.is_locked ? 'material-symbols:lock-outline' : 'material-symbols:lock-open-outline-rounded',
      color: draft.is_locked ? 'warning' : 'primary',
    });
  }
  for (const feature of changedFeatures.value) {
    const enabled = draft.features[feature];
    result.push({
      key: feature,
      label: t(`admin.pages.team.featureAction.${enabled ? 'enable' : 'disable'}`, { feature: featureMeta.value[feature].label }),
      icon: enabled ? 'material-symbols:check-rounded' : 'material-symbols:block-outline',
      color: enabled ? 'primary' : 'error',
    });
  }
  return result;
});

async function saveAccess() {
  const current = response.value;
  if (!current || !dirty.value || saving.value) return;

  const body: StaffTeamAccessUpdateRequest = {};
  if (current.editable.team_ban && draft.is_banned !== current.access.is_banned) body.is_banned = draft.is_banned;
  if (current.editable.team_lock && draft.is_locked !== current.access.is_locked) body.is_locked = draft.is_locked;
  if (changedFeatures.value.length) body.features = changedFeatures.value.map(feature => ({ feature, enabled: draft.features[feature] }));
  const trimmedReason = reason.value.trim();
  if (trimmedReason) body.reason = trimmedReason;

  saving.value = true;
  try {
    const { data } = await api.patch<StaffTeamAccessResponse>(`/games/${props.gameId}/tickets/staff/teams/${props.teamId}/access`, body);
    syncDraft(data);
    modalOpen.value = false;
    toast.add({
      title: t('components.teamAccessMenu.saved'),
      icon: 'material-symbols:check-circle-outline-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('components.teamAccessMenu.saveFailed'), true);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <u-dropdown-menu :items="items">
    <button type="button" class="group max-w-full cursor-pointer rounded-md" :aria-label="t('components.teamAccessMenu.edit')">
      <u-badge :size="size" color="primary" variant="soft" icon="material-symbols:groups-2-outline-rounded" class="h-6 max-w-full group-data-[state=open]:ring-2 group-data-[state=open]:ring-primary/30">
        <span class="min-w-0 truncate">{{ teamName }}</span>
        <u-icon name="material-symbols:arrow-drop-down-rounded" class="size-4 shrink-0" />
      </u-badge>
    </button>
  </u-dropdown-menu>

  <rb-confirm-modal
    v-model:open="modalOpen"
    :title="t('components.teamAccessMenu.title', { team: teamName })"
    :description="t('components.teamAccessMenu.description')"
    :confirm-label="t('components.teamAccessMenu.save')"
    confirm-icon="material-symbols:save-outline-rounded"
    :confirm-disabled="loading || !dirty"
    :busy="saving"
    @confirm="saveAccess"
  >
    <template #body>
      <div v-if="loading" class="space-y-3">
        <u-skeleton class="h-20 w-full" />
        <u-skeleton class="h-20 w-full" />
      </div>
      <div v-else-if="response" class="space-y-3">
        <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
          <rb-form-field
            v-if="response.editable.team_ban"
            row
            :label="t('admin.common.teamState')"
            icon="material-symbols:shield-outline-rounded"
            :description="draft.is_banned ? t('admin.pages.team.teamStateDescription.banned') : t('admin.pages.team.teamStateDescription.normal')"
          >
            <u-field-group>
              <u-button color="neutral" variant="soft" active-color="error" icon="material-symbols:block-outline" :label="t('admin.common.banned')" :active="draft.is_banned" :disabled="saving" @click="draft.is_banned = true" />
              <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:check-rounded" :label="t('admin.pages.team.normal')" :active="!draft.is_banned" :disabled="saving" @click="draft.is_banned = false" />
            </u-field-group>
          </rb-form-field>

          <template v-if="response.editable.team_lock">
            <u-separator v-if="response.editable.team_ban" />
            <rb-form-field
              row
              :label="t('admin.pages.team.accessChange.lock')"
              icon="material-symbols:lock-outline"
              :description="draft.is_locked ? t('admin.pages.team.teamLockDescription.locked') : t('admin.pages.team.teamLockDescription.unlocked')"
            >
              <u-field-group>
                <u-button color="neutral" variant="soft" active-color="warning" icon="material-symbols:lock-outline" :label="t('admin.common.locked')" :active="draft.is_locked" :disabled="saving" @click="draft.is_locked = true" />
                <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:lock-open-outline-rounded" :label="t('admin.pages.team.unlock')" :active="!draft.is_locked" :disabled="saving" @click="draft.is_locked = false" />
              </u-field-group>
            </rb-form-field>
          </template>

          <template v-for="(feature, index) in response.editable.features" :key="feature">
            <u-separator v-if="response.editable.team_ban || response.editable.team_lock || index > 0" />
            <rb-form-field row :label="featureMeta[feature].label" :icon="featureMeta[feature].icon" :description="draft.features[feature] ? featureMeta[feature].enabled : featureMeta[feature].disabled">
              <u-field-group>
                <u-button color="neutral" variant="soft" active-color="error" icon="material-symbols:block-outline" :label="t('admin.common.banned')" :active="!draft.features[feature]" :disabled="saving" @click="draft.features[feature] = false" />
                <u-button
                  color="neutral"
                  variant="soft"
                  active-color="primary"
                  icon="material-symbols:check-rounded"
                  :label="t('admin.pages.team.normal')"
                  :active="draft.features[feature]"
                  :disabled="saving"
                  @click="draft.features[feature] = true"
                />
              </u-field-group>
            </rb-form-field>
          </template>
        </div>

        <div v-if="changes.length" class="flex flex-wrap gap-2">
          <u-badge v-for="change in changes" :key="change.key" :color="change.color" variant="soft" :icon="change.icon">{{ change.label }}</u-badge>
        </div>

        <rb-form-field :label="t('admin.pages.team.reason')">
          <u-textarea v-model="reason" class="w-full" :rows="3" :maxlength="500" :disabled="saving" :placeholder="t('admin.pages.team.accessReasonPlaceholder')" />
        </rb-form-field>
      </div>
    </template>
  </rb-confirm-modal>

  <rb-confirm-modal
    v-model:open="currencyModalOpen"
    :title="t('components.teamAccessMenu.currencyTitle', { team: teamName })"
    :description="t('components.teamAccessMenu.currencyDescription')"
    :confirm-label="t('components.teamAccessMenu.currencyConfirm')"
    confirm-icon="material-symbols:account-balance-wallet-outline-rounded"
    :confirm-disabled="currencyLoading || Boolean(currencyValidation)"
    :busy="currencySaving"
    @confirm="saveCurrency"
  >
    <template #body>
      <div v-if="currencyLoading" class="space-y-3">
        <u-skeleton class="h-10 w-full" />
        <u-skeleton class="h-24 w-full" />
      </div>
      <u-empty
        v-else-if="currencies.length === 0"
        icon="material-symbols:money-bag-outline-rounded"
        :title="t('components.teamAccessMenu.currencyEmpty')"
      />
      <div v-else class="space-y-4">
        <rb-form-field :label="t('components.teamAccessMenu.currencyLabel')" required>
          <u-select v-model="selectedCurrencyId" :items="currencyItems" class="w-full" :disabled="currencySaving" />
        </rb-form-field>

        <div v-if="selectedCurrency" class="grid gap-3 sm:grid-cols-2">
          <rb-form-field :label="t('components.teamAccessMenu.currencyOperation')" required>
            <u-field-group class="w-fit max-w-full">
              <u-button color="neutral" variant="soft" active-color="success" icon="material-symbols:add-rounded" :label="t('components.teamAccessMenu.currencyAdd')" :active="currencyOperation === 'add'" :disabled="currencySaving" @click="currencyOperation = 'add'" />
              <u-button color="neutral" variant="soft" active-color="warning" icon="material-symbols:remove-rounded" :label="t('components.teamAccessMenu.currencyDeduct')" :active="currencyOperation === 'deduct'" :disabled="currencySaving" @click="currencyOperation = 'deduct'" />
            </u-field-group>
          </rb-form-field>
          <rb-form-field :label="t('components.teamAccessMenu.currencyAmount')" required>
            <rb-input-number v-model="currencyAmount" :prec="selectedCurrency.prec" :min="0" :max="selectedCurrency.max_amount" orientation="vertical" class="w-full" :disabled="currencySaving" />
          </rb-form-field>
        </div>

        <div v-if="selectedCurrency" class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-elevated/60 px-4 py-3 text-sm ring ring-default">
          <span class="text-muted">{{ t('components.teamAccessMenu.currencyCurrent') }}</span>
          <span class="font-medium text-highlighted">{{ intPrecString(selectedCurrentAmount, selectedCurrency.prec) }} {{ selectedCurrency.name }}</span>
          <u-icon name="material-symbols:arrow-forward-rounded" class="text-muted" />
          <span :class="currencyValidation ? 'text-error' : 'text-highlighted'" class="font-medium">{{ intPrecString(currencyAfter, selectedCurrency.prec) }} {{ selectedCurrency.name }}</span>
        </div>

        <u-alert v-if="currencyConflict" color="error" variant="subtle" icon="material-symbols:warning-outline-rounded" :title="currencyConflict" />
        <p v-else-if="currencyValidation" class="text-sm text-error">{{ currencyValidation }}</p>

        <rb-form-field :label="t('admin.pages.team.reason')">
          <u-textarea v-model="currencyReason" class="w-full" :rows="3" :maxlength="500" :disabled="currencySaving" :placeholder="t('components.teamAccessMenu.currencyReasonPlaceholder')" />
        </rb-form-field>
      </div>
    </template>
  </rb-confirm-modal>

  <rbph-team-management-history v-model:open="historyOpen" :game-id="gameId" :team-id="teamId" :team-name="teamName" />
</template>
