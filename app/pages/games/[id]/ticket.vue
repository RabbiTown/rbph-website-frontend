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

const pageData = ref<TicketMessageInfo>();

async function updateData(newId: number | undefined = undefined): Promise<boolean> {
  const gameId = newId || game.value?.id;
  if (gameId) {
    try {
      const { data } = await api.get<TicketMessageInfo>(`/games/${gameId}/tickets/self`);
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

const submitLoading = ref(false);

const draftMessage = ref('');
async function submitMessage() {
  submitLoading.value = true;

  const gameId = game.value?.id;
  if (gameId) {
    try {
      const { code } = await api.post<TicketSendResponse>(
        `/games/${gameId}/tickets/self/send`,
        { content: draftMessage.value },
        { errorHints: { [-1]: '队伍站内信被禁用。', [-2]: '积压信息过多，请先等待工作人员回复。', [-3]: '内容类型无效或无权使用。', [-4]: '发送的信息过长。', [-5]: '信息要求的费用无效。' } },
      );
      draftMessage.value = '';

      if (code === 0) {
        toast.add({
          title: '已发送站内信',
          description: '请等待工作人员回复。',
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        updateData();
      }
    } catch (error) {
      handleError(error, '站内信发送失败');
    }
  }

  submitLoading.value = false;
}
</script>

<template>
  <div>
    <div class="py-6">
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div class="text-3xl font-bold">站内信</div>
      </div>
    </div>
    <u-chat-prompt v-model="draftMessage" class="mb-6" placeholder="发送站内信" :ui="{ footer: 'text-muted mt-1 justify-end' }" :rows="3" :disabled="!pageData || submitLoading" :loading="!pageData" @submit="submitMessage">
      <u-chat-prompt-submit variant="soft" class="rounded-full cursor-pointer" :disabled="!pageData || submitLoading" :loading="submitLoading" />
      <template #footer>
        <icon name="material-symbols:markdown-outline-rounded" />
        <span class="text-xs"> 支持 Markdown 语法 · 使用 Shift + Enter 换行</span>
      </template>
    </u-chat-prompt>
    <div v-if="pageData && pageData.messages.length > 0" class="flex flex-wrap gap-4">
      <u-card v-for="msg in pageData.messages" :key="msg.id" class="w-full" variant="subtle" :ui="{ body: 'sm:p-0 p-0' }">
        <u-collapsible :default-open="true" :unmount-on-hide="false">
          <div class="px-5 py-3 flex items-center group dark:bg-slate-800 bg-slate-100 cursor-pointer">
            <icon class="align-middle me-2 text-primary" name="material-symbols:chat-outline-rounded" />
            <div class="text-sm flex-1 flex flex-wrap justify-between">
              <div>
                <u-badge v-if="msg.sender_type === RbTicketSenderType.Host" variant="soft" color="warning" class="me-1">工作人员</u-badge>
                <u-badge v-if="msg.sender_type === RbTicketSenderType.Team" variant="soft" class="me-1">队员</u-badge>
                {{ msg.sender.nickname }}
              </div>
              <div v-if="msg.ctime_at" class="text-secondary text-xs flex items-center ms-1">
                <icon name="material-symbols:schedule-outline-rounded" class="align-middle me-0.5" />
                发送于 {{ formatDate(msg.ctime_at) }}
              </div>
            </div>
            <icon name="material-symbols:expand-more-rounded" class="-me-1 size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
          </div>
          <template v-if="msg.content && msg.content_type" #content>
            <div class="px-4 py-px border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
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
