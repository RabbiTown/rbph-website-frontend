<script setup lang="ts">const { t } = useI18n();


interface CurrencyDraft {
  amount: number;
  growth: number;
  hidden: boolean;
}

interface AccessChangePreview {
  key: string;
  label: string;
  icon: string;
  color: 'error' | 'warning' | 'primary';
}

const route = useRoute();
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();

const gameId = computed(() => Number(route.params.id));
const teamId = computed(() => Number(route.params.team));
const loading = ref(false);
const saving = ref(false);
const memberBusy = ref(false);
const deleting = ref(false);
const team = ref<AdminTeamDetail>();
const addMemberOpen = ref(false);
const selectedAddUser = ref<AdminUserOption>();
const addUserId = ref<number>();
const deleteOpen = ref(false);
const deleteConfirmName = ref('');
const reasonOpen = ref(false);
const accessChangeReason = ref('');
const currencyChangeReason = ref('');
const currencyDrafts = reactive<Record<number, CurrencyDraft>>({});

const draft = reactive({
  name: '',
  pass: '',
  bio: '',
  is_banned: false,
  is_locked: false,
  features: {} as Record<RbTeamFeature, boolean>,
});

const featureMeta: Record<RbTeamFeature, { label: string; icon: string; enabled: string; disabled: string }> = {
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
};

const errorHints = {
  [-4]: t('admin.pages.team.targetUserGameTeam'),
  [-3]: t('admin.pages.team.submissionContentInvalid'),
  [-2]: t('admin.pages.team.cannotLastItemMember'),
  [-1]: t('admin.common.targetNotFound'),
};

const teamFieldsDirty = computed(() => {
  const current = team.value;
  if (!current) return false;
  return (
    draft.name !== current.name ||
    draft.pass !== current.pass ||
    draft.bio !== current.bio ||
    draft.is_banned !== current.is_banned ||
    draft.is_locked !== current.is_locked ||
    current.features.some(feature => draft.features[feature.feature] !== feature.enabled)
  );
});

function currencyDirty(currency: AdminTeamCurrency) {
  const value = currencyDrafts[currency.id];
  return Boolean(value && (value.amount !== (currency.current_amount ?? currency.amount) || value.growth !== currency.team_growth || value.hidden !== Boolean(currency.hidden)));
}

const currenciesDirty = computed(() => Boolean(team.value?.currency.some(currencyDirty)));
const dirty = computed(() => teamFieldsDirty.value || currenciesDirty.value);
const deleteConfirmValid = computed(() => deleteConfirmName.value === team.value?.name);
const accessChanges = computed<AccessChangePreview[]>(() => {
  const current = team.value;
  if (!current) return [];

  const changes: AccessChangePreview[] = [];
  if (draft.is_banned !== current.is_banned) {
    changes.push({
      key: 'team-banned',
      label: draft.is_banned ? t('admin.pages.team.accessChange.ban') : t('admin.pages.team.accessChange.unban'),
      icon: draft.is_banned ? 'material-symbols:block-outline' : 'material-symbols:check-rounded',
      color: draft.is_banned ? 'error' : 'primary',
    });
  }
  if (draft.is_locked !== current.is_locked) {
    changes.push({
      key: 'team-locked',
      label: draft.is_locked ? t('admin.pages.team.accessChange.lock') : t('admin.pages.team.accessChange.unlock'),
      icon: draft.is_locked ? 'material-symbols:lock-outline' : 'material-symbols:lock-open-outline-rounded',
      color: draft.is_locked ? 'warning' : 'primary',
    });
  }
  for (const feature of current.features) {
    const enabled = draft.features[feature.feature];
    if (enabled !== feature.enabled) {
      changes.push({
        key: feature.feature,
        label: t('admin.pages.team.featureAction', { enabled, feature: featureMeta[feature.feature].label }),
        icon: enabled ? 'material-symbols:check-rounded' : 'material-symbols:block-outline',
        color: enabled ? 'primary' : 'error',
      });
    }
  }
  return changes;
});
const currencyBalanceChanges = computed(() => {
  const current = team.value;
  if (!current) return [];
  return current.currency.flatMap(currency => {
    const value = currencyDrafts[currency.id];
    const before = currency.current_amount ?? currency.amount;
    if (!value || value.amount === before) return [];
    return [{ currency, before, after: value.amount, delta: value.amount - before }];
  });
});

