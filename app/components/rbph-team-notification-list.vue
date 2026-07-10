<script setup lang="ts">
const emit = defineEmits<{
  updated: [time: number];
}>();

const { t } = useI18n();
const pageSize = 20;
const api = useApi();
const game = useGame().ref;
const team = useTeam(false).ref;
const notifications = ref<TeamNotification[]>([]);
const loading = ref(false);
const markingAll = ref(false);
const reachedEnd = ref(false);

const hasUnread = computed(() => notifications.value.some(item => !item.read));

interface NotificationGroup {
  key: string;
  notifications: TeamNotification[];
  latest: TeamNotification;
  puzzle: boolean;
  read: boolean;
  actor: string;
}

function isPuzzleNotification(notification: TeamNotification) {
  return Boolean(notification.data.puzzle_id);
}

function notificationThreadKey(notification: TeamNotification) {
  return `${isPuzzleNotification(notification) ? 'puzzle' : 'dm'}:${notification.data.ticket_id}`;
}

function createNotificationGroup(notification: TeamNotification, key: string): NotificationGroup {
  return {
    key,
    notifications: [notification],
    latest: notification,
    puzzle: isPuzzleNotification(notification),
    read: notification.read,
    actor: '',
  };
}

function resolveGroupActor(group: NotificationGroup) {
  const actors = new Map(group.notifications.map(item => [item.actor?.id ?? `unknown-${item.actor?.nickname ?? ''}`, item.actor?.nickname || t('common.unknownStaff')]));
  return actors.size === 1 ? [...actors.values()][0]! : t('common.multipleStaff');
}

function readNotificationGroupKey(notification: TeamNotification) {
  return `read:${notificationThreadKey(notification)}:${notification.read_at ?? notification.id}`;
}

const notificationGroups = computed<NotificationGroup[]>(() => {
  const groups: NotificationGroup[] = [];
  const unreadGroups = new Map<string, NotificationGroup>();
  const readGroups = new Map<string, NotificationGroup>();

  for (const notification of notifications.value) {
    const threadKey = notificationThreadKey(notification);

    if (notification.read) {
      unreadGroups.delete(threadKey);
      const readGroupKey = readNotificationGroupKey(notification);
      const readGroup = readGroups.get(readGroupKey);
      if (readGroup) {
        readGroup.notifications.push(notification);
      } else {
        const newGroup = createNotificationGroup(notification, readGroupKey);
        groups.push(newGroup);
        readGroups.set(readGroupKey, newGroup);
      }
      continue;
    }

    const group = unreadGroups.get(threadKey);
    if (group) {
      group.notifications.push(notification);
      continue;
    }

    const newGroup = createNotificationGroup(notification, `unread:${threadKey}:${notification.id}`);
    groups.push(newGroup);
    unreadGroups.set(threadKey, newGroup);
  }

  for (const group of groups) {
    group.actor = resolveGroupActor(group);
  }

  return groups;
});

