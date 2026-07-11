<script setup lang="ts">const { t } = useI18n();


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
  [-4]: t('admin.pages.teams.userGameTeam'),
  [-3]: t('admin.pages.teams.teamInfoInvalid'),
  [-1]: t('admin.common.targetNotFound'),
};

const filters = [
  { label: t('admin.pages.teams.allTeam'), value: 'all', icon: 'material-symbols:groups-2-outline-rounded' },
  { label: t('admin.common.bannedLabel'), value: 'banned', icon: 'material-symbols:block-outline' },
  { label: t('admin.pages.teams.locked'), value: 'locked', icon: 'material-symbols:lock-outline' },
  { label: t('admin.pages.teams.finished'), value: 'finished', icon: 'material-symbols:flag-outline-rounded' },
] as const;

const createValid = computed(() => Boolean(createDraft.name.trim() && createDraft.pass.trim() && createDraft.captain_user_id != null));

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
    handleError(error, t('admin.pages.teams.loadTeamListFailed'));
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
    toast.add({ title: t('admin.pages.teams.teamCreated'), description: data.team.name, icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
    await navigateTo(`/admin/games/${gameId.value}/teams/${data.team.id}`);
  } catch (error) {
    handleError(error, t('admin.pages.teams.createTeamFailed'), true);
  } finally {
    creating.value = false;
  }
}

function statusBadges(team: AdminTeamListItem) {
  const result: { label: string; color: 'error' | 'warning' | 'success' | 'neutral'; icon: string }[] = [];
  if (team.is_banned) result.push({ label: t('admin.common.banned'), color: 'error', icon: 'material-symbols:block-outline' });
  if (team.is_locked) result.push({ label: t('admin.common.locked'), color: 'warning', icon: 'material-symbols:lock-outline' });
  if (team.finish_at) result.push({ label: t('admin.pages.teams.finishedLabel'), color: 'success', icon: 'material-symbols:flag-outline-rounded' });
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
        <u-form-field :label="t('admin.pages.teams.searchTeam')">
          <u-input v-model="search" icon="material-symbols:search-rounded" :placeholder="t('admin.pages.teams.nameOrCaptain')" variant="subtle" class="w-full" />
        </u-form-field>

        <u-form-field :label="t('admin.common.teamState')">
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
        <u-button block icon="material-symbols:add-rounded" :label="t('admin.pages.teams.createTeam')" @click="openCreateModal" />
      </div>
    </aside>

    <main class="min-w-0 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.teams.teamList') }}</h2>
          <p class="mt-1 text-sm text-muted">{{ t('admin.pages.teams.matchingCount', { count: total }) }}</p>
        </div>
        <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" @click="loadTeams" />
      </div>

      <div v-if="loading && teams.length === 0" class="space-y-2">
        <u-skeleton v-for="i in 4" :key="i" class="h-20 w-full" />
      </div>
      <u-empty v-else-if="teams.length === 0" icon="material-symbols:groups-2-outline-rounded" :title="t('admin.pages.teams.emptyTeam')" :description="t('admin.pages.teams.filterConditionOrCreateTeamTeam')" />
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
              <u-badge size="sm" :color="team.member_count > 0 ? 'neutral' : 'warning'" variant="soft" icon="material-symbols:group-outline-rounded">{{ t('admin.pages.teams.memberCount', { count: team.member_count }) }}</u-badge>
              <u-badge size="sm" :color="team.captain_name ? 'neutral' : 'warning'" variant="soft" icon="material-symbols:award-star-outline-rounded">{{ team.captain_name ?? t('admin.pages.teams.captain') }}</u-badge>
              <u-badge v-if="team.finish_at" size="sm" color="success" variant="soft" icon="material-symbols:flag-outline-rounded">{{ t('admin.common.finishedAt', { time: formatDate(team.finish_at) }) }}</u-badge>
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

    <rb-confirm-modal v-model:open="createOpen" :title="t('admin.pages.teams.createTeam')" :description="t('admin.pages.teams.createTeamSpecifiedCaptain')" :confirm-label="t('admin.pages.teams.createTeamLabel')" confirm-icon="material-symbols:add-rounded" :confirm-disabled="!createValid" :busy="creating" @confirm="createTeam">
      <template #body>
        <div class="space-y-4">
          <rb-form-field :label="t('admin.common.teamName')" required>
            <u-input v-model="createDraft.name" :placeholder="t('admin.pages.teams.enterTeamName')" class="w-full" :disabled="creating" />
          </rb-form-field>
          <rb-form-field :label="t('admin.common.teamPassword')" required>
            <u-input v-model="createDraft.pass" :placeholder="t('admin.pages.teams.enterTeamPassword')" class="w-full" :disabled="creating" />
          </rb-form-field>
          <rb-form-field :label="t('admin.common.teamBio')">
            <u-textarea v-model="createDraft.bio" :placeholder="t('admin.pages.teams.empty')" class="w-full" :rows="3" :disabled="creating" />
          </rb-form-field>
          <rb-form-field :label="t('admin.common.captain')" required>
            <rbph-admin-user-select v-model="createDraft.captain_user_id" v-model:user="selectedCaptain" :game-id="gameId" :disabled="creating" />
          </rb-form-field>
        </div>
      </template>
    </rb-confirm-modal>
  </div>
</template>
