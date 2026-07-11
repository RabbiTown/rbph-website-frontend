<script setup lang="ts">const { t } = useI18n();


const api = useApi();
const toast = useToast();
const currentUser = useUser().ref;

useHead({
  titleTemplate: t('admin.common.userManagementTitle'),
});

const loading = ref(false);
const creating = ref(false);
const createOpen = ref(false);
const passwordOpen = ref(false);
const temporaryPassword = ref('');
const createdUser = ref<AdminUserDetail>();
const search = ref('');
const role = ref<'all' | RbUserRole>('all');
const users = ref<AdminUserListItem[]>([]);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

const createDraft = reactive({
  email: '',
  nickname: '',
  bio: '',
  role: RbUserRole.User,
});

const roleItems = [
  { label: t('admin.pages.users.allUser'), value: 'all' as const, icon: 'material-symbols:group-outline-rounded', color: 'neutral' as const },
  { label: t('admin.common.bannedLabel'), value: RbUserRole.Banned, icon: 'material-symbols:block-outline', color: 'error' as const },
  { label: t('admin.common.regularUser'), value: RbUserRole.User, icon: 'material-symbols:person-outline-rounded', color: 'primary' as const },
  { label: t('admin.common.staff'), value: RbUserRole.Moderator, icon: 'material-symbols:shield-person-outline-rounded', color: 'warning' as const },
  { label: t('admin.common.admin'), value: RbUserRole.Admin, icon: 'material-symbols:admin-panel-settings-outline-rounded', color: 'success' as const },
  { label: t('admin.common.superAdmin'), value: RbUserRole.Root, icon: 'material-symbols:security-rounded', color: 'info' as const },
];

const roleMeta: Record<RbUserRole, { label: string; icon: string; color: 'error' | 'primary' | 'warning' | 'success' | 'info' }> = {
  [RbUserRole.Banned]: { label: t('admin.common.bannedLabel'), icon: 'material-symbols:block-outline', color: 'error' },
  [RbUserRole.User]: { label: t('admin.common.regularUser'), icon: 'material-symbols:person-outline-rounded', color: 'primary' },
  [RbUserRole.Moderator]: { label: t('admin.common.staff'), icon: 'material-symbols:shield-person-outline-rounded', color: 'warning' },
  [RbUserRole.Admin]: { label: t('admin.common.admin'), icon: 'material-symbols:admin-panel-settings-outline-rounded', color: 'success' },
  [RbUserRole.Root]: { label: t('admin.common.superAdmin'), icon: 'material-symbols:security-rounded', color: 'info' },
};

const creatableRoleItems = computed(() => roleItems.slice(1).filter(item => item.value < RbUserRole.Root && (currentUser.value?.urole === RbUserRole.Root || item.value < RbUserRole.Admin)));

const createValid = computed(() => createDraft.email.trim().includes('@') && createDraft.nickname.trim().length > 0);

function query() {
  return {
    search: search.value.trim() || undefined,
    role: role.value === 'all' ? undefined : role.value,
    limit: pageSize,
    offset: (page.value - 1) * pageSize,
  };
}

async function loadUsers() {
  loading.value = true;
  try {
    const { data } = await api.get<{ users: AdminUserListItem[]; total: number }>('/admin/users', { query: query() });
    users.value = data.users;
    total.value = data.total;
  } catch (error) {
    users.value = [];
    total.value = 0;
    handleError(error, t('admin.pages.users.loadUserListFailed'));
  } finally {
    loading.value = false;
  }
}

function resetAndLoad() {
  page.value = 1;
  loadUsers();
}

function updatePage(value: number) {
  if (value === page.value || loading.value) return;
  page.value = value;
  loadUsers();
}

function openCreate() {
  Object.assign(createDraft, { email: '', nickname: '', bio: '', role: RbUserRole.User });
  createOpen.value = true;
}

async function createUser() {
  if (!createValid.value) return;
  creating.value = true;
  try {
    const { data } = await api.post<AdminTemporaryPasswordResponse>(
      '/admin/users',
      {
        email: createDraft.email.trim(),
        nickname: createDraft.nickname.trim(),
        bio: createDraft.bio,
        role: createDraft.role,
      },
      { errorHints: { [-6]: t('admin.pages.users.superAdminGrantAdminAccess'), [-3]: t('admin.pages.users.emailExists'), [-2]: t('admin.pages.users.userInfoInvalid') } },
    );
    createOpen.value = false;
    createdUser.value = data.user;
    temporaryPassword.value = data.temporary_password;
    passwordOpen.value = true;
    await loadUsers();
  } catch (error) {
    handleError(error, t('admin.pages.users.createUserFailed'), true);
  } finally {
    creating.value = false;
  }
}

async function copyPassword() {
  await navigator.clipboard.writeText(temporaryPassword.value);
  toast.add({ title: t('admin.common.temporaryPasswordCopied'), icon: 'material-symbols:content-copy-outline-rounded', color: 'success' });
}

watchDebounced(search, resetAndLoad, { debounce: 250, maxWait: 800 });
watch(role, resetAndLoad);
onMounted(loadUsers);
</script>