async function load(reset = false) {
  if (!game.value?.id || loading.value) return;
  loading.value = true;
  try {
    const before = reset ? undefined : notifications.value.at(-1)?.id;
    const query: Record<string, number> = { limit: pageSize };
    if (before !== undefined) query.before = before;
    const { data } = await api.get<TeamNotification[]>(`/games/${game.value.id}/notifications`, { query });
    notifications.value = reset ? data : [...notifications.value, ...data];
    reachedEnd.value = data.length < pageSize;
    emit('updated', Date.now());
  } catch (error) {
    handleError(error, t('notifications.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function reload() {
  reachedEnd.value = false;
  await load(true);
}

async function openNotification(group: NotificationGroup) {
  if (!game.value?.id) return;
  const unreadIds = group.notifications.filter(item => !item.read).map(item => item.id);
  if (unreadIds.length > 0) {
    try {
      await api.post(`/games/${game.value.id}/notifications/read`, { notification_ids: unreadIds });
      const readAt = new Date().toISOString();
      group.notifications.forEach(item => {
        item.read = true;
        item.read_at = readAt;
      });
      await useNotificationUnread().refresh();
    } catch (error) {
      handleError(error, t('notifications.markReadFailed'));
      return;
    }
  }
  await navigateTo(group.puzzle ? `/tickets/${group.latest.data.ticket_id}` : `/games/${game.value.id}/ticket`);
}

async function markAllRead() {
  if (!game.value?.id || markingAll.value) return;
  markingAll.value = true;
  try {
    await api.post(`/games/${game.value.id}/notifications/read-all`);
    const readAt = new Date().toISOString();
    notifications.value.forEach(item => {
      if (!item.read) {
        item.read = true;
        item.read_at = readAt;
      }
    });
    await useNotificationUnread().refresh();
  } catch (error) {
    handleError(error, t('notifications.markReadFailed'));
  } finally {
    markingAll.value = false;
  }
}

function title(notification: TeamNotification) {
  return notification.data.puzzle_id ? `${notification.data.puzzle_title} #${notification.data.ticket_id}` : t('message.title');
}

function groupTitle(group: NotificationGroup) {
  if (group.notifications.length === 1) return title(group.latest);
  return title(group.latest);
}

function groupDescription(group: NotificationGroup) {
  const key = group.puzzle ? 'ticket' : 'message';
  if (group.notifications.length === 1) return t(`${key}.notificationReply`, { actor: group.actor });
  return t(`${key}.notificationReplies`, { actor: group.actor, count: group.notifications.length });
}

watch(game, () => reload(), { immediate: true });

useSync().listen(SyncMessageType.NotificationUpdated, ({ data }) => {
  if (data.game_id === game.value?.id && data.team_id === team.value?.id) reload();
});

defineExpose({ reload });
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="notifications.length" class="flex justify-end">
      <u-button :label="t('common.allRead')" icon="material-symbols:done-all-rounded" color="neutral" variant="ghost" size="sm" :disabled="!hasUnread" :loading="markingAll" @click="markAllRead" />
    </div>

    <u-card v-if="notifications.length" variant="subtle" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <button v-for="group in notificationGroups" :key="group.key" type="button" class="flex w-full items-start gap-3 p-4 sm:p-5 text-left transition-colors hover:bg-elevated/50 cursor-pointer" @click="openNotification(group)">
          <span class="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-elevated text-info">
            <u-icon :name="group.puzzle ? 'material-symbols:near-me-outline-rounded' : 'material-symbols:mail-outline-rounded'" class="size-5" />
            <span v-if="!group.read" class="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-error ring-2 ring-default" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-highlighted">{{ groupTitle(group) }}</span>
              <u-badge v-if="!group.read" size="sm" color="error" variant="soft">{{ t('common.unread') }}</u-badge>
            </span>
            <span class="mt-1 block text-xs text-muted sm:hidden">{{ formatDate(group.latest.ctime_at) }}</span>
            <span class="mt-1 block text-sm text-toned">
              <u-badge size="sm" color="warning" variant="soft" class="mr-1 align-middle mb-0.5">{{ t('common.staff') }}</u-badge>
              {{ groupDescription(group) }}
            </span>
          </span>
          <span class="flex shrink-0 flex-col items-end gap-1">
            <u-icon name="material-symbols:chevron-right-rounded" class="size-5 text-muted" />
            <span class="hidden whitespace-nowrap text-xs text-muted sm:block">{{ formatDate(group.latest.ctime_at) }}</span>
          </span>
        </button>
      </div>
    </u-card>

    <u-empty v-else-if="!loading" :title="t('common.noNotifications')" icon="material-symbols:notifications-off-outline-rounded" />

    <div class="flex justify-center">
      <u-button v-if="!reachedEnd && notifications.length" :label="t('common.loadMore')" color="neutral" variant="soft" :loading="loading" @click="load(false)" />
      <u-icon v-else-if="loading" name="svg-spinners:180-ring-with-bg" class="size-6 text-muted" />
    </div>
  </div>
</template>
