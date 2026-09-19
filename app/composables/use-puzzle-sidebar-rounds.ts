const pendingRequests = new Map<number, Promise<RbRoundUserData>>();
let cacheGeneration = 0;

export function usePuzzleSidebarRounds() {
  const rounds = useState<Record<number, RbRoundUserData>>('puzzle-sidebar-rounds', () => ({}));

  async function load(id: number, refresh = false) {
    const cached = rounds.value[id];
    if (cached && !refresh) return cached;

    let request = pendingRequests.get(id);
    if (!request) {
      request = useApi()
        .get<RbRoundUserData>(`/rounds/${id}`)
        .then(({ data }) => data);
      pendingRequests.set(id, request);
    }

    const generation = cacheGeneration;
    try {
      const data = await request;
      if (generation === cacheGeneration) rounds.value[id] = data;
      return data;
    } finally {
      if (pendingRequests.get(id) === request) pendingRequests.delete(id);
    }
  }

  return { rounds, load };
}

export function clearPuzzleSidebarRounds() {
  cacheGeneration++;
  pendingRequests.clear();
  useState<Record<number, RbRoundUserData>>('puzzle-sidebar-rounds').value = {};
}
