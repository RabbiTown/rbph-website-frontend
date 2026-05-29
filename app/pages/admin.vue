<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui';

definePageMeta({ middleware: ['admin'] });

const route = useRoute();

const user = useUser().ref;
const game = useAdmin().useGame();

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
          icon: 'material-symbols:videogame-asset-rounded',
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

const navBottom = computed(() => {
  return [{ label: '返回平台', icon: 'material-symbols:home-outline-rounded', to: '/' }] satisfies DropdownMenuItem[];
});

const nav = computed(() => {
  const result = [] as NavigationMenuItem[][];

  if (game.ref.value) {
    result.push([
      {
        label: '仪表盘',
        icon: 'material-symbols:space-dashboard-outline-rounded',
        to: `/admin/games/${game.ref.value.id}`,
        exact: true,
      },
      {
        label: '谜题管理',
        icon: 'material-symbols:extension-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/puzzles`,
      },
      {
        label: '队伍管理',
        icon: 'material-symbols:groups-2-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/teams`,
      },
      {
        label: '工单管理',
        icon: 'material-symbols:mail-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/tickets`,
      },
    ]);
  }

  result.push([
    {
      label: '用户管理',
      icon: 'material-symbols:deployed-code-account-outline-rounded',
      to: '/admin/users',
    },
    {
      label: '系统日志',
      icon: 'material-symbols:receipt-long-outline-rounded',
      to: '/admin/users',
    },
    {
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
            :label="collapsed ? undefined : (game.ref.value?.title ?? '未选择比赛')"
            :trailing-icon="collapsed ? undefined : 'material-symbols:expand-all-rounded'"
            :icon="game.ref.value ? 'material-symbols:videogame-asset-rounded' : 'material-symbols:remove-selection-rounded'"
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
        <u-navigation-menu :items="nav" orientation="vertical" :collapsed="collapsed" />
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
