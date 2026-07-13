<script setup lang="ts">
const props = defineProps<{
  gameId: number;
  teamId: number;
  teamName: string;
}>();

const open = defineModel<boolean>('open', { default: false });
const api = useApi();
const { t } = useI18n();
const pageSize = 20;
const activities = ref<RbTeamActivity[]>([]);
const loading = ref(false);
const hasMore = ref(false);

const accessChangeLabels = computed<Record<string, string>>(() => ({
  'team:banned': t('activityLog.access.teamBanned'),
  'team:unbanned': t('activityLog.access.teamUnbanned'),
  'team:locked': t('activityLog.access.teamLocked'),
  'team:unlocked': t('activityLog.access.teamUnlocked'),
  'direct_message:banned': t('activityLog.access.directMessageBanned'),
  'direct_message:unbanned': t('activityLog.access.directMessageUnbanned'),
  'puzzle_ticket:banned': t('activityLog.access.puzzleTicketBanned'),
  'puzzle_ticket:unbanned': t('activityLog.access.puzzleTicketUnbanned'),
  'leaderboard:banned': t('activityLog.access.leaderboardBanned'),
  'leaderboard:unbanned': t('activityLog.access.leaderboardUnbanned'),
}));

async function load(reset = false) {
  if (loading.value) return;
  const gameId = props.gameId;
  const teamId = props.teamId;
  const before = reset ? undefined : activities.value.at(-1)?.id;
  loading.value = true;
  try {
    const query: Record<string, number> = { limit: pageSize };
    if (before !== undefined) query.before = before;
    const { data } = await api.get<RbTeamActivity[]>(`/games/${gameId}/tickets/staff/teams/${teamId}/management-activity`, { query });
    if (gameId !== props.gameId || teamId !== props.teamId) return;
    activities.value = reset ? data : [...activities.value, ...data];
    hasMore.value = data.length === pageSize;
  } catch (error) {
    handleError(error, t('components.teamAccessMenu.historyLoadFailed'));
  } finally {
    loading.value = false;
  }
}

function activityView(activity: RbTeamActivity) {
  const actor = activityUserLabel(activity.data.user, activity.user_id) || t('activity.staff');
  const reason = typeof activity.data.reason === 'string' ? activity.data.reason.trim() : '';
  if (activity.type === 'team.access_changed') {
    const changes = (activity.data.changes ?? [])
      .map(change => accessChangeLabels.value[`${change.target === 'feature' ? change.feature : 'team'}:${change.action}`])
      .filter(Boolean);
    const restricted = (activity.data.changes ?? []).some(change => change.action === 'banned' || change.action === 'locked');
    return {
      icon: 'material-symbols:admin-panel-settings-outline-rounded',
      color: restricted ? 'text-error' : 'text-primary',
      title: t('activityLog.teamAccessChanged', { actor, changes }),
      details: reason ? [t('activity.reasonDetail', { reason })] : [],
    };
  }

  return {
    icon: 'material-symbols:account-balance-wallet-outline-rounded',
    color: Number(activity.delta_amount ?? activity.data.delta ?? 0) < 0 ? 'text-warning' : 'text-success',
    title: t('activityLog.currencyAdjustedByStaff', { actor, reason }),
    details: reason ? [t('activity.reasonDetail', { reason })] : [],
  };
}

watch(
  () => [open.value, props.gameId, props.teamId] as const,
  ([isOpen]) => {
    if (isOpen) void load(true);
  },
);
</script>

<template>
  <u-modal v-model:open="open" :title="t('components.teamAccessMenu.historyTitle', { team: teamName })" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div v-if="loading && activities.length === 0" class="space-y-3">
        <u-skeleton class="h-16 w-full" />
        <u-skeleton class="h-16 w-full" />
        <u-skeleton class="h-16 w-full" />
      </div>
      <u-empty v-else-if="activities.length === 0" icon="material-symbols:history-rounded" :title="t('activity.noRecords')" />
      <div v-else>
        <div class="divide-y divide-default">
          <div v-for="activity in activities" :key="activity.id" class="flex items-start gap-3 py-4 first:pt-0">
            <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <u-icon :name="activityView(activity).icon" :class="['size-4', activityView(activity).color]" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div class="wrap-break-word text-sm font-medium text-highlighted">
                  <u-badge v-if="isStaffActivityLog(activity)" size="sm" color="warning" variant="soft" class="mr-1 align-middle mb-0.5">{{ t('activity.staff') }}</u-badge>
                  <i18n-t v-if="activity.type === 'currency.staff_adjusted'" keypath="activityLog.currencyAdjustedByStaff" tag="span">
                    <template #actor>{{ activityUserLabel(activity.data.user, activity.user_id) || t('activity.staff') }}</template>
                    <template #change>
                      <span :class="Number(activity.delta_amount ?? activity.data.delta ?? 0) < 0 ? 'text-warning' : 'text-success'">{{ formatActivityLogCurrency(activity) }}</span>
                    </template>
                  </i18n-t>
                  <span v-else>{{ activityView(activity).title }}</span>
                </div>
                <time class="shrink-0 text-xs text-muted">{{ formatDate(activity.ctime_at) }}</time>
              </div>
              <div v-for="detail in activityView(activity).details" :key="detail" class="mt-1 wrap-break-word text-sm text-muted">{{ detail }}</div>
            </div>
          </div>
        </div>
        <div v-if="hasMore" class="mt-3 flex justify-center">
          <u-button color="neutral" variant="soft" icon="material-symbols:expand-more-rounded" :label="t('common.loadMore')" :loading="loading" @click="load()" />
        </div>
      </div>
    </template>
  </u-modal>
</template>
