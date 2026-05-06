<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui/runtime/components/Breadcrumb.vue.js';

definePageMeta({
  layout: 'game',
});

useUser().required();

const api = useApi();
const route = useRoute();
const toast = useToast();

const game = useGame().ref;

type TicketFullInfo = TicketAggreInfo & TicketMessageInfo;

const ticket = ref<TicketFullInfo>();

const ticket_id = computed(() => route.params.id as string);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: `人工提示 #${ticket_id.value}` }, { text: game.value?.title, sep: ' - ' }])),
});

async function updateData(new_id: string | undefined = undefined) {
  const id = new_id ? parseInt(new_id) : ticket.value?.id || NaN;
  if (isNaN(id)) throw 'Invalid ticket id';

  if (ticket.value?.id !== id) {
    try {
      const { data } = await useApi().get<TicketFullInfo>(`/tickets/${new_id}`);
      ticket.value = data;

      if (data.game_id) {
        updateGameState(data.game_id.toString());
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
        { errorHints: { [-1]: '这条人工提示已关闭。', [-2]: '积压信息过多，请先等待工作人员回复。', [-3]: '内容类型无效或无权使用。', [-4]: '发送的信息过长。', [-5]: '信息要求的费用无效。' } },
      );
      draftMessage.value = '';

      if (code === 0) {
        toast.add({
          title: '已发送进一步询问',
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
  <div v-if="ticket" class="py-6">
    <u-breadcrumb class="mb-6" :items="breadItems" />
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
    <u-chat-prompt v-model="draftMessage" class="my-6" placeholder="进一步询问" :ui="{ footer: 'text-muted mt-1 justify-end' }" :rows="3" :disabled="!pageData || submitLoading" :loading="!pageData" @submit="submitMessage">
      <u-chat-prompt-submit variant="soft" class="rounded-full cursor-pointer" :disabled="!ticket || submitLoading" :loading="submitLoading" />
      <template #footer>
        <icon name="material-symbols:markdown-outline-rounded" />
        <span class="text-xs"> 支持 Markdown 语法 · 使用 Shift + Enter 换行</span>
      </template>
    </u-chat-prompt>
  </div>
</template>
