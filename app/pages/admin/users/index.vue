<script setup lang="ts">
const api = useApi();
const toast = useToast();
const currentUser = useUser().ref;

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
  { label: '全部用户', value: 'all' as const, icon: 'material-symbols:group-outline-rounded', color: 'neutral' as const },
  { label: '已封禁', value: RbUserRole.Banned, icon: 'material-symbols:block-outline', color: 'error' as const },
  { label: '普通用户', value: RbUserRole.User, icon: 'material-symbols:person-outline-rounded', color: 'primary' as const },
  { label: '工作人员', value: RbUserRole.Moderator, icon: 'material-symbols:shield-person-outline-rounded', color: 'warning' as const },
  { label: '管理员', value: RbUserRole.Admin, icon: 'material-symbols:admin-panel-settings-outline-rounded', color: 'success' as const },
  { label: '超级管理员', value: RbUserRole.Root, icon: 'material-symbols:security-rounded', color: 'info' as const },
];

const roleMeta: Record<RbUserRole, { label: string; icon: string; color: 'error' | 'primary' | 'warning' | 'success' | 'info' }> = {
  [RbUserRole.Banned]: { label: '已封禁', icon: 'material-symbols:block-outline', color: 'error' },
  [RbUserRole.User]: { label: '普通用户', icon: 'material-symbols:person-outline-rounded', color: 'primary' },
  [RbUserRole.Moderator]: { label: '工作人员', icon: 'material-symbols:shield-person-outline-rounded', color: 'warning' },
  [RbUserRole.Admin]: { label: '管理员', icon: 'material-symbols:admin-panel-settings-outline-rounded', color: 'success' },
  [RbUserRole.Root]: { label: '超级管理员', icon: 'material-symbols:security-rounded', color: 'info' },
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
    handleError(error, '获取用户列表失败');
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
      { errorHints: { [-6]: '只有超级管理员可以授予管理员权限', [-3]: '该邮箱已存在', [-2]: '用户信息不合法' } },
    );
    createOpen.value = false;
    createdUser.value = data.user;
    temporaryPassword.value = data.temporary_password;
    passwordOpen.value = true;
    await loadUsers();
  } catch (error) {
    handleError(error, '创建用户失败', true);
  } finally {
    creating.value = false;
  }
}

async function copyPassword() {
  await navigator.clipboard.writeText(temporaryPassword.value);
  toast.add({ title: '临时密码已复制', icon: 'material-symbols:content-copy-outline-rounded', color: 'success' });
}

watchDebounced(search, resetAndLoad, { debounce: 250, maxWait: 800 });
watch(role, resetAndLoad);
onMounted(loadUsers);
</script>

<template>
  <u-dashboard-panel id="admin-users">
    <template #header>
      <u-dashboard-navbar title="用户管理">
        <template #leading>
          <u-dashboard-sidebar-collapse />
        </template>
      </u-dashboard-navbar>
    </template>
    <template #body>
      <div class="grid min-h-0 gap-6 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,64rem)_minmax(14rem,18rem)]">
        <aside class="min-w-0">
          <div class="space-y-4 rounded-md border border-default bg-default p-4">
            <u-form-field label="搜索用户">
              <u-input v-model="search" icon="material-symbols:search-rounded" placeholder="邮箱、昵称或用户 ID" variant="subtle" class="w-full" />
            </u-form-field>
            <u-form-field label="用户角色">
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
            <u-button block icon="material-symbols:person-add-outline-rounded" label="新建用户" @click="openCreate" />
          </div>
        </aside>

        <main class="min-w-0 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-semibold text-highlighted">用户列表</h2>
              <p class="mt-1 text-sm text-muted">共 {{ total }} 名符合条件的用户</p>
            </div>
            <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" @click="loadUsers" />
          </div>
          <div v-if="loading && users.length === 0" class="space-y-2"><u-skeleton v-for="i in 4" :key="i" class="h-20 w-full" /></div>
          <u-empty v-else-if="users.length === 0" icon="material-symbols:person-search-outline-rounded" title="暂无用户" description="调整筛选条件，或新建一个用户。" />
          <div v-else class="divide-y divide-default rounded-md border border-default bg-default px-4">
            <nuxt-link v-for="item in users" :key="item.id" :to="`/admin/users/${item.id}`" class="group flex items-center gap-3 py-4">
              <u-avatar :src="buildCravatarUrl(item.email)" :text="item.nickname" size="md" />
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <span class="truncate font-medium text-highlighted">{{ item.nickname }}</span>
                  <u-badge :color="roleMeta[item.urole].color" variant="soft" size="sm" :icon="roleMeta[item.urole].icon">{{ roleMeta[item.urole].label }}</u-badge>
                  <u-badge v-if="item.must_change_password" color="warning" variant="soft" size="sm" icon="material-symbols:password-rounded">待修改密码</u-badge>
                </div>
                <div class="mt-1 flex flex-wrap gap-1.5 text-sm text-muted">
                  <span class="truncate">{{ item.email }}</span>
                  <u-badge color="neutral" variant="soft" size="sm" icon="material-symbols:groups-2-outline-rounded">{{ item.team_count }} 支队伍</u-badge>
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
        title="新建用户"
        description="账号将使用一次性随机密码。"
        confirm-label="创建用户"
        confirm-icon="material-symbols:person-add-outline-rounded"
        :confirm-disabled="!createValid"
        :busy="creating"
        @confirm="createUser"
      >
        <template #body>
          <div class="space-y-4">
            <rb-form-field label="邮箱" required><u-input v-model="createDraft.email" class="w-full" type="email" /></rb-form-field>
            <rb-form-field label="昵称" required><u-input v-model="createDraft.nickname" class="w-full" :maxlength="60" /></rb-form-field>
            <rb-form-field label="个人简介"><u-textarea v-model="createDraft.bio" class="w-full" :maxlength="200" :rows="3" /></rb-form-field>
            <rb-form-field label="角色" required>
              <u-field-group class="flex-wrap">
                <u-button v-for="item in creatableRoleItems" :key="item.value" :icon="item.icon" :color="item.color" :variant="createDraft.role === item.value ? 'solid' : 'soft'" @click="createDraft.role = item.value as RbUserRole">{{
                  item.label
                }}</u-button>
              </u-field-group>
            </rb-form-field>
          </div>
        </template>
      </rb-confirm-modal>

      <u-modal v-model:open="passwordOpen" title="一次性临时密码" description="关闭后将不再显示，可在用户详情中重新生成。" :dismissible="false">
        <template #body>
          <div class="space-y-4">
            <u-alert color="warning" variant="subtle" icon="material-symbols:warning-outline-rounded" title="用户登录后必须立即修改密码" />
            <rb-form-field label="用户"><u-input :model-value="createdUser?.email" disabled class="w-full" /></rb-form-field>
            <rb-form-field label="临时密码"
              ><u-input :model-value="temporaryPassword" readonly class="w-full font-mono"
                ><template #trailing><u-button icon="material-symbols:content-copy-outline-rounded" color="neutral" variant="link" @click="copyPassword" /></template></u-input
            ></rb-form-field>
            <div class="flex justify-end"><u-button label="我已记录" @click="passwordOpen = false" /></div>
          </div>
        </template>
      </u-modal>
    </template>
  </u-dashboard-panel>
</template>
