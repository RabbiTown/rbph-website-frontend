<script setup lang="ts">
const { t } = useI18n();

const props = defineProps<{
  gameId: number;
  placeholder?: string;
  disabled?: boolean;
}>();

const model = defineModel<number>();
const selectedTeam = defineModel<StaffTeamOption>('team');

const api = useApi();
const searchTerm = ref('');
const teams = ref<StaffTeamOption[]>([]);
const loading = ref(false);
let requestId = 0;

async function loadTeams() {
  const currentRequest = ++requestId;
  loading.value = true;
  try {
    const { data } = await api.get<{ teams: StaffTeamOption[] }>(`/games/${props.gameId}/tickets/staff/teams`, {
      query: { search: searchTerm.value.trim() },
    });
    if (currentRequest !== requestId) return;
    teams.value = selectedTeam.value && !data.teams.some(team => team.id === selectedTeam.value?.id) ? [selectedTeam.value, ...data.teams] : data.teams;
  } catch (error) {
    if (currentRequest === requestId) handleError(error, t('components.staffTeamSelect.loadFailed'));
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

watchDebounced(searchTerm, loadTeams, { debounce: 200, maxWait: 500 });
watch(
  () => props.gameId,
  () => {
    searchTerm.value = '';
    loadTeams();
  },
  { immediate: true },
);
watch(model, id => {
  selectedTeam.value = teams.value.find(team => team.id === id);
});

function clearSelection() {
  model.value = undefined;
  selectedTeam.value = undefined;
  searchTerm.value = '';
}
</script>

<template>
  <u-select-menu
    v-model="model"
    v-model:search-term="searchTerm"
    :items="teams"
    value-key="id"
    label-key="name"
    :placeholder="placeholder || t('components.staffTeamSelect.searchPlaceholder')"
    search-input
    :clear="{ 'aria-label': t('admin.common.reset') }"
    :loading="loading"
    :disabled="disabled"
    icon="material-symbols:groups-2-outline-rounded"
    class="w-full"
    @clear="clearSelection"
  />
</template>
