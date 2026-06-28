<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

const props = defineProps<{
  currencyId?: number | null;
}>();

const emit = defineEmits<{
  updated: [time: number];
}>();

interface CurrencyActivitySummary {
  currency_id: number;
  init_amount: number;
  current_amount: number;
  logged_delta: number;
}

interface CurrencyActivityResponse {
  data: RbTeamActivity[];
  summary: CurrencyActivitySummary | null;
}

type CurrencyActivityRow = { kind: 'activity'; id: number; activity: RbTeamActivity } | { kind: 'auto'; id: string; delta: number; balance: number } | { kind: 'init'; id: string; delta: number; balance: number };

const pageSize = 20;
const api = useApi();
const game = useGame().ref;
const currency = useCurrency().getAllCurrent();
const activities = ref<RbTeamActivity[]>([]);
const currencySummary = ref<CurrencyActivitySummary | null>(null);
const loading = ref(false);
const pageIndex = ref(0);
const cursors = ref<(number | undefined)[]>([undefined]);
const reachedEnd = ref(false);
const isCurrencyMode = computed(() => props.currencyId !== undefined && props.currencyId !== null);

const paginationTotal = computed(() => {
  if (activities.value.length === 0) return 0;
  if (reachedEnd.value) return pageIndex.value * pageSize + activities.value.length;
  return (pageIndex.value + 2) * pageSize;
});

function activityQuery(before?: number) {
  const query: Record<string, number | boolean> = { limit: pageSize };
  if (before !== undefined) query.before = before;
  if (props.currencyId !== undefined && props.currencyId !== null) {
    query.currency_id = props.currencyId;
    query.include_summary = true;
  }
  return query;
}

async function fetchActivities(before?: number) {
  if (!game.value?.id) return [];
  if (isCurrencyMode.value) {
    const { data } = await api.get<CurrencyActivityResponse>(`/games/${game.value.id}/teams/self/activity`, { query: activityQuery(before) });
    currencySummary.value = data.summary;
    return data.data;
  }

  const { data } = await api.get<RbTeamActivity[]>(`/games/${game.value.id}/teams/self/activity`, { query: activityQuery(before) });
  currencySummary.value = null;
  return data;
}

async function loadPage(index: number) {
  if (!game.value?.id || loading.value) return;

  loading.value = true;
  try {
    const data = await fetchActivities(cursors.value[index]);
    if (data.length === 0 && index > 0) {
      reachedEnd.value = true;
      return;
    }

    activities.value = data;
    pageIndex.value = index;
    reachedEnd.value = data.length < pageSize;
    emit('updated', Date.now());
  } catch (error) {
    handleError(error, '队伍动态获取失败');
  } finally {
    loading.value = false;
  }
}

async function reloadActivities() {
  cursors.value = [undefined];
  reachedEnd.value = false;
  currencySummary.value = null;
  await loadPage(0);
}

async function nextPage() {
  if (loading.value || reachedEnd.value || activities.value.length === 0) return;

  const nextIndex = pageIndex.value + 1;
  if (cursors.value[nextIndex] === undefined) {
    cursors.value[nextIndex] = activities.value[activities.value.length - 1]?.id;
  }
  await loadPage(nextIndex);
}

async function updatePage(page: number) {
  const index = page - 1;
  if (index === pageIndex.value || index < 0 || loading.value) return;
  if (index === pageIndex.value + 1) {
    await nextPage();
    return;
  }
  if (index < pageIndex.value) {
    await loadPage(index);
  }
}

function formatCurrencyAmount(amount: number) {
  return intPrecString(amount, selectedCurrency.value?.prec ?? 0, true, ' ');
}

function formatCurrencyBalance(amount: number) {
  return intPrecString(amount, selectedCurrency.value?.prec ?? 0);
}

function formatCurrencyCost(currencyId: number | null | undefined, amount: number | null | undefined) {
  if (!currencyId || !amount) return '';
  const cur = currency.value[currencyId];
  if (!cur) return `${amount}`;
  return `${intPrecString(amount, cur.prec)} ${cur.name}`;
}

