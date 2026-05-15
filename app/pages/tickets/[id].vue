<script setup lang="ts">
import type { SelectItem, TabsItem, TimelineItem } from '@nuxt/ui';
import type { BreadcrumbItem } from '@nuxt/ui/runtime/components/Breadcrumb.vue.js';

definePageMeta({
  layout: 'game',
});

useUser().required();

const api = useApi();
const route = useRoute();
const toast = useToast();

const game = useGame().ref;
const currency = useCurrency();
const currencyRef = currency.getAllCurrent();

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

  if (ticket.value?.id !== id) {
    try {
      const { data } = await useApi().get<TicketThread>(`/tickets/${new_id}`);
      pageData.value = data;

      if (data.ticket?.game_id) {
        updateGameState(data.ticket.game_id.toString());
      }
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
    }
  }
}

watch(
  ticket_id,
  async new_id => {
    updateData(new_id).catch(e => showError({ status: 400, statusText: e }));
  },
  { immediate: true },
);

const breadItems = computed<BreadcrumbItem[]>(() => [
  {
    label: ticket.value?.puzzle?.round.title,
    to: `/rounds/${ticket.value?.puzzle?.round.id}`,
    icon: 'material-symbols:grid-view-outline-rounded',
  },
  {
    label: ticket.value?.puzzle?.title,
    to: `/puzzles/${ticket.value?.puzzle?.id}/tickets`,
    icon: 'material-symbols:extension-outline-rounded',
  },
  {
    label: `人工提示 #${ticket.value?.id}`,
    to: `/tickets/${ticket.value?.id}`,
    icon: 'material-symbols:near-me-outline-rounded',
  },
]);

const history = computed<TimelineItem[]>(
  () =>
    pageData.value?.messages.map(msg => {
      if (isTicketMessage(msg)) {
        return {
          username: msg.sender.nickname,
          date: msg.ctime_at,
          action: '发送了消息',
          icon: 'material-symbols:chat-outline-rounded',
          data: msg,
          message: msg,
        };
      }
      return {
        username: msg.actor.nickname,
        date: msg.ctime_at,
        action: ticketActionConsts[msg.action].desc,
        icon: ticketActionConsts[msg.action].icon,
        data: msg,
        message: msg.message,
      };
    }) ?? [],
);

const submitLoading = ref(false);
const unlockLoading = ref(false);

