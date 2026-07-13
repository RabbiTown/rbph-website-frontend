<script setup lang="ts">
definePageMeta({ layout: 'game', middleware: 'staff' });

const { t } = useI18n();
const api = useApi();
const route = useRoute();
const user = useUser().ref;
const gameId = computed(() => Number(route.params.id));

const tickets = ref<TicketSummary[]>([]);
const selectedId = ref<number>();
const thread = ref<TicketThread>();
const listLoading = ref(false);
const listHasMore = ref(false);
const listScroll = ref<HTMLElement>();
const threadLoading = ref(false);
const threadHistoryLoading = ref(false);
const threadHistoryGapIndex = ref(1);
const submitLoading = ref(false);
const assigneeLoading = ref(false);
const assigneeConfirmOpen = ref(false);
const teamAccessMenu = ref<{ openEditor: () => void }>();
const currentTeamFeatureBanned = ref(false);
const sendConflictOpen = ref(false);
const sendConflictAssignee = ref<TicketAggreInfoUser>();
const sendConflictAction = ref<'send' | 'close'>();
const draft = ref('');
const contentType = ref(RbContentType.UnsafeMarkdown);
const assigneeActionButtonClass = 'group grid h-6 max-w-full cursor-pointer overflow-hidden px-0 text-xs';
const assigneeActionNormalClass = 'col-start-1 row-start-1 inline-flex items-center justify-center gap-1 px-1.5 transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-0';
const assigneeActionHoverClass = 'col-start-1 row-start-1 inline-flex translate-y-1 items-center justify-center gap-1 px-1.5 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100';

const teamCurrency = computed(() => {
  const currency = thread.value?.ticket?.team?.currency;
  const result: Record<number, RbTeamCurrency & { current: number }> = {};
  if (!currency) return result;
  for (const item of currency) {
    result[item.id] = {
      ...item,
      current: useCurrency().calcCurrent(item),
    };
  }
  return result;
});
const threadCurrency = computed(() => teamCurrency.value);
const allowedCurrencyTypes = computed(() => thread.value?.perm.currency ?? []);
const currencyTypeItems = computed(() => [
  { label: t('ticket.noUnlock'), value: null, icon: 'material-symbols:lock-open-right-outline-rounded' },
  ...allowedCurrencyTypes.value.map(id => ({ label: teamCurrency.value[id]?.name ?? `#${id}`, value: id, icon: 'material-symbols:emoji-objects-outline-rounded' })),
]);
const reqCurrencyId = ref<number | null>(null);
const reqCurrencyAmount = ref(0);
const reqCurrencyType = computed(() => (reqCurrencyId.value === null ? undefined : teamCurrency.value[reqCurrencyId.value]));
const sendConflictDescription = computed(() => {
  if (!sendConflictAssignee.value) return '';
  const action = sendConflictAction.value === 'close' ? t('pages.staffInbox.replyAndClose') : t('pages.staffInbox.continueReply');
  return t('pages.staffInbox.conflictDescription', { name: sendConflictAssignee.value.nickname, action });
});

const kind = ref((route.query.kind as string) || 'all');
const state = ref('open');
const waitingFor = ref('all');
const assigneeFilter = ref('all');
const puzzleId = computed(() => {
  const value = Number(route.query.puzzle_id);
  return Number.isFinite(value) && value > 0 ? value : undefined;
});

useHead({ titleTemplate: computed(() => buildTitleParts([{ text: t('pages.staffInbox.title') }, { text: useGame().ref.value?.title, sep: ' - ' }])) });

async function loadTickets(_silent = false, append = false) {
  if (!gameId.value || (append && (!listHasMore.value || listLoading.value))) return;
  listLoading.value = true;
  try {
    const { data } = await api.get<StaffTicketListResponse>(`/games/${gameId.value}/tickets/staff`, {
      query: {
        kind: kind.value,
        state: state.value,
        waiting_for: waitingFor.value,
        assignee: assigneeFilter.value,
        puzzle_id: puzzleId.value,
        limit: 50,
        offset: append ? tickets.value.length : 0,
      },
    });
    if (append) {
      const seen = new Set(tickets.value.map(ticket => ticket.id));
      tickets.value.push(...data.tickets.filter(ticket => !seen.has(ticket.id)));
    } else {
      tickets.value = data.tickets;
    }
    listHasMore.value = data.has_more;
  } catch (error) {
    handleError(error, t('pages.staffInbox.loadListFailed'));
  } finally {
    listLoading.value = false;
  }
}

