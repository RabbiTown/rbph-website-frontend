export interface ActivityLogUserRef {
  id?: number | null;
  nickname?: string | null;
  name?: string | null;
}

export interface ActivityLogNamedRef {
  id?: number | null;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
}

export interface ActivityLogHintRef {
  id?: number | null;
  title?: string | null;
  cost_id?: number | null;
  cost_amount?: number | null;
}

export interface ActivityLogCurrencyRef {
  id?: number | null;
  slug?: string | null;
  name?: string | null;
  prec?: number | null;
}

export interface ActivityLogSubmission {
  answer?: string | null;
  action?: number | null;
  ignored?: boolean | null;
  result?: string | null;
}

export interface ActivityLogCurrencyPenalty {
  currency_id?: number | null;
  name?: string | null;
  prec?: number | null;
  amount?: number | null;
}

export interface ActivityLogCost {
  currency_id?: number | null;
  amount?: number | null;
}

export interface ActivityLogAccessChange {
  target?: 'team' | 'feature' | null;
  feature?: RbTeamFeature | null;
  action?: 'banned' | 'unbanned' | 'locked' | 'unlocked' | null;
}

export interface ActivityLogPayload {
  user?: ActivityLogUserRef | null;
  target_user?: ActivityLogUserRef | null;
  team?: ActivityLogNamedRef | null;
  puzzle?: ActivityLogNamedRef | null;
  round?: ActivityLogNamedRef | null;
  hint?: ActivityLogHintRef | null;
  ticket?: ActivityLogNamedRef | null;
  message?: ActivityLogNamedRef | null;
  currency?: ActivityLogCurrencyRef | null;
  submission?: ActivityLogSubmission | null;
  currency_penalty?: ActivityLogCurrencyPenalty[] | null;
  cost?: ActivityLogCost | null;
  fields?: Record<string, boolean> | null;
  staff?: boolean | null;
  delta?: number | null;
  before?: number | null;
  after?: number | null;
  cooldown_seconds?: number | null;
  cooldown_till?: string | null;
  email?: string | null;
  reason?: string | null;
  changes?: ActivityLogAccessChange[] | null;
  [key: string]: unknown;
}

export interface ActivityLogEntry {
  type: string;
  user_id?: number | null;
  target_user_id?: number | null;
  delta_amount?: number | null;
  data: ActivityLogPayload;
}

export interface ActivityLogCurrencyInfo {
  name?: string | null;
  prec?: number | null;
}

export function activityUserLabel(value: ActivityLogUserRef | null | undefined, fallbackId?: number | null) {
  if (value?.nickname) return value.nickname;
  if (value?.name) return value.name;
  if (value?.id != null) return `UID ${value.id}`;
  if (fallbackId != null) return `UID ${fallbackId}`;
  return '';
}

export function activityActorName(entry: ActivityLogEntry, teamMemberFallback = false) {
  const name = activityUserLabel(entry.data.user, entry.user_id);
  if (name) return name;
  if (teamMemberFallback && entry.type.startsWith('team.member.')) return '队伍管理';
  return '';
}

export function activityActorTitle(entry: ActivityLogEntry, action: string, teamMemberFallback = false) {
  const actor = activityActorName(entry, teamMemberFallback);
  return actor ? `${actor} ${action}` : action;
}

export function activityNamedLabel(value: ActivityLogNamedRef | null | undefined, fallbackId: number | null | undefined, fallbackName: string) {
  if (value?.title) return `「${value.title}」`;
  if (value?.name) return `「${value.name}」`;
  if (value?.id || fallbackId) return `${fallbackName} #${value?.id ?? fallbackId}`;
  return fallbackName;
}

export function activitySimpleNamedLabel(value: ActivityLogNamedRef | null | undefined, fallbackName: string) {
  if (value?.title) return `「${value.title}」`;
  if (value?.name) return `「${value.name}」`;
  return fallbackName;
}

export function activityTicketLabel(ticket: ActivityLogNamedRef | null | undefined, puzzle: ActivityLogNamedRef | null | undefined) {
  if (ticket?.id && puzzle?.title) return `「${puzzle.title}#${ticket.id}」`;
  if (ticket?.id) return `#${ticket.id}`;
  return '';
}

export function isStaffActivityLog(entry: ActivityLogEntry) {
  return Boolean(entry.data.staff);
}

export function activityJudgeResultLabel(action: number | null | undefined, ignored?: boolean | null) {
  const label = (() => {
    switch (action) {
      case -2:
        return '评测故障';
      case -1:
        return '评测中';
      case 0:
        return '回答错误';
      case 1:
        return '回答正确';
      case 2:
        return '里程碑';
      case 3:
        return '开始比赛';
      case 4:
        return '触发彩蛋';
      case 5:
        return '回答正确，完成比赛';
      default:
        return '已记录';
    }
  })();
  return ignored ? `${label}（不占用提交次数）` : label;
}

export function formatActivityLogCurrencyAmount(data: ActivityLogPayload, amount: number | null | undefined, signed = true) {
  if (amount === null || amount === undefined) return '';
  const currency = data.currency;
  const text = intPrecString(Number(amount), currency?.prec ?? 0, signed, ' ');
  return currency?.name ? `${text} ${currency.name}` : text;
}

export function activityCurrencyDetails(entry: ActivityLogEntry) {
  const delta = Number(entry.data.delta ?? entry.delta_amount ?? 0);
  return [delta ? `变动：${formatActivityLogCurrencyAmount(entry.data, delta)}` : '', entry.data.after !== undefined ? `结余：${formatActivityLogCurrencyAmount(entry.data, Number(entry.data.after), false)}` : ''].filter(Boolean);
}

export function formatActivityLogCurrency(entry: ActivityLogEntry) {
  const currency = entry.data.currency;
  const delta = Number(entry.data.delta ?? entry.delta_amount ?? 0);
  if (!currency) return delta ? `${delta > 0 ? '+' : ''}${delta}` : '';
  return `${currency.name ?? ''} ${intPrecString(delta, currency.prec ?? 0, true, ' ')}`;
}

export function activityCurrencyAfter(entry: ActivityLogEntry) {
  const currency = entry.data.currency;
  if (!currency || entry.data.after === undefined) return '';
  return `${currency.name ?? ''} ${intPrecString(Number(entry.data.after), currency.prec ?? 0)}`;
}

export function activityCurrencyReasonTitle(entry: ActivityLogEntry) {
  const reason = typeof entry.data.reason === 'string' ? entry.data.reason.trim() : '';
  if (reason) return reason;
  return `${activitySimpleNamedLabel(entry.data.puzzle, '题目')}变动了货币`;
}

export function activityConsequenceText(entry: ActivityLogEntry, currencyById: (id: number) => ActivityLogCurrencyInfo | undefined, formatTime: (value: string) => string) {
  const parts: string[] = [];
  const data = entry.data;

  if (data.cooldown_seconds) {
    parts.push(`提交冷却 ${data.cooldown_seconds} 秒`);
  } else if (data.cooldown_till) {
    parts.push(`提交冷却至 ${formatTime(data.cooldown_till)}`);
  }

  for (const item of data.currency_penalty ?? []) {
    const currencyId = item.currency_id;
    const currency = typeof currencyId === 'number' ? currencyById(currencyId) : undefined;
    const amount = -Number(item.amount ?? 0);
    parts.push(`${currency?.name ?? item.name ?? '货币'} ${intPrecString(amount, currency?.prec ?? item.prec ?? 0, true, ' ')}`);
  }

  return parts.join('，');
}
