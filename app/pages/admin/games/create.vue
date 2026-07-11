<script setup lang="ts">import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';


const { t } = useI18n();

useHead({
  titleTemplate: t('admin.pages.createGame.pageTitle'),
});

const schema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, t('admin.pages.createGame.enterGameName')), v.maxLength(60, t('admin.pages.createGame.gameNameCannotExceedItemCharacters'))),
});

type CreateGameSchema = v.InferOutput<typeof schema>;

const api = useApi();
const toast = useToast();
const gameMgr = useAdmin().useGame();
const creating = ref(false);
const state = reactive({ title: '' });
const cancelTarget = computed(() => {
  const gameId = gameMgr.ref.value?.id ?? gameMgr.gameList.value[0]?.id;
  return gameId ? `/admin/games/${gameId}` : '/admin';
});

async function createGame(event: FormSubmitEvent<CreateGameSchema>) {
  if (creating.value) return;

  creating.value = true;
  try {
    type Response = { game: RbGameModel };
    const { data } = await api.post<Response>(
      '/admin/games',
      { title: event.data.title },
      {
        errorHints: {
          [-2]: t('admin.pages.createGame.gameNameInvalid'),
        },
      },
    );

    await gameMgr.updateGameList();
    if (!gameMgr.selectById(data.game.id)) gameMgr.upsert(data.game);

    toast.add({
      title: t('admin.pages.createGame.gameCreated'),
      description: data.game.title,
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    await navigateTo(`/admin/games/${data.game.id}`);
  } catch (error) {
    handleError(error, t('admin.pages.createGame.createGameFailed'), true);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <u-dashboard-panel id="game-create">
    <template #header>
      <u-dashboard-navbar :title="t('admin.common.createGame')">
        <template #leading>
          <u-dashboard-sidebar-collapse />
        </template>
      </u-dashboard-navbar>
    </template>

    <template #body>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]">
        <aside class="hidden xl:block" />

        <u-form :schema="schema" :state="state" class="flex min-w-0 flex-col gap-4" @submit="createGame">
          <section class="space-y-4">
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.gameInfo') }}</h2>
            <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
              <rb-form-field name="title" row :label="t('admin.common.gameName')" required :ui="{ container: 'w-full sm:w-96' }">
                <u-input v-model="state.title" autofocus maxlength="60" :placeholder="t('admin.common.enterGameName')" class="w-full" :disabled="creating" />
              </rb-form-field>
            </div>
          </section>

          <div class="flex justify-end gap-2">
            <u-button type="button" color="neutral" variant="soft" :label="t('admin.common.cancel')" :to="cancelTarget" :disabled="creating" />
            <u-button type="submit" icon="material-symbols:add-circle-outline-rounded" :label="t('admin.common.createGame')" :loading="creating" />
          </div>
        </u-form>

        <aside class="hidden xl:block" />
      </div>
    </template>
  </u-dashboard-panel>
</template>
