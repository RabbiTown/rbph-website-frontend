<script setup lang="ts">
definePageMeta({ layout: 'game', middleware: 'staff' });

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
  { label: '无需解锁', value: null, icon: 'material-symbols:lock-open-right-outline-rounded' },
  ...allowedCurrencyTypes.value.map(id => ({ label: teamCurrency.value[id]?.name ?? `#${id}`, value: id, icon: 'material-symbols:emoji-objects-outline-rounded' })),
]);
const reqCurrencyId = ref<number | null>(null);
const reqCurrencyAmount = ref(0);
const reqCurrencyType = computed(() => (reqCurrencyId.value === null ? undefined : teamCurrency.value[reqCurrencyId.value]));
const sendConflictDescription = computed(() => {
  if (!sendConflictAssignee.value) return '';
  const action = sendConflictAction.value === 'close' ? '回复并关闭' : '继续回复';
  return `该会话已由 ${sendConflictAssignee.value.nickname} 认领，是否仍要${action}？`;
});

const kind = ref((route.query.kind as string) || 'all');
const state = ref('open');
const waitingFor = ref('all');
const assigneeFilter = ref('all');
const puzzleId = computed(() => {
  const value = Number(route.query.puzzle_id);
  return Number.isFinite(value) && value > 0 ? value : undefined;
});

useHead({ titleTemplate: computed(() => buildTitleParts([{ text: '消息工作台' }, { text: useGame().ref.value?.title, sep: ' - ' }])) });

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
    handleError(error, '获取消息列表失败');
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
  if (!silent) threadLoading.value = true;
  try {
    const { data } = await api.get<TicketThread>(ticketEndpoint(ticketId));
    thread.value = data;
    threadHistoryGapIndex.value = 1;
    contentType.value = getDefaultTicketContentType(data.perm);
    reqCurrencyId.value = null;
    reqCurrencyAmount.value = 0;
  } catch (error) {
    handleError(error, '获取会话失败');
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
    handleError(error, '加载更早会话记录失败');
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
    handleError(error, '更新会话失败');
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
  return ticket.puzzle ? `${ticket.puzzle.title} #${ticket.id}` : `站内信 #${ticket.id}`;
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
      { errorHints: { [-7]: '已有其他工作人员认领此会话。' } },
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
    handleError(error, '回复失败');
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
      { errorHints: { [-7]: '已有其他工作人员认领此会话。' } },
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
    handleError(error, '关闭工单失败');
  } finally {
    submitLoading.value = false;
  }
}

