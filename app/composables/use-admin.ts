const api = useApi();

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

export function useAdmin() {
  return {
    useGame,
  };
}
