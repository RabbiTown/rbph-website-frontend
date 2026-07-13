<script setup lang="ts">
import type { SelectItem, TabsItem } from '@nuxt/ui';
import type { BreadcrumbItem } from '@nuxt/ui/runtime/components/Breadcrumb.vue.js';

definePageMeta({
  layout: 'game',
});

useUser().required();
const user = useUser().ref;
const { t } = useI18n();

const api = useApi();
const route = useRoute();
const toast = useToast();

const game = useGame().ref;

const pageData = ref<TicketThread>();
const historyGapIndex = ref(1);
const ticket = computed(() => pageData.value?.ticket);
const teamBanned = computed(() => ticket.value?.team?.state === RbTeamState.Banned);
const sendBlock = computed(() => {
  const block = pageData.value?.perm.send_block;
  return block ? sendBlockConsts[block] : undefined;
});
const canSend = computed(() => canSendTicket(pageData.value?.perm));
const draftContentType = ref(RbContentType.UnsafeMarkdown);

const ticket_id = computed(() => route.params.id as string);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: `${t('ticket.title')} #${ticket_id.value}` }, { text: game.value?.title, sep: ' - ' }])),
});

async function updateData(new_id: string | undefined = undefined) {
  const id = new_id ? parseInt(new_id) : ticket.value?.id || NaN;
  if (isNaN(id)) throw 'Invalid ticket id';

  try {
    const { data } = await useApi().get<TicketThread>(`/tickets/${id}`);
    pageData.value = data;
    historyGapIndex.value = 1;

    if (data.ticket?.game_id) {
      updateGameState(data.ticket.game_id.toString());
    }
  } catch (error) {
    showError(error instanceof Error ? error : String(error));
  }
}

const historyLoading = ref(false);

async function loadHistory() {
  const after = pageData.value?.history.after;
  if (!after || historyLoading.value) return;
  historyLoading.value = true;
  try {
    const { data } = await api.get<TicketThread>(`/tickets/${ticket_id.value}`, {
      query: { after, stop: pageData.value?.history.stop },
    });
    if (pageData.value) {
      const previousLength = pageData.value.messages.length;
      const messages = mergeTicketThreadItems(pageData.value.messages, data.messages);
      historyGapIndex.value += messages.length - previousLength;
      pageData.value = {
        ...pageData.value,
        messages,
        history: {
          ...pageData.value.history,
          after: data.history.after,
          has_more: data.history.has_more,
        },
      };
    }
  } catch (error) {
    handleError(error, t('ticket.loadEarlierFailed'));
  } finally {
    historyLoading.value = false;
  }
}

async function loadNewer() {
  const newer = pageData.value?.history.newer;
  if (!newer) return updateData(ticket_id.value);
  try {
    const { data } = await api.get<TicketThread>(`/tickets/${ticket_id.value}`, { query: { after: newer } });
    if (pageData.value) {
      pageData.value = {
        ...pageData.value,
        ticket: data.ticket,
        perm: data.perm,
        messages: mergeTicketThreadItems(pageData.value.messages, data.messages),
        history: { ...pageData.value.history, newer: data.history.newer ?? pageData.value.history.newer },
      };
    }
  } catch (error) {
    handleError(error, t('ticket.updateFailed'));
  }
}

watch(
  ticket_id,
  async new_id => {
    updateData(new_id).catch(e => showError({ status: 400, statusText: e }));
  },
  { immediate: true },
);

useSync().listen(SyncMessageType.TicketUpdated, ({ data }) => {
  if (data.actor_id === user.value?.id && (data.event === 'assigned' || data.event === 'unassigned')) return;
  if (data.ticket_id === Number(ticket_id.value)) loadNewer();
});

const breadItems = computed<BreadcrumbItem[]>(() => [
  {
    label: ticket.value?.puzzle?.round.title,
    to: ticket.value?.game_id && ticket.value?.puzzle ? gameRoundSimpleRoute(ticket.value.game_id, ticket.value.puzzle.round) : undefined,
    icon: 'material-symbols:grid-view-outline-rounded',
  },
  {
    label: ticket.value?.puzzle?.title,
    to: ticket.value?.game_id && ticket.value?.puzzle ? gamePuzzleSimpleRoute(ticket.value.game_id, ticket.value.puzzle, 'tickets') : undefined,
    icon: 'material-symbols:extension-outline-rounded',
  },
  {
    label: `${t('ticket.title')} #${ticket.value?.id}`,
    to: `/tickets/${ticket.value?.id}`,
    icon: 'material-symbols:near-me-outline-rounded',
  },
]);