async function assignSelf(force = false) {
  if (!selectedId.value || assigneeLoading.value) return;
  assigneeLoading.value = true;
  try {
    const { data } = await api.post<TicketAssignResponse>(`${ticketEndpoint(selectedId.value)}/assignee/self`, { force }, { errorHints: { [-7]: '已有其他工作人员认领此会话。' } });
    if (thread.value?.ticket) thread.value.ticket.assignee = data.assignee ?? undefined;
    assigneeConfirmOpen.value = false;
    await loadTickets(true);
  } catch (error) {
    const assignee = conflictAssignee(error);
    if (!force && assignee) {
      assigneeConfirmOpen.value = true;
      return;
    }
    handleError(error, '认领失败');
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
    handleError(error, '取消认领失败');
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
          [-8]: '站内信当前仅允许回复已有会话，无法向该队伍主动发起新会话。',
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
    handleError(error, '发送站内信失败');
  } finally {
    submitLoading.value = false;
  }
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
        <h1 class="text-3xl font-bold">消息工作台</h1>
      </div>
      <u-button icon="material-symbols:outgoing-mail-outline-rounded" label="发送站内信" @click="openDm" />
    </div>

    <div class="grid min-h-[calc(100vh-10rem)] items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside class="w-full lg:sticky lg:top-20">
        <u-card variant="subtle" :ui="{ body: 'flex min-h-0 flex-col gap-3 p-2 sm:p-2 lg:max-h-[calc(100vh-6rem)]' }">
          <div class="flex items-center gap-2 font-semibold text-highlighted">
            <u-icon name="material-symbols:inbox-outline-rounded" />
            会话选择
          </div>
          <u-separator />
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <u-select
              v-model="kind"
              :items="[
                { label: '全部类型', value: 'all' },
                { label: '人工提示', value: 'puzzle' },
                { label: '站内信', value: 'dm' },
              ]"
            />
            <u-select
              v-model="state"
              :items="[
                { label: '全部状态', value: 'all' },
                { label: '开放中', value: 'open' },
                { label: '已关闭', value: 'closed' },
              ]"
            />
            <u-select
              v-model="waitingFor"
              :items="[
                { label: '全部消息', value: 'all' },
                { label: '等待工作人员', value: 'staff' },
                { label: '等待队伍', value: 'team' },
              ]"
            />
            <u-select
              v-model="assigneeFilter"
              :items="[
                { label: '全部负责人', value: 'all' },
                { label: '由我处理', value: 'me' },
                { label: '无人处理', value: 'none' },
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
                <u-badge v-if="ticket.last_by === RbTicketSenderType.Team" color="warning" variant="soft">待回复</u-badge>
              </div>
              <div class="mt-2 min-w-0">
                <div class="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                  <rb-user-badge v-if="ticket.assignee" :user="ticket.assignee" class="min-w-0 max-w-full">
                    <span class="min-w-0 truncate">{{ ticket.assignee.nickname }}</span>
                  </rb-user-badge>
                  <u-badge v-else color="neutral" variant="soft" icon="material-symbols:person-off-outline-rounded" class="max-w-full">未认领</u-badge>
                  <u-badge color="primary" variant="soft" icon="material-symbols:groups-2-outline-rounded" class="min-w-0 max-w-full">
                    <span class="min-w-0 truncate">{{ ticket.team?.name }}</span>
                  </u-badge>
                </div>
                <div class="mt-1.5 text-xs text-muted text-right -mb-0.5">{{ ticket.last_at ? formatDate(ticket.last_at) : '暂无消息' }}</div>
              </div>
            </u-card>
            <div v-if="listLoading && tickets.length > 0" class="flex justify-center py-3"><u-icon name="material-symbols:progress-activity" class="size-5 animate-spin text-muted" /></div>
            <u-empty v-if="!listLoading && tickets.length === 0" title="没有匹配的会话" icon="material-symbols:inbox-outline-rounded" />
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
                    <span>未认领</span>
                  </span>
                  <span :class="assigneeActionHoverClass">
                    <u-icon name="material-symbols:person-add-outline-rounded" class="size-4 shrink-0" />
                    <span>认领会话</span>
                  </span>
                </u-button>

                <u-button v-else-if="thread.ticket.assignee.id === user?.id" :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft" :loading="assigneeLoading" @click="unassign">
                  <span :class="assigneeActionNormalClass">
                    <u-avatar :src="thread.ticket.assignee.avatar" :text="thread.ticket.assignee.nickname" size="3xs" />
                    <span class="min-w-0 truncate">{{ thread.ticket.assignee.nickname }}</span>
                  </span>
                  <span :class="assigneeActionHoverClass">
                    <u-icon name="material-symbols:person-remove-outline-rounded" class="size-4 shrink-0" />
                    <span>取消认领</span>
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
                      <span>认领会话</span>
                    </span>
                  </u-button>
                  <template #content>
                    <div class="flex items-center gap-2 px-4 py-2 text-xs">
                      <u-icon name="material-symbols:warning-outline-rounded" />
                      <span>会话已由 {{ thread.ticket.assignee.nickname }} 认领，确定覆盖认领吗？</span>
                      <u-button :loading="assigneeLoading" class="cursor-pointer" color="warning" variant="soft" size="xs" @click="assignSelf(true)">确定</u-button>
                    </div>
                  </template>
                </u-popover>

                <u-badge size="md" color="primary" variant="soft" icon="material-symbols:groups-2-outline-rounded" class="h-6 max-w-full">
                  <span class="min-w-0 truncate">{{ thread.ticket.team?.name }}</span>
                </u-badge>
              </div>
            </div>
          </div>

          <rbph-ticket-timeline
            v-if="thread.ticket.puzzle"
            :items="thread.messages"
            :currency="threadCurrency"
            :can-view-locked="thread.perm.can_view_locked"
            :show-history-gap="Boolean(thread.history.has_more && thread.history.after)"
            :history-loading="threadHistoryLoading"
            :history-gap-index="threadHistoryGapIndex"
            class="mb-6"
            @load-history="loadThreadHistory"
          />

          <div v-else class="mb-6 space-y-3">
            <div v-for="item in dmThreadItems" :key="`${item.type}-${item.id}`">
              <div v-if="isTicketMessage(item)" class="rounded-md border border-default p-3">
                <div class="flex justify-between text-xs text-muted mb-2">
                  <span>
                    <u-badge v-if="item.sender_type === RbTicketSenderType.Host" variant="soft" color="warning" class="me-1">工作人员</u-badge>
                    {{ item.sender.nickname }}
                  </span>
                  <span>{{ formatDate(item.ctime_at) }}</span>
                </div>
                <rbph-content v-if="item.content !== undefined && item.content_type !== undefined" :content="item as RbContent" />
              </div>
            </div>
            <div v-if="threadHistoryLoading" class="flex justify-center py-3"><u-icon name="material-symbols:progress-activity" class="size-5 animate-spin text-muted" /></div>
          </div>

          <rbph-message-edit
            v-model:draft="draft"
            v-model:content-type="contentType"
            placeholder="回复当前会话"
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
        </template>
        <u-empty v-else class="min-h-112" title="选择一个会话" description="从左侧列表打开人工提示或站内信" icon="material-symbols:forum-outline-rounded" />
      </main>
    </div>

    <u-modal v-model:open="dmOpen" title="发送队伍站内信" description="选择队伍并发送消息">
      <template #body>
        <div class="space-y-4">
          <rbph-staff-team-select v-model="dmTeam" :game-id="gameId" placeholder="输入队伍名称搜索" />
          <rbph-message-edit v-model:draft="dmDraft" v-model:content-type="contentType" placeholder="输入站内信" :content-types="[RbContentType.UnsafeMarkdown]" :loading="submitLoading" :disabled="!dmTeam || submitLoading" @submit="sendDm" />
        </div>
      </template>
    </u-modal>

    <rb-confirm-modal
      v-model:open="sendConflictOpen"
      title="已有工作人员认领"
      :description="sendConflictDescription"
      confirm-label="仍要继续"
      confirm-color="warning"
      confirm-icon="material-symbols:send-outline-rounded"
      :busy="submitLoading"
      @confirm="confirmSendConflict"
    />
  </div>
</template>
