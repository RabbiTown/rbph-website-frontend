<script setup lang="ts">
const { t } = useI18n();
const props = defineProps<{ ticket: Partial<TicketAggreInfo> }>();

const color = computed(() => {
  switch (props.ticket.state) {
    case RbTicketState.Open:
      return 'success';
    case RbTicketState.Closed:
      return 'error';
    default:
      return 'secondary';
  }
});

const stateIcon = computed(() => {
  switch (props.ticket.state) {
    case RbTicketState.Open:
      return {
        name: 'material-symbols:add-circle-outline-rounded',
        label: t('ticket.open'),
        class: 'text-success',
      };
    case RbTicketState.Closed:
      return {
        name: 'material-symbols:check-circle-outline-rounded',
        label: t('ticket.closedState'),
        class: 'text-error',
      };
    default:
      return {
        name: 'material-symbols:circle-outline',
        label: '',
        class: 'text-secondary',
      };
  }
});

const puzzleStateLabel = computed(() => {
  switch (props.ticket.puzzle?.state) {
    case RbTeamPuzzleState.Solved:
      return t('ticket.puzzleSolved');
    case RbTeamPuzzleState.Unlocked:
      return t('ticket.puzzleUnsolved');
    default:
      return t('ticket.puzzleLocked');
  }
});

const puzzleStateIcon = computed(() => {
  switch (props.ticket.puzzle?.state) {
    case RbTeamPuzzleState.Solved:
      return 'material-symbols:check-circle-outline-rounded';
    case RbTeamPuzzleState.Unlocked:
      return 'material-symbols:circle-outline';
    default:
      return 'material-symbols:cancel-outline-rounded';
  }
});
</script>

<template>
  <u-card variant="soft" :ui="{ body: 'px-5 pb-4 pt-3 sm:px-5 sm:pb-4 sm:pt-3' }" :class="`transition-colors border border-${color}/25 border-dashed hover:border-${color} has-focus-visible:border-${color} cursor-pointer`" @click="navigateTo(`/tickets/${ticket.id}`)">
    <div class="flex items-start gap-3">
      <u-icon :name="stateIcon.name" :aria-label="stateIcon.label" role="img" class="mt-0.5 size-6 shrink-0" :class="stateIcon.class" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="text-lg font-bold">{{ ticket.puzzle?.title }}</span>
          <span class="text-muted text-1xl">#{{ ticket?.id }}</span>
        </div>
        <div v-if="ticket.puzzle || ticket.team || ticket.last_at" class="mb-0.5 flex flex-wrap gap-3 text-xs leading-none text-muted">
          <div v-if="ticket.team" class="flex items-center gap-1">
            <u-icon name="material-symbols:groups-2-outline-rounded" />
            {{ ticket.team.name }}
          </div>
          <div v-if="ticket.puzzle" class="flex items-center gap-1">
            <u-icon :name="puzzleStateIcon" />
            {{ puzzleStateLabel }}
          </div>
          <div v-if="ticket.last_at" class="flex items-center gap-1">
            <u-icon name="material-symbols:schedule-outline-rounded" />
            {{ formatDate(ticket.last_at) }}
          </div>
        </div>
      </div>
    </div>
  </u-card>
</template>