function syncDrafts(next: AdminTeamDetail) {
  draft.name = next.name;
  draft.pass = next.pass;
  draft.bio = next.bio;
  draft.is_banned = next.is_banned;
  draft.is_locked = next.is_locked;
  draft.features = Object.fromEntries(next.features.map(feature => [feature.feature, feature.enabled])) as Record<RbTeamFeature, boolean>;

  for (const currency of next.currency) {
    currencyDrafts[currency.id] = {
      amount: currency.current_amount ?? currency.amount,
      growth: currency.team_growth,
      hidden: Boolean(currency.hidden),
    };
  }
  for (const id of Object.keys(currencyDrafts).map(Number)) {
    if (!next.currency.some(currency => currency.id === id)) Reflect.deleteProperty(currencyDrafts, id);
  }
}

function applyTeam(next: AdminTeamDetail, sync = true) {
  team.value = next;
  if (sync) syncDrafts(next);
}

async function loadTeam() {
  if (!gameId.value || !teamId.value || dirty.value) return;
  loading.value = true;
  try {
    const { data } = await api.get<{ team: AdminTeamDetail }>(`/admin/games/${gameId.value}/teams/${teamId.value}`);
    applyTeam(data.team);
  } catch (error) {
    handleError(error, t('admin.pages.team.loadTeamDetailsFailed'));
  } finally {
    loading.value = false;
  }
}

function reset() {
  if (team.value) syncDrafts(team.value);
  dirtyToast.clear();
}

function resetCurrency(currency: AdminTeamCurrency) {
  currencyDrafts[currency.id] = {
    amount: currency.current_amount ?? currency.amount,
    growth: currency.team_growth,
    hidden: Boolean(currency.hidden),
  };
}

