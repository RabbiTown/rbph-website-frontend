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
  unlockDue: [];
}>();
const currentTime = useCurrentTimeSec();
const emittedDue = new Set<number>();

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
  const items: TicketTimelineItem[] = props.items.map((item): TicketTimelineItem => {
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

function unlockRemaining(message: TicketMessage) {
  if (!message.unlock_at) return 0;
  return Math.max(0, Date.parse(message.unlock_at) - currentTime.value);
}

function isCooling(message: TicketMessage) {
  return unlockRemaining(message) > 0;
}

watch(currentTime, () => {
  let due = false;
  for (const item of props.items) {
    const message = isTicketMessage(item) ? item : item.message;
    if (!message?.unlock_at || message.unlocked || emittedDue.has(message.id)) continue;
    if (Date.parse(message.unlock_at) <= currentTime.value) {
      emittedDue.add(message.id);
      due = true;
    }
  }
  if (due) emit('unlockDue');
});

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
      <div v-if="item.message && (item.message.content !== undefined || item.message.unlock_at || (item.message.cost_id !== null && item.message.cost_id !== undefined))" class="px-4 py-4 ring ring-default mt-2 rounded-md text-default">
        <rbph-content v-if="item.message.content !== undefined" :content="item.message as RbContent" />
        <div v-else class="flex flex-wrap items-center gap-2">
          <u-badge v-if="isCooling(item.message)" size="md" color="warning" variant="soft" icon="material-symbols:timer-outline-rounded">
            {{ t('ticket.unlocksIn', { time: formatTime(unlockRemaining(item.message)) }) }}
          </u-badge>
          <u-badge
            v-if="isCooling(item.message) && item.message.cost_id !== null && item.message.cost_id !== undefined"
            size="md"
            color="error"
            variant="soft"
            icon="material-symbols:lock-open-right-outline-rounded"
          >
            {{ t('ticket.unlockCost', { cost: costText(item.message) }) }}
          </u-badge>
          <u-popover v-else-if="unlockable && item.message.cost_id !== null && item.message.cost_id !== undefined" arrow>
            <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-open-right-outline-rounded">{{ t('ticket.unlockCost', { cost: costText(item.message) }) }}</u-button>
            <template #content>
              <div class="py-2 px-4 text-xs">
                <u-icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle me-1" />
                <span class="mx-1"> {{ t('ticket.unlockMessage') }} </span>
                <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="emit('unlock', item.message)">{{ t('ticket.unlock') }}</u-button>
              </div>
            </template>
          </u-popover>
          <u-badge
            v-else-if="item.message.cost_id !== null && item.message.cost_id !== undefined"
            size="md"
            color="error"
            variant="soft"
            icon="material-symbols:lock-open-right-outline-rounded"
          >
            {{ t('ticket.unlockCost', { cost: costText(item.message) }) }}
          </u-badge>
        </div>
        <div
          v-if="item.message.content !== undefined && item.message.cost_id !== null && item.message.cost_id !== undefined"
          class="mt-2 flex flex-wrap justify-end gap-2"
        >
          <u-badge v-if="item.message.unlocked" size="md" color="success" variant="soft" icon="material-symbols:lock-open-right-outline-rounded">{{ t('ticket.unlockedCost', { cost: costText(item.message) }) }}</u-badge>
          <template v-else>
            <u-badge v-if="isCooling(item.message)" size="md" color="warning" variant="soft" icon="material-symbols:timer-outline-rounded">
              {{ t('ticket.unlocksIn', { time: formatTime(unlockRemaining(item.message)) }) }}
            </u-badge>
            <u-badge v-if="isCooling(item.message)" size="md" color="error" variant="soft" icon="material-symbols:lock-open-right-outline-rounded">
              {{ t('ticket.unlockCost', { cost: costText(item.message) }) }}
            </u-badge>
          </template>
          <u-popover v-if="!item.message.unlocked && !isCooling(item.message) && canViewLocked && unlockable" arrow>
            <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-open-right-outline-rounded">{{ t('ticket.unlockCost', { cost: costText(item.message) }) }}</u-button>
            <template #content>
              <div class="py-2 px-4 text-xs">
                <u-icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle" />
                <span class="mx-1"> {{ t('ticket.unlockForTeam') }} </span>
                <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="emit('unlock', item.message)">{{ t('ticket.unlock') }}</u-button>
              </div>
            </template>
          </u-popover>
          <u-badge
            v-else-if="!item.message.unlocked && !isCooling(item.message)"
            size="md"
            color="error"
            variant="soft"
            icon="material-symbols:lock-open-right-outline-rounded"
          >
            {{ t('ticket.unlockCost', { cost: costText(item.message) }) }}
          </u-badge>
        </div>
        <div v-else-if="item.message.content !== undefined && item.message.unlock_at" class="mt-2 flex justify-end">
          <u-badge size="md" :color="item.message.unlocked ? 'success' : 'warning'" variant="soft" icon="material-symbols:timer-outline-rounded">
            {{ item.message.unlocked ? formatTime(item.message.unlock_after_seconds * 1000) : t('ticket.unlocksIn', { time: formatTime(unlockRemaining(item.message)) }) }}
          </u-badge>
        </div>
      </div>
    </template>
  </u-timeline>
</template>