const draftMessage = ref('');
async function submitMessage(senderType: RbTicketSenderType) {
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
          messages: [...(pageData.value?.messages ?? []), data.msg],
          perm,
        };
        draftContentType.value = getDefaultTicketContentType(perm);
      }
    } catch (error) {
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

async function submitClose() {
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
  [RbTicketSendBlock.Closed]: { icon: 'material-symbols:check-rounded', color: 'success', desc: '工单已关闭，不再接受新的回复。' },
  [RbTicketSendBlock.Pending]: { icon: 'material-symbols:more-horiz', color: 'warning', desc: '请等待工作人员回复。' },
};

interface TicketActionConst {
  icon: string;
  desc: string;
}

const ticketActionConsts: Record<RbTicketOperationAction, TicketActionConst> = {
  [RbTicketOperationAction.Open]: { icon: 'material-symbols:add-circle-outline-rounded', desc: '请求了人工提示' },
  [RbTicketOperationAction.Close]: { icon: 'material-symbols:check-rounded', desc: '关闭了人工提示' },
  [RbTicketOperationAction.AutoCloseSolved]: { icon: 'material-symbols:check-rounded', desc: '解出了谜题，人工提示自动关闭' },
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
const currencyTypeItems = computed(() => [
  { label: '无需解锁', value: null, icon: 'material-symbols:lock-open-right-outline-rounded' },
  ...(pageData.value?.perm.currency.map(it => {
    return { label: it.name, value: it.id, icon: 'material-symbols:emoji-objects-outline-rounded' } satisfies SelectItem;
  }) ?? []),
]);
const reqCurrencyId = ref<number | null>(null);
const reqCurrencyAmount = ref(0);
const reqCurrencyType = computed(() => allowedCurrencyTypes.value.find(it => it.id === reqCurrencyId.value));
</script>

<template>
  <div v-if="ticket" class="py-6">
    <u-breadcrumb class="mb-6" :items="breadItems" />
    <div class="mb-4">
      <rbph-currency-badges />
    </div>
    <div class="flex items-baseline justify-between md:flex-row flex-col">
      <div>
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="text-3xl font-bold">人工提示 </span>
          <span class="text-muted text-2xl">#{{ ticket?.id }}</span>
          <u-badge v-if="ticket?.state === RbTicketState.Open" class="rounded-full py-1.5 px-2.5" color="success" variant="subtle" icon="material-symbols:add-circle-outline-rounded">开放中</u-badge>
          <u-badge v-else-if="ticket?.state === RbTicketState.Closed" class="rounded-full py-1.5 px-2.5" color="error" variant="subtle" icon="material-symbols:check-circle-outline-rounded">已关闭</u-badge>
        </div>
      </div>

      <!-- <div class="mt-2 text-secondary ms-0.5 text-xs">
        <icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
        创建于 {{ formatDate(ticket.?.state.utime_at) }}
      </div> -->
    </div>
    <u-timeline :items="history" :ui="{ date: 'float-end ms-1' }" class="w-full mt-6" color="success">
      <template #title="{ item }">
        <u-badge v-if="(item.data.actor_type || item.data.sender_type) === RbTicketSenderType.Host" variant="soft" color="warning" class="me-2">工作人员</u-badge>
        <span class="me-1">{{ item.username }}</span>
        <span class="font-normal text-muted">&nbsp;{{ item.action }}</span>
      </template>
      <template #date="{ item }">
        {{ formatDate(item.date) }}
      </template>
      <template #description="{ item }">
        <div v-if="item.message.content !== undefined || (item.data.cost_id !== null && item.data.cost_id !== undefined)" class="px-4 py-4 ring ring-default mt-2 rounded-md text-default">
          <rbph-content v-if="item.message.content !== undefined" :content="item.message" />
          <div v-else class="flex align-middle gap-2">
            这条消息已被锁定……
            <u-popover arrow>
              <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-outline">
                解锁：{{ currencyRef[item.data.cost_id]?.name }} - {{ intPrecString(item.data.cost_amount, currencyRef[item.data.cost_id]?.prec ?? 0) }}
              </u-button>
              <template #content>
                <div class="py-2 px-4 text-xs">
                  <icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle" />
                  <span class="text-xs"> 确定要解锁这条消息吗？ </span>
                  <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="unlockMessage(item.data)"> 解锁 </u-button>
                </div>
              </template>
            </u-popover>
          </div>
          <div v-if="item.data.cost_id !== null && item.data.cost_id !== undefined" class="flex justify-end">
            <u-badge v-if="item.data.unlocked" class="mt-2" color="success" variant="soft" icon="material-symbols:lock-open-right-outline-rounded">
              已解锁：{{ currencyRef[item.data.cost_id]?.name }} - {{ intPrecString(item.data.cost_amount, currencyRef[item.data.cost_id]?.prec ?? 0) }}
            </u-badge>
            <u-popover v-else-if="pageData?.perm.can_view_locked" class="mt-2" arrow>
              <u-button class="cursor-pointer" size="xs" color="error" variant="soft" icon="material-symbols:lock-outline">
                未解锁：{{ currencyRef[item.data.cost_id]?.name }} - {{ intPrecString(item.data.cost_amount, currencyRef[item.data.cost_id]?.prec ?? 0) }}
              </u-button>
              <template #content>
                <div class="py-2 px-4 text-xs">
                  <icon name="material-symbols:lock-open-right-outline-rounded" class="align-middle" />
                  <span class="text-xs"> 为该队伍免费解锁这条消息？ </span>
                  <u-button :loading="unlockLoading" class="cursor-pointer" color="success" variant="soft" size="xs" @click="unlockMessage(item.data)"> 解锁 </u-button>
                </div>
              </template>
            </u-popover>
          </div>
        </div>
      </template>
    </u-timeline>

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
        <u-alert v-else class="mb-2" variant="subtle" title="将作为工作人员回复。" description="请向该队伍提供必要的帮助。" icon="material-symbols:check-rounded" color="warning" />
        <rbph-message-edit
          v-model:draft="draftMessage"
          v-model:content-type="draftContentType"
          placeholder="回复人工提示"
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