function activityView(activity: RbTeamActivity) {
  const data = activity.data;
  const puzzleTitle = activitySimpleNamedLabel(data.puzzle, '题目');
  const hintTitle = activitySimpleNamedLabel(data.hint, '提示');
  const teamTitle = activitySimpleNamedLabel(data.team, '队伍');
  const ticketTitle = activityTicketLabel(data.ticket, data.puzzle);
  const currencyText = formatActivityLogCurrency(activity);
  const targetUser = activityUserLabel(data.target_user, activity.target_user_id);
  const actorTitle = (action: string) => activityActorTitle(activity, action, true);

  switch (activity.type) {
    case 'team.created':
      return { icon: 'material-symbols:group-add-outline-rounded', color: 'success' as const, title: actorTitle(`创建了队伍${data.team?.name ? teamTitle : ''}`), details: [] };
    case 'team.updated':
      return { icon: 'material-symbols:edit-outline-rounded', color: 'neutral' as const, title: actorTitle('更新了队伍信息'), details: [] };
    case 'team.member.joined':
      return { icon: 'material-symbols:person-add-outline-rounded', color: 'success' as const, title: actorTitle('加入了队伍'), details: [] };
    case 'team.member.left':
      return { icon: 'material-symbols:logout-rounded', color: 'neutral' as const, title: actorTitle('离开了队伍'), details: [] };
    case 'team.member.kicked':
      return { icon: 'material-symbols:person-remove-outline-rounded', color: 'warning' as const, title: actorTitle(targetUser ? `移除了成员 ${targetUser}` : '移除了成员'), details: [] };
    case 'team.member.promoted':
      return { icon: 'material-symbols:award-star-outline-rounded', color: 'primary' as const, title: actorTitle(targetUser ? `将 ${targetUser} 设置为队长` : '变更了队长'), details: [] };
    case 'submission.judged':
    case 'submission.backend_added': {
      const submission = data.submission;
      const consequences = activityConsequenceText(activity, id => currency.value[id], formatDate);
      const answer = submission?.answer !== undefined && submission.answer !== null ? ` [${submission.answer}]` : '';
      return {
        icon: 'material-symbols:assignment-turned-in-outline-rounded',
        color: submission?.action !== undefined && submission.action !== null && submission.action > 0 ? ('success' as const) : submission?.action === 0 ? ('warning' as const) : ('info' as const),
        title: actorTitle(`向${puzzleTitle}提交了答案${answer}`),
        details: [`提交结果：${activityJudgeResultLabel(submission?.action, submission?.ignored)}${consequences ? `（${consequences}）` : ''}${submission?.result ? `（${submission.result}）` : ''}`],
      };
    }
    case 'puzzle.solved':
    case 'puzzle.backend_solved':
      return { icon: 'material-symbols:check-circle-outline-rounded', color: 'success' as const, title: actorTitle(`解出了${puzzleTitle}`), details: [] };
    case 'puzzle.unlocked':
      return { icon: 'material-symbols:lock-open-outline-rounded', color: 'primary' as const, title: `开放了题目${puzzleTitle}`, details: [] };
    case 'game.started':
      return { icon: 'material-symbols:flag-outline-rounded', color: 'success' as const, title: actorTitle('开始了比赛'), details: [] };
    case 'hint.purchased':
      return {
        icon: 'material-symbols:emoji-objects-outline-rounded',
        color: 'primary' as const,
        title: actorTitle(`在${puzzleTitle}解锁了提示${hintTitle}`),
        details: [data.hint?.cost_id && data.hint?.cost_amount ? `已花费 ${formatCurrencyCost(data.hint.cost_id, data.hint.cost_amount)} 解锁提示` : ''].filter(Boolean),
      };
    case 'currency.penalty':
      return { icon: 'material-symbols:payments-outline-rounded', color: 'warning' as const, title: actorTitle(data.puzzle?.title ? `在${puzzleTitle}提交答案错误惩罚` : '提交答案错误惩罚'), details: [`变动：${currencyText}`] };
    case 'currency.cost':
    case 'currency.added':
      return {
        icon: 'material-symbols:account-balance-wallet-outline-rounded',
        color: activity.delta_amount && activity.delta_amount < 0 ? ('warning' as const) : ('success' as const),
        title: actorTitle(activityCurrencyReasonTitle(activity)),
        details: [`变动：${currencyText}${activityCurrencyAfter(activity) ? `；余额：${activityCurrencyAfter(activity)}` : ''}`].filter(Boolean),
      };
    case 'ticket.opened':
      return { icon: 'material-symbols:near-me-outline-rounded', color: 'success' as const, title: actorTitle(`开启了人工提示${ticketTitle}`), details: [] };
    case 'ticket.closed':
      return { icon: 'material-symbols:check-circle-outline-rounded', color: 'neutral' as const, title: actorTitle(`关闭了人工提示${ticketTitle}`), details: [] };
    case 'ticket.message_purchased':
      return { icon: 'material-symbols:mark-email-read-outline-rounded', color: 'primary' as const, title: actorTitle(`在人工提示${ticketTitle}中购买了付费消息`), details: [] };
    default:
      return { icon: 'material-symbols:history-rounded', color: 'neutral' as const, title: actorTitle(activity.type), details: [] };
  }
}

const selectedCurrency = computed(() => (props.currencyId !== undefined && props.currencyId !== null ? currency.value[props.currencyId] : undefined));

const currencyRows = computed<CurrencyActivityRow[]>(() => {
  const rows: CurrencyActivityRow[] = [];
  const summary = currencySummary.value;
  const selected = selectedCurrency.value;

  if (pageIndex.value === 0 && summary && selected && selected.growth !== 0) {
    rows.push({
      kind: 'auto',
      id: `auto-${summary.currency_id}`,
      delta: summary.current_amount - summary.init_amount - Number(summary.logged_delta),
      balance: summary.current_amount,
    });
  }

  rows.push(...activities.value.map(activity => ({ kind: 'activity' as const, id: activity.id, activity })));

  if (reachedEnd.value && summary && summary.init_amount !== 0) {
    rows.push({
      kind: 'init',
      id: `init-${summary.currency_id}`,
      delta: summary.init_amount,
      balance: summary.init_amount,
    });
  }

  return rows;
});