const submitLoading = ref(false);
const unlockLoading = ref(false);
const assigneeLoading = ref(false);
const assigneeConfirmOpen = ref(false);
const assigneeActionButtonClass = 'group grid h-6 max-w-full cursor-pointer overflow-hidden px-0 text-xs';
const assigneeActionNormalClass = 'col-start-1 row-start-1 inline-flex items-center justify-center gap-1 px-1.5 transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-0';
const assigneeActionHoverClass = 'col-start-1 row-start-1 inline-flex translate-y-1 items-center justify-center gap-1 px-1.5 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100';

const draftMessage = ref('');
async function submitMessage(senderType: RbTicketSenderType, forceAssignee = false) {
  if (senderType === RbTicketSenderType.Team && !canSend.value) return;
  if (senderType === RbTicketSenderType.Host && !pageData.value?.perm.can_host) return;

  submitLoading.value = true;

  const ticketId = ticket.value?.id;
  if (ticketId) {
    try {
      const payload = {
        content: draftMessage.value,
        content_type: draftContentType.value,
        sender_type: senderType,
        cost_id: senderType === RbTicketSenderType.Host ? reqCurrencyId.value : null,
        cost_amount: senderType === RbTicketSenderType.Host ? reqCurrencyAmount.value : 0,
        force_assignee: forceAssignee,
      } satisfies TicketSendRequest;
      const { code, data } = await api.post<TicketSendResponse>(`/tickets/${ticketId}/send`, payload, {
        errorHints: {
          [-1]: t('ticket.closedMessage'),
          [-2]: t('ticket.pendingOverflow'),
          [-3]: t('ticket.sendBlockType'),
          [-4]: t('ticket.sendBlockLength'),
          [-5]: t('ticket.sendBlockCost'),
          [-8]: t('ticket.featureClosed'),
          [-9]: t('ticket.teamFeatureBanned'),
        },
      });
      draftMessage.value = '';

      if (code === 0) {
        const hostReply = senderType === RbTicketSenderType.Host;
        toast.add({
          title: hostReply ? t('ticket.repliedByStaff') : t('ticket.repliedByTeam'),
          description: hostReply ? t('ticket.repliedByStaffDesc') : t('ticket.repliedByTeamDesc'),
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        const perm = data.perm ??
          pageData.value?.perm ?? {
            send_block: RbTicketSendBlock.Ok,
            can_host: false,
            can_view_locked: false,
            content_type: [RbContentType.UnsafeMarkdown],
            currency: [],
          };
        pageData.value = {
          ticket: data.ticket ?? pageData.value?.ticket,
          messages: mergeTicketThreadItems(pageData.value?.messages ?? [], [data.msg]),
          history: pageData.value?.history ?? { has_more: false },
          perm,
        };
        draftContentType.value = getDefaultTicketContentType(perm);
      }
    } catch (error) {
      const assignee = (error as { data?: { payload?: { assignee?: { nickname: string } } } }).data?.payload?.assignee;
      if (senderType === RbTicketSenderType.Host && !forceAssignee && assignee && window.confirm(t('ticket.assigneeAlready', { name: assignee.nickname }))) {
        submitLoading.value = false;
        return submitMessage(senderType, true);
      }
      handleError(error, t('ticket.sendFailed'));
    }
  }

  submitLoading.value = false;
}

function submitTeamMessage() {
  return submitMessage(RbTicketSenderType.Team);
}

function submitHostMessage() {
  return submitMessage(RbTicketSenderType.Host);
}

async function assignSelf(force = false) {
  if (!ticket.value?.id || assigneeLoading.value) return;
  assigneeLoading.value = true;
  try {
    const { data } = await api.post<TicketAssignResponse>(`/tickets/${ticket.value.id}/assignee/self`, { force }, { errorHints: { [-7]: t('ticket.claimConflict') } });
    ticket.value.assignee = data.assignee ?? undefined;
    assigneeConfirmOpen.value = false;
  } catch (error) {
    const assignee = (error as { data?: { payload?: { assignee?: { id: number; nickname: string; email?: string } } } }).data?.payload?.assignee;
    if (!force && assignee) {
      ticket.value.assignee = assignee;
      assigneeConfirmOpen.value = true;
      return;
    }
    handleError(error, t('ticket.claimFailed'));
  } finally {
    assigneeLoading.value = false;
  }
}

async function unassign() {
  if (!ticket.value?.id || assigneeLoading.value) return;
  assigneeLoading.value = true;
  try {
    await api.del(`/tickets/${ticket.value.id}/assignee`);
    ticket.value.assignee = undefined;
  } catch (error) {
    handleError(error, t('ticket.unclaimFailed'));
  } finally {
    assigneeLoading.value = false;
  }
}

async function submitClose(forceAssignee = false) {
  if (!pageData.value?.perm.can_host) return;

  submitLoading.value = true;

  const ticketId = ticket.value?.id;
  if (ticketId) {
    try {
      const payload = {
        content: draftMessage.value,
        content_type: draftContentType.value,
        sender_type: RbTicketSenderType.Host,
        cost_id: reqCurrencyId.value,
        cost_amount: reqCurrencyAmount.value,
        force_assignee: forceAssignee,
      } satisfies TicketSendRequest;
      const { data } = await api.post<TicketCloseResponse>(`/tickets/${ticketId}/close`, payload);
      draftMessage.value = '';

      toast.add({
        title: t('ticket.closedToast'),
        description: t('ticket.closedToastDesc'),
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      pageData.value = {
        ticket: data.ticket ?? pageData.value?.ticket,
        messages: mergeTicketThreadItems(pageData.value?.messages ?? [], data.thread.messages),
        history: pageData.value?.history ?? data.thread.history,
        perm: data.perm ??
          pageData.value?.perm ?? {
            send_block: RbTicketSendBlock.Ok,
            can_host: false,
            can_view_locked: false,
            content_type: [RbContentType.UnsafeMarkdown],
          },
      };
      draftContentType.value = getDefaultTicketContentType(pageData.value.perm);
    } catch (error) {
      const assignee = (error as { data?: { payload?: { assignee?: { nickname: string } } } }).data?.payload?.assignee;
      if (!forceAssignee && assignee && window.confirm(t('ticket.closeConfirm', { name: assignee.nickname }))) {
        submitLoading.value = false;
        return submitClose(true);
      }
      handleError(error, t('ticket.closeFailed'));
    }
  }

  submitLoading.value = false;
}

async function unlockMessage(message: TicketMessage) {
  if (!pageData.value?.perm.can_view_locked && pageData.value?.perm.send_block === RbTicketSendBlock.NoAccess) return;
  if (message.sender_type !== RbTicketSenderType.Host || message.unlocked || message.cost_id === null || message.cost_id === undefined) return;

  unlockLoading.value = true;

  const ticketId = ticket.value?.id;
  if (ticketId) {
    try {
      const { data } = await api.post<TicketUnlockResponse>(`/tickets/${ticketId}/messages/${message.id}/purchase`, undefined, {
        errorHints: {
          [-2]: t('ticket.insufficientBalance'),
          [-1]: t('ticket.unavailableOrPurchased'),
        },
      });
      const messages =
        pageData.value?.messages.map(item => {
          if (isTicketMessage(item) && item.id === data.id) {
            return { ...item, ...data, unlocked: true } as TicketMessage;
          }
          return item;
        }) ?? [];
      pageData.value = {
        ...pageData.value!,
        messages,
      };
      toast.add({
        title: t('ticket.unlockedToast'),
        description: t('ticket.unlockedToastDesc'),
        icon: 'material-symbols:lock-open-right-outline-rounded',
        color: 'success',
      });
    } catch (error) {
      handleError(error, t('ticket.unlockFailed'));
    }
  }

  unlockLoading.value = false;
}

interface SendBlockConst {
  icon: string;
  color: 'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral' | undefined;
  title: string;
  teamRestriction?: boolean;
}

const sendBlockConsts: Partial<Record<RbTicketSendBlock, SendBlockConst>> = {
  [RbTicketSendBlock.NoAccess]: { icon: 'material-symbols:error-med-outline-rounded', color: 'error', title: t('ticket.noAccess') },
  [RbTicketSendBlock.Closed]: { icon: 'material-symbols:check-rounded', color: 'success', title: t('ticket.closed') },
  [RbTicketSendBlock.Pending]: { icon: 'material-symbols:more-horiz', color: 'warning', title: t('ticket.pending') },
  [RbTicketSendBlock.FeatureClosed]: { icon: 'material-symbols:lock-outline', color: 'warning', title: t('ticket.featureClosed') },
  [RbTicketSendBlock.FeatureExistingOnly]: { icon: 'material-symbols:history-rounded', color: 'warning', title: t('ticket.featureExistingOnly') },
  [RbTicketSendBlock.TeamFeatureBanned]: { icon: 'material-symbols:block-outline', color: 'error', title: t('ticket.teamFeatureBanned'), teamRestriction: true },
};

const tabItems = computed(
  () =>
    [
      ...(pageData.value?.perm.send_block !== RbTicketSendBlock.NoAccess
        ? [
            {
              label: t('ticket.asTeam'),
              icon: 'material-symbols:group-outline-rounded',
              slot: 'as-team' as const,
            },
          ]
        : []),
      ...(pageData.value?.perm.can_host
        ? [
            {
              label: t('ticket.asStaff'),
              icon: 'material-symbols:near-me-outline-rounded',
              slot: 'as-host' as const,
            },
          ]
        : []),
    ] satisfies TabsItem[],
);

const allowedCurrencyTypes = computed(() => pageData.value?.perm.currency ?? []);
const teamCurrency = computed(() => {
  const tc = pageData.value?.ticket?.team?.currency;
  const result: Record<number, RbTeamCurrency & { current: number }> = {};
  if (!tc) return result;
  for (const x of tc) {
    result[x.id] = {
      ...x,
      current: useCurrency().calcCurrent(x),
    };
  }
  return result;
});
const currencyTypeItems = computed(() => [
  { label: t('ticket.noUnlock'), value: null, icon: 'material-symbols:lock-open-right-outline-rounded' },
  ...allowedCurrencyTypes.value.map(id => {
    return { label: teamCurrency.value[id]?.name ?? `#${id}`, value: id, icon: 'material-symbols:emoji-objects-outline-rounded' } satisfies SelectItem;
  }),
]);
const reqCurrencyId = ref<number | null>(null);
const reqCurrencyAmount = ref(0);
const reqCurrencyType = computed(() => (reqCurrencyId.value === null ? undefined : teamCurrency.value[reqCurrencyId.value]));
</script>

<template>
  <div v-if="ticket" class="py-6">
    <u-breadcrumb class="mb-6" :items="breadItems" />
    <div class="mb-4">
      <rbph-currency-badges :currency="teamCurrency" />
    </div>
    <div>
      <div>
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="text-3xl font-bold">{{ t('ticket.title') }} </span>
          <span class="text-muted text-2xl">#{{ ticket?.id }}</span>
          <u-badge v-if="ticket?.state === RbTicketState.Open" class="rounded-full py-1.5 px-2.5" color="success" variant="subtle" icon="material-symbols:add-circle-outline-rounded">{{ t('ticket.open') }}</u-badge>
          <u-badge v-else-if="ticket?.state === RbTicketState.Closed" class="rounded-full py-1.5 px-2.5" color="error" variant="subtle" icon="material-symbols:check-circle-outline-rounded">{{ t('ticket.closedState') }}</u-badge>
        </div>

        <div v-if="pageData?.perm.can_host" class="mt-2 flex flex-wrap items-center gap-2">
          <u-button v-if="!ticket.assignee" :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft" :loading="assigneeLoading" @click="assignSelf()">
            <span :class="assigneeActionNormalClass">
              <u-icon name="material-symbols:person-off-outline-rounded" class="size-4 shrink-0" />
              <span>{{ t('ticket.unclaimed') }}</span>
            </span>
            <span :class="assigneeActionHoverClass">
              <u-icon name="material-symbols:person-add-outline-rounded" class="size-4 shrink-0" />
              <span>{{ t('ticket.claim') }}</span>
            </span>
          </u-button>

          <u-button v-else-if="ticket.assignee.id === user?.id" :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft" :loading="assigneeLoading" @click="unassign">
            <span :class="assigneeActionNormalClass">
              <u-avatar :src="ticket.assignee.avatar" :text="ticket.assignee.nickname" size="3xs" />
              <span class="min-w-0 truncate">{{ ticket.assignee.nickname }}</span>
            </span>
            <span :class="assigneeActionHoverClass">
              <u-icon name="material-symbols:person-remove-outline-rounded" class="size-4 shrink-0" />
              <span>{{ t('ticket.unclaim') }}</span>
            </span>
          </u-button>

          <u-popover v-else v-model:open="assigneeConfirmOpen" arrow>
            <u-button :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft">
              <span :class="assigneeActionNormalClass">
                <u-avatar :src="ticket.assignee.avatar" :text="ticket.assignee.nickname" size="3xs" />
                <span class="min-w-0 truncate">{{ ticket.assignee.nickname }}</span>
              </span>
              <span :class="assigneeActionHoverClass">
                <u-icon name="material-symbols:person-add-outline-rounded" class="size-4 shrink-0" />
                <span>{{ t('ticket.claim') }}</span>
              </span>
            </u-button>
            <template #content>
              <div class="flex items-center gap-2 px-4 py-2 text-xs">
                <u-icon name="material-symbols:warning-outline-rounded" />
                <span>{{ t('ticket.claimConfirm', { name: ticket.assignee.nickname }) }}</span>
                <u-button :loading="assigneeLoading" class="cursor-pointer" color="warning" variant="soft" size="xs" @click="assignSelf(true)">{{ t('common.confirm') }}</u-button>
              </div>
            </template>
          </u-popover>

          <rbph-team-access-menu
            v-if="ticket.team && ticket.game_id && pageData?.perm.can_host"
            :game-id="ticket.game_id"
            :team-id="ticket.team.id"
            :team-name="ticket.team.name"
          />
        </div>
      </div>

      <!-- <div class="mt-2 text-secondary ms-0.5 text-xs">
        <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
        {{ t('common.createdAt', { time: formatDate(ticket?.state.utime_at) }) }}
      </div> -->
    </div>
    <rbph-ticket-timeline
      :items="pageData?.messages ?? []"
      :currency="teamCurrency"
      :can-view-locked="pageData?.perm.can_view_locked"
      :unlock-loading="unlockLoading"
      :show-history-gap="Boolean(pageData?.history.has_more && pageData.history.after)"
      :history-loading="historyLoading"
      :history-gap-index="historyGapIndex"
      unlockable
      class="mt-6"
      @unlock="unlockMessage"
      @load-history="loadHistory"
    />

    <u-tabs :items="tabItems" variant="link" :ui="{ list: tabItems.length > 1 ? undefined : 'hidden' }">
      <template #as-team>
        <u-alert v-if="teamBanned && canSend" class="mb-2" variant="subtle" :title="t('ticket.teamBannedWarning')" icon="material-symbols:warning-outline-rounded" color="warning">
          <template #description>
            <i18n-t keypath="ticket.restrictionDetails" tag="span" class="whitespace-nowrap">
              <template #activity><u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" :label="t('nav.teamActivity')" class="p-0 align-middle mb-0.5" /></template>
            </i18n-t>
          </template>
        </u-alert>
        <rbph-message-edit
          v-if="canSend"
          v-model:draft="draftMessage"
          v-model:content-type="draftContentType"
          :placeholder="t('ticket.replyPlaceholder')"
          :content-types="pageData?.perm.content_type"
          :disabled="!canSend || submitLoading"
          :loading="!pageData || submitLoading"
          @submit="submitTeamMessage"
        />
        <u-alert v-if="sendBlock" variant="subtle" :title="sendBlock.title" :icon="sendBlock.icon" :color="sendBlock.color">
          <template v-if="sendBlock.teamRestriction" #description>
            <i18n-t keypath="ticket.restrictionDetails" tag="span" class="whitespace-nowrap">
              <template #activity><u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" :label="t('nav.teamActivity')" class="p-0 align-middle mb-0.5" /></template>
            </i18n-t>
          </template>
        </u-alert>
      </template>
      <template #as-host>
        <u-alert v-if="pageData?.ticket?.state === RbTicketState.Closed" class="mb-2" variant="subtle" :title="t('ticket.hostClosedTitle')" :description="t('ticket.hostClosedDesc')" icon="material-symbols:check-rounded" color="success" />
        <u-alert v-else class="mb-2" variant="subtle" :title="t('ticket.sendAsStaff')" :description="t('ticket.hostReplyDesc')" icon="material-symbols:near-me-outline-rounded" color="warning" />
        <rbph-message-edit
          v-model:draft="draftMessage"
          v-model:content-type="draftContentType"
          :placeholder="t('ticket.staffReplyPlaceholder')"
          :content-types="pageData?.perm.content_type"
          :disabled="submitLoading"
          :loading="!pageData || submitLoading"
          :can-close="pageData?.ticket?.state === RbTicketState.Open"
          @submit="submitHostMessage"
          @submit-close="submitClose"
        >
          <template #tool>
            <u-select v-if="currencyTypeItems.length > 0" v-model="reqCurrencyId" :items="currencyTypeItems" variant="soft" size="sm" class="w-40" />
            <rb-input-number v-if="reqCurrencyId !== null" v-model="reqCurrencyAmount" :prec="reqCurrencyType?.prec ?? 0" orientation="vertical" class="w-24" variant="soft" :step="10" />
          </template>
        </rbph-message-edit>
      </template>
    </u-tabs>
  </div>
</template>
