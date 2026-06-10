const api = useApi();

export interface AdminRoundData {
  id: number;
  slug?: string | null;
  title: string;
  content: string;
  content_type: number;
  cover?: string | null;
  game_id: number;
  puzzle?: number | null;
  sort: number;
}

export interface AdminPuzzleData {
  id: number;
  game_id: number;
  slug?: string | null;
  title: string;
  ptype: number;
  content: string;
  content_type: number;
  judge: unknown;
  penalty: unknown;
  max_submit?: number | null;
  unlock_cond: string;
  round_id: number;
  sort: number;
  ticket_cooldown: number;
  ctime_at: string;
}

export interface AdminPuzzleContext {
  puzzle: Ref<AdminPuzzleData | undefined>;
  round: Ref<AdminRoundData | undefined>;
  contentEditor: Ref<{ focus: () => void } | undefined>;
  focusTitle: () => void;
  headerDirty: ComputedRef<boolean>;
  applyHeader: () => Promise<boolean>;
  resetHeader: () => void;
  refresh: () => Promise<void>;
}

const adminPuzzleContextKey: InjectionKey<AdminPuzzleContext> = Symbol('rbph-admin-puzzle-context');

function useGame() {
  const game = useState<RbGameModel | undefined>('admin.game');

  const gameList = useState<RbGameModel[]>('admin.game_list', () => []);

  async function updateGameList() {
    type Response = { games: RbGameModel[] };
    try {
      const { data } = await api.get<Response>(`/admin/games`);
      gameList.value = data.games;
      return data.games;
    } catch (err) {
      gameList.value = [];
      throw err;
    }
  }

  function upsert(model: RbGameModel | undefined) {
    game.value = model;
  }

  function updateCurrent(model: RbGameModel) {
    if (game.value) Object.assign(game.value, model);
  }

  function selectById(id: number): RbGameModel | undefined {
    const result = gameList.value.find(x => x.id === id);
    upsert(result);
    return result;
  }

  return {
    ref: game,
    gameList,
    upsert,
    updateCurrent,
    selectById,
    updateGameList,
  };
}

function providePuzzleContext(context: AdminPuzzleContext) {
  provide(adminPuzzleContextKey, context);
  return context;
}

function usePuzzleContext(): AdminPuzzleContext {
  const context = inject(adminPuzzleContextKey);
  if (!context) throw new Error('Admin puzzle context is not provided');
  return context;
}

export function useAdmin() {
  return {
    useGame,
    providePuzzleContext,
    usePuzzleContext,
  };
}
