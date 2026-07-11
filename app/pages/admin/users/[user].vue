<script setup lang="ts">const { t } = useI18n();


const route = useRoute();
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const currentUser = useUser().ref;

useHead({
  titleTemplate: t('admin.common.userManagementTitle'),
});

const userId = computed(() => Number(route.params.user));
const user = ref<AdminUserDetail>();
const loading = ref(false);
const saving = ref(false);
const resetting = ref(false);
const resetOpen = ref(false);
const passwordOpen = ref(false);
const temporaryPassword = ref('');

const draft = reactive({ email: '', nickname: '', bio: '', role: RbUserRole.User });
const roleItems = [
  { label: t('admin.common.bannedLabel'), value: RbUserRole.Banned, icon: 'material-symbols:block-outline', color: 'error' as const },
  { label: t('admin.common.regularUser'), value: RbUserRole.User, icon: 'material-symbols:person-outline-rounded', color: 'primary' as const },
  { label: t('admin.common.staff'), value: RbUserRole.Moderator, icon: 'material-symbols:shield-person-outline-rounded', color: 'warning' as const },
  { label: t('admin.common.admin'), value: RbUserRole.Admin, icon: 'material-symbols:admin-panel-settings-outline-rounded', color: 'success' as const },
];

const dirty = computed(() => Boolean(user.value && (draft.email !== user.value.email || draft.nickname !== user.value.nickname || draft.bio !== (user.value.bio ?? '') || draft.role !== user.value.urole)));
const valid = computed(() => draft.email.trim().includes('@') && draft.nickname.trim().length > 0);
const canManageCredentials = computed(() => Boolean(currentUser.value && user.value && user.value.urole < currentUser.value.urole));
const canResetPassword = canManageCredentials;

function roleDisabled(role: RbUserRole) {
  if (saving.value || currentUser.value?.id === user.value?.id) return true;
  if (currentUser.value?.urole === RbUserRole.Root) return false;
  return (user.value?.urole ?? RbUserRole.User) >= RbUserRole.Admin || role >= RbUserRole.Admin;
}

function syncDraft(next: AdminUserDetail) {
  draft.email = next.email;
  draft.nickname = next.nickname;
  draft.bio = next.bio ?? '';
  draft.role = next.urole;
}

async function loadUser() {
  if (!Number.isInteger(userId.value) || userId.value < 0 || dirty.value) return;
  loading.value = true;
  try {
    const { data } = await api.get<{ user: AdminUserDetail }>(`/admin/users/${userId.value}`);
    user.value = data.user;
    syncDraft(data.user);
    if (currentUser.value?.id === data.user.id) await useUser().updateData();
  } catch (error) {
    handleError(error, t('admin.pages.user.loadUserDetailsFailed'));
  } finally {
    loading.value = false;
  }
}

function reset() {
  if (user.value) syncDraft(user.value);
  dirtyToast.clear();
}

