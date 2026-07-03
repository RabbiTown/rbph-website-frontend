<script setup lang="ts">
interface AdminLogData extends ActivityLogEntry {
  id: number;
  scope: number;
  severity: number;
  game_id?: number | null;
  team_id?: number | null;
  user_id?: number | null;
  target_user_id?: number | null;
  puzzle_id?: number | null;
  round_id?: number | null;
  hint_id?: number | null;
  ticket_id?: number | null;
  submission_id?: number | null;
  currency_id?: number | null;
  ctime_at: string;
}

interface AdminLogResponse {
  code: number;
  logs: AdminLogData[];
  total: number;
}

const pageSize = 50;
const api = useApi();
const logs = ref<AdminLogData[]>([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const updateTime = ref<number | null>(null);

const filters = reactive({
  scope: null as number | null,
  severity: null as number | null,
  event_type: '',
  game_id: null as number | null | undefined,
  team_id: null as number | null | undefined,
  user_id: null as number | null | undefined,
});

const scopeItems = [
  { label: '全部范围', value: null },
  { label: '队伍动态', value: 1 },
  { label: '系统', value: 2 },
  { label: '管理', value: 3 },
  { label: '安全', value: 4 },
];

const severityItems = [
  { label: '全部级别', value: null },
  { label: '信息', value: 0 },
  { label: '警告', value: 1 },
  { label: '错误', value: 2 },
];

function scopeLabel(value: number) {
  return scopeItems.find(item => item.value === value)?.label ?? `scope:${value}`;
}

function severityMeta(value: number) {
  if (value === 1) return { label: '警告', color: 'warning' as const };
  if (value === 2) return { label: '错误', color: 'error' as const };
  return { label: '信息', color: 'neutral' as const };
}

function hasNumberFilter(value: number | null | undefined) {
  return typeof value === 'number';
}

const hasActiveFilters = computed(() => filters.scope !== null || filters.severity !== null || filters.event_type.trim() !== '' || hasNumberFilter(filters.game_id) || hasNumberFilter(filters.team_id) || hasNumberFilter(filters.user_id));

const activeFilterChips = computed(() =>
  [
    filters.scope !== null ? { key: 'scope', label: `范围：${scopeLabel(filters.scope)}` } : null,
    filters.severity !== null ? { key: 'severity', label: `级别：${severityMeta(filters.severity).label}` } : null,
    filters.event_type.trim() ? { key: 'event_type', label: `事件：${filters.event_type.trim()}` } : null,
    hasNumberFilter(filters.game_id) ? { key: 'game_id', label: `game:${filters.game_id}` } : null,
    hasNumberFilter(filters.team_id) ? { key: 'team_id', label: `team:${filters.team_id}` } : null,
    hasNumberFilter(filters.user_id) ? { key: 'user_id', label: `user:${filters.user_id}` } : null,
  ].filter((item): item is { key: keyof typeof filters; label: string } => item !== null),
);

function actorTitle(log: AdminLogData, action: string) {
  return activityActorTitle(log, action);
}

function submissionDetails(log: AdminLogData) {
  const submission = log.data.submission;
  if (!submission) return [];
  const result =
    submission.answer !== undefined && submission.answer !== null
      ? `答案 [${submission.answer}] 提交结果：${activityJudgeResultLabel(submission.action, submission.ignored)}`
      : `提交结果：${activityJudgeResultLabel(submission.action, submission.ignored)}`;
  return [result, submission.result ? `返回信息：${submission.result}` : ''].filter(Boolean);
}

function fieldDetails(fields: Record<string, boolean> | null | undefined, names: Record<string, string>) {
  if (!fields) return [];
  const changed = Object.entries(fields)
    .filter(([, enabled]) => enabled)
    .map(([key]) => names[key] ?? key);
  return changed.length > 0 ? [`修改字段：${changed.join('、')}`] : [];
}

function logView(log: AdminLogData) {
  const data = log.data;
  const puzzle = activityNamedLabel(data.puzzle, log.puzzle_id, '题目');
  const hint = activityNamedLabel(data.hint, log.hint_id, '提示');
  const ticket = activityTicketLabel(data.ticket, data.puzzle);
  const targetUser = activityUserLabel(data.target_user, log.target_user_id);
  const severity = severityMeta(log.severity);

  switch (log.type) {
    case 'auth.login':
      return { icon: 'material-symbols:login-rounded', color: 'success' as const, title: actorTitle(log, '登录'), details: [] };
    case 'auth.logout':
      return { icon: 'material-symbols:logout-rounded', color: 'neutral' as const, title: actorTitle(log, '退出登录'), details: [] };
    case 'auth.register_requested':
      return { icon: 'material-symbols:how-to-reg-outline-rounded', color: 'primary' as const, title: '请求注册账号', details: data.email ? [`邮箱：${data.email}`] : [] };
    case 'auth.registered':
      return { icon: 'material-symbols:person-add-outline-rounded', color: 'success' as const, title: actorTitle(log, '注册账号'), details: [] };
    case 'auth.verified':
      return { icon: 'material-symbols:verified-user-outline-rounded', color: 'success' as const, title: actorTitle(log, '完成账号验证'), details: [] };
    case 'admin.system_settings_updated':
      return {
        icon: 'material-symbols:settings-outline-rounded',
        color: 'warning' as const,
        title: actorTitle(log, '修改了系统设置'),
        details: fieldDetails(data.fields, {
          registration_open: '开放注册',
          require_email_verification: '邮箱验证',
          captcha_login_required: '登录验证码',
          captcha_registration_required: '注册验证码',
          max_sessions: '最大并发会话',
          max_websocket_connections: '最大并发连接',
          maintenance_enabled: '维护模式',
          maintenance_message: '维护提示',
        }),
      };
    case 'user.profile_updated':
      return { icon: 'material-symbols:manage-accounts-outline-rounded', color: 'neutral' as const, title: actorTitle(log, '更新了个人资料'), details: fieldDetails(data.fields, { nickname: '用户名', bio: '个人简介' }) };
    case 'team.created':
      return { icon: 'material-symbols:group-add-outline-rounded', color: 'success' as const, title: actorTitle(log, `创建了队伍${activityNamedLabel(data.team, log.team_id, '队伍')}`), details: [] };
    case 'team.updated':
      return { icon: 'material-symbols:edit-outline-rounded', color: 'neutral' as const, title: actorTitle(log, '更新了队伍信息'), details: fieldDetails(data.fields, { name: '队伍名称', pass: '队伍密码', bio: '队伍简介' }) };
    case 'team.member.joined':
      return { icon: 'material-symbols:person-add-outline-rounded', color: 'success' as const, title: actorTitle(log, '加入了队伍'), details: [] };
    case 'team.member.left':
      return { icon: 'material-symbols:logout-rounded', color: 'neutral' as const, title: actorTitle(log, '离开了队伍'), details: [] };
    case 'team.member.kicked':
      return { icon: 'material-symbols:person-remove-outline-rounded', color: 'warning' as const, title: targetUser ? `移除了成员 ${targetUser}` : '移除了成员', details: [] };
    case 'team.member.promoted':
      return { icon: 'material-symbols:award-star-outline-rounded', color: 'primary' as const, title: targetUser ? `将 ${targetUser} 设置为队长` : '变更了队长', details: [] };
    case 'team.disbanded':
      return { icon: 'material-symbols:group-remove-outline-rounded', color: 'warning' as const, title: `解散了${activityNamedLabel(data.team, log.team_id, '队伍')}`, details: [] };
    case 'submission.judged':
    case 'submission.backend_added':
      return {
        icon: 'material-symbols:assignment-turned-in-outline-rounded',
        color: data.submission?.action && data.submission?.action > 0 ? ('success' as const) : data.submission?.action === 0 ? ('warning' as const) : ('info' as const),
        title: actorTitle(log, `向${puzzle}提交了答案`),
        details: submissionDetails(log),
      };
    case 'puzzle.solved':
    case 'puzzle.backend_solved':
      return { icon: 'material-symbols:check-circle-outline-rounded', color: 'success' as const, title: actorTitle(log, `解出了${puzzle}`), details: [] };
    case 'puzzle.unlocked':
      return { icon: 'material-symbols:lock-open-outline-rounded', color: 'primary' as const, title: `开放了题目${puzzle}`, details: [] };
    case 'game.started':
      return { icon: 'material-symbols:flag-outline-rounded', color: 'success' as const, title: actorTitle(log, '开始了比赛'), details: [] };
    case 'hint.purchased':
      return {
        icon: 'material-symbols:emoji-objects-outline-rounded',
        color: 'primary' as const,
        title: actorTitle(log, `在${puzzle}解锁了提示${hint}`),
        details: activityCurrencyDetails(log),
      };
    case 'currency.penalty':
      return { icon: 'material-symbols:payments-outline-rounded', color: 'warning' as const, title: actorTitle(log, data.puzzle?.title ? `在${puzzle}触发了错误惩罚` : '触发了错误惩罚'), details: activityCurrencyDetails(log) };
    case 'currency.cost':
    case 'currency.added':
      return {
        icon: 'material-symbols:account-balance-wallet-outline-rounded',
        color: log.delta_amount && log.delta_amount < 0 ? ('warning' as const) : ('success' as const),
        title: actorTitle(log, activityCurrencyReasonTitle(log)),
        details: activityCurrencyDetails(log),
      };
    case 'ticket.opened':
      return { icon: 'material-symbols:near-me-outline-rounded', color: 'success' as const, title: actorTitle(log, `开启了人工提示${ticket}`), details: [] };
    case 'ticket.closed':
      return { icon: 'material-symbols:check-circle-outline-rounded', color: 'neutral' as const, title: actorTitle(log, `关闭了人工提示${ticket}`), details: [] };
    case 'ticket.message_purchased':
      return { icon: 'material-symbols:mark-email-read-outline-rounded', color: 'primary' as const, title: actorTitle(log, `在人工提示${ticket}中购买了付费消息`), details: [] };
    default:
      return {
        icon: severity.color === 'error' ? 'material-symbols:error-outline-rounded' : severity.color === 'warning' ? 'material-symbols:warning-outline-rounded' : 'material-symbols:history-rounded',
        color: severity.color,
        title: actorTitle(log, `触发了事件 ${log.type}`),
        details: [],
      };
  }
}

function logIconClass(log: AdminLogData) {
  const color = logView(log).color;
  if (color === 'success') return 'size-4 text-success';
  if (color === 'warning') return 'size-4 text-warning';
  if (color === 'primary') return 'size-4 text-primary';
  if (color === 'info') return 'size-4 text-info';
  if (color === 'error') return 'size-4 text-error';
  return 'size-4 text-muted';
}

function relatedItems(log: AdminLogData) {
  return [
    log.game_id ? `game:${log.game_id}` : '',
    log.team_id ? `team:${log.team_id}` : '',
    log.puzzle_id ? `puzzle:${log.puzzle_id}` : '',
    log.round_id ? `round:${log.round_id}` : '',
    log.hint_id ? `hint:${log.hint_id}` : '',
    log.ticket_id ? `ticket:${log.ticket_id}` : '',
    log.submission_id ? `submission:${log.submission_id}` : '',
    log.currency_id ? `currency:${log.currency_id}` : '',
  ].filter(Boolean);
}

function queryOf(targetPage: number) {
  const query: Record<string, string | number> = { limit: pageSize, page: targetPage };
  if (filters.scope !== null) query.scope = filters.scope;
  if (filters.severity !== null) query.severity = filters.severity;
  if (filters.event_type.trim()) query.event_type = filters.event_type.trim();
  if (hasNumberFilter(filters.game_id)) query.game_id = filters.game_id;
  if (hasNumberFilter(filters.team_id)) query.team_id = filters.team_id;
  if (hasNumberFilter(filters.user_id)) query.user_id = filters.user_id;
  return query;
}

async function fetchLogs(targetPage: number) {
  const { data } = await api.get<AdminLogResponse>('/admin/logs', { query: queryOf(targetPage) });
  return data;
}

async function loadPage(targetPage: number) {
  if (loading.value) return;
  loading.value = true;
  try {
    const data = await fetchLogs(targetPage);
    logs.value = data.logs;
    total.value = data.total;
    page.value = targetPage;
    updateTime.value = Date.now();
  } catch (error) {
    handleError(error, '系统日志获取失败');
  } finally {
    loading.value = false;
  }
}

async function reloadLogs() {
  await loadPage(1);
}

async function updatePage(targetPage: number) {
  if (targetPage === page.value || targetPage < 1 || loading.value) return;
  await loadPage(targetPage);
}

function resetFilters() {
  filters.scope = null;
  filters.severity = null;
  filters.event_type = '';
  filters.game_id = null;
  filters.team_id = null;
  filters.user_id = null;
  reloadLogs();
}

function clearFilter(key: keyof typeof filters) {
  if (key === 'event_type') {
    filters.event_type = '';
  } else {
    filters[key] = null;
  }
  reloadLogs();
}

onMounted(reloadLogs);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: '系统日志' }, { text: 'RBPH 管理后台', sep: ' - ' }])),
});
</script>

