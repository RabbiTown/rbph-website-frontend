export default defineNuxtPlugin(() => {
  const team = useTeam(false);
  const user = useUser(false);
  const game = useGame();
  const currency = useCurrency(false);

  watch(
    [game.ref, user.ref],
    () => {
      if (team.activated) team.updateData();
    },
    { immediate: true }
  );

  watch(
    [team.ref],
    () => {
      if (currency.activated) currency.updateData();
    },
    { immediate: true }
  );
});
