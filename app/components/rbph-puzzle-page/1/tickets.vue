<script setup lang="ts">
const puzzle = defineModel<RbPuzzleShowData | undefined>();

const api = useApi();
const toast = useToast();

const pageData = ref<TicketPuzzleList>();

async function updateData(): Promise<boolean> {
  const puzzleId = puzzle.value?.data.id;
  if (puzzleId) {
    try {
      const { data } = await api.get<TicketPuzzleList>(`/puzzles/${puzzleId}/tickets`);
      pageData.value = data;
      return true;
    } catch (error) {
      handleError(error, '获取人工提示信息失败');
    }
  }
  return false;
}

watch(
  puzzle,
  async () => {
    pageData.value = undefined;
    updateData();
  },
  { immediate: true },
);

const submitLoading = ref(false);

const draftMessage = ref('');
async function submitMessage() {
  submitLoading.value = true;

  const puzzleId = puzzle.value?.data.id;
  if (puzzleId) {
    try {
      const { code, data } = await api.post<TicketOpenResponse>(
        `/puzzles/${puzzleId}/tickets`,
        { content: draftMessage.value },
        { errorHints: { [-1]: '无法处理请求。', [-2]: '同时只能请求一个人工提示。', [-3]: '题目人工提示暂未开放。', [-4]: '内容类型无效或无权使用。', [-5]: '发送的信息过长。' } },
      );
      draftMessage.value = '';

      if (code === 0) {
        toast.add({
          title: '已请求人工提示',
          description: '请等待工作人员回复。',
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        const openedTicket = data.thread.ticket;
        if (openedTicket) {
          const tickets = pageData.value?.tickets ?? [];
          pageData.value = {
            can_open: false,
            block: TicketOpenBlock.Pending,
            tickets: [openedTicket, ...tickets.filter(ticket => ticket.id !== openedTicket.id)],
          };
        }
      }
    } catch (error) {
      handleError(error, '人工提示请求失败');
    }
  }

  submitLoading.value = false;
}
</script>

<template>
  <div>
    <div v-if="pageData" class="flex flex-col gap-4">
      <u-chat-prompt
        v-if="pageData.can_open"
        v-model="draftMessage"
        class="mb-6"
        placeholder="请求人工提示"
        :ui="{ footer: 'text-muted mt-1 justify-end' }"
        :rows="3"
        :disabled="!pageData || submitLoading"
        :loading="!pageData"
        @submit="submitMessage"
      >
        <u-chat-prompt-submit variant="soft" class="rounded-full cursor-pointer" :disabled="!pageData || submitLoading" :loading="submitLoading" />
        <template #footer>
          <icon name="material-symbols:markdown-outline-rounded" />
          <span class="text-xs"> 支持 Markdown 语法 · 使用 Shift + Enter 换行</span>
        </template>
      </u-chat-prompt>
      <rbph-ticket-card v-for="ticket in pageData.tickets" :key="ticket.id" :ticket="ticket" />
    </div>
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
  </div>
</template>