function ticketEndpoint(ticketId: number) {
  const ticket = tickets.value.find(item => item.id === ticketId) ?? (thread.value?.ticket?.id === ticketId ? thread.value.ticket : undefined);
  return ticket && !ticket.puzzle ? `/games/${gameId.value}/tickets/staff/dm/tickets/${ticketId}` : `/tickets/${ticketId}`;
}

async function loadThread(ticketId = selectedId.value, silent = false, force = false) {
  if (!ticketId) return;
  if (!force && ticketId === selectedId.value && (threadLoading.value || thread.value?.ticket?.id === ticketId)) return;
  selectedId.value = ticketId;
  currentTeamFeatureBanned.value = false;
  if (!silent) threadLoading.value = true;
  try {
    const { data } = await api.get<TicketThread>(ticketEndpoint(ticketId));
    thread.value = data;
    threadHistoryGapIndex.value = 1;
    contentType.value = getDefaultTicketContentType(data.perm);
    reqCurrencyId.value = null;
    reqCurrencyAmount.value = 0;
  } catch (error) {
    handleError(error, t('pages.staffInbox.loadThreadFailed'));
  } finally {
    if (!silent) threadLoading.value = false;
  }
}

async function loadThreadHistory() {
  if (!selectedId.value || !thread.value?.history.has_more || threadHistoryLoading.value) return;
  const puzzle = Boolean(thread.value.ticket?.puzzle);
  const cursor = puzzle ? thread.value.history.after : thread.value.history.before;
  if (!cursor) return;
  threadHistoryLoading.value = true;
  try {
    const { data } = await api.get<TicketThread>(ticketEndpoint(selectedId.value), {
      query: puzzle ? { after: cursor, stop: thread.value.history.stop } : { before: cursor },
    });
    if (thread.value) {
      const previousLength = thread.value.messages.length;
      const messages = mergeTicketThreadItems(thread.value.messages, data.messages);
      if (puzzle) threadHistoryGapIndex.value += messages.length - previousLength;
      thread.value = {
        ...thread.value,
        messages,
        history: puzzle ? { ...thread.value.history, after: data.history.after, has_more: data.history.has_more } : { ...data.history, newer: thread.value.history.newer },
      };
    }
  } catch (error) {
    handleError(error, t('pages.staffInbox.loadEarlierFailed'));
  } finally {
    threadHistoryLoading.value = false;
  }
}

async function loadThreadNewer(ticketId: number) {
  if (ticketId !== selectedId.value || !thread.value) return;
  const newer = thread.value.history.newer;
  if (!newer) return loadThread(ticketId, true, true);
  try {
    const { data } = await api.get<TicketThread>(ticketEndpoint(ticketId), { query: { after: newer } });
    if (thread.value?.ticket?.id === ticketId) {
      thread.value = {
        ...thread.value,
        ticket: data.ticket,
        perm: data.perm,
        messages: mergeTicketThreadItems(thread.value.messages, data.messages),
        history: { ...thread.value.history, newer: data.history.newer ?? thread.value.history.newer },
      };
    }
  } catch (error) {
    handleError(error, t('pages.staffInbox.updateFailed'));
  }
}

const dmThreadItems = computed(() => (thread.value?.ticket?.puzzle ? [] : [...(thread.value?.messages ?? [])].reverse()));

watch([gameId, kind, state, waitingFor, assigneeFilter, puzzleId], () => loadTickets(), { immediate: true });

