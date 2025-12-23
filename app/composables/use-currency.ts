class SyncTime {
  serverTime: number = NaN;
  localTime: number = 0;

  currentTimeRef: Ref<number> = ref(Date.now());

  timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  intervalId: ReturnType<typeof setTimeout> | undefined = undefined;

  syncWith(server_time: Date) {
    this.serverTime = server_time.getTime();
    this.localTime = Date.now();
    this.updateCurrentTimeRef();
  }

  calcCurrentTime() {
    if (isNaN(this.serverTime)) {
      return Date.now();
    } else {
      return this.serverTime + Date.now() - this.localTime;
    }
  }

  updateCurrentTimeRef() {
    this.currentTimeRef.value = this.calcCurrentTime();
  }

  startAutoUpdate() {
    this.stopAutoUpdate();

    const current = this.calcCurrentTime();
    const nextMs = 60000 - (current % 60000);
    this.timeoutId = setTimeout(() => {
      this.updateCurrentTimeRef();
      this.intervalId = setInterval(() => this.updateCurrentTimeRef(), 60000);
    }, nextMs);
  }

  stopAutoUpdate() {
    clearTimeout(this.timeoutId);
    clearInterval(this.intervalId);
  }
}

const syncTime = new SyncTime();

export function useSyncTime() {
  return syncTime;
}

let inited = false;

export function useCurrency() {
  const currency = ref<RbTeamCurrencyWrapper>();

  async function updateData() {
    syncTime.stopAutoUpdate();

    const api = useApi();
    const gameId = useState<RbGame | undefined>('game').value?.id;

    if (gameId) {
      try {
        const { data } = await api.get<RbTeamCurrencyWrapper>(`/games/${gameId}/teams/self/currency`);

        currency.value = data;
        syncTime.syncWith(new Date(currency.value.server_time));
      } catch (error) {
        if (getRbErrorCode(error) === -104) {
          currency.value = undefined;
        }
      }
    }

    syncTime.startAutoUpdate();
  }

  if (!inited) {
    inited = true;
    watch(useState('team'), () => updateData(), { immediate: true });
  }

  function calcCurrent(target: RbTeamCurrency): number {
    return Math.min(target.amount + Math.floor((syncTime.currentTimeRef.value - new Date(target.utime_at).getTime()) / 60000) * target.growth, target.max_amount);
  }

  function getCurrent(id: number): ComputedRef<number | undefined> {
    return computed(() => {
      if (!currency.value) return undefined;

      const target = currency.value.data.find(x => x.id == id);
      if (!target) return undefined;

      return calcCurrent(target);
    });
  }

  function getAllCurrent(): ComputedRef<Record<number, RbTeamCurrency & { current: number }>> {
    return computed(() => {
      const result: Record<number, RbTeamCurrency & { current: number }> = {};

      if (!currency.value) return result;

      for (const x of currency.value.data) {
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
  };
}
