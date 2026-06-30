export function navigateToLogin() {
  return navigateTo(`/login?url=${useRoute().path}`);
}

const userUsed = ref(false);
let userUpdatePromise: Promise<void> | null = null;

export function useUser(activate: boolean = true) {
  const user = useState<RbUser | undefined>('user');

  async function updateData() {
    if (userUpdatePromise) return userUpdatePromise;

    async function inner() {
      try {
        const { data } = await useApi().get<RbUser>('/user/info');
        user.value = data;
      } catch (error) {
        if (getRbErrorCode(error) === -101) {
          user.value = undefined;
        } else {
          throw error;
        }
      }
    }

    userUpdatePromise = inner().finally(() => (userUpdatePromise = null));
  }

  async function waitUpdate() {
    if (userUpdatePromise) {
      await userUpdatePromise;
      return user;
    } else {
      return user;
    }
  }

  function required() {
    if (!user.value) {
      updateData().then(() => {
        if (!user.value) {
          navigateToLogin();
        }
      });
    }
  }

  if (activate && !userUsed.value) {
    userUsed.value = true;
    updateData();
  }

  return { ref: user, updateData, required, waitUpdate, activated: userUsed };
}

const teamUsed = ref(false);
let teamLastUpdate = 0;

export function useTeam(activate: boolean = true) {
  const team = useState<RbTeam | undefined>('team');

  async function updateData() {
    if (await useAggreInfo().waitUpdate()) return;

    const now = Date.now();
    if (now - teamLastUpdate < 500) return;
    teamLastUpdate = now;

    const gameId = useState<RbGame | undefined>('game').value?.id;

    if (gameId) {
      try {
        const { data } = await useApi().get<RbTeam>(`/games/${gameId}/teams/self`);
        team.value = data;
      } catch (error) {
        if (getRbErrorCode(error) === -104) {
          team.value = undefined;
        } else {
          throw error;
        }
      }
    }
  }

  if (activate && !teamUsed.value) {
    teamUsed.value = true;
    updateData();
  }

  return { ref: team, updateData, activated: teamUsed };
}

let roundLastUpdate = 0;

export function useGame() {
  const ref = useState<RbGame | undefined>('game');

  async function updateRoundState() {
    if (await useAggreInfo().waitUpdate()) return;

    const now = Date.now();
    if (now - roundLastUpdate < 500) return;
    roundLastUpdate = now;

    if (ref.value?.id) {
      try {
        const { data } = await useApi().get<Pick<RbRound, 'id' | 'title'>[]>(`/games/${ref.value.id}/rounds`);
        ref.value.rounds = data;
      } catch (error) {
        if (getRbErrorCode(error) === RbErrorCode.NotFound) {
          ref.value.rounds = [];
        } else {
          throw error;
        }
      }
    }
  }

  return { ref, updateRoundState };
}

let aggreStatePromise: Promise<void> | null = null;

export function useAggreInfo() {
  function updateState(gameId: number) {
    if (aggreStatePromise) return aggreStatePromise;
    async function inner() {
      try {
        const { data } = await useApi().get<RbGameAggreInfo>(`/games/${gameId}/info`);
        useNuxtApp().$syncWithAggreInfo(data);
      } catch (error) {
        showError(error instanceof Error ? error : String(error));
        return;
      }
    }
    aggreStatePromise = inner().finally(() => (aggreStatePromise = null));
    return aggreStatePromise;
  }

  async function waitUpdate() {
    if (aggreStatePromise) {
      try {
        await aggreStatePromise;
        return true;
      } catch {
        /* ignored */
      }
    }
    return false;
  }

  return {
    updateState,
    waitUpdate,
  };
}

export async function updateGameState(new_id: string | undefined = undefined, forceUpdate: boolean = false) {
  const game = useState<RbGame | undefined>('game');

  const id = new_id ? parseInt(new_id) : game.value?.id;
  if (!id) {
    game.value = undefined;
    return;
  }
  if (isNaN(id)) throw 'Invalid game id';

  const api = useApi();

  if (forceUpdate || game.value?.id !== id) {
    if ((await useUser().waitUpdate()).value) {
      useAggreInfo().updateState(id);
    } else {
      try {
        const { data } = await api.get<RbGame>(`/games/${id}`);
        game.value = data;
      } catch (error) {
        showError(error instanceof Error ? error : String(error));
        return;
      }
    }

    localStorage.setItem('rbph::select_game', id.toString());
  }
}

export async function resetTeamState() {
  useState('team').value = undefined;
  useState('currency').value = undefined;
}

export function usePuzzle() {
  const puzzle = useState<RbPuzzleShowData | undefined>('puzzle');

  async function updateState(new_id: string | undefined = undefined) {
    const id = new_id ? parseInt(new_id) : puzzle.value?.data.id || NaN;
    if (isNaN(id)) throw 'Invalid puzzle id';

    try {
      const { data } = await useApi().get<RbPuzzleShowData>(`/puzzles/${id}`);
      puzzle.value = data;
      if (data.data.game_id) {
        updateGameState(data.data.game_id.toString());
      }
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
    }
  }

  async function updateStateByGameRef(game_id: string, puzzle_ref: string) {
    const gameId = parseInt(game_id);
    if (isNaN(gameId)) throw 'Invalid game id';
    if (!puzzle_ref) throw 'Invalid puzzle id';

    try {
      const { data } = await useApi().get<RbPuzzleShowData>(`/games/${gameId}/puzzles/${encodeURIComponent(puzzle_ref)}`);
      puzzle.value = data;
      if (data.data.game_id) {
        updateGameState(data.data.game_id.toString());
      }
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
    }
  }

  return { ref: puzzle, updateState, updateStateByGameRef };
}

export async function resetStates() {
  useState('user').value = undefined;
  resetTeamState();
  useGameReleaseSync().reset();
}
