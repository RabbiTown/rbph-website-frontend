const currencyUsed = ref(false);
let currencyLastUpdate = 0;

const currency = ref<RbTeamCurrency[]>();

export function useCurrency(activate: boolean = true) {
  async function updateData() {
    if (await useAggreInfo().waitUpdate()) return;

    const now = Date.now();
    if (now - currencyLastUpdate < 500) return;
    currencyLastUpdate = now;

    const api = useApi();
    const gameId = useState<RbGame | undefined>('game').value?.id;

    if (gameId) {
      try {
        const { data } = await api.get<RbTeamCurrency[]>(`/games/${gameId}/teams/self/currency`);

        currency.value = data;
        useSyncTime().updateCurrentTimeRef();
      } catch (error) {
        if (getRbErrorCode(error) === -104) {
          currency.value = undefined;
        }
      }
    }
  }

  if (activate && !currencyUsed.value) {
    currencyUsed.value = true;
    updateData();
  }

  const syncTime = useSyncTime().currentTimeRef;

  function calcCurrent(target: RbTeamCurrency): number {
    return Math.min(target.amount + Math.floor((syncTime.value - new Date(target.utime_at).getTime()) / 60000) * target.growth, target.max_amount);
  }

  function getCurrent(id: number): ComputedRef<number | undefined> {
    return computed(() => {
      if (!currency.value) return undefined;

      const target = currency.value.find(x => x.id == id);
      if (!target) return undefined;

      return calcCurrent(target);
    });
  }

  function getAllCurrent(): ComputedRef<Record<number, RbTeamCurrency & { current: number }>> {
    return computed(() => {
      const result: Record<number, RbTeamCurrency & { current: number }> = {};

      if (!currency.value) return result;

      for (const x of currency.value) {
        result[x.id] = {
          ...x,
          current: calcCurrent(x),
        };
      }

      return result;
    });
  }

  return {
    ref: currency,
    getCurrent,
    getAllCurrent,
    updateData,
    activated: currencyUsed,
  };
}
