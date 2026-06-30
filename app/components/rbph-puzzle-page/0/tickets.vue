<script setup lang="ts">
const { puzzle } = usePuzzleContext();

const api = useApi();
const toast = useToast();
const team = useTeam().ref;
const game = useGame().ref;
const user = useUser().ref;
const isStaff = computed(() => (user.value?.urole ?? RbUserRole.User) >= RbUserRole.Moderator);
const isAdmin = computed(() => user.value?.urole === RbUserRole.Admin);

type StaffView = 'staff' | 'team';

const pageData = ref<TicketPuzzleList>();
const staffTickets = ref<TicketSummary[]>();
const staffView = ref<StaffView>('staff');
const selectedTeamId = ref<number>();
const selectedAdminTeam = ref<StaffTeamOption>();
const selectedTeam = computed(() => (isAdmin.value ? selectedAdminTeam.value : team.value));
const canOpenTicket = computed(() => pageData.value?.open_block === TicketOpenBlock.Ok);

function deriveTicket(ticket: TicketSummary, targetTeam: Pick<RbTeam, 'id' | 'name' | 'state'> | undefined = team.value): TicketSummary {
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

  const derivedTeam = targetTeam
    ? {
        id: ticket.team?.id ?? targetTeam.id,
        name: ticket.team?.name ?? targetTeam.name,
        state: ticket.team?.state ?? targetTeam.state,
      }
    : ticket.team;

  return {
    ...ticket,
    game_id: ticket.game_id ?? puzzleData?.game_id ?? game.value?.id,
    team: derivedTeam,
    puzzle: derivedPuzzle,
  };
}

function derivePuzzleList(data: TicketPuzzleList, targetTeam?: Pick<RbTeam, 'id' | 'name' | 'state'>): TicketPuzzleList {
  return {
    ...data,
    tickets: data.tickets.map(ticket => deriveTicket(ticket, targetTeam)),
  };
}

