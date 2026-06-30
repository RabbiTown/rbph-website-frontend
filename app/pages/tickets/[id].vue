<script setup lang="ts">
import type { SelectItem, TabsItem } from '@nuxt/ui';
import type { BreadcrumbItem } from '@nuxt/ui/runtime/components/Breadcrumb.vue.js';

definePageMeta({
  layout: 'game',
});

useUser().required();
const user = useUser().ref;

const api = useApi();
const route = useRoute();
const toast = useToast();

const game = useGame().ref;

const pageData = ref<TicketThread>();
const ticket = computed(() => pageData.value?.ticket);
const sendBlock = computed(() => {
  const block = pageData.value?.perm.send_block;
  return block ? sendBlockConsts[block] : undefined;
});
const canSend = computed(() => canSendTicket(pageData.value?.perm));
const draftContentType = ref(RbContentType.UnsafeMarkdown);

const ticket_id = computed(() => route.params.id as string);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: `人工提示 #${ticket_id.value}` }, { text: game.value?.title, sep: ' - ' }])),
});

async function updateData(new_id: string | undefined = undefined) {
  const id = new_id ? parseInt(new_id) : ticket.value?.id || NaN;
  if (isNaN(id)) throw 'Invalid ticket id';

  try {
    const { data } = await useApi().get<TicketThread>(`/tickets/${id}`);
    pageData.value = data;

    if (data.ticket?.game_id) {
      updateGameState(data.ticket.game_id.toString());
    }
  } catch (error) {
    showError(error instanceof Error ? error : String(error));
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
  if (data.ticket_id === Number(ticket_id.value)) updateData(ticket_id.value);
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
    label: `人工提示 #${ticket.value?.id}`,
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
        errorHints: { [-1]: '这条人工提示已关闭。', [-2]: '积压信息过多，请先等待工作人员回复。', [-3]: '内容类型无效或无权使用。', [-4]: '发送的信息过长。', [-5]: '信息要求的费用无效。' },
      });
      draftMessage.value = '';

      if (code === 0) {
        const hostReply = senderType === RbTicketSenderType.Host;
        toast.add({
          title: hostReply ? '已发送工作人员回复' : '已发送进一步询问',
          description: hostReply ? '该队伍可以看到你的回复。' : '请等待工作人员回复。',
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
          messages: (pageData.value?.messages ?? []).some(item => isTicketMessage(item) && item.id === data.msg.id) ? (pageData.value?.messages ?? []) : [...(pageData.value?.messages ?? []), data.msg],
          perm,
        };
        draftContentType.value = getDefaultTicketContentType(perm);
      }
    } catch (error) {
      const assignee = (error as { data?: { payload?: { assignee?: { nickname: string } } } }).data?.payload?.assignee;
      if (senderType === RbTicketSenderType.Host && !forceAssignee && assignee && window.confirm(`该会话已由 ${assignee.nickname} 认领，仍要继续回复吗？`)) {
        submitLoading.value = false;
        return submitMessage(senderType, true);
      }
      handleError(error, '站内信发送失败');
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
    const { data } = await api.post<TicketAssignResponse>(`/tickets/${ticket.value.id}/assignee/self`, { force }, { errorHints: { [-7]: '已有其他工作人员认领此会话。' } });
    ticket.value.assignee = data.assignee ?? undefined;
    assigneeConfirmOpen.value = false;
  } catch (error) {
    const assignee = (error as { data?: { payload?: { assignee?: { id: number; nickname: string; email?: string } } } }).data?.payload?.assignee;
    if (!force && assignee) {
      ticket.value.assignee = assignee;
      assigneeConfirmOpen.value = true;
      return;
    }
    handleError(error, '认领失败');
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
    handleError(error, '取消认领失败');
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
        title: '已关闭工单',
        description: '队伍仍可查看历史记录。',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      pageData.value = {
        ticket: data.ticket ?? pageData.value?.ticket,
        messages: data.thread.messages,
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
      if (!forceAssignee && assignee && window.confirm(`该会话已由 ${assignee.nickname} 认领，仍要回复并关闭吗？`)) {
        submitLoading.value = false;
        return submitClose(true);
      }
      handleError(error, '关闭工单失败');
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
          [-2]: '余额不足。',
          [-1]: '消息暂未开放或已购买。',
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
        title: '已解锁消息',
        description: '队伍可查看该条内容。',
        icon: 'material-symbols:lock-open-right-outline-rounded',
        color: 'success',
      });
    } catch (error) {
      handleError(error, '解锁消息失败');
    }
  }

  unlockLoading.value = false;
}

interface SendBlockConst {
  icon: string;
  color: 'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral' | undefined;
  desc: string;
}

const sendBlockConsts: Partial<Record<RbTicketSendBlock, SendBlockConst>> = {
  [RbTicketSendBlock.NoAccess]: { icon: 'material-symbols:error-med-outline-rounded', color: 'error', desc: '没有发送权限。' },
  [RbTicketSendBlock.Closed]: { icon: 'material-symbols:check-rounded', color: 'success', desc: '人工提示已关闭，不再接受新的回复。' },
  [RbTicketSendBlock.Pending]: { icon: 'material-symbols:more-horiz', color: 'warning', desc: '请等待工作人员回复。' },
  [RbTicketSendBlock.FeatureClosed]: { icon: 'material-symbols:lock-outline-rounded', color: 'warning', desc: '比赛人工提示已关闭，暂时不能发送消息。' },
};

