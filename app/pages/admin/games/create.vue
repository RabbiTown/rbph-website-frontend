<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

useHead({
  titleTemplate: '创建比赛 - RBPH 管理后台',
});

const schema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, '请输入比赛名称'), v.maxLength(60, '比赛名称不能超过 60 个字符')),
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
          [-2]: '比赛名称不合法。',
        },
      },
    );

    await gameMgr.updateGameList();
    if (!gameMgr.selectById(data.game.id)) gameMgr.upsert(data.game);

    toast.add({
      title: '比赛已创建',
      description: data.game.title,
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    await navigateTo(`/admin/games/${data.game.id}`);
  } catch (error) {
    handleError(error, '创建比赛失败', true);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <u-dashboard-panel id="game-create">
    <template #header>
      <u-dashboard-navbar title="创建比赛">
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
            <h2 class="text-xl font-semibold text-highlighted">比赛信息</h2>
            <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
              <rb-form-field name="title" row label="比赛名称" required :ui="{ container: 'w-full sm:w-96' }">
                <u-input v-model="state.title" autofocus maxlength="60" placeholder="输入比赛名称" class="w-full" :disabled="creating" />
              </rb-form-field>
            </div>
          </section>

          <div class="flex justify-end gap-2">
            <u-button type="button" color="neutral" variant="soft" label="取消" :to="cancelTarget" :disabled="creating" />
            <u-button type="submit" icon="material-symbols:add-circle-outline-rounded" label="创建比赛" :loading="creating" />
          </div>
        </u-form>

        <aside class="hidden xl:block" />
      </div>
    </template>
  </u-dashboard-panel>
</template>
