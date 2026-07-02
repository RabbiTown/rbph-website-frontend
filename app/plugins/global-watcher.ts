export default defineNuxtPlugin(() => {
  const team = useTeam(false);
  const user = useUser(false);
  const currency = useCurrency(false);

  const syncing = ref(false);

  watch(
    user.ref,
    newUser => {
      if (syncing.value) return;
      if (newUser && !newUser.must_change_password) updateGameState(undefined, true);
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
      useGame().ref.value = { ...info.game, rounds: info.rounds };
      useTeam().ref.value = info.team;
      useCurrency().ref.value = info.currency || [];
      useSyncTime().syncWith(new Date(info.server_time));
      useGameReleaseSync().initialize(info);

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
