type SidKind = 'puzzle-submit' | 'hint-purchase' | string;

interface SidEntry {
  kind?: SidKind;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

const sids = new Map<string, SidEntry>();

const PENDING_TTL_MS = 60_000;
const CONSUMED_TTL_MS = 5_000;

function scheduleCleanup(sid: string, ttl: number) {
  const pending = sids.get(sid);
  if (!pending) return;

  if (pending.cleanupTimer) {
    clearTimeout(pending.cleanupTimer);
  }

  pending.cleanupTimer = setTimeout(() => {
    sids.delete(sid);
  }, ttl);
}

function generateSid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function useSid() {
  function register(sid: string, kind?: SidKind) {
    sids.set(sid, { kind });
    scheduleCleanup(sid, PENDING_TTL_MS);
    return sid;
  }

  function create(kind?: SidKind) {
    return register(generateSid(), kind);
  }

  function consume(sid?: string) {
    if (!sid || !sids.has(sid)) return false;

    scheduleCleanup(sid, CONSUMED_TTL_MS);
    return true;
  }

  function clear(sid?: string) {
    if (!sid) return;

    const pending = sids.get(sid);
    if (pending?.cleanupTimer) {
      clearTimeout(pending.cleanupTimer);
    }
    sids.delete(sid);
  }

  return {
    create,
    register,
    consume,
    clear,
  };
}
