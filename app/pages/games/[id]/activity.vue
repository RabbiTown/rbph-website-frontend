<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

const userStore = useUser();
userStore.required();

const game = useGame().ref;
const teamStore = useTeam();
const team = teamStore.ref;
const currencyStore = useCurrency();
const currencies = currencyStore.ref;
const route = useRoute();
const notificationUnread = useNotificationUnread().count;

const activeTab = ref(route.query.tab === 'notifications' ? 'notifications' : 'team');
const activityList = useTemplateRef<{ reload: () => Promise<void> }>('activity-list');
const notificationList = useTemplateRef<{ reload: () => Promise<void> }>('notification-list');
const updateTime = ref<number | null>(null);
const refreshLoading = ref(false);

const tabItems = computed(() => [
  {
    label: '队伍动态',
    icon: 'material-symbols:dynamic-form-outline-rounded',
    value: 'team',
  },
  {
    label: '通知',
    icon: 'material-symbols:notifications-outline-rounded',
    badge: notificationUnread.value > 0 ? { label: notificationUnread.value, color: 'error', variant: 'soft', size: 'sm' } : undefined,
    value: 'notifications',
  },
  ...(currencies.value ?? []).map(currency => ({
    label: `${currency.name} 变动记录`,
    icon: 'material-symbols:emoji-objects-outline-rounded',
    value: `currency-${currency.id}`,
  })),
]);

const activeCurrencyId = computed(() => {
  const match = activeTab.value.match(/^currency-(\d+)$/);
  return match ? Number(match[1]) : null;
});

onMounted(async () => {
  await useAggreInfo().waitUpdate();
  await teamStore.updateData();
  if (!team.value && game.value?.id) {
    navigateTo(`/games/${game.value.id}/profile`);
  }
});

watch(tabItems, items => {
  if (!items.some(item => item.value === activeTab.value)) activeTab.value = 'team';
});

async function refreshCurrent() {
  const list = activeTab.value === 'notifications' ? notificationList.value : activityList.value;
  if (!list) return;
  refreshLoading.value = true;
  try {
    await list.reload();
  } finally {
    refreshLoading.value = false;
  }
}

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: '队伍动态' }, { text: game.value?.title, sep: ' - ' }])),
});
</script>

<template>
  <u-main class="py-8">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 class="text-2xl font-semibold text-highlighted">队伍动态</h1>
        <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
          <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" size="sm" :loading="refreshLoading" @click="refreshCurrent" />
          <span>
            <u-icon name="material-symbols:schedule-outline-rounded" class="mb-0.5 align-middle" />
            <template v-if="updateTime">更新于 {{ formatDate(updateTime) }}</template>
            <template v-else>尚未更新</template>
          </span>
        </div>
      </div>

      <u-tabs v-model="activeTab" :items="tabItems" variant="link" :content="false" class="-mb-2" />

      <rbph-team-notification-list v-if="activeTab === 'notifications'" ref="notification-list" @updated="time => (updateTime = time)" />
      <u-card v-else variant="subtle" :ui="{ body: activeCurrencyId ? 'sm:p-4' : undefined }">
        <rbph-team-activity-list v-if="activeTab === 'team'" ref="activity-list" @updated="time => (updateTime = time)" />
        <rbph-team-activity-list v-else :key="activeCurrencyId ?? 'currency'" ref="activity-list" :currency-id="activeCurrencyId" @updated="time => (updateTime = time)" />
      </u-card>
    </div>
  </u-main>
</template>
