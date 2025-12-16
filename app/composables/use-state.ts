export async function useUser(required: boolean = true) {
  const user = useState<RbUser | undefined>('user');
  if (user.value) {
    return user;
  }

  try {
    const { data } = await useApi().get<RbUser>('/user/info');
    user.value = data;
  } catch (error) {
    if (getRbErrorCode(error) === -101 && required) {
      user.value = undefined;
      if (required) {
        navigateTo(`/login?url=${useRoute().path}`);
      }
    }
  }

  return user;
}

export async function useTeam() {
  const team = useState<RbTeam | undefined>('team');
  if (team.value) {
    return team;
  }

  const gameId = useState<RbGame | undefined>('game').value?.id;
  if (gameId) {
    try {
      const { data } = await useApi().get<RbTeam>(`/games/${gameId}/teams/self`);
      team.value = data;
    } catch (error) {
      if (getRbErrorCode(error) === -104) {
        team.value = undefined;
      }
    }
  }

  return team;
}

export async function usePuzzle() {
  const puzzle = useState<RbPuzzleShowData | undefined>('puzzle');
  if (puzzle.value) {
    return puzzle;
  }

  const puzzleId = useRoute().params.id as string | undefined;
  if (puzzleId) {
    updatePuzzleState(puzzleId);
  }

  return puzzle;
}

export async function updateGameState(new_id: string) {
  const id = parseInt(new_id);
  if (isNaN(id)) {
    throw 'Invalid game.';
  }

  const api = useApi();
  const game = useState<RbGame>('game');

  if (game.value?.id !== id) {
    // reset game-related states
    useState('team').value = undefined;

    try {
      const { data } = await api.get<RbGame>(`/games/${id}`);
      game.value = data;
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
      return;
    }

    try {
      const { data } = await api.get<RbTeam>(`/games/${id}/teams/self`);
      useState('team').value = data;
    } catch (error) {
      const code = getRbErrorCode(error);
      if (code != -104 && code != -101) {
        showError(error instanceof Error ? error : String(error));
        return;
      }
    }

    localStorage.setItem('rbph::select_game', id.toString());
  }
}

export async function clearTeamState() {
  useState('team').value = undefined;
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
  useState('team').value = undefined;
}
