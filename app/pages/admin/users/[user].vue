<script setup lang="ts">
const route = useRoute();
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const currentUser = useUser().ref;

useHead({
  titleTemplate: '用户管理 - RBPH 管理后台',
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
  { label: '已封禁', value: RbUserRole.Banned, icon: 'material-symbols:block-outline', color: 'error' as const },
  { label: '普通用户', value: RbUserRole.User, icon: 'material-symbols:person-outline-rounded', color: 'primary' as const },
  { label: '工作人员', value: RbUserRole.Moderator, icon: 'material-symbols:shield-person-outline-rounded', color: 'warning' as const },
  { label: '管理员', value: RbUserRole.Admin, icon: 'material-symbols:admin-panel-settings-outline-rounded', color: 'success' as const },
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
    handleError(error, '获取用户详情失败');
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
      { errorHints: { [-7]: '不能修改同级或更高权限账号的邮箱。', [-6]: '只有超级管理员可以修改管理员角色。', [-4]: '不能修改自己的角色。', [-3]: '该邮箱已存在。', [-2]: '用户信息不合法。', [-1]: '用户不存在。' } },
    );
    user.value = data.user;
    syncDraft(data.user);
    dirtyToast.clear();
    if (currentUser.value?.id === data.user.id) await useUser().updateData();
    toast.add({ title: '用户信息已保存', icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '保存用户信息失败', true);
  } finally {
    saving.value = false;
  }
}

async function resetPassword() {
  resetting.value = true;
  try {
    const { data } = await api.post<AdminTemporaryPasswordResponse>(`/admin/users/${userId.value}/reset-password`, undefined, { errorHints: { [-6]: '不能重置同级或更高权限账号的密码' } });
    user.value = data.user;
    syncDraft(data.user);
    temporaryPassword.value = data.temporary_password;
    resetOpen.value = false;
    passwordOpen.value = true;
  } catch (error) {
    handleError(error, '重置密码失败', true);
  } finally {
    resetting.value = false;
  }
}

async function copyPassword() {
  await navigator.clipboard.writeText(temporaryPassword.value);
  toast.add({ title: '临时密码已复制', icon: 'material-symbols:content-copy-outline-rounded', color: 'success' });
}

