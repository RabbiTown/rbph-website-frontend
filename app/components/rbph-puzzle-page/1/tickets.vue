<script setup lang="ts">
const { puzzle } = usePuzzleContext();

const api = useApi();
const toast = useToast();
const team = useTeam().ref;
const game = useGame().ref;

const pageData = ref<TicketPuzzleList>();
const canOpenTicket = computed(() => pageData.value?.open_block === TicketOpenBlock.Ok);

function deriveTicket(ticket: TicketSummary): TicketSummary {
  const puzzleData = puzzle.value?.data;
  const puzzleState = puzzle.value?.state;

  const ticketPuzzle = ticket.puzzle;
  const derivedPuzzle = puzzleData
    ? {
        id: ticketPuzzle?.id ?? puzzleData.id,
        title: ticketPuzzle?.title ?? puzzleData.title,
        round: ticketPuzzle?.round ?? puzzleData.round,
        state: ticketPuzzle?.state ?? puzzleState?.state ?? RbTeamPuzzleState.Locked,
      }
    : ticketPuzzle;

  const derivedTeam = team.value
    ? {
        id: ticket.team?.id ?? team.value.id,
        name: ticket.team?.name ?? team.value.name,
        state: ticket.team?.state ?? team.value.state,
      }
    : ticket.team;

  return {
    ...ticket,
    game_id: ticket.game_id ?? puzzleData?.game_id ?? game.value?.id,
    team: derivedTeam,
    puzzle: derivedPuzzle,
  };
}

function derivePuzzleList(data: TicketPuzzleList): TicketPuzzleList {
  return {
    ...data,
    tickets: data.tickets.map(deriveTicket),
  };
}

async function updateData(): Promise<boolean> {
  const puzzleId = puzzle.value?.data.id;
  if (puzzleId) {
    try {
      const { data } = await api.get<TicketPuzzleList>(`/puzzles/${puzzleId}/tickets`);
      pageData.value = derivePuzzleList(data);
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
const draftContentType = ref(RbContentType.UnsafeMarkdown);
async function submitMessage() {
  submitLoading.value = true;

  const puzzleId = puzzle.value?.data.id;
  if (puzzleId) {
    try {
      const { code, data } = await api.post<TicketOpenResponse>(`/puzzles/${puzzleId}/tickets`, { content: draftMessage.value, content_type: draftContentType.value } satisfies TicketSendRequest, {
        errorHints: { [-1]: '无法处理请求。', [-2]: '同时只能请求一个人工提示。', [-3]: '题目人工提示暂未开放。', [-4]: '内容类型无效或无权使用。', [-5]: '发送的信息过长。' },
      });
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
          const derivedTicket = deriveTicket(openedTicket);
          pageData.value = {
            open_block: TicketOpenBlock.CurrentPuzzlePending,
            open_tickets: [],
            tickets: [derivedTicket, ...tickets.filter(ticket => ticket.id !== derivedTicket.id)],
          };
        }
      }
    } catch (error) {
      handleError(error, '人工提示请求失败');
    }
  }

  submitLoading.value = false;
}

const currentTime = useCurrentTimeSec();

const cooldown = computed(() => {
  const till = pageData.value?.cooldown_till ? new Date(pageData.value.cooldown_till).getTime() : undefined;
  if (!till) return 0;
  return Math.max(till - currentTime.value, 0);
});
</script>

<template>
  <div>
    <div v-if="pageData" class="flex flex-col gap-4">
      <u-alert v-if="canOpenTicket" variant="subtle" title="你可以请求人工提示。" description="如果有预设提示无法解决的困惑，请询问人工提示。" icon="material-symbols:near-me-outline-rounded" color="warning" />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.PendingLimit" variant="subtle" title="暂时不能请求人工提示。" icon="material-symbols:near-me-disabled-outline-rounded" color="error">
        <template #description>
          当前同时开放的人工提示已达到上限，请考虑关闭以下请求。
          <div class="flex mt-1.5 flex-wrap gap-1">
            <nuxt-link v-for="el in pageData.open_tickets" :key="el.id" :to="`/tickets/${el.id}`">
              <u-badge color="success" variant="subtle" icon="material-symbols:add-circle-outline-rounded">{{ el.puzzle_title }} #{{ el.id }}</u-badge>
            </nuxt-link>
          </div>
        </template>
      </u-alert>
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.Cooldown && cooldown" variant="subtle" title="暂时不能请求人工提示。" icon="material-symbols:hourglass-outline-rounded" color="error">
        <template #description>
          本题的人工提示将在 {{ formatTime(cooldown) }} 后开放。
        </template>
      </u-alert>
      <rbph-message-edit
        v-if="canOpenTicket"
        v-model:draft="draftMessage"
        v-model:content-type="draftContentType"
        class="mb-6"
        :content-types="[RbContentType.UnsafeMarkdown]"
        placeholder="请求人工提示"
        :disabled="!pageData || submitLoading"
        :loading="!pageData || submitLoading"
        @submit="submitMessage"
      />
      <rbph-ticket-card v-for="ticket in pageData.tickets" :key="ticket.id" :ticket="ticket" />
    </div>
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
  </div>
</template>
