<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui';

const props = withDefaults(
  defineProps<{
    items: TicketThreadItem[];
    currency?: Record<number, Pick<RbTeamCurrency, 'name' | 'prec'>>;
    canViewLocked?: boolean;
    unlockable?: boolean;
    unlockLoading?: boolean;
  }>(),
  {
    currency: () => ({}),
    canViewLocked: false,
    unlockable: false,
    unlockLoading: false,
  },
);

const emit = defineEmits<{
  unlock: [message: TicketMessage];
}>();

interface TicketTimelineItem extends TimelineItem {
  username: string;
  date: string;
  action: string;
  senderType: RbTicketSenderType;
  message?: TicketMessage;
}

const actionMeta: Record<RbTicketOperationAction, { icon: string; action: string }> = {
  [RbTicketOperationAction.Open]: { icon: 'material-symbols:add-circle-outline-rounded', action: '请求了人工提示' },
  [RbTicketOperationAction.Close]: { icon: 'material-symbols:check-rounded', action: '关闭了人工提示' },
  [RbTicketOperationAction.AutoCloseSolved]: { icon: 'material-symbols:check-rounded', action: '解出了谜题，人工提示自动关闭' },
};

const timelineItems = computed<TicketTimelineItem[]>(() =>
  props.items.map(item => {
    if (isTicketMessage(item)) {
      return {
        username: item.sender.nickname,
        date: item.ctime_at,
        action: '发送了消息',
        icon: 'material-symbols:chat-outline-rounded',
        senderType: item.sender_type,
        message: item,
      };
    }
    return {
      username: item.actor.nickname,
      date: item.ctime_at,
      action: actionMeta[item.action].action,
      icon: actionMeta[item.action].icon,
      senderType: item.actor_type,
      message: item.message,
    };
  }),
);

function costText(message: TicketMessage) {
  if (message.cost_id === null || message.cost_id === undefined) return '';
  const currency = props.currency[message.cost_id];
  return `${currency?.name ?? `货币 #${message.cost_id}`} ${intPrecString(-message.cost_amount, currency?.prec ?? 0, true, ' ')}`;
}
</script>

<template>
  <u-timeline :items="timelineItems" :ui="{ date: 'float-end ms-1' }" class="w-full" color="success">
    <template #title="{ item }">
      <u-badge v-if="item.senderType === RbTicketSenderType.Host" variant="soft" color="warning" class="me-2">工作人员</u-badge>
      <span class="me-1">{{ item.username }}</span>
      <span class="font-normal text-muted">&nbsp;{{ item.action }}</span>
    </template>
    <template #date="{ item }">
      {{ formatDate(item.date) }}
    </template>
    <template #description="{ item }">
      <div v-if="item.message && (item.message.content !== undefined || (item.message.cost_id !== null && item.message.cost_id !== undefined))" class="px-4 py-4 ring ring-default mt-2 rounded-md text-default">
        <rbph-content v-if="item.message.content !== undefined" :content="item.message as RbContent" />
        <div v-else class="flex items-center gap-2">
          这条消息已被锁定……
          <u-popover v-if="unlockable" arrow>
            <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-outline">解锁：{{ costText(item.message) }}</u-button>
            <template #content>
              <div class="py-2 px-4 text-xs">
                <u-icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle" />
                <span> 确定要解锁这条消息吗？ </span>
                <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="emit('unlock', item.message)">解锁</u-button>
              </div>
            </template>
          </u-popover>
        </div>
        <div v-if="item.message.cost_id !== null && item.message.cost_id !== undefined" class="flex justify-end">
          <u-badge v-if="item.message.unlocked" class="mt-2" color="success" variant="soft" icon="material-symbols:lock-open-right-outline-rounded">已解锁：{{ costText(item.message) }}</u-badge>
          <u-popover v-else-if="canViewLocked && unlockable" class="mt-2" arrow>
            <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-outline">未解锁：{{ costText(item.message) }}</u-button>
            <template #content>
              <div class="py-2 px-4 text-xs">
                <u-icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle" />
                <span> 为该队伍免费解锁这条消息？ </span>
                <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="emit('unlock', item.message)">解锁</u-button>
              </div>
            </template>
          </u-popover>
          <u-badge v-else-if="!item.message.unlocked" class="mt-2" color="error" variant="soft" icon="material-symbols:lock-outline">未解锁：{{ costText(item.message) }}</u-badge>
        </div>
      </div>
    </template>
  </u-timeline>
</template>
