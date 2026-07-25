export interface MessageUnlockOffer {
  unlockAfterSeconds: number;
  costId: number | null;
  costAmount: number;
}

interface UnlockBidHistory {
  cooldown: number[];
  currencies: Record<string, number[]>;
}

const historyVersion = ref(0);
const HISTORY_LIMIT = 5;
const HISTORY_PREFIX = 'rbph::message-unlock-bids:v1:';
const WARNING_PREFIX = 'rbph::ticket-no-bid-warning-disabled:v1:';

function emptyHistory(): UnlockBidHistory {
  return { cooldown: [], currencies: {} };
}

function historyKey(gameId: number) {
  return `${HISTORY_PREFIX}${gameId}`;
}

function warningKey(gameId: number) {
  return `${WARNING_PREFIX}${gameId}`;
}

function readHistory(gameId: number): UnlockBidHistory {
  if (!import.meta.client) return emptyHistory();
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey(gameId)) ?? 'null') as Partial<UnlockBidHistory> | null;
    return {
      cooldown: Array.isArray(parsed?.cooldown) ? parsed.cooldown.filter(value => Number.isInteger(value) && value > 0).slice(0, HISTORY_LIMIT) : [],
      currencies: parsed?.currencies && typeof parsed.currencies === 'object' ? parsed.currencies : {},
    };
  } catch {
    return emptyHistory();
  }
}

function recent(values: number[], value: number) {
  return [value, ...values.filter(item => item !== value)].slice(0, HISTORY_LIMIT);
}

export function getRecentMessageUnlockBids(gameId: number, type: 'cooldown' | number): number[] {
  void historyVersion.value;
  const history = readHistory(gameId);
  const values = type === 'cooldown' ? history.cooldown : history.currencies[String(type)] ?? [];
  return values.filter(value => Number.isFinite(value) && value > 0).slice(0, HISTORY_LIMIT);
}

export function rememberMessageUnlockOffer(gameId: number, offer: MessageUnlockOffer) {
  if (!import.meta.client) return;
  const history = readHistory(gameId);
  if (offer.unlockAfterSeconds > 0) history.cooldown = recent(history.cooldown, Math.trunc(offer.unlockAfterSeconds));
  if (offer.costId !== null && offer.costAmount > 0) {
    const key = String(offer.costId);
    history.currencies[key] = recent(history.currencies[key] ?? [], Math.trunc(offer.costAmount));
  }
  try {
    localStorage.setItem(historyKey(gameId), JSON.stringify(history));
    historyVersion.value++;
  } catch {
    // Local preferences are optional.
  }
}

export function isMessageUnlockOfferEmpty(offer: MessageUnlockOffer) {
  return offer.unlockAfterSeconds <= 0 && (offer.costId === null || offer.costAmount <= 0);
}

export function isNoBidWarningDisabled(gameId: number) {
  if (!import.meta.client) return false;
  try {
    return localStorage.getItem(warningKey(gameId)) === '1';
  } catch {
    return false;
  }
}

export function disableNoBidWarning(gameId: number) {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(warningKey(gameId), '1');
  } catch {
    // Local preferences are optional.
  }
}
