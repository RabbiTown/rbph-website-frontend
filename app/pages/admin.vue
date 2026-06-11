<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui';

definePageMeta({ middleware: ['admin'] });

const route = useRoute();

const user = useUser().ref;
const game = useAdmin().useGame();
const colorMode = useColorMode();
const selectedGame = computed(() => game.ref.value);
const gameSwitchIcon = computed(() => (selectedGame.value ? 'material-symbols:sports-esports-outline-rounded' : 'material-symbols:remove-selection-rounded'));
const isDarkMode = computed(() => colorMode.value === 'dark');

game
  .updateGameList()
  .then(x => {
    if (x.length > 0 && route.path === '/admin') {
      navigateTo(`/admin/games/${x[0]?.id}`);
    }
  })
  .catch(err => {
    handleError(err, '获取比赛列表失败');
  });

const gameNav = computed(() => {
  const result = [] as DropdownMenuItem[][];

  if (game.gameList.value) {
    result.push(
      game.gameList.value.map(x => {
        return {
          label: x.title,
          icon: 'material-symbols:sports-esports',
          to: `/admin/games/${x.id}`,
        };
      }),
    );
  }

  result.push([
    {
      label: '创建比赛',
      icon: 'material-symbols:add-circle-outline-rounded',
      to: '/admin/games/create',
    },
    {
      label: '管理比赛',
      icon: 'material-symbols:settings-outline-rounded',
      to: '/admin/games',
      exact: true,
    },
  ]);

  return result;
});

const userNav = computed(() => {
  return [
    { label: user.value?.nickname, type: 'label' },
    { label: '退出登录', icon: 'material-symbols:logout-rounded', color: 'error', to: '/logout' },
  ] satisfies DropdownMenuItem[];
});

function toggleColorMode() {
  colorMode.preference = isDarkMode.value ? 'light' : 'dark';
}

const navBottom = computed(() => {
  return [
    {
      label: isDarkMode.value ? '浅色模式' : '深色模式',
      icon: isDarkMode.value ? 'material-symbols:light-mode-outline-rounded' : 'material-symbols:dark-mode-outline-rounded',
      onSelect: toggleColorMode,
    },
    { label: '返回平台', icon: 'material-symbols:home-outline-rounded', to: '/' },
  ] satisfies NavigationMenuItem[];
});

const nav = computed(() => {
  const result = [] as NavigationMenuItem[][];

  if (game.ref.value) {
    result.push([
      {
        value: 'admin-game-dashboard',
        label: '仪表盘',
        icon: 'material-symbols:space-dashboard-outline-rounded',
        to: `/admin/games/${game.ref.value.id}`,
        exact: true,
      },
      {
        value: 'admin-game-puzzles',
        label: '谜题管理',
        icon: 'material-symbols:extension-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/puzzles`,
        active: route.path.startsWith(`/admin/games/${game.ref.value.id}/puzzles`) || route.path.startsWith(`/admin/games/${game.ref.value.id}/rounds`),
      },
      {
        value: 'admin-game-teams',
        label: '队伍管理',
        icon: 'material-symbols:groups-2-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/teams`,
      },
      {
        value: 'admin-game-tickets',
        label: '工单管理',
        icon: 'material-symbols:mail-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/tickets`,
      },
    ]);
  }

  result.push([
    {
      value: 'admin-users',
      label: '用户管理',
      icon: 'material-symbols:deployed-code-account-outline-rounded',
      to: '/admin/users',
    },
    {
      value: 'admin-logs',
      label: '系统日志',
      icon: 'material-symbols:receipt-long-outline-rounded',
      to: '/admin/users',
    },
    {
      value: 'admin-settings',
      label: '系统设置',
      icon: 'material-symbols:settings-outline-rounded',
      to: '/admin/users',
    },
  ]);

  return result;
});
</script>

<template>
  <u-dashboard-group unit="rem">
    <u-dashboard-sidebar id="default" collapsible resizable class="bg-elevated/25" :ui="{ footer: 'lg:border-t lg:border-default' }">
      <template #header="{ collapsed }">
        <u-dropdown-menu :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }" :items="gameNav">
          <u-button
            :key="`admin-game-switch-${selectedGame?.id ?? 'none'}-${collapsed ? 'collapsed' : 'expanded'}`"
            :label="collapsed ? undefined : (selectedGame?.title ?? '未选择比赛')"
            :trailing-icon="collapsed ? undefined : 'material-symbols:expand-all-rounded'"
            :icon="gameSwitchIcon"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated cursor-pointer"
            :ui="{ trailingIcon: 'text-dimmed' }"
          />
        </u-dropdown-menu>
      </template>
      <template #default="{ collapsed }">
        <u-navigation-menu :key="`admin-nav-${game.ref.value?.id ?? 'none'}-${collapsed ? 'collapsed' : 'expanded'}`" :items="nav" orientation="vertical" :collapsed="collapsed" />
        <u-navigation-menu :items="navBottom" orientation="vertical" :collapsed="collapsed" class="mt-auto" />
      </template>
      <template #footer="{ collapsed }">
        <u-dropdown-menu :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }" :items="userNav">
          <u-button
            :label="collapsed ? undefined : user?.nickname"
            :trailing-icon="collapsed ? undefined : 'material-symbols:event-list-outline-rounded'"
            icon="material-symbols:person-2-outline-rounded"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated cursor-pointer"
            :ui="{ trailingIcon: 'text-dimmed' }"
          />
        </u-dropdown-menu>
      </template>
    </u-dashboard-sidebar>
    <nuxt-page />
  </u-dashboard-group>
</template>
