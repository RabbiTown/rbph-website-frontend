<script setup lang="ts">
interface CurrencyDraft {
  amount: number;
  growth: number;
  hidden: boolean;
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
    label: '站内信',
    icon: 'material-symbols:mail-outline-rounded',
    enabled: '遵循比赛的站内信开放状态。',
    disabled: '队伍不能发送站内信。',
  },
  puzzle_ticket: {
    label: '人工提示',
    icon: 'material-symbols:near-me-outline-rounded',
    enabled: '遵循比赛的人工提示开放状态。',
    disabled: '队伍不能发起或回复人工提示。',
  },
  leaderboard: {
    label: '排行榜',
    icon: 'material-symbols:leaderboard-outline-rounded',
    enabled: '队伍可以进入排行榜。',
    disabled: '队伍在排行榜中被隐藏。',
  },
};

const errorHints = {
  [-4]: '目标用户已经在本比赛的其他队伍中',
  [-3]: '提交内容不合法',
  [-2]: '不能移除最后一个成员',
  [-1]: '目标不存在',
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
    handleError(error, '获取队伍详情失败');
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

async function saveTeam() {
  const current = team.value;
  if (!current || !dirty.value || saving.value) return;
  if (!draft.name.trim() || !draft.pass.trim()) {
    toast.add({ title: '队伍名称和密码不能为空', icon: 'material-symbols:error-outline-rounded', color: 'error' });
    return;
  }

  const changedCurrencies = current.currency.filter(currencyDirty).map(currency => ({ id: currency.id, ...currencyDrafts[currency.id] }));
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
        },
        { errorHints },
      );
      next = data.team;
    }

    for (const currency of changedCurrencies) {
      const { data } = await api.patch<{ team: AdminTeamDetail }>(`/admin/games/${gameId.value}/teams/${teamId.value}/currencies/${currency.id}`, { amount: currency.amount, growth: currency.growth, hidden: currency.hidden }, { errorHints });
      next = data.team;
    }

    applyTeam(next);
    dirtyToast.clear();
    toast.add({ title: '队伍设置已保存', icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '保存队伍设置失败', true);
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
  if (!addUserId.value) return;
  memberBusy.value = true;
  try {
    const { data } = await api.post<{ team: AdminTeamDetail }>(`/admin/games/${gameId.value}/teams/${teamId.value}/members`, { user_id: addUserId.value }, { errorHints });
    applyTeam(data.team, false);
    addMemberOpen.value = false;
    toast.add({ title: '成员已添加', icon: 'material-symbols:person-add-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '添加成员失败', true);
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
    handleError(error, '移除成员失败', true);
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
    handleError(error, '转让队长失败', true);
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
    toast.add({ title: '队伍已解散', icon: 'material-symbols:delete-outline-rounded', color: 'success' });
    await navigateTo(`/admin/games/${gameId.value}/teams`);
  } catch (error) {
    handleError(error, '解散队伍失败', true);
  } finally {
    deleting.value = false;
  }
}

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '队伍设置修改尚未保存。',
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
            <h2 class="truncate text-xl font-semibold text-highlighted">{{ team?.name ?? '队伍设置' }}</h2>
          </div>
          <div v-if="team" class="mt-1 flex flex-wrap gap-1.5 pl-10">
            <u-badge size="sm" color="neutral" variant="soft" icon="material-symbols:calendar-today-outline-rounded">创建于 {{ formatDate(team.ctime_at) }}</u-badge>
            <u-badge v-if="team.finish_at" size="sm" color="success" variant="soft" icon="material-symbols:flag-outline-rounded">完赛于 {{ formatDate(team.finish_at) }}</u-badge>
          </div>
        </div>
        <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" :disabled="dirty || saving" @click="loadTeam" />
      </div>

      <u-skeleton v-if="loading && !team" class="h-96 w-full" />

      <u-form v-if="team" :state="draft" class="flex flex-col gap-8" @submit.prevent="saveTeam">
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-highlighted">基本信息</h3>
          <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
            <rb-form-field row narrow-label label="队伍名称" icon="material-symbols:groups-2-outline-rounded" :dirty="draft.name !== team.name" :reset="() => (draft.name = team!.name)">
              <u-input v-model="draft.name" class="w-full" :disabled="saving" />
            </rb-form-field>
            <u-separator />
            <rb-form-field row narrow-label label="队伍密码" icon="material-symbols:password-rounded" :dirty="draft.pass !== team.pass" :reset="() => (draft.pass = team!.pass)">
              <u-input v-model="draft.pass" class="w-full" :disabled="saving" />
            </rb-form-field>
            <u-separator />
            <rb-form-field row narrow-label label="队伍简介" icon="material-symbols:notes-rounded" :dirty="draft.bio !== team.bio" :reset="() => (draft.bio = team!.bio)">
              <u-textarea v-model="draft.bio" class="w-full" :rows="3" :disabled="saving" />
            </rb-form-field>
          </div>
        </section>

        <u-separator />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">功能权限</h2>
          </div>
          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
            <rb-form-field
              row
              label="队伍状态"
              icon="material-symbols:shield-outline-rounded"
              :description="draft.is_banned ? '队伍不能访问谜题。' : '队伍可以正常参与比赛。'"
              :dirty="draft.is_banned !== team.is_banned"
              :reset="() => (draft.is_banned = team!.is_banned)"
            >
              <u-field-group>
                <u-button color="neutral" variant="soft" active-color="error" icon="material-symbols:block-outline" label="封禁" :active="draft.is_banned" :disabled="saving" @click="draft.is_banned = true" />
                <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:check-rounded" label="正常" :active="!draft.is_banned" :disabled="saving" @click="draft.is_banned = false" />
              </u-field-group>
            </rb-form-field>
            <u-separator />
            <rb-form-field
              row
              label="锁定队伍"
              icon="material-symbols:lock-outline"
              :description="draft.is_locked ? '队伍不能解散，队伍成员不能离开队伍。' : '玩家可以正常管理队伍成员。'"
              :dirty="draft.is_locked !== team.is_locked"
              :reset="() => (draft.is_locked = team!.is_locked)"
            >
              <u-field-group>
                <u-button color="neutral" variant="soft" active-color="warning" icon="material-symbols:lock-outline" label="锁定" :active="draft.is_locked" :disabled="saving" @click="draft.is_locked = true" />
                <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:lock-open-outline-rounded" label="解锁" :active="!draft.is_locked" :disabled="saving" @click="draft.is_locked = false" />
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
                  <u-button color="neutral" variant="soft" active-color="error" icon="material-symbols:block-outline" label="封禁" :active="!draft.features[feature.feature]" :disabled="saving" @click="draft.features[feature.feature] = false" />
                  <u-button color="neutral" variant="soft" active-color="primary" icon="material-symbols:check-rounded" label="正常" :active="draft.features[feature.feature]" :disabled="saving" @click="draft.features[feature.feature] = true" />
                </u-field-group>
              </rb-form-field>
            </template>
          </div>
        </section>

        <u-separator />

        <section class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-semibold text-highlighted">成员</h2>
            </div>
            <u-button size="sm" icon="material-symbols:person-add-outline-rounded" label="添加成员" :disabled="memberBusy" @click="openAddMember" />
          </div>
          <rbph-team-member-list :members="team.members" can-manage allow-locked-management :busy="memberBusy" @promote="promoteMember" @remove="removeMember" />
        </section>

        <u-separator />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">货币管理</h2>
          </div>
          <u-empty v-if="team.currency.length === 0" icon="material-symbols:money-bag-outline-rounded" title="该队伍没有货币" />
          <div v-else class="space-y-3">
            <div v-for="currency in team.currency" :key="currency.id" class="relative rounded-lg bg-elevated/60 px-4 py-3 ring ring-default">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate font-medium text-highlighted">
                    {{ currency.name }}
                    <u-badge class="font-mono ms-1 mb-0.5" size="md" variant="soft">{{ currency.slug }}</u-badge>
                  </div>
                </div>
                <u-button v-if="currencyDirty(currency)" size="xs" color="warning" variant="soft" icon="material-symbols:restart-alt-rounded" label="重置" :disabled="saving" @click="resetCurrency(currency)" />
              </div>
              <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem]">
                <rb-form-field label="当前余额" :dirty="currencyDrafts[currency.id]?.amount !== (currency.current_amount ?? currency.amount)" :reset="() => (currencyDrafts[currency.id].amount = currency.current_amount ?? currency.amount)">
                  <rb-input-number v-model="currencyDrafts[currency.id].amount" :prec="currency.prec" :min="0" :max="currency.max_amount" orientation="vertical" class="w-full" :disabled="saving" />
                </rb-form-field>
                <rb-form-field label="增长/分钟" :dirty="currencyDrafts[currency.id]?.growth !== currency.team_growth" :reset="() => (currencyDrafts[currency.id].growth = currency.team_growth)">
                  <div class="flex min-w-0 items-center gap-2">
                    <rb-input-number v-model="currencyDrafts[currency.id].growth" :prec="currency.prec" orientation="vertical" class="min-w-0 flex-1" :disabled="saving" />
                    <span class="shrink-0 text-sm text-muted">+</span>
                    <div class="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-muted px-3 text-sm ring ring-default">
                      <span class="font-medium text-highlighted">{{ intPrecString(currency.game_growth, currency.prec) }}</span>
                    </div>
                  </div>
                </rb-form-field>
                <rb-form-field label="隐藏货币" :dirty="currencyDrafts[currency.id]?.hidden !== Boolean(currency.hidden)" :reset="() => (currencyDrafts[currency.id].hidden = Boolean(currency.hidden))">
                  <u-switch v-model="currencyDrafts[currency.id].hidden" :disabled="saving" :label="currencyDrafts[currency.id].hidden ? '已隐藏' : '正常显示'" class="mt-2" />
                </rb-form-field>
              </div>
            </div>
          </div>
        </section>

        <u-separator />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">危险区域</h2>
          </div>

          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
            <rb-form-field row narrow-label label="解散队伍">
              <u-button color="error" variant="soft" icon="material-symbols:delete-outline-rounded" label="解散队伍" @click="deleteOpen = true" />
              <div class="text-muted mt-1.5">删除队伍及其关联数据。</div>
            </rb-form-field>
          </div>
        </section>
      </u-form>
    </main>

    <aside class="hidden xl:block" />

    <rb-confirm-modal
      v-model:open="addMemberOpen"
      title="添加成员"
      description="输入邮箱或昵称搜索用户。"
      confirm-label="添加成员"
      confirm-icon="material-symbols:person-add-outline-rounded"
      :confirm-disabled="!addUserId"
      :busy="memberBusy"
      @confirm="addMember"
    >
      <template #body>
        <rb-form-field label="用户" required>
          <rbph-admin-user-select v-model="addUserId" v-model:user="selectedAddUser" :game-id="gameId" :disabled="memberBusy" />
        </rb-form-field>
      </template>
    </rb-confirm-modal>

    <rb-confirm-modal
      v-model:open="deleteOpen"
      title="解散队伍"
      description="请输入队伍名称以确认解散。"
      confirm-label="解散"
      confirm-color="error"
      confirm-icon="material-symbols:delete-outline-rounded"
      :confirm-disabled="!deleteConfirmValid"
      :busy="deleting"
      @confirm="deleteTeam"
    >
      <template #body>
        <rb-form-field label="队伍名称">
          <u-input v-model="deleteConfirmName" :placeholder="team?.name" class="w-full" :disabled="deleting" />
        </rb-form-field>
      </template>
    </rb-confirm-modal>
  </div>
</template>