async function save() {
  if (!dirty.value || !valid.value || saving.value) return;
  saving.value = true;
  try {
    const { data } = await api.patch<{ user: AdminUserDetail }>(
      `/admin/users/${userId.value}`,
      { email: draft.email.trim(), nickname: draft.nickname.trim(), bio: draft.bio, role: draft.role },
      { errorHints: { [-7]: t('admin.pages.user.emailPermissionDenied'), [-6]: t('admin.pages.user.superAdminUpdateAdminRole'), [-4]: t('admin.pages.user.cannotUpdateSelfRole'), [-3]: t('admin.pages.user.emailExists'), [-2]: t('admin.pages.user.userInfoInvalid'), [-1]: t('admin.pages.user.userNotFound') } },
    );
    user.value = data.user;
    syncDraft(data.user);
    dirtyToast.clear();
    if (currentUser.value?.id === data.user.id) await useUser().updateData();
    toast.add({ title: t('admin.pages.user.userInfoSaved'), icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, t('admin.pages.user.saveUserInfoFailed'), true);
  } finally {
    saving.value = false;
  }
}

async function resetPassword() {
  resetting.value = true;
  try {
    const { data } = await api.post<AdminTemporaryPasswordResponse>(`/admin/users/${userId.value}/reset-password`, undefined, { errorHints: { [-6]: t('admin.pages.user.passwordResetPermissionDenied') } });
    user.value = data.user;
    syncDraft(data.user);
    temporaryPassword.value = data.temporary_password;
    resetOpen.value = false;
    passwordOpen.value = true;
  } catch (error) {
    handleError(error, t('admin.pages.user.resetPasswordFailed'), true);
  } finally {
    resetting.value = false;
  }
}

async function copyPassword() {
  await navigator.clipboard.writeText(temporaryPassword.value);
  toast.add({ title: t('admin.common.temporaryPasswordCopied'), icon: 'material-symbols:content-copy-outline-rounded', color: 'success' });
}

watch(dirty, value => {
  if (value) dirtyToast.show({ description: t('admin.pages.user.userInfoUpdateNotYetSave'), guardOnLeave: true, apply: save, reset });
  else dirtyToast.clear();
});
watch(userId, () => {
  dirtyToast.clear();
  user.value = undefined;
  loadUser();
});
onMounted(loadUser);
onBeforeUnmount(() => dirtyToast.clear());
</script>

<template>
  <u-dashboard-panel id="admin-user-detail">
    <template #header>
      <u-dashboard-navbar :title="t('admin.common.userManagement')">
        <template #leading>
          <u-dashboard-sidebar-collapse />
        </template>
      </u-dashboard-navbar>
    </template>
    <template #body>
      <div>
        <div class="grid min-h-0 gap-6 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,64rem)_minmax(14rem,18rem)]">
          <aside class="hidden xl:block" />
          <main class="min-w-0">
            <div class="mb-6 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <u-button to="/admin/users" icon="material-symbols:arrow-back-rounded" variant="ghost" color="neutral" />
                  <h2 class="truncate text-xl font-semibold text-highlighted">{{ user?.nickname ?? t('admin.pages.user.userSettings') }}</h2>
                </div>
                <div v-if="user" class="mt-1 flex flex-wrap gap-1.5 pl-10">
                  <u-badge color="neutral" variant="soft" icon="material-symbols:id-card-outline-rounded">{{ t('admin.pages.user.userIdentifier', { id: user.id }) }}</u-badge>
                  <u-badge color="neutral" variant="soft" icon="material-symbols:calendar-today-outline-rounded">{{ t('admin.pages.user.registeredAt', { time: formatDate(user.ctime_at) }) }}</u-badge>
                  <u-badge v-if="user.must_change_password" color="warning" variant="soft" icon="material-symbols:password-rounded">{{ t('admin.common.passwordChangeRequired') }}</u-badge>
                </div>
              </div>
              <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" :disabled="dirty || saving" @click="loadUser" />
            </div>

            <div v-if="loading && !user" class="space-y-3">
              <u-skeleton class="h-64 w-full" />
              <u-skeleton class="h-32 w-full" />
            </div>
            <u-form v-else-if="user" :state="draft" class="flex flex-col gap-8" @submit.prevent="save">
              <section class="space-y-4">
                <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.user.accountInfo') }}</h2>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field row narrow-label :label="t('admin.common.email')" icon="material-symbols:alternate-email-rounded" :dirty="draft.email !== user.email" :reset="() => (draft.email = user!.email)">
                    <u-input v-model="draft.email" type="email" class="w-full" :disabled="saving || !canManageCredentials" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row narrow-label :label="t('admin.common.nickname')" icon="material-symbols:badge-outline-rounded" :dirty="draft.nickname !== user.nickname" :reset="() => (draft.nickname = user!.nickname)">
                    <u-input v-model="draft.nickname" class="w-full" :maxlength="60" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row narrow-label :label="t('admin.common.userBio')" icon="material-symbols:notes-rounded" :dirty="draft.bio !== (user.bio ?? '')" :reset="() => (draft.bio = user!.bio ?? '')">
                    <u-textarea v-model="draft.bio" class="w-full" :maxlength="200" :rows="4" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row narrow-label :label="t('admin.common.userRole')" icon="material-symbols:manage-accounts-outline-rounded" :dirty="draft.role !== user.urole" :reset="() => (draft.role = user!.urole)">
                    <u-badge v-if="user.urole === RbUserRole.Root" color="info" class="mt-0.5" variant="soft" icon="material-symbols:security-rounded">{{ t('admin.common.superAdmin') }}</u-badge>
                    <u-field-group v-else class="flex-wrap">
                      <u-button
                        v-for="item in roleItems"
                        :key="item.value"
                        :icon="item.icon"
                        color="neutral"
                        :active="draft.role === item.value"
                        :active-color="item.color"
                        variant="soft"
                        :disabled="roleDisabled(item.value)"
                        @click="draft.role = item.value"
                      >
                        {{ item.label }}
                      </u-button>
                    </u-field-group>
                  </rb-form-field>
                </div>
              </section>

              <u-separator />

              <section class="space-y-4">
                <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.user.belongingTeam') }}</h2>
                <u-empty v-if="user.teams.length === 0" :title="t('admin.pages.user.notJoinTeam')" icon="material-symbols:group-off-outline-rounded" />
                <div v-else class="divide-y divide-default rounded-md border border-default bg-default px-4">
                  <nuxt-link v-for="team in user.teams" :key="`${team.game_id}:${team.team_id}`" :to="`/admin/games/${team.game_id}/teams/${team.team_id}`" class="group flex items-center gap-3 py-4">
                    <u-icon name="material-symbols:groups-2-outline-rounded" class="size-6 text-muted" />
                    <div class="min-w-0 flex-1">
                      <div class="font-medium text-highlighted">{{ team.team_name }}</div>
                      <div class="mt-1 text-sm text-muted">{{ team.game_title }}</div>
                    </div>
                    <u-badge v-if="team.is_captain" color="warning" variant="soft" icon="material-symbols:award-star-outline-rounded">{{ t('admin.common.captain') }}</u-badge>
                    <u-icon name="material-symbols:chevron-right-rounded" class="size-5 text-dimmed transition-transform group-hover:translate-x-0.5" />
                  </nuxt-link>
                </div>
              </section>

              <u-separator />

              <section class="space-y-4">
                <u-collapsible :unmount-on-hide="false">
                  <button type="button" class="group flex w-full cursor-pointer items-center justify-between gap-3 text-start">
                    <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.user.resetPassword') }}</h2>
                    <u-icon name="material-symbols:expand-more-rounded" class="size-5 text-muted transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                  <template #content
                    ><div class="mt-4 flex items-center justify-between gap-4 rounded-md bg-elevated/60 p-4 ring ring-default">
                      <p class="text-sm text-muted">{{ canResetPassword ? t('admin.pages.user.passwordResetDescription') : t('admin.pages.user.passwordResetUnavailable') }}</p>
                      <u-button color="warning" variant="soft" icon="material-symbols:password-rounded" :label="t('admin.pages.user.generateTemporaryPassword')" :disabled="!canResetPassword" @click="resetOpen = true" /></div
                  ></template>
                </u-collapsible>
              </section>
            </u-form>
          </main>

          <aside class="hidden xl:block" />

          <rb-confirm-modal
            v-model:open="resetOpen"
            :title="t('admin.pages.user.resetUserPassword')"
            :description="t('admin.pages.user.passwordResetWarning')"
            :confirm-label="t('admin.pages.user.confirmReset')"
            confirm-color="warning"
            confirm-icon="material-symbols:password-rounded"
            :busy="resetting"
            @confirm="resetPassword"
          />
          <u-modal v-model:open="passwordOpen" :title="t('admin.common.oneTimeTemporaryPassword')" :description="t('admin.pages.user.closeShowAgainReset')" :dismissible="false">
            <template #body
              ><div class="space-y-4">
                <u-alert color="warning" variant="subtle" icon="material-symbols:warning-outline-rounded" :title="t('admin.common.mustChangePasswordAfterLogin')" /><rb-form-field :label="t('admin.common.temporaryPassword')"
                  ><u-input :model-value="temporaryPassword" readonly class="w-full font-mono"
                    ><template #trailing><u-button icon="material-symbols:content-copy-outline-rounded" color="neutral" variant="link" @click="copyPassword" /></template></u-input
                ></rb-form-field>
                <div class="flex justify-end"><u-button :label="t('admin.common.acknowledge')" @click="passwordOpen = false" /></div></div
            ></template>
          </u-modal>
        </div>
      </div>
    </template>
  </u-dashboard-panel>
</template>