onMounted(() => {
  useInfiniteScroll(listScroll, () => loadTickets(true, true), {
    distance: 80,
    canLoadMore: () => listHasMore.value && !listLoading.value,
  });
  useInfiniteScroll(
    window,
    () => {
      if (thread.value?.ticket && !thread.value.ticket.puzzle) return loadThreadHistory();
    },
    {
      distance: 80,
      canLoadMore: () => Boolean(thread.value?.ticket && !thread.value.ticket.puzzle && thread.value.history.has_more) && !threadHistoryLoading.value,
    },
  );
});

function conflictAssignee(error: unknown): TicketAggreInfoUser | undefined {
  return (error as { data?: { payload?: { assignee?: { id: number; nickname: string } } } }).data?.payload?.assignee;
}

function ticketDisplayTitle(ticket: TicketSummary) {
  return ticket.puzzle
    ? t('pages.staffInbox.puzzleTicketIdentifier', { puzzle: ticket.puzzle.title, id: ticket.id })
    : t('pages.staffInbox.messageIdentifier', { id: ticket.id });
}

function openSendConflict(action: 'send' | 'close', assignee: TicketAggreInfoUser) {
  sendConflictAction.value = action;
  sendConflictAssignee.value = assignee;
  sendConflictOpen.value = true;
}

async function confirmSendConflict() {
  const action = sendConflictAction.value;
  if (action === 'send') await sendMessage(true);
  else if (action === 'close') await closeWithMessage(true);
  sendConflictOpen.value = false;
  sendConflictAction.value = undefined;
  sendConflictAssignee.value = undefined;
}

async function sendMessage(forceAssignee = false) {
  const ticketId = selectedId.value;
  if (!ticketId || !draft.value.trim()) return;
  const puzzle = Boolean(thread.value?.ticket?.puzzle);
  submitLoading.value = true;
  try {
    const { data } = await api.post<TicketSendResponse>(
      `${ticketEndpoint(ticketId)}/send`,
      {
        content: draft.value,
        content_type: contentType.value,
        sender_type: RbTicketSenderType.Host,
        cost_id: puzzle ? reqCurrencyId.value : null,
        cost_amount: puzzle ? reqCurrencyAmount.value : 0,
        force_assignee: forceAssignee,
      } satisfies TicketSendRequest,
      { errorHints: { [-7]: t('ticket.claimConflict') } },
    );
    draft.value = '';
    if (thread.value) {
      if (data.ticket) thread.value.ticket = data.ticket;
      thread.value.messages = mergeTicketThreadItems(thread.value.messages, [data.msg]);
    }
    await loadTickets(true);
  } catch (error) {
    const assignee = conflictAssignee(error);
    if (!forceAssignee && assignee) {
      openSendConflict('send', assignee);
      return;
    }
    handleError(error, t('pages.staffInbox.replyFailed'));
  } finally {
    submitLoading.value = false;
  }
}

async function closeWithMessage(forceAssignee = false) {
  const ticketId = selectedId.value;
  if (!ticketId || !thread.value?.ticket.puzzle || thread.value.ticket.state !== RbTicketState.Open) return;

  submitLoading.value = true;
  try {
    const { data } = await api.post<TicketCloseResponse>(
      `/tickets/${ticketId}/close`,
      {
        content: draft.value,
        content_type: contentType.value,
        sender_type: RbTicketSenderType.Host,
        cost_id: reqCurrencyId.value,
        cost_amount: reqCurrencyAmount.value,
        force_assignee: forceAssignee,
      } satisfies TicketSendRequest,
      { errorHints: { [-7]: t('ticket.claimConflict') } },
    );
    draft.value = '';
    if (thread.value) {
      thread.value = {
        ...data.thread,
        messages: mergeTicketThreadItems(thread.value.messages, data.thread.messages),
        history: thread.value.history,
      };
    } else {
      thread.value = data.thread;
    }
    await loadTickets(true);
  } catch (error) {
    const assignee = conflictAssignee(error);
    if (!forceAssignee && assignee) {
      openSendConflict('close', assignee);
      return;
    }
    handleError(error, t('ticket.closeFailed'));
  } finally {
    submitLoading.value = false;
  }
}