async function updateData(): Promise<boolean> {
  const puzzleId = puzzle.value?.data.id;
  if (puzzleId) {
    try {
      if (isStaff.value) {
        const gameId = puzzle.value?.data.game_id;
        if (staffView.value === 'team') {
          if (!isAdmin.value) selectedTeamId.value = team.value?.id;
          if (!selectedTeamId.value) return true;
          const { data } = await api.get<TicketPuzzleList>(`/games/${gameId}/tickets/staff/puzzle/${puzzleId}/teams/${selectedTeamId.value}`);
          pageData.value = derivePuzzleList(data, selectedTeam.value);
          return true;
        }
        const { data } = await api.get<StaffTicketListResponse>(`/games/${gameId}/tickets/staff`, {
          query: { kind: 'puzzle', puzzle_id: puzzleId, state: 'all' },
        });
        staffTickets.value = data.tickets;
        return true;
      }
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
  [puzzle, isStaff, team],
  async () => {
    pageData.value = undefined;
    staffTickets.value = undefined;
    selectedTeamId.value = team.value?.id;
    selectedAdminTeam.value = team.value
      ? {
          id: team.value.id,
          name: team.value.name,
          state: team.value.state,
        }
      : undefined;
    updateData();
  },
  { immediate: true },
);

watch([staffView, selectedTeamId], () => {
  if (!isStaff.value) return;
  pageData.value = undefined;
  if (staffView.value === 'staff') staffTickets.value = undefined;
  updateData();
});

useSync().listen(SyncMessageType.TicketUpdated, ({ data }) => {
  if (data.puzzle_id === puzzle.value?.data.id) updateData();
});

const submitLoading = ref(false);

const draftMessage = ref('');
const draftContentType = ref(RbContentType.UnsafeMarkdown);
async function submitMessage() {
  submitLoading.value = true;

  const puzzleId = puzzle.value?.data.id;
  if (puzzleId) {
    try {
      const gameId = puzzle.value?.data.game_id;
      const staffTarget = isStaff.value && staffView.value === 'team' ? selectedTeam.value : undefined;
      const endpoint = staffTarget ? `/games/${gameId}/tickets/staff/puzzle/${puzzleId}/teams/${staffTarget.id}` : `/puzzles/${puzzleId}/tickets`;
      const { code, data } = await api.post<TicketOpenResponse>(endpoint, { content: draftMessage.value, content_type: draftContentType.value } satisfies TicketSendRequest, {
        errorHints: { [-1]: '无法处理请求。', [-2]: '同时只能请求一个人工提示。', [-3]: '题目人工提示暂未开放。', [-4]: '内容类型无效或无权使用。', [-5]: '发送的信息过长。' },
      });
      draftMessage.value = '';

      if (code === 0) {
        toast.add({
          title: staffTarget ? `已为 ${staffTarget.name} 发起人工提示` : '已请求人工提示',
          description: staffTarget ? '队伍会收到该人工提示和通知。' : '请等待工作人员回复。',
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        const openedTicket = data.thread.ticket;
        if (openedTicket) {
          const tickets = pageData.value?.tickets ?? [];
          const derivedTicket = deriveTicket(openedTicket, staffTarget);
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
    <div v-if="isStaff" class="mb-4 flex flex-col gap-3">
      <u-tabs
        v-model="staffView"
        :items="[
          { label: '工作人员视图', value: 'staff', icon: 'material-symbols:near-me-outline-rounded' },
          { label: '队伍视图', value: 'team', icon: 'material-symbols:groups-2-outline-rounded' },
        ]"
        :content="false"
        variant="link"
      />
      <rbph-staff-team-select v-if="staffView === 'team' && isAdmin && puzzle?.data.game_id" v-model="selectedTeamId" v-model:team="selectedAdminTeam" :game-id="puzzle.data.game_id" placeholder="输入队伍名称搜索" class="w-full sm:max-w-80" />
      <u-alert v-else-if="staffView === 'team' && team" variant="subtle" color="neutral" icon="material-symbols:groups-2-outline-rounded" :title="`本队视图：${team.name}`" />
    </div>

    <div v-if="isStaff && staffView === 'staff' && staffTickets" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <u-alert class="flex-1" variant="subtle" title="工作人员视图" description="这里显示所有队伍针对本题发起的人工提示。" icon="material-symbols:near-me-outline-rounded" color="warning" />
        <u-button :to="`/games/${puzzle?.data.game_id}/staff/inbox?kind=puzzle&puzzle_id=${puzzle?.data.id}`" label="在工作台打开" icon="material-symbols:inbox-outline-rounded" />
      </div>
      <rbph-ticket-card v-for="ticket in staffTickets" :key="ticket.id" :ticket="ticket" />
      <u-empty v-if="staffTickets.length === 0" icon="material-symbols:inbox-outline-rounded" title="本题暂无人工提示" />
    </div>
    <u-empty
      v-else-if="isStaff && staffView === 'team' && !selectedTeamId"
      icon="material-symbols:group-search-outline-rounded"
      :title="isAdmin ? '请选择队伍' : '你当前没有加入队伍'"
      :description="isAdmin ? '输入队伍名称搜索，选择后可查看其人工提示状态并发起人工提示。' : 'Moderator 只能查看本队视图。'"
    />
    <div v-else-if="pageData" class="flex flex-col gap-4">
      <u-alert
        v-if="canOpenTicket"
        variant="subtle"
        :title="isStaff && selectedTeam ? `可以为 ${selectedTeam.name} 发起人工提示。` : '你可以请求人工提示。'"
        :description="isStaff && selectedTeam ? '发起后将以工作人员消息开始会话，并通知该队伍。' : '如果有预设提示无法解决的困惑，请询问人工提示。'"
        icon="material-symbols:near-me-outline-rounded"
        color="warning"
      />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.Disabled" variant="subtle" title="暂时不能请求人工提示。" description="本题未启用人工提示。" icon="material-symbols:near-me-disabled-outline-rounded" color="error" />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.FeatureClosed" variant="subtle" title="人工提示暂未开放" description="比赛当前不允许创建新的人工提示工单。" icon="material-symbols:near-me-disabled-outline-rounded" color="warning" />
      <u-alert
        v-else-if="pageData.open_block === TicketOpenBlock.CurrentPuzzlePending"
        variant="subtle"
        title="暂时不能请求人工提示。"
        description="本题已有开放中的人工提示，请在下方会话中继续沟通。"
        icon="material-symbols:near-me-disabled-outline-rounded"
        color="error"
      />
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
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.Cooldown" variant="subtle" title="暂时不能请求人工提示。" icon="material-symbols:hourglass-outline-rounded" color="error">
        <template #description>
          {{ cooldown ? `本题的人工提示将在 ${formatTime(cooldown)} 后开放。` : '本题的人工提示仍在冷却中。' }}
        </template>
      </u-alert>
      <rbph-message-edit
        v-if="canOpenTicket"
        v-model:draft="draftMessage"
        v-model:content-type="draftContentType"
        class="mb-6"
        :content-types="[RbContentType.UnsafeMarkdown]"
        :placeholder="isStaff && selectedTeam ? `为 ${selectedTeam.name} 发起人工提示` : '请求人工提示'"
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