async function saveTeam(reasonConfirmed = false) {
  const current = team.value;
  if (!current || !dirty.value || saving.value) return;
  if (!draft.name.trim() || !draft.pass.trim()) {
    toast.add({ title: t('admin.pages.team.teamNamePasswordCannotEmpty'), icon: 'material-symbols:error-outline-rounded', color: 'error' });
    return;
  }
  if ((accessChanges.value.length > 0 || currencyBalanceChanges.value.length > 0) && !reasonConfirmed) {
    accessChangeReason.value = '';
    currencyChangeReason.value = '';
    reasonOpen.value = true;
    return;
  }

  const changedCurrencies = current.currency.filter(currencyDirty);
  let next = current;
  saving.value = true;
  try {
    if (teamFieldsDirty.value) {
      const { data } = await api.patch<{ team: AdminTeamDetail }>(
        `/admin/games/${gameId.value}/teams/${teamId.value}`,
        {
          name: draft.name.trim(),
          pass: draft.pass.trim(),
          bio: draft.bio,
          is_banned: draft.is_banned,
          is_locked: draft.is_locked,
          features: Object.entries(draft.features).map(([feature, enabled]) => ({ feature, enabled })),
          reason: accessChanges.value.length > 0 ? accessChangeReason.value.trim() || undefined : undefined,
        },
        { errorHints },
      );
      next = data.team;
    }

    for (const currency of changedCurrencies) {
      const value = currencyDrafts[currency.id];
      const body: { amount?: number; growth?: number; hidden?: boolean; reason?: string } = {};
      if (value.amount !== (currency.current_amount ?? currency.amount)) {
        body.amount = value.amount;
        body.reason = currencyChangeReason.value.trim() || undefined;
      }
      if (value.growth !== currency.team_growth) body.growth = value.growth;
      if (value.hidden !== Boolean(currency.hidden)) body.hidden = value.hidden;
      const { data } = await api.patch<{ team: AdminTeamDetail }>(`/admin/games/${gameId.value}/teams/${teamId.value}/currencies/${currency.id}`, body, { errorHints });
      next = data.team;
    }

    applyTeam(next);
    reasonOpen.value = false;
    dirtyToast.clear();
    toast.add({ title: t('admin.pages.team.teamSettingsSaved'), icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, t('admin.pages.team.saveTeamSettingsFailed'), true);
  } finally {
    saving.value = false;
  }
}

function openAddMember() {
  addUserId.value = undefined;
  selectedAddUser.value = undefined;
  addMemberOpen.value = true;
}

async function addMember() {
  if (addUserId.value == null) return;
  memberBusy.value = true;
  try {
    const { data } = await api.post<{ team: AdminTeamDetail }>(`/admin/games/${gameId.value}/teams/${teamId.value}/members`, { user_id: addUserId.value }, { errorHints });
    applyTeam(data.team, false);
    addMemberOpen.value = false;
    toast.add({ title: t('admin.pages.team.memberAdd'), icon: 'material-symbols:person-add-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, t('admin.pages.team.addMemberFailed'), true);
  } finally {
    memberBusy.value = false;
  }
}

async function removeMember(member: RbTeamMember) {
  memberBusy.value = true;
  try {
    const { data } = await api.del<{ team: AdminTeamDetail }>(`/admin/games/${gameId.value}/teams/${teamId.value}/members/${member.id}`, { errorHints });
    applyTeam(data.team, false);
  } catch (error) {
    handleError(error, t('admin.pages.team.memberFailed'), true);
  } finally {
    memberBusy.value = false;
  }
}

async function promoteMember(member: RbTeamMember) {
  memberBusy.value = true;
  try {
    const { data } = await api.post<{ team: AdminTeamDetail }>(`/admin/games/${gameId.value}/teams/${teamId.value}/members/${member.id}/captain`, undefined, { errorHints });
    applyTeam(data.team, false);
  } catch (error) {
    handleError(error, t('admin.pages.team.transferCaptainFailed'), true);
  } finally {
    memberBusy.value = false;
  }
}

async function deleteTeam() {
  if (!deleteConfirmValid.value) return;
  deleting.value = true;
  try {
    await api.del(`/admin/games/${gameId.value}/teams/${teamId.value}`, { errorHints });
    dirtyToast.clear();
    toast.add({ title: t('admin.pages.team.teamDisband'), icon: 'material-symbols:delete-outline-rounded', color: 'success' });
    await navigateTo(`/admin/games/${gameId.value}/teams`);
  } catch (error) {
    handleError(error, t('admin.pages.team.disbandTeamFailed'), true);
  } finally {
    deleting.value = false;
  }
}

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: t('admin.pages.team.teamSettingsUpdateNotYetSave'),
      guardOnLeave: true,
      apply: saveTeam,
      reset,
    });
  } else {
    dirtyToast.clear();
  }
});

watch(teamId, () => {
  dirtyToast.clear();
  team.value = undefined;
  loadTeam();
});

onMounted(loadTeam);
onBeforeUnmount(() => dirtyToast.clear());
</script>

