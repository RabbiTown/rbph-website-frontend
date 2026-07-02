<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: '站内信' }, { text: game.value?.title, sep: ' - ' }])),
});

const api = useApi();
const toast = useToast();

const pageData = ref<TicketThread>();
const canSend = computed(() => canSendTicket(pageData.value?.perm));
const messages = computed(() => pageData.value?.messages.filter(isTicketMessage) ?? []);
const draftContentType = ref(RbContentType.UnsafeMarkdown);

async function updateData(newId: number | undefined = undefined): Promise<boolean> {
  const gameId = newId || game.value?.id;
  if (gameId) {
    try {
      const { data } = await api.get<TicketThread>(`/games/${gameId}/tickets/self`);
      pageData.value = data;
      return true;
    } catch (error) {
      handleError(error, '获取站内信信息失败');
    }
  }
  return false;
}

watch(
  game,
  async newGame => {
    pageData.value = undefined;
    updateData(newGame?.id);
  },
  { immediate: true },
);

useSync().listen(SyncMessageType.TicketUpdated, ({ data }) => {
  if (data.game_id === game.value?.id && data.team_id === useTeam(false).ref.value?.id) updateData();
});

const submitLoading = ref(false);

const draftMessage = ref('');
async function submitMessage() {
  if (!canSend.value) return;

  submitLoading.value = true;

  const gameId = game.value?.id;
  if (gameId) {
    try {
      const { code, data } = await api.post<TicketSendResponse>(`/games/${gameId}/tickets/self/send`, { content: draftMessage.value, content_type: draftContentType.value } satisfies TicketSendRequest, {
        errorHints: { [-1]: '队伍站内信被禁用。', [-2]: '积压信息过多，请先等待工作人员回复。', [-3]: '内容类型无效或无权使用。', [-4]: '发送的信息过长。', [-5]: '信息要求的费用无效。' },
      });
      draftMessage.value = '';

      if (code === 0) {
        toast.add({
          title: '已发送站内信',
          description: '请等待工作人员回复。',
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        const perm = data.perm ?? pageData.value?.perm ?? { send_block: RbTicketSendBlock.Ok, can_host: false, can_view_locked: false, content_type: [RbContentType.UnsafeMarkdown], currency: [] };
        pageData.value = {
          ticket: data.ticket ?? pageData.value?.ticket,
          messages: (pageData.value?.messages ?? []).some(item => isTicketMessage(item) && item.id === data.msg.id) ? (pageData.value?.messages ?? []) : [...(pageData.value?.messages ?? []), data.msg],
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

const sendBlock = computed(() => {
  const block = pageData.value?.perm.send_block;
  return block ? sendBlockConsts[block] : undefined;
});

interface SendBlockConst {
  icon: string;
  color: 'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral' | undefined;
  desc: string;
}

const sendBlockConsts: Partial<Record<RbTicketSendBlock, SendBlockConst>> = {
  [RbTicketSendBlock.NoAccess]: { icon: 'material-symbols:error-med-outline-rounded', color: 'error', desc: '没有发送权限。' },
  [RbTicketSendBlock.Closed]: { icon: 'material-symbols:check-rounded', color: 'success', desc: '本队伍站内信功能已被禁用。如果你认为这是一个错误，请通过其他渠道联系工作人员。' },
  [RbTicketSendBlock.Pending]: { icon: 'material-symbols:more-horiz', color: 'warning', desc: '积压信息过多，请等待工作人员回复。' },
  [RbTicketSendBlock.FeatureClosed]: { icon: 'material-symbols:lock-outline', color: 'warning', desc: '站内信功能已关闭，暂时不能发送消息。' },
};
</script>

<template>
  <div>
    <div class="pt-6">
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div class="text-3xl font-bold">站内信</div>
      </div>
    </div>
    <u-alert v-if="sendBlock" class="my-6" variant="subtle" :title="sendBlock.desc" :icon="sendBlock.icon" :color="sendBlock.color" />
    <rbph-message-edit
      v-else
      v-model:draft="draftMessage"
      v-model:content-type="draftContentType"
      class="my-6"
      placeholder="发送站内信"
      :content-types="pageData?.perm.content_type"
      :disabled="!canSend || submitLoading"
      :loading="!pageData || submitLoading"
      @submit="submitMessage"
    />
    <div v-if="pageData && messages.length > 0" class="flex flex-wrap gap-4">
      <u-card v-for="msg in messages" :key="msg.id" class="w-full" variant="subtle" :ui="{ body: 'sm:p-0 p-0' }">
        <u-collapsible :default-open="true" :unmount-on-hide="false">
          <div class="px-5 py-3 flex items-center group dark:bg-slate-800 bg-slate-100 cursor-pointer">
            <u-icon class="align-middle me-2 text-primary" name="material-symbols:chat-outline-rounded" />
            <div class="text-sm flex-1 flex flex-wrap justify-between">
              <div>
                <u-badge v-if="msg.sender_type === RbTicketSenderType.Host" variant="soft" color="warning" class="me-1">工作人员</u-badge>
                <u-badge v-if="msg.sender_type === RbTicketSenderType.Team" variant="soft" class="me-1">队员</u-badge>
                {{ msg.sender.nickname }}
              </div>
              <div v-if="msg.ctime_at" class="text-secondary text-xs flex items-center ms-1">
                <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle me-0.5" />
                发送于 {{ formatDate(msg.ctime_at) }}
              </div>
            </div>
            <u-icon name="material-symbols:expand-more-rounded" class="-me-1 size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
          </div>
          <template v-if="msg.content && msg.content_type !== undefined" #content>
            <div class="px-4 py-4 border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
              <rbph-content :content="msg as RbContent" />
            </div>
          </template>
        </u-collapsible>
      </u-card>
    </div>
    <u-empty v-else-if="pageData" icon="material-symbols:chat-info-outline-rounded" title="需要帮助？" description="发送站内信与主办方联系" />
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
  </div>
</template>
