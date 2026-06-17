<script setup lang="ts">
import type { NavigationMenuChildItem, NavigationMenuItem } from '@nuxt/ui';

const user = useUser().ref;

const game = useGame().ref;
const team = useTeam().ref;

const route = useRoute();
const currentPuzzle = usePuzzle().ref;
const RBUser = resolveComponent('rb-user');

const navItems = computed(() => {
  if (!game.value) return [];

  const result = [] as NavigationMenuItem[];

  result.push({
    value: 'game-home',
    label: '主页',
    icon: 'material-symbols:home-outline-rounded',
    to: `/games/${game.value.id}`,
    exact: true,
  });

  if (team.value && game.value.rounds) {
    result.push({
      value: 'game-puzzles',
      label: '谜题',
      icon: 'material-symbols:group-work-outline',
      children: game.value.rounds.map(x => {
        return {
          value: `game-round-${x.id}`,
          label: x.title,
          description: '谜题区域',
          icon: 'material-symbols:grid-view-outline-rounded',
          to: gameRoundSimpleRoute(game.value?.id, x),
          active: route.path.startsWith(`/games/${game.value?.id}/rounds/${x.slug || x.id}`) || route.path.startsWith(`/rounds/${x.id}`) || currentPuzzle.value?.data.round.id === x.id,
        };
      }),
      active: route.path.startsWith(`/games/${game.value.id}/puzzles`) || route.path.startsWith(`/games/${game.value.id}/rounds`) || route.path.startsWith('/puzzles') || route.path.startsWith('/rounds'),
    });
  } else if (!team.value) {
    result.push({
      value: 'game-profile',
      label: '参与比赛',
      icon: 'material-symbols:how-to-reg-outline-rounded',
      to: `/games/${game.value.id}/profile`,
      active: route.path.startsWith(`/games/${game.value.id}/profile`),
    });
  }

  result.push({
    value: 'game-announcements',
    label: '公告',
    icon: 'material-symbols:chat-info-outline-rounded',
    to: `/games/${game.value.id}/info`,
  });

  result.push({
    value: 'game-leaderboard',
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
      label: user.value.nickname + (team.value ? ` @ ${team.value?.name}` : ''),
      description: '用户/队伍信息',
      icon: 'material-symbols:person-2-outline-rounded',
      to: `/games/${game.value.id}/profile`,
    });

    if (team.value) {
      children.push({
        label: '队伍动态',
        icon: 'material-symbols:dynamic-form-outline-rounded',
        to: `/games/${game.value.id}/activity`,
      });

      children.push({
        label: '站内信',
        icon: 'material-symbols:mail-outline-rounded',
        to: `/games/${game.value.id}/ticket`,
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
      value: 'user-menu',
      label: '用户',
      icon: 'material-symbols:deployed-code-account-outline-rounded',
      avatar: { src: buildCravatarUrl(user.value.email) },
      children: children,
    });
  } else {
    result.push({
      value: 'login',
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
    const userSpecial = [] as NavigationMenuItem[];
    userSpecial.push({
      label: user.value.nickname,
      type: 'label',
    });

    if (team.value) {
      userSpecial.push(
        {
          label: team.value.name,
          type: 'label',
        },
        {
          label: '用户/队伍信息',
          icon: 'material-symbols:groups-2-outline-rounded',
          to: `/games/${game.value.id}/profile`,
        },
        {
          label: '队伍动态',
          icon: 'material-symbols:dynamic-form-outline-rounded',
          to: `/games/${game.value.id}/activity`,
        },
        {
          label: '站内信',
          icon: 'material-symbols:mail-outline-rounded',
          to: `/games/${game.value.id}/ticket`,
        },
      );
    } else {
      userSpecial.push({
        label: '用户/队伍信息',
        icon: 'material-symbols:person-2-outline-rounded',
        to: `/games/${game.value.id}/profile`,
      });
    }

    result.push(userSpecial);

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
    <u-navigation-menu :key="`game-nav-${game?.id ?? 'none'}-${game?.rounds?.length ?? 'none'}-${user?.id ?? 'guest'}-${team?.id ?? 'none'}`" :items="[...navItems, ...userNav]" content-orientation="vertical" />
    <template #right>
      <u-color-mode-button />
    </template>
    <template #body>
      <u-navigation-menu :key="`game-nav-mobile-${game?.id ?? 'none'}-${game?.rounds?.length ?? 'none'}-${user?.id ?? 'guest'}-${team?.id ?? 'none'}`" :items="[navItems, ...userNavMobile]" orientation="vertical" />
    </template>
  </u-header>
</template>