const currencyColumns = computed<TableColumn<CurrencyActivityRow>[]>(() => [
  {
    accessorKey: 'event',
    header: '事件',
    cell: ({ row }) => {
      if (row.original.kind === 'auto') {
        return h('div', { class: 'wrap-break-word py-1 text-sm font-medium text-highlighted' }, '随时间变化自动获得');
      }
      if (row.original.kind === 'init') {
        return h('div', { class: 'wrap-break-word py-1 text-sm font-medium text-highlighted' }, '初始获得');
      }

      const activity = row.original.activity;
      const view = activityView(activity);
      return h('div', { class: 'min-w-0 py-1' }, [h('div', { class: 'wrap-break-word text-sm font-medium text-highlighted' }, view.title), h('time', { class: 'mt-1 block text-xs text-muted' }, formatDate(activity.ctime_at))]);
    },
    meta: {
      class: {
        th: 'w-64 md:w-none wrap-anywhere whitespace-normal',
        td: 'w-64 md:w-none wrap-anywhere whitespace-normal',
      },
    },
  },
  {
    accessorKey: 'delta',
    header: '变动',
    cell: ({ row }) => {
      const delta = row.original.kind === 'activity' ? Number(row.original.activity.data.delta ?? row.original.activity.delta_amount ?? 0) : row.original.delta;
      const color = delta > 0 ? 'text-success' : delta < 0 ? 'text-warning' : 'text-muted';
      return h('span', { class: ['font-medium', color] }, formatCurrencyAmount(delta));
    },
    meta: {
      class: {
        th: 'w-28',
        td: 'w-28 whitespace-nowrap',
      },
    },
  },
  {
    accessorKey: 'balance',
    header: '结余',
    cell: ({ row }) => {
      const balance = row.original.kind === 'activity' ? Number(row.original.activity.data.after ?? 0) : row.original.balance;
      return h('span', { class: 'text-highlighted' }, formatCurrencyBalance(balance));
    },
    meta: {
      class: {
        th: 'w-28',
        td: 'w-28 whitespace-nowrap',
      },
    },
  },
]);

function activityIconClass(activity: RbTeamActivity) {
  const color = activityView(activity).color;
  if (color === 'success') return 'size-4 text-success';
  if (color === 'warning') return 'size-4 text-warning';
  if (color === 'primary') return 'size-4 text-primary';
  if (color === 'info') return 'size-4 text-info';
  return 'size-4 text-muted';
}

watch(
  () => [game.value?.id, props.currencyId] as const,
  () => reloadActivities(),
  { immediate: true },
);

defineExpose({
  reload: reloadActivities,
});
</script>

<template>
  <div>
    <div v-if="loading && activities.length === 0" class="flex items-center gap-2 py-1 text-sm text-muted">
      <u-icon name="material-symbols:progress-activity" class="size-4 animate-spin" />
      <span>加载中</span>
    </div>
    <div v-else-if="isCurrencyMode ? currencyRows.length === 0 : activities.length === 0" class="py-8 text-sm text-muted">暂无记录</div>
    <u-table v-else-if="isCurrencyMode" :loading="loading" :data="currencyRows" :columns="currencyColumns" :ui="{ base: 'table-fixed w-full' }" />
    <div v-else class="divide-y divide-default">
      <div v-for="activity in activities" :key="activity.id" :class="['flex gap-3 py-4 first:pt-0 last:pb-0', activityView(activity).details.length === 0 ? 'items-center' : 'items-start']">
        <div :class="['flex size-8 shrink-0 items-center justify-center rounded-md bg-muted', activityView(activity).details.length === 0 ? '' : 'mt-0.5']">
          <u-icon :name="activityView(activity).icon" :class="activityIconClass(activity)" />
        </div>
        <div class="min-w-0 flex-1">
          <div :class="['flex justify-between gap-3', activityView(activity).details.length === 0 ? 'items-center' : 'items-start']">
            <div class="min-w-0 wrap-break-word text-sm font-medium text-highlighted">
              <u-badge v-if="isStaffActivityLog(activity)" size="sm" color="warning" variant="soft" class="mr-1 align-middle mb-0.5">工作人员</u-badge>
              <span>{{ activityView(activity).title }}</span>
              <time class="mt-1 block text-xs font-normal text-muted sm:hidden">{{ formatDate(activity.ctime_at) }}</time>
            </div>
            <time class="hidden shrink-0 text-xs text-muted sm:block">{{ formatDate(activity.ctime_at) }}</time>
          </div>
          <div v-for="detail in activityView(activity).details" :key="detail" class="mt-1 wrap-break-word text-sm text-muted">
            {{ detail }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="paginationTotal > pageSize" class="mt-4 flex justify-end">
      <u-pagination :page="pageIndex + 1" :total="paginationTotal" :items-per-page="pageSize" variant="soft" active-variant="subtle" :disabled="loading" @update:page="updatePage" />
    </div>
  </div>
</template>