async function assignSelf(force = false) {
  if (!selectedId.value || assigneeLoading.value) return;
  assigneeLoading.value = true;
  try {
    const { data } = await api.post<TicketAssignResponse>(`${ticketEndpoint(selectedId.value)}/assignee/self`, { force }, { errorHints: { [-7]: t('ticket.claimConflict') } });
    if (thread.value?.ticket) thread.value.ticket.assignee = data.assignee ?? undefined;
    assigneeConfirmOpen.value = false;
    await loadTickets(true);
  } catch (error) {
    const assignee = conflictAssignee(error);
    if (!force && assignee) {
      assigneeConfirmOpen.value = true;
      return;
    }
    handleError(error, t('ticket.claimFailed'));
  } finally {
    assigneeLoading.value = false;
  }
}

async function unassign() {
  if (!selectedId.value || assigneeLoading.value) return;
  assigneeLoading.value = true;
  try {
    await api.del<TicketAssignResponse>(`${ticketEndpoint(selectedId.value)}/assignee`);
    if (thread.value?.ticket) thread.value.ticket.assignee = undefined;
    await loadTickets(true);
  } catch (error) {
    handleError(error, t('ticket.unclaimFailed'));
  } finally {
    assigneeLoading.value = false;
  }
}

const dmTeam = ref<number>();
const dmDraft = ref('');
const dmOpen = ref(false);

async function openDm() {
  dmOpen.value = true;
}

async function sendDm() {
  if (!dmTeam.value || !dmDraft.value.trim()) return;
  submitLoading.value = true;
  try {
    const { data } = await api.post<TicketSendResponse>(
      `/games/${gameId.value}/tickets/staff/dm/${dmTeam.value}/send`,
      {
        content: dmDraft.value,
        content_type: RbContentType.UnsafeMarkdown,
      },
      {
        errorHints: {
          [-8]: t('pages.staffInbox.dmExistingOnly'),
        },
      },
    );
    dmDraft.value = '';
    dmOpen.value = false;
    kind.value = 'dm';
    state.value = 'all';
    await loadTickets();
    if (data.ticket) await loadThread(data.ticket.id);
  } catch (error) {
    handleError(error, t('pages.staffInbox.sendDmFailed'));
  } finally {
    submitLoading.value = false;
  }
}

const unlockLoading = ref(false);
const toast = useToast();

