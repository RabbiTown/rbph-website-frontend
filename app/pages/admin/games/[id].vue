<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const gameMgr = useAdmin().useGame();
const game = gameMgr.ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: game.value?.title }, { text: 'RBPH 管理后台', sep: ' - ' }])),
});

const route = useRoute();

const gameId = computed(() => route.params.id as string);

watch(
  [gameId, gameMgr.gameList],
  () => {
    const id = parseInt(gameId.value);
    if (isNaN(id)) gameMgr.upsert(undefined);
    gameMgr.selectById(id);
  },
  { immediate: true },
);

const tabs = computed(() => {
  if (!game.value) return [];

  return [
    {
      label: '仪表盘',
      icon: 'material-symbols:space-dashboard-outline-rounded',
      to: `/admin/games/${game.value.id}`,
      exact: true,
    },
    {
      label: '谜题管理',
      icon: 'material-symbols:extension-outline-rounded',
      to: `/admin/games/${game.value.id}/puzzles`,
      active: route.path.startsWith(`/admin/games/${game.value.id}/puzzles`) || route.path.startsWith(`/admin/games/${game.value.id}/rounds`),
    },
    {
      label: '队伍管理',
      icon: 'material-symbols:groups-2-outline-rounded',
      to: `/admin/games/${game.value.id}/teams`,
    },
    {
      label: '工单管理',
      icon: 'material-symbols:mail-outline-rounded',
      to: `/admin/games/${game.value.id}/tickets`,
    },
  ] satisfies NavigationMenuItem[];
});
</script>

<template>
  <u-dashboard-panel id="game-index">
    <template #header>
      <u-dashboard-navbar :title="game?.title">
        <template #leading>
          <u-dashboard-sidebar-collapse />
        </template>
      </u-dashboard-navbar>

      <u-dashboard-toolbar>
        <u-navigation-menu :items="tabs" highlight class="-mx-1" />
      </u-dashboard-toolbar>
    </template>

    <template #body>
      <div>
        <nuxt-page />
      </div>
    </template>
  </u-dashboard-panel>
</template>
