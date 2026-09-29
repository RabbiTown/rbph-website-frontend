<script setup lang="ts">const { t } = useI18n();


interface UserSelectItem extends AdminUserOption {
  label: string;
  disabled: boolean;
}

const props = defineProps<{
  gameId: number;
  placeholder?: string;
  disabled?: boolean;
  allowTeamId?: number;
  allowAnyTeam?: boolean;
}>();

const model = defineModel<number>();
const selectedUser = defineModel<AdminUserOption>('user');

const api = useApi();
const searchTerm = ref('');
const users = ref<AdminUserOption[]>([]);
const loading = ref(false);
let requestId = 0;

const items = computed<UserSelectItem[]>(() =>
  users.value.map(user => ({
    ...user,
    label: `${user.nickname} · ${user.email}`,
    disabled: !props.allowAnyTeam && Boolean(user.in_team_id && user.in_team_id !== props.allowTeamId),
  })),
);

async function loadUsers() {
  const search = searchTerm.value.trim();
  const currentRequest = ++requestId;
  if (!search) {
    users.value = selectedUser.value ? [selectedUser.value] : [];
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const { data } = await api.get<{ users: AdminUserOption[] }>(`/admin/games/${props.gameId}/teams/users`, {
      query: { search },
    });
    if (currentRequest !== requestId) return;
    users.value = selectedUser.value && !data.users.some(user => user.id === selectedUser.value?.id) ? [selectedUser.value, ...data.users] : data.users;
  } catch (error) {
    if (currentRequest === requestId) handleError(error, t('components.rbphAdminUserSelect.userListLoadFailed'));
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

watchDebounced(searchTerm, loadUsers, { debounce: 200, maxWait: 500 });
watch(
  () => props.gameId,
  () => {
    searchTerm.value = '';
    users.value = selectedUser.value ? [selectedUser.value] : [];
  },
);
watch(model, id => {
  selectedUser.value = users.value.find(user => user.id === id);
});

function clearSelection() {
  model.value = undefined;
  selectedUser.value = undefined;
  searchTerm.value = '';
}
</script>

<template>
  <u-select-menu
    v-model="model"
    v-model:search-term="searchTerm"
    :items="items"
    value-key="id"
    label-key="label"
    :placeholder="placeholder || t('components.rbphAdminUserSelect.searchPlaceholder')"
    search-input
    :clear="{ 'aria-label': t('admin.common.reset') }"
    :loading="loading"
    :disabled="disabled"
    icon="material-symbols:person-search-outline-rounded"
    class="w-full"
    @clear="clearSelection"
  />
</template>
