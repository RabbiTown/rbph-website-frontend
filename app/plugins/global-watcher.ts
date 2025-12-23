export default defineNuxtPlugin(() => {
  const team = useTeam(false);
  const user = useUser(false);
  const game = useGame();

  watch(
    [game.ref, user.ref],
    () => {
      if (team.activated) team.updateData();
    },
    { immediate: true }
  );
});
