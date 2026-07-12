<script setup lang="ts">
const { t } = useI18n();

useHead({
  titleTemplate: computed(() => t('pages.transit.headTitle')),
});

const api = useApi();
const userMgr = useUser();
const games = ref<RbGame[]>([]);
const enteringGameId = ref<number>();
const loading = ref(true);

async function enterGame(game: RbGame) {
  if (enteringGameId.value) return;
  enteringGameId.value = game.id;
  if (import.meta.client) localStorage.setItem('rbph::select_game', game.id.toString());
  await navigateTo(`/games/${game.id}`);
}

async function initialize() {
  try {
    const userReady = userMgr.waitUpdate();
    const selectedId = Number(localStorage.getItem('rbph::select_game'));
    let selectedGame: RbGame | undefined;

    if (Number.isInteger(selectedId) && selectedId > 0) {
      try {
        const { data } = await api.get<RbGame>(`/games/${selectedId}`);
        selectedGame = data;
      } catch (error) {
        if (getRbErrorCode(error) !== -104) throw error;
        localStorage.removeItem('rbph::select_game');
      }
    }

    await userReady;
    if (selectedGame) {
      await enterGame(selectedGame);
    } else {
      const { data } = await api.get<RbGame[]>('/games/active');
      games.value = data;

      if (data.length === 0 && (userMgr.ref.value?.urole ?? RbUserRole.User) >= RbUserRole.Admin) {
        await navigateTo('/admin');
      } else if (data.length === 1 && data[0]) {
        await enterGame(data[0]);
      }
    }
  } catch (error) {
    showError(error instanceof Error ? error : String(error));
  } finally {
    loading.value = false;
  }
}

onMounted(initialize);
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10 sm:px-6">
    <u-icon v-if="loading" name="i-lucide:loader-circle" class="animate-spin" size="60px" />

    <section v-else-if="games.length > 1" class="w-full space-y-5">
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">{{ t('pages.transit.title') }}</h1>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="game in games"
          :key="game.id"
          type="button"
          class="group overflow-hidden rounded-lg bg-elevated text-start ring ring-default transition hover:-translate-y-0.5 hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :disabled="Boolean(enteringGameId)"
          @click="enterGame(game)"
        >
          <div class="aspect-16/7 overflow-hidden bg-muted">
            <img v-if="game.cover" :src="game.cover" :alt="game.title" class="size-full object-cover transition duration-300 group-hover:scale-[1.02]">
            <div v-else class="flex size-full items-center justify-center text-dimmed">
              <u-icon name="material-symbols:sports-esports-outline-rounded" class="size-10" />
            </div>
          </div>
          <div class="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <span class="min-w-0 font-medium text-highlighted">{{ game.title }}</span>
            <u-icon v-if="enteringGameId === game.id" name="material-symbols:progress-activity-rounded" class="size-5 shrink-0 animate-spin text-primary" />
            <u-icon v-else name="material-symbols:arrow-forward-rounded" class="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </button>
      </div>
    </section>

    <u-empty v-else-if="games.length === 0" class="w-full" icon="material-symbols:event-busy-outline-rounded" :title="t('pages.transit.noGames')">
      <template v-if="!userMgr.ref.value" #actions>
        <u-button to="/login" color="neutral" variant="outline" icon="material-symbols:login-rounded" :label="t('pages.transit.login')" />
      </template>
    </u-empty>
  </main>
</template>
