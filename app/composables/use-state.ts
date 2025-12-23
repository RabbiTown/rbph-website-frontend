export function navigateToLogin() {
  navigateTo(`/login?url=${useRoute().path}`);
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

  return { ref: user, updateData, required, activated: userUsed };
}

const teamUsed = ref(false);

export function useTeam(activate: boolean = true) {
  const team = useState<RbTeam | undefined>('team');

  async function updateData() {
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

export function useGame() {
  return { ref: useState<RbGame | undefined>('game') };
}

export function usePuzzle() {
  return { ref: useState<RbPuzzleShowData | undefined>('puzzle') };
}

export async function updateGameState(new_id: string) {
  const id = parseInt(new_id);
  if (isNaN(id)) {
    throw 'Invalid game.';
  }

  const api = useApi();
  const game = useState<RbGame>('game');

  if (game.value?.id !== id) {
    try {
      const { data } = await api.get<RbGame>(`/games/${id}`);
      game.value = data;
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
      return;
    }

    localStorage.setItem('rbph::select_game', id.toString());
  }
}

export async function resetTeamState() {
  useState('team').value = undefined;
  useState('currency').value = undefined;
}

export async function updatePuzzleState(new_id: string | undefined = undefined) {
  const puzzle = useState<RbPuzzleShowData | undefined>('puzzle');

  const id = new_id ? parseInt(new_id) : puzzle.value?.data.id || NaN;
  if (isNaN(id)) {
    throw 'Invalid puzzle.';
  }

  if (puzzle.value?.data.id !== id) {
    try {
      const { data } = await useApi().get<RbPuzzleShowData>(`/puzzles/${new_id}`);
      puzzle.value = data;
      if (data.data.game_id) {
        updateGameState(data.data.game_id.toString());
      }
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
    }
  }
}

export async function resetStates() {
  useState('user').value = undefined;
  resetTeamState();
}
