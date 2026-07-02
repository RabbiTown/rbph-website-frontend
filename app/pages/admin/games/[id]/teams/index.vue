<script setup lang="ts">
const route = useRoute();
const api = useApi();
const toast = useToast();

const gameId = computed(() => Number(route.params.id));
const loading = ref(false);
const creating = ref(false);
const createOpen = ref(false);
const search = ref('');
const filter = ref<'all' | 'banned' | 'locked' | 'finished'>('all');
const teams = ref<AdminTeamListItem[]>([]);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const selectedCaptain = ref<AdminUserOption>();
const createDraft = reactive({
  name: '',
  pass: '',
  bio: '',
  captain_user_id: undefined as number | undefined,
});

const errorHints = {
  [-4]: '该用户已经在本比赛的其他队伍中',
  [-3]: '队伍信息不合法',
  [-1]: '目标不存在',
};

const filters = [
  { label: '全部队伍', value: 'all', icon: 'material-symbols:groups-2-outline-rounded' },
  { label: '已封禁', value: 'banned', icon: 'material-symbols:block-outline' },
  { label: '已锁定', value: 'locked', icon: 'material-symbols:lock-outline' },
  { label: '已完赛', value: 'finished', icon: 'material-symbols:flag-outline-rounded' },
] as const;

const createValid = computed(() => Boolean(createDraft.name.trim() && createDraft.pass.trim() && createDraft.captain_user_id));

function teamQuery() {
  return {
    search: search.value.trim() || undefined,
    is_banned: filter.value === 'banned' ? true : undefined,
    is_locked: filter.value === 'locked' ? true : undefined,
    is_finished: filter.value === 'finished' ? true : undefined,
    limit: pageSize,
    offset: (page.value - 1) * pageSize,
  };
}

async function loadTeams() {
  if (!gameId.value) return;
  loading.value = true;
  try {
    const { data } = await api.get<{ teams: AdminTeamListItem[]; total: number }>(`/admin/games/${gameId.value}/teams`, { query: teamQuery() });
    teams.value = data.teams;
    total.value = data.total;
  } catch (error) {
    teams.value = [];
    total.value = 0;
    handleError(error, '获取队伍列表失败');
  } finally {
    loading.value = false;
  }
}

function resetPageAndLoad() {
  page.value = 1;
  loadTeams();
}

function updatePage(value: number) {
  if (value === page.value || loading.value) return;
  page.value = value;
  loadTeams();
}

function resetCreateDraft() {
  createDraft.name = '';
  createDraft.pass = '';
  createDraft.bio = '';
  createDraft.captain_user_id = undefined;
  selectedCaptain.value = undefined;
}

function openCreateModal() {
  resetCreateDraft();
  createOpen.value = true;
}

