export default defineNuxtPlugin(() => {
  const team = useTeam(false);
  const user = useUser(false);
  const currency = useCurrency(false);

  const syncing = ref(false);

  watch(
    user.ref,
    newUser => {
      if (syncing.value) return;
      if (newUser) updateGameState(undefined, true);
    },
    { immediate: true }
  );

  watch(
    team.ref,
    newTeam => {
      if (syncing.value) return;
      if (currency.activated && newTeam) currency.updateData();
    },
    { immediate: true }
  );

  async function syncWithAggreInfo(info: RbGameAggreInfo) {
    syncing.value = true;

    try {
      useGame().ref.value = info.game;
      useTeam().ref.value = info.team;
      useCurrency().ref.value = info.currency || [];
      useSyncTime().syncWith(new Date(info.server_time));

      await nextTick();
    } finally {
      syncing.value = false;
    }
  }

  return {
    provide: {
      syncWithAggreInfo,
    },
  };
});