<template>
  <div class="grid min-h-0 gap-6 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,64rem)_minmax(14rem,18rem)]">
    <aside class="hidden xl:block" />

    <main class="min-w-0">
      <div class="mb-6 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <u-button :to="`/admin/games/${gameId}/teams`" icon="material-symbols:arrow-back-rounded" variant="ghost" color="neutral" />
            <h2 class="truncate text-xl font-semibold text-highlighted">{{ team?.name ?? t('admin.pages.team.teamSettings') }}</h2>
          </div>
          <div v-if="team" class="mt-1 flex flex-wrap gap-1.5 pl-10">
            <u-badge size="sm" color="neutral" variant="soft" icon="material-symbols:calendar-today-outline-rounded">{{ t('admin.pages.team.createdAt', { time: formatDate(team.ctime_at) }) }}</u-badge>
            <u-badge v-if="team.finish_at" size="sm" color="success" variant="soft" icon="material-symbols:flag-outline-rounded">{{ t('admin.common.finishedAt', { time: formatDate(team.finish_at) }) }}</u-badge>
          </div>
        </div>
        <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" :disabled="dirty || saving" @click="loadTeam" />
      </div>

      <u-skeleton v-if="loading && !team" class="h-96 w-full" />

      <u-form v-if="team" :state="draft" class="flex flex-col gap-8" @submit.prevent="saveTeam()">
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.pages.team.info') }}</h3>
          <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
            <rb-form-field row narrow-label :label="t('admin.common.teamName')" icon="material-symbols:groups-2-outline-rounded" :dirty="draft.name !== team.name" :reset="() => (draft.name = team!.name)">
              <u-input v-model="draft.name" class="w-full" :disabled="saving" />
            </rb-form-field>
            <u-separator />
            <rb-form-field row narrow-label :label="t('admin.common.teamPassword')" icon="material-symbols:password-rounded" :dirty="draft.pass !== team.pass" :reset="() => (draft.pass = team!.pass)">
              <u-input v-model="draft.pass" class="w-full" :disabled="saving" />
            </rb-form-field>
            <u-separator />
            <rb-form-field row narrow-label :label="t('admin.common.teamBio')" icon="material-symbols:notes-rounded" :dirty="draft.bio !== team.bio" :reset="() => (draft.bio = team!.bio)">
              <u-textarea v-model="draft.bio" class="w-full" :rows="3" :disabled="saving" />
            </rb-form-field>
          </div>
        </section>

        <u-separator />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.team.featureAccess') }}</h2>
          </div>
          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
            <rb-form-field
              row
              :label="t('admin.common.teamState')"
              icon="material-symbols:shield-outline-rounded"
              :description="draft.is_banned ? t('admin.pages.team.teamStateDescription.banned') : t('admin.pages.team.teamStateDescription.normal')"
              :dirty="draft.is_banned !== team.is_banned"
              :reset="() => (draft.is_banned = team!.is_banned)"
            >
              <u-field-group>
                <u-button color="neutral" variant="soft" active-color="error" icon="material-symbols:block-outline" :label="t('admin.common.banned')" :active="draft.is_banned" :disabled="saving" @click="draft.is_banned = true" />
                <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:check-rounded" :label="t('admin.pages.team.normal')" :active="!draft.is_banned" :disabled="saving" @click="draft.is_banned = false" />
              </u-field-group>
            </rb-form-field>
            <u-separator />
            <rb-form-field
              row
              :label="t('admin.pages.team.accessChange.lock')"
              icon="material-symbols:lock-outline"
              :description="draft.is_locked ? t('admin.pages.team.teamLockDescription.locked') : t('admin.pages.team.teamLockDescription.unlocked')"
              :dirty="draft.is_locked !== team.is_locked"
              :reset="() => (draft.is_locked = team!.is_locked)"
            >
              <u-field-group>
                <u-button color="neutral" variant="soft" active-color="warning" icon="material-symbols:lock-outline" :label="t('admin.common.locked')" :active="draft.is_locked" :disabled="saving" @click="draft.is_locked = true" />
                <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:lock-open-outline-rounded" :label="t('admin.pages.team.unlock')" :active="!draft.is_locked" :disabled="saving" @click="draft.is_locked = false" />
              </u-field-group>
            </rb-form-field>
            <template v-for="feature in team.features" :key="feature.feature">
              <u-separator />
              <rb-form-field
                row
                :label="featureMeta[feature.feature].label"
                :icon="featureMeta[feature.feature].icon"
                :description="draft.features[feature.feature] ? featureMeta[feature.feature].enabled : featureMeta[feature.feature].disabled"
                :dirty="draft.features[feature.feature] !== feature.enabled"
                :reset="() => (draft.features[feature.feature] = feature.enabled)"
              >
                <u-field-group>
                  <u-button color="neutral" variant="soft" active-color="error" icon="material-symbols:block-outline" :label="t('admin.common.banned')" :active="!draft.features[feature.feature]" :disabled="saving" @click="draft.features[feature.feature] = false" />
                  <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:check-rounded" :label="t('admin.pages.team.normal')" :active="draft.features[feature.feature]" :disabled="saving" @click="draft.features[feature.feature] = true" />
                </u-field-group>
              </rb-form-field>
            </template>
          </div>
        </section>

        <u-separator />

        <section class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.team.member') }}</h2>
            </div>
            <u-button size="sm" icon="material-symbols:person-add-outline-rounded" :label="t('admin.pages.team.addMember')" :disabled="memberBusy" @click="openAddMember" />
          </div>
          <rbph-team-member-list :members="team.members" can-manage allow-locked-management :busy="memberBusy" @promote="promoteMember" @remove="removeMember" />
        </section>

        <u-separator />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.currencyManagement') }}</h2>
          </div>
          <u-empty v-if="team.currency.length === 0" icon="material-symbols:money-bag-outline-rounded" :title="t('admin.pages.team.teamCurrency')" />
          <div v-else class="space-y-3">
            <div v-for="currency in team.currency" :key="currency.id" class="relative rounded-lg bg-elevated/60 px-4 py-3 ring ring-default">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate font-medium text-highlighted">
                    {{ currency.name }}
                    <u-badge class="font-mono ms-1 mb-0.5" size="md" variant="soft">{{ currency.slug }}</u-badge>
                  </div>
                </div>
                <u-button v-if="currencyDirty(currency)" size="xs" color="warning" variant="soft" icon="material-symbols:restart-alt-rounded" :label="t('admin.common.reset')" :disabled="saving" @click="resetCurrency(currency)" />
              </div>
              <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem]">
                <rb-form-field :label="t('admin.pages.team.currentBalance')" :dirty="currencyDrafts[currency.id]?.amount !== (currency.current_amount ?? currency.amount)" :reset="() => (currencyDrafts[currency.id].amount = currency.current_amount ?? currency.amount)">
                  <rb-input-number v-model="currencyDrafts[currency.id].amount" :prec="currency.prec" :max="currency.max_amount" orientation="vertical" class="w-full" :disabled="saving" />
                </rb-form-field>
                <rb-form-field :label="t('admin.common.growthPerMinute')" :dirty="currencyDrafts[currency.id]?.growth !== currency.team_growth" :reset="() => (currencyDrafts[currency.id].growth = currency.team_growth)">
                  <div class="flex min-w-0 items-center gap-2">
                    <rb-input-number v-model="currencyDrafts[currency.id].growth" :prec="currency.prec" orientation="vertical" class="min-w-0 flex-1" :disabled="saving" />
                    <span class="shrink-0 text-sm text-muted">+</span>
                    <div class="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-muted px-3 text-sm ring ring-default">
                      <span class="font-medium text-highlighted">{{ intPrecString(currency.game_growth, currency.prec) }}</span>
                    </div>
                  </div>
                </rb-form-field>
                <rb-form-field :label="t('admin.pages.team.hideCurrency')" :dirty="currencyDrafts[currency.id]?.hidden !== Boolean(currency.hidden)" :reset="() => (currencyDrafts[currency.id].hidden = Boolean(currency.hidden))">
                  <u-switch v-model="currencyDrafts[currency.id].hidden" :disabled="saving" :label="currencyDrafts[currency.id].hidden ? t('admin.pages.team.currencyVisibility.hidden') : t('admin.pages.team.currencyVisibility.visible')" class="mt-2" />
                </rb-form-field>
              </div>
            </div>
          </div>
        </section>

        <u-separator />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.dangerZone') }}</h2>
          </div>

          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
            <rb-form-field row narrow-label :label="t('admin.pages.team.disbandTeam')">
              <u-button color="error" variant="soft" icon="material-symbols:delete-outline-rounded" :label="t('admin.pages.team.disbandTeam')" @click="deleteOpen = true" />
              <div class="text-muted mt-1.5">{{ t('admin.pages.team.deleteTeamRelatedData') }}</div>
            </rb-form-field>
          </div>
        </section>
      </u-form>
    </main>

    <aside class="hidden xl:block" />

    <rb-confirm-modal
      v-model:open="reasonOpen"
      :title="t('admin.pages.team.confirmTeamChanges')"
      :description="t('admin.pages.team.changeReasonDescription')"
      :confirm-label="t('admin.pages.team.save')"
      confirm-icon="material-symbols:save-outline-rounded"
      :busy="saving"
      @confirm="saveTeam(true)"
    >
      <template #body>
        <div v-if="accessChanges.length" class="space-y-3">
          <div class="font-medium text-highlighted">{{ t('admin.pages.team.accessChanges') }}</div>
          <div class="flex flex-wrap gap-2">
            <u-badge v-for="change in accessChanges" :key="change.key" :color="change.color" variant="soft" :icon="change.icon">
              {{ change.label }}
            </u-badge>
          </div>
          <rb-form-field :label="t('admin.pages.team.reason')">
            <u-textarea v-model="accessChangeReason" class="w-full" :rows="3" :maxlength="500" :disabled="saving" :placeholder="t('admin.pages.team.accessReasonPlaceholder')" />
          </rb-form-field>
        </div>
        <u-separator v-if="accessChanges.length && currencyBalanceChanges.length" class="my-4" />
        <div v-if="currencyBalanceChanges.length" class="space-y-3">
          <div class="font-medium text-highlighted">{{ t('admin.pages.team.currencyBalanceChanges') }}</div>
          <div class="space-y-2">
            <div v-for="change in currencyBalanceChanges" :key="change.currency.id" class="flex flex-wrap items-center gap-2 rounded-md bg-elevated/60 px-3 py-2 text-sm ring ring-default">
              <span class="font-medium text-highlighted">{{ change.currency.name }}</span>
              <span class="text-muted">{{ intPrecString(change.before, change.currency.prec) }}</span>
              <u-icon name="material-symbols:arrow-forward-rounded" class="text-muted" />
              <span class="font-medium text-highlighted">{{ intPrecString(change.after, change.currency.prec) }}</span>
              <u-badge :color="change.delta < 0 ? 'warning' : 'success'" variant="soft">{{ intPrecString(change.delta, change.currency.prec, true, ' ') }}</u-badge>
            </div>
          </div>
          <rb-form-field :label="t('admin.pages.team.reason')">
            <u-textarea v-model="currencyChangeReason" class="w-full" :rows="3" :maxlength="500" :disabled="saving" :placeholder="t('admin.pages.team.currencyReasonPlaceholder')" />
          </rb-form-field>
        </div>
      </template>
    </rb-confirm-modal>

    <rb-confirm-modal
      v-model:open="addMemberOpen"
      :title="t('admin.pages.team.addMember')"
      :description="t('admin.pages.team.searchPlaceholderUser')"
      :confirm-label="t('admin.pages.team.addMember')"
      confirm-icon="material-symbols:person-add-outline-rounded"
      :confirm-disabled="addUserId == null"
      :busy="memberBusy"
      @confirm="addMember"
    >
      <template #body>
        <rb-form-field :label="t('admin.common.user')" required>
          <rbph-admin-user-select v-model="addUserId" v-model:user="selectedAddUser" :game-id="gameId" :disabled="memberBusy" />
        </rb-form-field>
      </template>
    </rb-confirm-modal>

    <rb-confirm-modal
      v-model:open="deleteOpen"
      :title="t('admin.pages.team.disbandTeam')"
      :description="t('admin.pages.team.enterTeamNameConfirmDisband')"
      :confirm-label="t('admin.pages.team.disband')"
      confirm-color="error"
      confirm-icon="material-symbols:delete-outline-rounded"
      :confirm-disabled="!deleteConfirmValid"
      :busy="deleting"
      @confirm="deleteTeam"
    >
      <template #body>
        <rb-form-field :label="t('admin.common.teamName')">
          <u-input v-model="deleteConfirmName" :placeholder="team?.name" class="w-full" :disabled="deleting" />
        </rb-form-field>
      </template>
    </rb-confirm-modal>
  </div>
</template>
