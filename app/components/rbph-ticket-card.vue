<script setup lang="ts">
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

const puzzleStateLabel = computed(() => {
  switch (props.ticket.puzzle?.state) {
    case RbTeamPuzzleState.Solved:
      return '谜题已通过';
    case RbTeamPuzzleState.Unlocked:
      return '谜题未通过';
    default:
      return '谜题未解锁';
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
  <u-card variant="soft" :class="`transition-colors border border-${color}/25 border-dashed hover:border-${color} has-focus-visible:border-${color} cursor-pointer`" @click="navigateTo(`/tickets/${ticket.id}`)">
    <div class="flex gap-3 flex-col">
      <div class="flex items-baseline gap-2 flex-wrap">
        <u-badge v-if="ticket?.state === RbTicketState.Open" class="rounded-full py-1.5 px-2.5" color="success" variant="subtle" icon="material-symbols:add-circle-outline-rounded">开放中</u-badge>
        <u-badge v-else-if="ticket?.state === RbTicketState.Closed" class="rounded-full py-1.5 px-2.5" color="error" variant="subtle" icon="material-symbols:check-circle-outline-rounded">已关闭</u-badge>
        <span class="text-xl font-bold">人工提示 </span>
        <span class="text-muted text-1xl">#{{ ticket?.id }}</span>
      </div>
      <div v-if="ticket.puzzle || ticket.team" class="flex gap-3 text-muted text-sm leading-none flex-wrap">
        <div v-if="ticket.puzzle" class="flex items-center gap-1">
          <u-icon name="material-symbols:extension-outline-rounded" />
          {{ ticket.puzzle.title }}
        </div>
        <div v-if="ticket.puzzle" class="flex items-center gap-1">
          <u-icon :name="puzzleStateIcon" />
          {{ puzzleStateLabel }}
        </div>
        <div v-if="ticket.team" class="flex items-center gap-1">
          <u-icon name="material-symbols:groups-2-outline-rounded" />
          {{ ticket.team.name }}
        </div>
      </div>
    </div>
  </u-card>
</template>