async function unlockMessage(message: TicketMessage) {
  if (!thread.value?.perm.can_view_locked && thread.value?.perm.send_block === RbTicketSendBlock.NoAccess) return;
  if (message.sender_type !== RbTicketSenderType.Host || message.unlocked || message.cost_id === null || message.cost_id === undefined) return;

  unlockLoading.value = true;

  const ticketId = thread.value?.ticket?.id;
  if (ticketId) {
    try {
      const { data } = await api.post<TicketUnlockResponse>(`/tickets/${ticketId}/messages/${message.id}/purchase`, undefined, {
        errorHints: {
          [-2]: t('ticket.insufficientBalance'),
          [-1]: t('ticket.unavailableOrPurchased'),
        },
      });
      const messages =
        thread.value?.messages.map(item => {
          if (isTicketMessage(item) && item.id === data.id) {
            return { ...item, ...data, unlocked: true } as TicketMessage;
          }
          return item;
        }) ?? [];
      thread.value = {
        ...thread.value!,
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

useSync().listen(SyncMessageType.TicketUpdated, ({ data }) => {
  if (data.game_id !== gameId.value) return;
  loadTickets(true);
  const ownAssigneeChange = data.actor_id === user.value?.id && (data.event === 'assigned' || data.event === 'unassigned');
  if (data.ticket_id === selectedId.value && !ownAssigneeChange) loadThreadNewer(data.ticket_id);
});
</script>

<template>
  <div class="py-6">
    <div class="flex items-center justify-between gap-3 mb-5">
      <div>
        <h1 class="text-3xl font-bold">{{ t('pages.staffInbox.title') }}</h1>
      </div>
      <u-button icon="material-symbols:outgoing-mail-outline-rounded" :label="t('pages.staffInbox.sendDm')" @click="openDm" />
    </div>

    <div class="grid min-h-[calc(100vh-10rem)] items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside class="w-full lg:sticky lg:top-20">
        <u-card variant="subtle" :ui="{ body: 'flex min-h-0 flex-col gap-3 p-2 sm:p-2 lg:max-h-[calc(100vh-6rem)]' }">
          <div class="flex items-center gap-2 font-semibold text-highlighted">
            <u-icon name="material-symbols:inbox-outline-rounded" />
            {{ t('pages.staffInbox.sessionSelect') }}
          </div>
          <u-separator />
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <u-select
              v-model="kind"
              :items="[
                { label: t('pages.staffInbox.allTypes'), value: 'all' },
                { label: t('pages.puzzlePage.tickets'), value: 'puzzle' },
                { label: t('message.title'), value: 'dm' },
              ]"
            />
            <u-select
              v-model="state"
              :items="[
                { label: t('pages.staffInbox.allStates'), value: 'all' },
                { label: t('ticket.open'), value: 'open' },
                { label: t('ticket.closedState'), value: 'closed' },
              ]"
            />
            <u-select
              v-model="waitingFor"
              :items="[
                { label: t('pages.staffInbox.allMessages'), value: 'all' },
                { label: t('pages.staffInbox.waitingStaff'), value: 'staff' },
                { label: t('pages.staffInbox.waitingTeam'), value: 'team' },
              ]"
            />
            <u-select
              v-model="assigneeFilter"
              :items="[
                { label: t('pages.staffInbox.allAssignees'), value: 'all' },
                { label: t('pages.staffInbox.handledByMe'), value: 'me' },
                { label: t('pages.staffInbox.unassigned'), value: 'none' },
              ]"
            />
          </div>
          <u-separator />
          <div ref="listScroll" class="min-h-0 flex-1 overflow-y-auto">
            <div v-if="listLoading && tickets.length === 0" class="p-3"><u-skeleton class="h-20" /></div>
            <u-card
              v-for="ticket in tickets"
              :key="ticket.id"
              :variant="selectedId === ticket.id ? 'subtle' : 'soft'"
              :ui="{ body: 'p-3 sm:p-3' }"
              class="mb-2 cursor-pointer text-left transition-colors"
              :class="selectedId === ticket.id ? 'bg-elevated' : 'hover:bg-elevated/50'"
              role="button"
              tabindex="0"
              @click="loadThread(ticket.id)"
              @keydown.enter="loadThread(ticket.id)"
              @keydown.space.prevent="loadThread(ticket.id)"
            >
              <div class="flex justify-between gap-2">
                <span class="flex min-w-0 items-center gap-1.5 font-semibold">
                  <u-icon :name="ticket.puzzle ? 'material-symbols:near-me-outline-rounded' : 'material-symbols:mail-outline-rounded'" class="size-5 shrink-0 text-muted" />
                  <span class="truncate">{{ ticketDisplayTitle(ticket) }}</span>
                </span>
                <u-badge v-if="ticket.last_by === RbTicketSenderType.Team" color="warning" variant="soft">{{ t('pages.staffInbox.pendingReply') }}</u-badge>
              </div>
              <div class="mt-2 min-w-0">
                <div class="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                  <rb-user-badge v-if="ticket.assignee" :user="ticket.assignee" class="min-w-0 max-w-full">
                    <span class="min-w-0 truncate">{{ ticket.assignee.nickname }}</span>
                  </rb-user-badge>
                  <u-badge v-else color="neutral" variant="soft" icon="material-symbols:person-off-outline-rounded" class="max-w-full">{{ t('ticket.unclaimed') }}</u-badge>
                  <u-badge color="primary" variant="soft" icon="material-symbols:groups-2-outline-rounded" class="min-w-0 max-w-full">
                    <span class="min-w-0 truncate">{{ ticket.team?.name }}</span>
                  </u-badge>
                </div>
                <div class="mt-1.5 text-xs text-muted text-right -mb-0.5">{{ ticket.last_at ? formatDate(ticket.last_at) : t('pages.staffInbox.noMessages') }}</div>
              </div>
            </u-card>
            <div v-if="listLoading && tickets.length > 0" class="flex justify-center py-3"><u-icon name="material-symbols:progress-activity" class="size-5 animate-spin text-muted" /></div>
            <u-empty v-if="!listLoading && tickets.length === 0" :title="t('pages.staffInbox.noMatch')" icon="material-symbols:inbox-outline-rounded" />
          </div>
        </u-card>
      </aside>

      <main class="min-h-[calc(100vh-10rem)] w-full min-w-0">
        <div v-if="threadLoading"><u-skeleton class="h-40" /></div>
        <template v-else-if="thread?.ticket">
          <div class="border-b border-default pb-4 mb-4">
            <div>
              <div class="text-xl font-bold">{{ ticketDisplayTitle(thread.ticket) }}</div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <u-button v-if="!thread.ticket.assignee" :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft" :loading="assigneeLoading" @click="assignSelf()">
                  <span :class="assigneeActionNormalClass">
                    <u-icon name="material-symbols:person-off-outline-rounded" class="size-4 shrink-0" />
                    <span>{{ t('ticket.unclaimed') }}</span>
                  </span>
                  <span :class="assigneeActionHoverClass">
                    <u-icon name="material-symbols:person-add-outline-rounded" class="size-4 shrink-0" />
                    <span>{{ t('ticket.claim') }}</span>
                  </span>
                </u-button>

                <u-button v-else-if="thread.ticket.assignee.id === user?.id" :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft" :loading="assigneeLoading" @click="unassign">
                  <span :class="assigneeActionNormalClass">
                    <u-avatar :src="thread.ticket.assignee.avatar" :text="thread.ticket.assignee.nickname" size="3xs" />
                    <span class="min-w-0 truncate">{{ thread.ticket.assignee.nickname }}</span>
                  </span>
                  <span :class="assigneeActionHoverClass">
                    <u-icon name="material-symbols:person-remove-outline-rounded" class="size-4 shrink-0" />
                    <span>{{ t('ticket.unclaim') }}</span>
                  </span>
                </u-button>

                <u-popover v-else v-model:open="assigneeConfirmOpen" arrow>
                  <u-button :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft">
                    <span :class="assigneeActionNormalClass">
                      <u-avatar :src="thread.ticket.assignee.avatar" :text="thread.ticket.assignee.nickname" size="3xs" />
                      <span class="min-w-0 truncate">{{ thread.ticket.assignee.nickname }}</span>
                    </span>
                    <span :class="assigneeActionHoverClass">
                      <u-icon name="material-symbols:person-add-outline-rounded" class="size-4 shrink-0" />
                      <span>{{ t('ticket.claim') }}</span>
                    </span>
                  </u-button>
                  <template #content>
                    <div class="flex items-center gap-2 px-4 py-2 text-xs">
                      <u-icon name="material-symbols:warning-outline-rounded" />
                      <span>{{ t('ticket.claimConfirm', { name: thread.ticket.assignee.nickname }) }}</span>
                      <u-button :loading="assigneeLoading" class="cursor-pointer" color="warning" variant="soft" size="xs" @click="assignSelf(true)">{{ t('common.confirm') }}</u-button>
                    </div>
                  </template>
                </u-popover>

                <rbph-team-access-menu
                  v-if="thread.ticket.team"
                  ref="teamAccessMenu"
                  :game-id="gameId"
                  :team-id="thread.ticket.team.id"
                  :team-name="thread.ticket.team.name"
                  :status-feature="thread.ticket.puzzle ? 'puzzle_ticket' : 'direct_message'"
                  size="md"
                  @status-change="currentTeamFeatureBanned = $event"
                />
              </div>
            </div>
          </div>

          <rbph-ticket-timeline
            v-if="thread.ticket.puzzle"
            :items="thread.messages"
            :currency="threadCurrency"
            :unlockable="true"
            :can-view-locked="thread.perm.can_view_locked"
            :show-history-gap="Boolean(thread.history.has_more && thread.history.after)"
            :history-loading="threadHistoryLoading"
            :history-gap-index="threadHistoryGapIndex"
            :unlock-loading="unlockLoading"
            class="mb-6"
            @unlock="unlockMessage"
            @load-history="loadThreadHistory"
          />

          <u-alert
            v-if="currentTeamFeatureBanned"
            class="mb-3"
            color="error"
            variant="subtle"
            orientation="horizontal"
            icon="material-symbols:warning-outline-rounded"
            :title="thread.ticket.puzzle ? t('components.teamAccessMenu.puzzleTicketBanned') : t('components.teamAccessMenu.directMessageBanned')"
          >
            <template #actions>
              <u-button
                color="error"
                variant="soft"
                icon="material-symbols:admin-panel-settings-outline-rounded"
                :label="t('components.teamAccessMenu.edit')"
                @click="teamAccessMenu?.openEditor()"
              />
            </template>
          </u-alert>

          <rbph-message-edit
            v-model:draft="draft"
            v-model:content-type="contentType"
            :placeholder="t('pages.staffInbox.replyCurrent')"
            :content-types="thread.perm.content_type"
            :loading="submitLoading"
            :disabled="submitLoading"
            :can-close="Boolean(thread.ticket.puzzle) && thread.ticket.state === RbTicketState.Open"
            @submit="sendMessage()"
            @submit-close="closeWithMessage()"
          >
            <template v-if="thread.ticket.puzzle" #tool>
              <u-select v-if="currencyTypeItems.length > 0" v-model="reqCurrencyId" :items="currencyTypeItems" variant="soft" size="sm" class="w-40" />
              <rb-input-number v-if="reqCurrencyId !== null" v-model="reqCurrencyAmount" :prec="reqCurrencyType?.prec ?? 0" orientation="vertical" class="w-24" variant="soft" :step="10" />
            </template>
          </rbph-message-edit>

          <div v-if="!thread.ticket.puzzle" class="my-6 space-y-3">
            <div v-for="item in dmThreadItems" :key="`${item.type}-${item.id}`">
              <div v-if="isTicketMessage(item)" class="rounded-md border border-default p-3">
                <div class="flex justify-between text-xs text-muted mb-2">
                  <span>
                    <u-badge v-if="item.sender_type === RbTicketSenderType.Host" variant="soft" color="warning" class="me-1">{{ t('message.staffMember') }}</u-badge>
                    {{ item.sender.nickname }}
                  </span>
                  <span>{{ formatDate(item.ctime_at) }}</span>
                </div>
                <rbph-content v-if="item.content !== undefined && item.content_type !== undefined" :content="item as RbContent" />
              </div>
            </div>
            <div v-if="threadHistoryLoading" class="flex justify-center py-3"><u-icon name="material-symbols:progress-activity" class="size-5 animate-spin text-muted" /></div>
          </div>
        </template>
        <u-empty v-else class="min-h-112" :title="t('pages.staffInbox.selectSession')" :description="t('pages.staffInbox.selectSessionDesc')" icon="material-symbols:forum-outline-rounded" />
      </main>
    </div>

    <u-modal v-model:open="dmOpen" :title="t('pages.staffInbox.sendTeamDmTitle')" :description="t('pages.staffInbox.sendTeamDmDesc')">
      <template #body>
        <div class="space-y-4">
          <rbph-staff-team-select v-model="dmTeam" :game-id="gameId" :placeholder="t('pages.staffInbox.searchTeam')" />
          <rbph-message-edit v-model:draft="dmDraft" v-model:content-type="contentType" :placeholder="t('pages.staffInbox.dmPlaceholder')" :content-types="[RbContentType.UnsafeMarkdown]" :loading="submitLoading" :disabled="!dmTeam || submitLoading" @submit="sendDm" />
        </div>
      </template>
    </u-modal>

    <rb-confirm-modal
      v-model:open="sendConflictOpen"
      :title="t('pages.staffInbox.sendConflict')"
      :description="sendConflictDescription"
      :confirm-label="t('pages.staffInbox.continueAnyway')"
      confirm-color="warning"
      confirm-icon="material-symbols:send-outline-rounded"
      :busy="submitLoading"
      @confirm="confirmSendConflict"
    />
  </div>
</template>