watch(dirty, value => {
  if (value) dirtyToast.show({ description: '用户信息修改尚未保存。', guardOnLeave: true, apply: save, reset });
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
      <u-dashboard-navbar title="用户管理">
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
                  <h2 class="truncate text-xl font-semibold text-highlighted">{{ user?.nickname ?? '用户设置' }}</h2>
                </div>
                <div v-if="user" class="mt-1 flex flex-wrap gap-1.5 pl-10">
                  <u-badge color="neutral" variant="soft" icon="material-symbols:id-card-outline-rounded">用户 #{{ user.id }}</u-badge>
                  <u-badge color="neutral" variant="soft" icon="material-symbols:calendar-today-outline-rounded">注册于 {{ formatDate(user.ctime_at) }}</u-badge>
                  <u-badge v-if="user.must_change_password" color="warning" variant="soft" icon="material-symbols:password-rounded">待修改密码</u-badge>
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
                <h2 class="text-xl font-semibold text-highlighted">账号信息</h2>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field row narrow-label label="邮箱" icon="material-symbols:alternate-email-rounded" :dirty="draft.email !== user.email" :reset="() => (draft.email = user!.email)">
                    <u-input v-model="draft.email" type="email" class="w-full" :disabled="saving || !canManageCredentials" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row narrow-label label="昵称" icon="material-symbols:badge-outline-rounded" :dirty="draft.nickname !== user.nickname" :reset="() => (draft.nickname = user!.nickname)">
                    <u-input v-model="draft.nickname" class="w-full" :maxlength="60" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row narrow-label label="个人简介" icon="material-symbols:notes-rounded" :dirty="draft.bio !== (user.bio ?? '')" :reset="() => (draft.bio = user!.bio ?? '')">
                    <u-textarea v-model="draft.bio" class="w-full" :maxlength="200" :rows="4" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row narrow-label label="用户角色" icon="material-symbols:manage-accounts-outline-rounded" :dirty="draft.role !== user.urole" :reset="() => (draft.role = user!.urole)">
                    <u-badge v-if="user.urole === RbUserRole.Root" color="info" class="mt-0.5" variant="soft" icon="material-symbols:security-rounded">超级管理员</u-badge>
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
                <h2 class="text-xl font-semibold text-highlighted">所属队伍</h2>
                <u-empty v-if="user.teams.length === 0" title="未加入任何队伍" icon="material-symbols:group-off-outline-rounded" />
                <div v-else class="divide-y divide-default rounded-md border border-default bg-default px-4">
                  <nuxt-link v-for="team in user.teams" :key="`${team.game_id}:${team.team_id}`" :to="`/admin/games/${team.game_id}/teams/${team.team_id}`" class="group flex items-center gap-3 py-4">
                    <u-icon name="material-symbols:groups-2-outline-rounded" class="size-6 text-muted" />
                    <div class="min-w-0 flex-1">
                      <div class="font-medium text-highlighted">{{ team.team_name }}</div>
                      <div class="mt-1 text-sm text-muted">{{ team.game_title }}</div>
                    </div>
                    <u-badge v-if="team.is_captain" color="warning" variant="soft" icon="material-symbols:award-star-outline-rounded">队长</u-badge>
                    <u-icon name="material-symbols:chevron-right-rounded" class="size-5 text-dimmed transition-transform group-hover:translate-x-0.5" />
                  </nuxt-link>
                </div>
              </section>

              <u-separator />

              <section class="space-y-4">
                <u-collapsible :unmount-on-hide="false">
                  <button type="button" class="group flex w-full cursor-pointer items-center justify-between gap-3 text-start">
                    <h2 class="text-xl font-semibold text-highlighted">重置密码</h2>
                    <u-icon name="material-symbols:expand-more-rounded" class="size-5 text-muted transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                  <template #content
                    ><div class="mt-4 flex items-center justify-between gap-4 rounded-md bg-elevated/60 p-4 ring ring-default">
                      <p class="text-sm text-muted">{{ canResetPassword ? '生成一次性随机密码，注销该用户所有会话，并要求下次登录后立即修改。' : '不能重置同级或更高权限账号的密码。' }}</p>
                      <u-button color="warning" variant="soft" icon="material-symbols:password-rounded" label="生成临时密码" :disabled="!canResetPassword" @click="resetOpen = true" /></div
                  ></template>
                </u-collapsible>
              </section>
            </u-form>
          </main>

          <aside class="hidden xl:block" />

          <rb-confirm-modal
            v-model:open="resetOpen"
            title="重置用户密码"
            description="该用户的所有登录会话将立即失效。"
            confirm-label="确认重置"
            confirm-color="warning"
            confirm-icon="material-symbols:password-rounded"
            :busy="resetting"
            @confirm="resetPassword"
          />
          <u-modal v-model:open="passwordOpen" title="一次性临时密码" description="关闭后将不再显示，可再次重置。" :dismissible="false">
            <template #body
              ><div class="space-y-4">
                <u-alert color="warning" variant="subtle" icon="material-symbols:warning-outline-rounded" title="用户登录后必须立即修改密码" /><rb-form-field label="临时密码"
                  ><u-input :model-value="temporaryPassword" readonly class="w-full font-mono"
                    ><template #trailing><u-button icon="material-symbols:content-copy-outline-rounded" color="neutral" variant="link" @click="copyPassword" /></template></u-input
                ></rb-form-field>
                <div class="flex justify-end"><u-button label="我已记录" @click="passwordOpen = false" /></div></div
            ></template>
          </u-modal>
        </div>
      </div>
    </template>
  </u-dashboard-panel>
</template>