const tabItems = computed(
  () =>
    [
      ...(pageData.value?.perm.send_block !== RbTicketSendBlock.NoAccess
        ? [
            {
              label: '作为队伍成员',
              icon: 'material-symbols:group-outline-rounded',
              slot: 'as-team' as const,
            },
          ]
        : []),
      ...(pageData.value?.perm.can_host
        ? [
            {
              label: '作为工作人员',
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
  { label: '无需解锁', value: null, icon: 'material-symbols:lock-open-right-outline-rounded' },
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
          <span class="text-3xl font-bold">人工提示 </span>
          <span class="text-muted text-2xl">#{{ ticket?.id }}</span>
          <u-badge v-if="ticket?.state === RbTicketState.Open" class="rounded-full py-1.5 px-2.5" color="success" variant="subtle" icon="material-symbols:add-circle-outline-rounded">开放中</u-badge>
          <u-badge v-else-if="ticket?.state === RbTicketState.Closed" class="rounded-full py-1.5 px-2.5" color="error" variant="subtle" icon="material-symbols:check-circle-outline-rounded">已关闭</u-badge>
        </div>

        <div v-if="pageData?.perm.can_host" class="mt-2 flex flex-wrap items-center gap-2">
          <u-button v-if="!ticket.assignee" :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft" :loading="assigneeLoading" @click="assignSelf()">
            <span :class="assigneeActionNormalClass">
              <u-icon name="material-symbols:person-off-outline-rounded" class="size-4 shrink-0" />
              <span>未认领</span>
            </span>
            <span :class="assigneeActionHoverClass">
              <u-icon name="material-symbols:person-add-outline-rounded" class="size-4 shrink-0" />
              <span>认领会话</span>
            </span>
          </u-button>

          <u-button v-else-if="ticket.assignee.id === user?.id" :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft" :loading="assigneeLoading" @click="unassign">
            <span :class="assigneeActionNormalClass">
              <u-avatar :src="buildCravatarUrl(ticket.assignee.email ?? '')" :text="ticket.assignee.nickname" size="3xs" />
              <span class="min-w-0 truncate">{{ ticket.assignee.nickname }}</span>
            </span>
            <span :class="assigneeActionHoverClass">
              <u-icon name="material-symbols:person-remove-outline-rounded" class="size-4 shrink-0" />
              <span>取消认领</span>
            </span>
          </u-button>

          <u-popover v-else v-model:open="assigneeConfirmOpen" arrow>
            <u-button :class="assigneeActionButtonClass" size="xs" color="neutral" variant="soft">
              <span :class="assigneeActionNormalClass">
                <u-avatar :src="buildCravatarUrl(ticket.assignee.email ?? '')" :text="ticket.assignee.nickname" size="3xs" />
                <span class="min-w-0 truncate">{{ ticket.assignee.nickname }}</span>
              </span>
              <span :class="assigneeActionHoverClass">
                <u-icon name="material-symbols:person-add-outline-rounded" class="size-4 shrink-0" />
                <span>认领会话</span>
              </span>
            </u-button>
            <template #content>
              <div class="flex items-center gap-2 px-4 py-2 text-xs">
                <u-icon name="material-symbols:warning-outline-rounded" />
                <span>会话已由 {{ ticket.assignee.nickname }} 认领，确定覆盖认领吗？</span>
                <u-button :loading="assigneeLoading" class="cursor-pointer" color="warning" variant="soft" size="xs" @click="assignSelf(true)">确定</u-button>
              </div>
            </template>
          </u-popover>

          <u-badge size="sm" color="primary" variant="soft" icon="material-symbols:groups-2-outline-rounded">
            {{ ticket.team?.name }}
          </u-badge>
        </div>
      </div>

      <!-- <div class="mt-2 text-secondary ms-0.5 text-xs">
        <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
        创建于 {{ formatDate(ticket.?.state.utime_at) }}
      </div> -->
    </div>
    <rbph-ticket-timeline :items="pageData?.messages ?? []" :currency="teamCurrency" :can-view-locked="pageData?.perm.can_view_locked" :unlock-loading="unlockLoading" unlockable class="mt-6" @unlock="unlockMessage" />

    <u-tabs :items="tabItems" variant="link" :ui="{ list: tabItems.length > 1 ? undefined : 'hidden' }">
      <template #as-team>
        <rbph-message-edit
          v-if="canSend"
          v-model:draft="draftMessage"
          v-model:content-type="draftContentType"
          placeholder="进一步询问"
          :content-types="pageData?.perm.content_type"
          :disabled="!canSend || submitLoading"
          :loading="!pageData || submitLoading"
          @submit="submitTeamMessage"
        />
        <u-alert v-if="sendBlock" variant="subtle" :title="sendBlock.desc" :icon="sendBlock.icon" :color="sendBlock.color" />
      </template>
      <template #as-host>
        <u-alert v-if="pageData?.ticket?.state === RbTicketState.Closed" class="mb-2" variant="subtle" title="工单已关闭。" description="你仍然可以作为工作人员回复，但是该队伍无法再追问。" icon="material-symbols:check-rounded" color="success" />
        <u-alert v-else class="mb-2" variant="subtle" title="将作为工作人员回复。" description="请向该队伍提供必要的帮助。" icon="material-symbols:near-me-outline-rounded" color="warning" />
        <rbph-message-edit
          v-model:draft="draftMessage"
          v-model:content-type="draftContentType"
          placeholder="回复人工提示请求"
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
