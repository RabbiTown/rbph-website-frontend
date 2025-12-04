<script setup lang="ts">
const api = useApi();
const route = useRoute();

const gameId = computed(() => route.params.id as string);

const game = useState<RbGame>('game');

if (!game.value || String(game.value.id) !== gameId.value) {
  // reset game-related states
  useState('team').value = undefined;

  try {
    const { data } = await api.get<RbGame>(`/games/${gameId.value}`);
    game.value = data;
  } catch (error) {
    showError(error instanceof Error ? error : String(error));
  }

  try {
    const { data } = await api.get<RbTeam>(`/games/${gameId.value}/teams/self`);
    useState('team').value = data;
  } catch (error) {
    const code = getRbErrorCode(error);
    if (code != -104 && code != -101) {
      showError(error instanceof Error ? error : String(error));
    }
  }
}

onMounted(() => {
  localStorage.setItem('rbph::select_game', gameId.value);
});
</script>

<template>
  <NuxtPage />
</template>