<template>
  <u-dashboard-panel id="admin-users">
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
          <aside class="min-w-0">
            <div class="space-y-4 rounded-md border border-default bg-default p-4">
              <u-form-field :label="t('admin.pages.users.searchUser')">
                <u-input v-model="search" icon="material-symbols:search-rounded" :placeholder="t('admin.pages.users.searchPlaceholder')" variant="subtle" class="w-full" />
              </u-form-field>
              <u-form-field :label="t('admin.common.userRole')">
                <div class="flex flex-col gap-1">
                  <u-button
                    v-for="item in roleItems"
                    :key="item.value"
                    :icon="item.icon"
                    :variant="role === item.value ? 'soft' : 'ghost'"
                    :active="role === item.value"
                    active-color="primary"
                    color="neutral"
                    class="justify-start"
                    @click="role = item.value"
                  >
                    {{ item.label }}
                  </u-button>
                </div>
              </u-form-field>
              <u-separator />
              <u-button block icon="material-symbols:person-add-outline-rounded" :label="t('admin.pages.users.createUser')" @click="openCreate" />
            </div>
          </aside>

          <main class="min-w-0 space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.users.userList') }}</h2>
                <p class="mt-1 text-sm text-muted">{{ t('admin.pages.users.matchingCount', { count: total }) }}</p>
              </div>
              <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" @click="loadUsers" />
            </div>
            <div v-if="loading && users.length === 0" class="space-y-2"><u-skeleton v-for="i in 4" :key="i" class="h-20 w-full" /></div>
            <u-empty v-else-if="users.length === 0" icon="material-symbols:person-search-outline-rounded" :title="t('admin.pages.users.emptyUser')" :description="t('admin.pages.users.filterConditionOrCreateItemUser')" />
            <div v-else class="divide-y divide-default rounded-md border border-default bg-default px-4">
              <nuxt-link v-for="item in users" :key="item.id" :to="`/admin/users/${item.id}`" class="group flex items-center gap-3 py-4">
                <u-avatar :src="item.avatar" :text="item.nickname" size="md" />
                <div class="min-w-0 flex-1">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <span class="truncate font-medium text-highlighted">{{ item.nickname }}</span>
                    <u-badge :color="roleMeta[item.urole].color" variant="soft" size="sm" :icon="roleMeta[item.urole].icon">{{ roleMeta[item.urole].label }}</u-badge>
                    <u-badge v-if="item.must_change_password" color="warning" variant="soft" size="sm" icon="material-symbols:password-rounded">{{ t('admin.common.passwordChangeRequired') }}</u-badge>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-1.5 text-sm text-muted">
                    <span class="truncate">{{ item.email }}</span>
                    <u-badge color="neutral" variant="soft" size="sm" icon="material-symbols:groups-2-outline-rounded">{{ t('admin.pages.users.teamCount', { count: item.team_count }) }}</u-badge>
                  </div>
                </div>
                <u-icon name="material-symbols:chevron-right-rounded" class="size-5 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5" />
              </nuxt-link>
            </div>
            <div v-if="total > pageSize" class="flex justify-center pt-2"><u-pagination :page="page" :total="total" :items-per-page="pageSize" show-edges variant="soft" active-variant="subtle" :disabled="loading" @update:page="updatePage" /></div>
          </main>
          <aside class="hidden xl:block" />
        </div>

        <rb-confirm-modal
          v-model:open="createOpen"
          :title="t('admin.pages.users.createUser')"
          :description="t('admin.pages.users.accountOneTimeRandomPassword')"
          :confirm-label="t('admin.pages.users.createUserLabel')"
          confirm-icon="material-symbols:person-add-outline-rounded"
          :confirm-disabled="!createValid"
          :busy="creating"
          @confirm="createUser"
        >
          <template #body>
            <div class="space-y-4">
              <rb-form-field :label="t('admin.common.email')" required><u-input v-model="createDraft.email" class="w-full" type="email" /></rb-form-field>
              <rb-form-field :label="t('admin.common.nickname')" required><u-input v-model="createDraft.nickname" class="w-full" :maxlength="60" /></rb-form-field>
              <rb-form-field :label="t('admin.common.userBio')"><u-textarea v-model="createDraft.bio" class="w-full" :maxlength="200" :rows="3" /></rb-form-field>
              <rb-form-field :label="t('admin.pages.users.role')" required>
                <u-field-group class="flex-wrap">
                  <u-button v-for="item in creatableRoleItems" :key="item.value" :icon="item.icon" :color="item.color" :variant="createDraft.role === item.value ? 'solid' : 'soft'" @click="createDraft.role = item.value as RbUserRole">{{
                    item.label
                  }}</u-button>
                </u-field-group>
              </rb-form-field>
            </div>
          </template>
        </rb-confirm-modal>

        <u-modal v-model:open="passwordOpen" :title="t('admin.common.oneTimeTemporaryPassword')" :description="t('admin.pages.users.closeShowUserDetailsReGenerate')" :dismissible="false">
          <template #body>
            <div class="space-y-4">
              <u-alert color="warning" variant="subtle" icon="material-symbols:warning-outline-rounded" :title="t('admin.common.mustChangePasswordAfterLogin')" />
              <rb-form-field :label="t('admin.common.user')"><u-input :model-value="createdUser?.email" disabled class="w-full" /></rb-form-field>
              <rb-form-field :label="t('admin.common.temporaryPassword')"
                ><u-input :model-value="temporaryPassword" readonly class="w-full font-mono"
                  ><template #trailing><u-button icon="material-symbols:content-copy-outline-rounded" color="neutral" variant="link" @click="copyPassword" /></template></u-input
              ></rb-form-field>
              <div class="flex justify-end"><u-button :label="t('admin.common.acknowledge')" @click="passwordOpen = false" /></div>
            </div>
          </template>
        </u-modal>
      </div>
    </template>
  </u-dashboard-panel>
</template>