<template>
  <u-dashboard-panel id="admin-logs">
    <template #header>
      <u-dashboard-navbar title="系统日志">
        <template #leading>
          <u-dashboard-sidebar-collapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2 text-xs text-muted">
            <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" size="sm" :loading="loading" @click="reloadLogs" />
            <span>
              <template v-if="updateTime">更新于 {{ formatDate(updateTime) }}</template>
              <template v-else>尚未更新</template>
            </span>
          </div>
        </template>
      </u-dashboard-navbar>
    </template>

    <template #body>
      <div class="grid min-h-0 gap-6 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,64rem)_minmax(14rem,18rem)]">
        <aside class="min-w-0">
          <form class="rounded-md border border-default bg-default p-4" @submit.prevent="reloadLogs">
            <div class="space-y-4">
              <u-form-field label="范围">
                <u-select v-model="filters.scope" :items="scopeItems" variant="subtle" class="w-full" />
              </u-form-field>
              <u-form-field label="级别">
                <u-select v-model="filters.severity" :items="severityItems" variant="subtle" class="w-full" />
              </u-form-field>
              <u-form-field label="事件类型">
                <u-input v-model="filters.event_type" placeholder="auth.login" variant="subtle" class="w-full" />
              </u-form-field>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <u-form-field label="比赛 ID">
                  <u-input-number v-model="filters.game_id" placeholder="game" variant="subtle" orientation="vertical" class="w-full" />
                </u-form-field>
                <u-form-field label="队伍 ID">
                  <u-input-number v-model="filters.team_id" placeholder="team" variant="subtle" orientation="vertical" class="w-full" />
                </u-form-field>
                <u-form-field label="用户 ID">
                  <u-input-number v-model="filters.user_id" placeholder="user" variant="subtle" orientation="vertical" class="w-full" />
                </u-form-field>
              </div>
              <div class="flex gap-2">
                <u-button type="submit" label="筛选" icon="material-symbols:filter-list-rounded" :loading="loading" />
                <u-button label="重置" icon="material-symbols:filter-list-off-rounded" color="neutral" variant="ghost" :disabled="loading || !hasActiveFilters" @click="resetFilters" />
              </div>

              <div v-if="activeFilterChips.length > 0" class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-muted">当前筛选</span>
                <u-button v-for="item in activeFilterChips" :key="item.key" size="xs" color="neutral" variant="soft" trailing-icon="material-symbols:close-rounded" :label="item.label" :disabled="loading" @click="clearFilter(item.key)" />
              </div>
            </div>
          </form>
        </aside>

        <main class="min-w-0 space-y-4">
          <div v-if="loading && logs.length === 0" class="flex items-center gap-2 py-8 text-sm text-muted">
            <u-icon name="material-symbols:progress-activity" class="size-4 animate-spin" />
            <span>加载中</span>
          </div>

          <u-empty v-else-if="logs.length === 0" icon="material-symbols:receipt-long-outline-rounded" title="暂无日志" />

          <div v-else class="divide-y divide-default rounded-md border border-default bg-default px-4 mb-4">
            <div v-for="log in logs" :key="log.id" :class="['flex gap-3 py-4 first:pt-4 last:pb-4', logView(log).details.length === 0 ? 'items-center' : 'items-start']">
              <div :class="['flex size-8 shrink-0 items-center justify-center rounded-md bg-muted', logView(log).details.length === 0 ? '' : 'mt-0.5']">
                <u-icon :name="logView(log).icon" :class="logIconClass(log)" />
              </div>
              <div class="min-w-0 flex-1">
                <div :class="['flex justify-between gap-3', logView(log).details.length === 0 ? 'items-center' : 'items-start']">
                  <div class="min-w-0">
                    <div class="wrap-break-word text-sm font-medium text-highlighted">
                      <u-badge v-if="isStaffActivityLog(log)" size="sm" color="warning" variant="soft" class="mr-1 align-middle">工作人员</u-badge>
                      <span>{{ logView(log).title }}</span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                      <code class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-toned">{{ log.type }}</code>
                      <u-badge size="sm" color="neutral" variant="soft">{{ scopeLabel(log.scope) }}</u-badge>
                      <u-badge size="sm" :color="severityMeta(log.severity).color" variant="soft">{{ severityMeta(log.severity).label }}</u-badge>
                      <u-badge v-for="item in relatedItems(log)" :key="item" size="sm" color="neutral" variant="outline" class="font-mono">{{ item }}</u-badge>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <time class="block text-xs text-muted">{{ formatDate(log.ctime_at) }}</time>
                    <div class="mt-1 font-mono text-xs text-dimmed">#{{ log.id }}</div>
                  </div>
                </div>
                <div v-for="detail in logView(log).details" :key="detail" class="mt-1 wrap-break-word text-sm text-muted">
                  {{ detail }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="total > pageSize" class="flex justify-end">
            <u-pagination :page="page" :total="total" :items-per-page="pageSize" variant="soft" active-variant="subtle" :disabled="loading" @update:page="updatePage" />
          </div>
        </main>

        <aside class="hidden xl:block" />
      </div>
    </template>
  </u-dashboard-panel>
</template>
