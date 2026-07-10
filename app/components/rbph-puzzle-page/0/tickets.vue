<script setup lang="ts">
const { t } = useI18n();
const { puzzle } = usePuzzleContext();

const api = useApi();
const toast = useToast();
const team = useTeam().ref;
const game = useGame().ref;
const user = useUser().ref;
const isStaff = computed(() => (user.value?.urole ?? RbUserRole.User) >= RbUserRole.Moderator);
const isAdmin = computed(() => (user.value?.urole ?? RbUserRole.User) >= RbUserRole.Admin);

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
      handleError(error, t('ticket.loadFailed'));
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
        errorHints: {
          [-1]: t('ticket.invalidRequest'),
          [-2]: t('ticket.onlyOne'),
          [-3]: t('ticket.puzzleUnavailable'),
          [-4]: t('ticket.sendBlockType'),
          [-5]: t('ticket.sendBlockLength'),
          [-6]: t('ticket.featureClosed'),
          [-7]: t('ticket.sendBlockExistingOnly'),
          [-8]: t('ticket.teamFeatureBanned'),
        },
      });
      draftMessage.value = '';

      if (code === 0) {
        toast.add({
          title: staffTarget ? t('ticket.requestedFor', { team: staffTarget.name }) : t('ticket.sentSuccess'),
          description: staffTarget ? t('ticket.requestedForDesc') : t('ticket.sentSuccessDesc'),
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
      handleError(error, t('ticket.requestFailed'));
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
          { label: t('ticket.staffView'), value: 'staff', icon: 'material-symbols:near-me-outline-rounded' },
          { label: t('ticket.teamView'), value: 'team', icon: 'material-symbols:groups-2-outline-rounded' },
        ]"
        :content="false"
        variant="link"
      />
      <rbph-staff-team-select v-if="staffView === 'team' && isAdmin && puzzle?.data.game_id" v-model="selectedTeamId" v-model:team="selectedAdminTeam" :game-id="puzzle.data.game_id" :placeholder="t('pages.staffInbox.searchTeam')" class="w-full sm:max-w-80" />
      <u-alert v-else-if="staffView === 'team' && team" variant="subtle" color="neutral" icon="material-symbols:groups-2-outline-rounded" :title="t('ticket.ownTeamView', { team: team.name })" />
    </div>

    <div v-if="isStaff && staffView === 'staff' && staffTickets" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <u-alert class="flex-1" variant="subtle" :title="t('ticket.staffView')" :description="t('ticket.staffViewDesc')" icon="material-symbols:near-me-outline-rounded" color="warning" />
        <u-button :to="`/games/${puzzle?.data.game_id}/staff/inbox?kind=puzzle&puzzle_id=${puzzle?.data.id}`" :label="t('pages.staffInbox.openInInbox')" icon="material-symbols:inbox-outline-rounded" />
      </div>
      <rbph-ticket-card v-for="ticket in staffTickets" :key="ticket.id" :ticket="ticket" />
      <u-empty v-if="staffTickets.length === 0" icon="material-symbols:inbox-outline-rounded" :title="t('ticket.noPuzzleTickets')" />
    </div>
    <u-empty
      v-else-if="isStaff && staffView === 'team' && !selectedTeamId"
      icon="material-symbols:group-search-outline-rounded"
      :title="isAdmin ? t('ticket.selectTeam') : t('pages.profile.noTeam')"
      :description="isAdmin ? t('ticket.selectTeamDesc') : t('ticket.teamViewOnly')"
    />
    <div v-else-if="pageData" class="flex flex-col gap-4">
      <u-alert v-if="!isStaff && team?.is_banned && canOpenTicket" variant="subtle" :title="t('ticket.teamBannedCanRequest')" icon="material-symbols:warning-outline-rounded" color="warning">
        <template #description>
          <i18n-t keypath="ticket.restrictionDetails" tag="span" class="whitespace-nowrap">
            <template #activity><u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" :label="t('nav.teamActivity')" class="p-0 align-middle mb-0.5" /></template>
          </i18n-t>
        </template>
      </u-alert>
      <u-alert
        v-if="canOpenTicket"
        variant="subtle"
        :title="isStaff && selectedTeam ? t('ticket.canRequestFor', { team: selectedTeam.name }) : t('ticket.canRequest')"
        :description="isStaff && selectedTeam ? t('ticket.canRequestForDesc') : t('ticket.contact')"
        icon="material-symbols:near-me-outline-rounded"
        color="warning"
      />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.Disabled" variant="subtle" :title="t('ticket.temporarilyUnavailable')" :description="t('ticket.disabledForPuzzle')" icon="material-symbols:near-me-disabled-outline-rounded" color="error" />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.FeatureClosed" variant="subtle" :title="t('ticket.temporarilyUnavailable')" :description="t('ticket.featureClosed')" icon="material-symbols:near-me-disabled-outline-rounded" color="warning" />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.FeatureExistingOnly" variant="subtle" :title="t('ticket.newRequestUnavailable')" :description="t('ticket.featureExistingOnly')" icon="material-symbols:history-rounded" color="warning" />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.TeamFeatureBanned" variant="subtle" :title="t('ticket.teamFeatureBanned')" icon="material-symbols:block-outline" color="error">
        <template #description>
          <i18n-t keypath="ticket.restrictionDetails" tag="span" class="whitespace-nowrap">
            <template #activity><u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" :label="t('nav.teamActivity')" class="p-0 align-middle mb-0.5" /></template>
          </i18n-t>
        </template>
      </u-alert>
      <u-alert
        v-else-if="pageData.open_block === TicketOpenBlock.CurrentPuzzlePending"
        variant="subtle"
        :title="t('ticket.temporarilyUnavailable')"
        :description="t('ticket.currentPuzzlePending')"
        icon="material-symbols:near-me-disabled-outline-rounded"
        color="error"
      />
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.PendingLimit" variant="subtle" :title="t('ticket.temporarilyUnavailable')" icon="material-symbols:near-me-disabled-outline-rounded" color="error">
        <template #description>
          {{ t('ticket.pendingLimit') }}
          <div class="flex mt-1.5 flex-wrap gap-1">
            <nuxt-link v-for="el in pageData.open_tickets" :key="el.id" :to="`/tickets/${el.id}`">
              <u-badge color="success" variant="subtle" icon="material-symbols:add-circle-outline-rounded">{{ el.puzzle_title }} #{{ el.id }}</u-badge>
            </nuxt-link>
          </div>
        </template>
      </u-alert>
      <u-alert v-else-if="pageData.open_block === TicketOpenBlock.Cooldown" variant="subtle" :title="t('ticket.temporarilyUnavailable')" icon="material-symbols:hourglass-outline-rounded" color="error">
        <template #description>
          {{ cooldown ? t('ticket.opensAfter', { time: formatTime(cooldown) }) : t('ticket.coolingDown') }}
        </template>
      </u-alert>
      <rbph-message-edit
        v-if="canOpenTicket"
        v-model:draft="draftMessage"
        v-model:content-type="draftContentType"
        class="mb-6"
        :content-types="[RbContentType.UnsafeMarkdown]"
        :placeholder="isStaff && selectedTeam ? t('ticket.requestForPlaceholder', { team: selectedTeam.name }) : t('ticket.requestPlaceholder')"
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
