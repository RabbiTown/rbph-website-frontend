<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui';

const { t } = useI18n();
const props = withDefaults(
  defineProps<{
    items: TicketThreadItem[];
    currency?: Record<number, Pick<RbTeamCurrency, 'name' | 'prec'>>;
    canViewLocked?: boolean;
    unlockable?: boolean;
    unlockLoading?: boolean;
    showHistoryGap?: boolean;
    historyLoading?: boolean;
    historyGapIndex?: number;
  }>(),
  {
    currency: () => ({}),
    canViewLocked: false,
    unlockable: false,
    unlockLoading: false,
    showHistoryGap: false,
    historyLoading: false,
    historyGapIndex: 1,
  },
);

const emit = defineEmits<{
  unlock: [message: TicketMessage];
  loadHistory: [];
}>();

interface TicketTimelineItem extends TimelineItem {
  username: string;
  date: string;
  action: string;
  senderType: RbTicketSenderType;
  message?: TicketMessage;
  gap?: boolean;
}

const actionMeta: Record<RbTicketOperationAction, { icon: string; action: string }> = {
  [RbTicketOperationAction.Open]: { icon: 'material-symbols:add-circle-outline-rounded', action: t('ticket.opened') },
  [RbTicketOperationAction.Close]: { icon: 'material-symbols:check-rounded', action: t('ticket.closedAction') },
  [RbTicketOperationAction.AutoCloseSolved]: { icon: 'material-symbols:check-rounded', action: t('ticket.autoClosedSolved') },
};

const timelineItems = computed<TicketTimelineItem[]>(() => {
  const items = props.items.map(item => {
    if (isTicketMessage(item)) {
      return {
        username: item.sender.nickname,
        date: item.ctime_at,
        action: t('ticket.sentMessage'),
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
  });
  if (props.showHistoryGap && items.length > 0) {
    items.splice(Math.min(props.historyGapIndex, items.length), 0, {
      username: '',
      date: '',
      action: '',
      icon: 'material-symbols:more-horiz',
      senderType: RbTicketSenderType.Team,
      gap: true,
    });
  }
  return items;
});

function costText(message: TicketMessage) {
  if (message.cost_id === null || message.cost_id === undefined) return '';
  const currency = props.currency[message.cost_id];
  return `${currency?.name ?? t('ticket.currencyFallback', { id: message.cost_id })} ${intPrecString(-message.cost_amount, currency?.prec ?? 0, true, ' ')}`;
}

</script>

<template>
  <u-timeline :items="timelineItems" :ui="{ date: 'float-end ms-1' }" class="w-full" color="success">
    <template #title="{ item }">
      <u-button v-if="item.gap" :loading="historyLoading" color="neutral" variant="soft" size="sm" icon="material-symbols:unfold-more-rounded" :label="t('ticket.loadingEarlier')" @click="emit('loadHistory')" />
      <template v-else>
        <u-badge v-if="item.senderType === RbTicketSenderType.Host" variant="soft" color="warning" class="me-2">{{ t('ticket.staffMember') }}</u-badge>
        <span class="me-1">{{ item.username }}</span>
        <span class="font-normal text-muted">&nbsp;{{ item.action }}</span>
      </template>
    </template>
    <template #date="{ item }">
      {{ item.gap ? '' : formatDate(item.date) }}
    </template>
    <template #description="{ item }">
      <div v-if="item.message && (item.message.content !== undefined || (item.message.cost_id !== null && item.message.cost_id !== undefined))" class="px-4 py-4 ring ring-default mt-2 rounded-md text-default">
        <rbph-content v-if="item.message.content !== undefined" :content="item.message as RbContent" />
        <div v-else class="flex items-center gap-2">
          {{ t('ticket.locked') }}
          <u-popover v-if="unlockable" arrow>
            <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-outline">{{ t('ticket.unlockCost', { cost: costText(item.message) }) }}</u-button>
            <template #content>
              <div class="py-2 px-4 text-xs">
                <u-icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle" />
                <span> {{ t('ticket.unlockMessage') }} </span>
                <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="emit('unlock', item.message)">{{ t('ticket.unlock') }}</u-button>
              </div>
            </template>
          </u-popover>
        </div>
        <div v-if="item.message.cost_id !== null && item.message.cost_id !== undefined" class="flex justify-end">
          <u-badge v-if="item.message.unlocked" class="mt-2" color="success" variant="soft" icon="material-symbols:lock-open-right-outline-rounded">{{ t('ticket.unlockedCost', { cost: costText(item.message) }) }}</u-badge>
          <u-popover v-else-if="canViewLocked && unlockable" class="mt-2" arrow>
            <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-outline">{{ t('ticket.notUnlockedCost', { cost: costText(item.message) }) }}</u-button>
            <template #content>
              <div class="py-2 px-4 text-xs">
                <u-icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle" />
                <span class="mx-1"> {{ t('ticket.unlockForTeam') }} </span>
                <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="emit('unlock', item.message)">{{ t('ticket.unlock') }}</u-button>
              </div>
            </template>
          </u-popover>
          <u-badge v-else-if="canViewLocked" class="mt-2" color="error" variant="soft" icon="material-symbols:lock-outline">{{ t('ticket.notUnlockedCost', { cost: costText(item.message) }) }}</u-badge>
        </div>
      </div>
    </template>
  </u-timeline>
</template>