async function createTeam() {
  if (!gameId.value || !createValid.value) return;
  creating.value = true;
  try {
    const { data } = await api.post<{ team: AdminTeamDetail }>(
      `/admin/games/${gameId.value}/teams`,
      {
        name: createDraft.name.trim(),
        pass: createDraft.pass.trim(),
        bio: createDraft.bio,
        captain_user_id: createDraft.captain_user_id,
      },
      { errorHints },
    );
    createOpen.value = false;
    toast.add({ title: '队伍已创建', description: data.team.name, icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
    await navigateTo(`/admin/games/${gameId.value}/teams/${data.team.id}`);
  } catch (error) {
    handleError(error, '创建队伍失败', true);
  } finally {
    creating.value = false;
  }
}

function statusBadges(team: AdminTeamListItem) {
  const result: { label: string; color: 'error' | 'warning' | 'success' | 'neutral'; icon: string }[] = [];
  if (team.is_banned) result.push({ label: '封禁', color: 'error', icon: 'material-symbols:block-outline' });
  if (team.is_locked) result.push({ label: '锁定', color: 'warning', icon: 'material-symbols:lock-outline' });
  if (team.finish_at) result.push({ label: '完赛', color: 'success', icon: 'material-symbols:flag-outline-rounded' });
  if (result.length === 0) result.push({ label: '未开始', color: 'neutral', icon: 'material-symbols:radio-button-unchecked' });
  return result;
}

watchDebounced(search, resetPageAndLoad, { debounce: 250, maxWait: 800 });
watch(filter, resetPageAndLoad);
onMounted(loadTeams);
</script>

<template>
  <div class="grid min-h-0 gap-6 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,64rem)_minmax(14rem,18rem)]">
    <aside class="min-w-0">
      <div class="space-y-4 rounded-md border border-default bg-default p-4">
        <u-form-field label="搜索队伍">
          <u-input v-model="search" icon="material-symbols:search-rounded" placeholder="名称或队长" variant="subtle" class="w-full" />
        </u-form-field>

        <u-form-field label="队伍状态">
          <div class="flex flex-col gap-1">
            <u-button
              v-for="item in filters"
              :key="item.value"
              :icon="item.icon"
              :variant="filter === item.value ? 'soft' : 'ghost'"
              :active="filter === item.value"
              active-color="primary"
              color="neutral"
              class="justify-start"
              @click="filter = item.value"
            >
              {{ item.label }}
            </u-button>
          </div>
        </u-form-field>

        <u-separator />
        <u-button block icon="material-symbols:add-rounded" label="新建队伍" @click="openCreateModal" />
      </div>
    </aside>

    <main class="min-w-0 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">队伍列表</h2>
          <p class="mt-1 text-sm text-muted">共 {{ total }} 支符合条件的队伍</p>
        </div>
        <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" @click="loadTeams" />
      </div>

      <div v-if="loading && teams.length === 0" class="space-y-2">
        <u-skeleton v-for="i in 4" :key="i" class="h-20 w-full" />
      </div>
      <u-empty v-else-if="teams.length === 0" icon="material-symbols:groups-2-outline-rounded" title="暂无队伍" description="调整筛选条件，或新建一支队伍。" />
      <div v-else class="divide-y divide-default rounded-md border border-default bg-default px-4">
        <nuxt-link v-for="team in teams" :key="team.id" :to="`/admin/games/${gameId}/teams/${team.id}`" class="group flex items-center gap-3 py-4">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <u-icon name="material-symbols:groups-2-outline-rounded" class="size-5 text-muted" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="truncate font-medium text-highlighted">{{ team.name }}</span>
              <u-badge v-for="badge in statusBadges(team)" :key="badge.label" size="sm" :color="badge.color" variant="soft" :icon="badge.icon">{{ badge.label }}</u-badge>
            </div>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <u-badge size="sm" color="neutral" variant="soft" icon="material-symbols:group-outline-rounded">{{ team.member_count }} 名成员</u-badge>
              <u-badge size="sm" color="neutral" variant="soft" icon="material-symbols:award-star-outline-rounded">{{ team.captain_name ?? '无队长' }}</u-badge>
              <u-badge v-if="team.finish_at" size="sm" color="success" variant="soft" icon="material-symbols:flag-outline-rounded">完赛于 {{ formatDate(team.finish_at) }}</u-badge>
            </div>
          </div>
          <u-icon name="material-symbols:chevron-right-rounded" class="size-5 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5" />
        </nuxt-link>
      </div>

      <div v-if="total > pageSize" class="flex justify-center pt-2">
        <u-pagination :page="page" :total="total" :items-per-page="pageSize" show-edges variant="soft" active-variant="subtle" :disabled="loading" @update:page="updatePage" />
      </div>
    </main>

    <aside class="hidden xl:block" />

    <rb-confirm-modal v-model:open="createOpen" title="新建队伍" description="创建队伍并指定初始队长。" confirm-label="创建队伍" confirm-icon="material-symbols:add-rounded" :confirm-disabled="!createValid" :busy="creating" @confirm="createTeam">
      <template #body>
        <div class="space-y-4">
          <rb-form-field label="队伍名称" required>
            <u-input v-model="createDraft.name" placeholder="输入队伍名称" class="w-full" :disabled="creating" />
          </rb-form-field>
          <rb-form-field label="队伍密码" required>
            <u-input v-model="createDraft.pass" placeholder="输入队伍密码" class="w-full" :disabled="creating" />
          </rb-form-field>
          <rb-form-field label="队伍简介">
            <u-textarea v-model="createDraft.bio" placeholder="可留空" class="w-full" :rows="3" :disabled="creating" />
          </rb-form-field>
          <rb-form-field label="队长" required>
            <rbph-admin-user-select v-model="createDraft.captain_user_id" v-model:user="selectedCaptain" :game-id="gameId" :disabled="creating" />
          </rb-form-field>
        </div>
      </template>
    </rb-confirm-modal>
  </div>
</template>
