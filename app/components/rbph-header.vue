<script setup lang="ts">
import type { NavigationMenuChildItem, NavigationMenuItem } from '@nuxt/ui';

const user = useUser().ref;

const game = useGame().ref;
const team = useTeam().ref;

const route = useRoute();

const navItems = computed(() => {
  if (!game.value) return [];

  const result = [] as NavigationMenuItem[];

  result.push({
    label: '主页',
    icon: 'material-symbols:home-outline-rounded',
    to: `/games/${game.value.id}`,
    exact: true,
  });

  if (game.value.rounds) {
    result.push({
      label: '谜题',
      icon: 'material-symbols:group-work-outline',
      children: game.value.rounds.map(x => {
        return {
          label: x.title,
          description: '谜题区域',
          icon: 'material-symbols:grid-view-outline-rounded',
          to: `/rounds/${x.id}`,
          active: route.path.startsWith(`/rounds/${x.id}`) || (route.path.startsWith('/puzzles') && usePuzzle().ref.value?.data.round.id === x.id),
        };
      }),
      active: route.path.startsWith('/puzzles') || route.path.startsWith('/rounds'),
    });
  }

  result.push({
    label: '公告',
    icon: 'material-symbols:chat-info-outline-rounded',
    to: `/games/${game.value.id}/info`,
  });

  result.push({
    label: '排行榜',
    icon: 'material-symbols:leaderboard-outline-rounded',
    to: `/games/${game.value.id}/leaderboard`,
  });

  return result;
});

const userNav = computed(() => {
  if (!game.value) return [];

  const result = [] as NavigationMenuItem[];

  if (user.value) {
    const children = [] as NavigationMenuChildItem[];

    children.push({
      label: user.value.nickname,
      description: '用户信息',
      icon: 'material-symbols:person-2-outline-rounded',
    });

    if (team.value) {
      children.push({
        label: team.value.name,
        description: '队伍信息',
        icon: 'material-symbols:groups-2-outline-rounded',
        to: `/games/${game.value.id}/team`,
      });

      children.push({
        label: '队伍动态',
        icon: 'material-symbols:dynamic-form-outline-rounded',
      });

      children.push({
        label: '站内信',
        icon: 'material-symbols:mail-outline-rounded',
        to: `/games/${game.value.id}/ticket`,
      });
    } else {
      children.push({
        label: '队伍管理',
        description: '加入或创建队伍',
        icon: 'material-symbols:groups-2-outline-rounded',
        to: `/games/${game.value.id}/team`,
      });
    }

    if (user.value.urole === RbUserRole.Admin) {
      children.push({
        label: '管理后台',
        icon: 'material-symbols:space-dashboard-outline-rounded',
        to: `/admin`,
        class: 'text-warning',
      });
    }

    children.push({
      label: '退出登录',
      icon: 'material-symbols:logout-rounded',
      to: `/logout`,
      class: 'text-error',
    });

    result.push({
      label: '用户',
      icon: 'material-symbols:deployed-code-account-outline-rounded',
      children: children,
    });
  } else {
    result.push({
      label: '登录',
      icon: 'material-symbols:login-rounded',
      to: `/login?url=/games/${game.value.id}`,
    });
  }

  return result;
});

const userNavMobile = computed(() => {
  if (!game.value) return [];

  const result = [] as NavigationMenuItem[][];

  if (user.value) {
    result.push([
      {
        label: user.value.nickname,
        type: 'label',
      },
      {
        label: '用户信息',
        icon: 'material-symbols:person-2-outline-rounded',
      },
    ]);

    if (team.value) {
      result.push([
        {
          label: team.value.name,
          type: 'label',
        },
        {
          label: '队伍信息',
          icon: 'material-symbols:groups-2-outline-rounded',
          to: `/games/${game.value.id}/team`,
        },
        {
          label: '队伍动态',
          icon: 'material-symbols:dynamic-form-outline-rounded',
        },
        {
          label: '站内信',
          icon: 'material-symbols:mail-outline-rounded',
          to: `/games/${game.value.id}/ticket`,
        },
      ]);
    } else {
      result.push([
        {
          label: '队伍管理',
          icon: 'material-symbols:groups-2-outline-rounded',
          to: `/games/${game.value.id}/team`,
        },
      ]);
    }

    const lastSpecial = [] as NavigationMenuItem[];

    if (user.value.urole === RbUserRole.Admin) {
      lastSpecial.push({
        label: '管理后台',
        icon: 'material-symbols:space-dashboard-outline-rounded',
        to: `/admin`,
        class: 'text-warning',
      });
    }

    lastSpecial.push({
      label: '退出登录',
      icon: 'material-symbols:logout-rounded',
      to: `/logout`,
      class: 'text-error',
    });

    result.push(lastSpecial);
  } else {
    result.push([
      {
        label: '登录',
        icon: 'material-symbols:login-rounded',
        to: `/login?url=/games/${game.value.id}`,
      },
    ]);
  }

  return result;
});
</script>

<template>
  <u-header :to="game ? `/games/${game.id}` : '/'">
    <template #title>
      {{ game?.title }}
    </template>
    <u-navigation-menu :items="[...navItems, ...userNav]" content-orientation="vertical" />
    <template #right>
      <u-color-mode-button />
    </template>
    <template #body>
      <u-navigation-menu :items="[navItems, ...userNavMobile]" orientation="vertical" />
    </template>
  </u-header>
</template>
