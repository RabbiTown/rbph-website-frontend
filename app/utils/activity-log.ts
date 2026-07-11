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

export type ActivityLogTranslateFn = (key: string, params?: Record<string, unknown>) => string;

export function activityUserLabel(value: ActivityLogUserRef | null | undefined, fallbackId?: number | null) {
  if (value?.nickname) return value.nickname;
  if (value?.name) return value.name;
  if (value?.id != null) return `UID ${value.id}`;
  if (fallbackId != null) return `UID ${fallbackId}`;
  return '';
}

export function isStaffActivityLog(entry: ActivityLogEntry) {
  return Boolean(entry.data.staff);
}

export function activityJudgeResultLabel(action: number | null | undefined, ignoredOrT?: boolean | ActivityLogTranslateFn, t?: ActivityLogTranslateFn) {
  const translate = typeof ignoredOrT === 'function' ? ignoredOrT : t;
  return (() => {
    switch (action) {
      case -2:
        return translate ? translate('judge.error') : 'Judge error';
      case -1:
        return translate ? translate('judge.pending') : 'Judging';
      case 0:
        return translate ? translate('judge.fail') : 'Incorrect';
      case 1:
        return translate ? translate('judge.correct') : 'Correct';
      case 2:
        return translate ? translate('judge.milestone') : 'Milestone';
      case 3:
        return translate ? translate('judge.startGame') : 'Game started';
      case 4:
        return translate ? translate('judge.easterEgg') : 'Easter egg';
      case 5:
        return translate ? translate('judge.finishGameLabel') : 'Correct, game finished';
      default:
        return translate ? translate('judge.recorded') : 'Recorded';
    }
  })();
}

export function formatActivityLogCurrencyAmount(data: ActivityLogPayload, amount: number | null | undefined, signed = true) {
  if (amount === null || amount === undefined) return '';
  const currency = data.currency;
  const text = intPrecString(Number(amount), currency?.prec ?? 0, signed, ' ');
  return currency?.name ? `${text} ${currency.name}` : text;
}

export function activityCurrencyDetails(entry: ActivityLogEntry, t?: ActivityLogTranslateFn) {
  const delta = Number(entry.data.delta ?? entry.delta_amount ?? 0);
  return [
    delta ? (t ? t('activity.changeDetail', { change: formatActivityLogCurrencyAmount(entry.data, delta) }) : `Change: ${formatActivityLogCurrencyAmount(entry.data, delta)}`) : '',
    entry.data.after !== undefined ? (t ? t('activity.balanceDetail', { balance: formatActivityLogCurrencyAmount(entry.data, Number(entry.data.after), false) }) : `Balance: ${formatActivityLogCurrencyAmount(entry.data, Number(entry.data.after), false)}`) : '',
  ].filter(Boolean);
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

export function activityCurrencyReasonTitle(entry: ActivityLogEntry, t?: ActivityLogTranslateFn) {
  const reason = typeof entry.data.reason === 'string' ? entry.data.reason.trim() : '';
  if (reason) return reason;
  const puzzle = entry.data.puzzle?.title ?? entry.data.puzzle?.name ?? '';
  return t ? t('activityLog.currencyChangedByPuzzle', { puzzle }) : puzzle ? `Currency changed by ${puzzle}` : 'Puzzle currency changed';
}

export function activityConsequenceText(entry: ActivityLogEntry, currencyById: (id: number) => ActivityLogCurrencyInfo | undefined, formatTime: (value: string) => string, t?: ActivityLogTranslateFn) {
  const parts: string[] = [];
  const data = entry.data;

  if (data.cooldown_seconds) {
    parts.push(t ? t('activityLog.cooldownSeconds', { seconds: data.cooldown_seconds }) : `Submission cooldown: ${data.cooldown_seconds} seconds`);
  } else if (data.cooldown_till) {
    parts.push(t ? t('activityLog.cooldownUntil', { time: formatTime(data.cooldown_till) }) : `Submission cooldown until ${formatTime(data.cooldown_till)}`);
  }

  for (const item of data.currency_penalty ?? []) {
    const currencyId = item.currency_id;
    const currency = typeof currencyId === 'number' ? currencyById(currencyId) : undefined;
    const amount = -Number(item.amount ?? 0);
    parts.push(`${currency?.name ?? item.name ?? (t ? t('currency.fallbackName') : 'Currency')} ${intPrecString(amount, currency?.prec ?? item.prec ?? 0, true, ' ')}`);
  }

  return t ? t('activity.consequenceList', { consequences: parts }) : parts.join(', ');
}
