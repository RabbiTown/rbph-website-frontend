let activeGameId: number | undefined = undefined;
let activeTeamId: number | undefined = undefined;
let releaseCursor = 0;
let timer: ReturnType<typeof setTimeout> | undefined = undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined = undefined;
let syncingPromise: Promise<void> | undefined = undefined;
let pendingCursor = 0;
let forcePending = false;
let hasConnected = false;

function clearTimer() {
  clearTimeout(timer);
  timer = undefined;
}

function clearRetryTimer() {
  clearTimeout(retryTimer);
  retryTimer = undefined;
}

export function useGameReleaseSync() {
  const revision = useState<number>('game-release-revision', () => 0);
  const phases = useState<RbReleasePhase[]>('game-release-phases', () => []);
  const features = useState<RbGameFeatures>('game-features', () => ({
    team_formation: 'open',
    direct_message: 'open',
    puzzle_ticket: 'open',
    leaderboard: 'live',
    currency: 'closed',
  }));
  const toast = useToast();

  function schedule() {
    clearTimer();
    if (!import.meta.client || !activeGameId) return;
    const nextPhase = phases.value.find(phase => new Date(phase.release_at).getTime() > useSyncTime().calcCurrentTime());
    if (!nextPhase) return;
    const target = new Date(nextPhase.release_at).getTime();
    if (!Number.isFinite(target)) return;
    const delay = Math.max(target - useSyncTime().calcCurrentTime() + 250, 0);
    timer = setTimeout(() => sync(), Math.min(delay, 2_147_483_647));
  }

  function initialize(info: RbGameAggreInfo) {
    const gameId = info.game.id;
    const teamId = info.team?.id;
    if (activeGameId !== gameId || activeTeamId !== teamId) {
      releaseCursor = info.release_cursor;
      pendingCursor = info.release_cursor;
      forcePending = false;
    } else {
      releaseCursor = Math.max(releaseCursor, info.release_cursor);
    }
    activeGameId = gameId;
    activeTeamId = teamId;
    phases.value = info.phases;
    features.value = info.features;
    clearRetryTimer();
    schedule();
  }

  function puzzleAction(gameId: number, puzzle: RbReleasedPuzzle) {
    return {
      icon: 'material-symbols:arrow-forward-rounded',
      label: puzzle.title,
      variant: 'soft' as const,
      to: puzzle.is_round_puzzle
        ? gameRoundSimpleRoute(gameId, { id: puzzle.round_id, slug: puzzle.round_slug })
        : gamePuzzleSimpleRoute(gameId, puzzle),
    };
  }

  function showEvent(gameId: number, event: RbReleaseEvent) {
    const Content = resolveComponent('rbph-content');
    const phase = event.phase;
    toast.add({
      title: phase?.title ?? '谜题已发布',
      description: phase?.description
        ? h(Content, { content: { content: phase.description, content_type: phase.content_type } })
        : event.puzzles.length > 0
          ? `已开放 ${event.puzzles.length} 道谜题。`
          : undefined,
      actions: event.puzzles.map(puzzle => puzzleAction(gameId, puzzle)),
      color: 'success',
      icon: 'material-symbols:event-available-outline-rounded',
      duration: 10000,
      ui: { actions: 'flex-wrap' },
    });
  }

  async function sync() {
    forcePending = true;
    return runRequestedSync();
  }

  async function runRequestedSync() {
    if (!activeGameId) return;
    if (syncingPromise) return syncingPromise;
    if (!forcePending && pendingCursor <= releaseCursor) return;

    const gameId = activeGameId;
    const after = releaseCursor;
    forcePending = false;
    let succeeded = false;
    syncingPromise = (async () => {
      try {
        const { data } = await useApi().post<RbReleaseSyncResponse>(`/games/${gameId}/releases/sync`, { after });
        if (activeGameId !== gameId) return;
        useSyncTime().syncWith(new Date(data.server_time));
        const visibleReleaseChanged = data.events.length > 0;
        for (const event of data.events) {
          if (event.id > releaseCursor) showEvent(gameId, event);
          releaseCursor = Math.max(releaseCursor, event.id);
        }
        releaseCursor = Math.max(releaseCursor, data.release_cursor);
        phases.value = data.phases;
        const currencyStateChanged = features.value.currency !== data.features.currency;
        features.value = data.features;
        clearRetryTimer();
        if (activeTeamId && visibleReleaseChanged) await useGame().updateRoundState();
        if (activeTeamId && currencyStateChanged) await useCurrency().updateData(true);
        if (visibleReleaseChanged) revision.value++;
        schedule();
        succeeded = true;
      } catch (error) {
        console.warn('Failed to sync game releases', error);
        clearRetryTimer();
        forcePending = true;
        retryTimer = setTimeout(() => runRequestedSync(), 15_000);
      }
    })().finally(() => {
      syncingPromise = undefined;
      if (succeeded && (forcePending || pendingCursor > releaseCursor)) void runRequestedSync();
    });
    return syncingPromise;
  }

  function notify(gameId: number, cursor: number, force: boolean) {
    if (gameId !== activeGameId) return;
    pendingCursor = Math.max(pendingCursor, cursor);
    if (!force && cursor <= releaseCursor) return;
    forcePending ||= force;
    return runRequestedSync();
  }

  function connectionChanged(online: boolean) {
    if (!online) return;
    const reconnect = hasConnected;
    hasConnected = true;
    if (reconnect && activeGameId) return sync();
  }

  function reset() {
    activeGameId = undefined;
    activeTeamId = undefined;
    releaseCursor = 0;
    pendingCursor = 0;
    forcePending = false;
    phases.value = [];
    features.value = {
      team_formation: 'open',
      direct_message: 'open',
      puzzle_ticket: 'open',
      leaderboard: 'live',
      currency: 'closed',
    };
    clearTimer();
    clearRetryTimer();
  }

  return { revision, phases, features, initialize, notify, reset, schedule, connectionChanged, sync };
}
