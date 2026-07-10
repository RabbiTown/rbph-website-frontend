<script setup lang="ts">
import type { BadgeProps, NavigationMenuChildItem, NavigationMenuItem } from '@nuxt/ui';

const user = useUser().ref;

const game = useGame().ref;
const team = useTeam().ref;

const route = useRoute();
const currentPuzzle = usePuzzle().ref;
const notificationState = useNotificationUnread();
const notificationUnread = notificationState.count;
const dmUnread = notificationState.dmCount;
const userMenuOpen = ref<string>();
const { t, locale } = useI18n();

function normalizeNavigationBadge(badge: NavigationMenuChildItem['badge']): BadgeProps | undefined {
  if (typeof badge === 'string' || typeof badge === 'number') return { label: badge };
  return badge;
}

function normalizeNavigationPath(to: NavigationMenuChildItem['to']): string | undefined {
  if (typeof to === 'string') return to.split(/[?#]/, 1)[0];
  if (to && typeof to === 'object' && 'path' in to && typeof to.path === 'string') return to.path;
  return undefined;
}

function isCurrentPath(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function isUserMenuChildActive(child: NavigationMenuChildItem): boolean {
  const path = normalizeNavigationPath(child.to);
  if (!path || path === '/logout') return false;
  return isCurrentPath(path);
}

const navItems = computed(() => {
  if (!game.value) return [];

  const result = [] as NavigationMenuItem[];

  result.push({
    value: 'game-home',
    label: t('nav.home'),
    icon: 'material-symbols:home-outline-rounded',
    to: `/games/${game.value.id}`,
    exact: true,
  });

  if (team.value && game.value.rounds && game.value.rounds.length > 0) {
    const inPuzzlePage = route.path.startsWith(`/games/${game.value?.id}/puzzles`) || route.path.startsWith('/puzzles');
    result.push({
      value: 'game-puzzles',
      label: t('nav.puzzles'),
      icon: 'material-symbols:group-work-outline',
      children: game.value.rounds.map(x => {
        return {
          value: `game-round-${x.id}`,
          label: x.title,
          description: t('nav.puzzleRound'),
          icon: 'material-symbols:grid-view-outline-rounded',
          to: gameRoundSimpleRoute(game.value?.id, x),
          active: route.path.startsWith(`/games/${game.value?.id}/rounds/${x.slug || x.id}`) || route.path.startsWith(`/rounds/${x.id}`) || (inPuzzlePage && currentPuzzle.value?.data.round.id === x.id),
        };
      }),
      active: inPuzzlePage || route.path.startsWith(`/games/${game.value.id}/rounds`) || route.path.startsWith('/rounds'),
    });
  } else if (!team.value) {
    result.push({
      value: 'game-profile',
      label: t('nav.joinGame'),
      icon: 'material-symbols:how-to-reg-outline-rounded',
      to: `/games/${game.value.id}/profile`,
      active: route.path.startsWith(`/games/${game.value.id}/profile`),
    });
  }

  result.push({
    value: 'game-announcements',
    label: t('nav.announcements'),
    icon: 'material-symbols:chat-info-outline-rounded',
    to: `/games/${game.value.id}/info`,
  });

  if (user.value) {
    result.push({
      value: 'game-leaderboard',
      label: t('nav.leaderboard'),
      icon: 'material-symbols:leaderboard-outline-rounded',
      to: `/games/${game.value.id}/leaderboard`,
    });
  }

  return result;
});

const userNav = computed(() => {
  if (!game.value) return [];

  const result = [] as NavigationMenuItem[];

  if (user.value) {
    const children = [] as NavigationMenuChildItem[];

    children.push({
      label: user.value.nickname + (team.value ? ` @ ${team.value?.name}` : ''),
      description: t('nav.profile'),
      icon: 'material-symbols:person-2-outline-rounded',
      to: `/games/${game.value.id}/profile`,
    });

    if (team.value) {
      children.push({
        label: t('nav.teamActivity'),
        icon: 'material-symbols:dynamic-form-outline-rounded',
        badge: notificationUnread.value > 0 ? { label: notificationUnread.value, color: 'error', variant: 'soft' } : undefined,
        to: notificationUnread.value > 0 ? `/games/${game.value.id}/activity?tab=notifications` : `/games/${game.value.id}/activity`,
      });

      children.push({
        label: t('nav.directMessages'),
        icon: 'material-symbols:mail-outline-rounded',
        badge: dmUnread.value > 0 ? { label: dmUnread.value, color: 'error', variant: 'soft' } : undefined,
        to: `/games/${game.value.id}/ticket`,
      });
    }

    if (user.value.urole >= RbUserRole.Moderator) {
      children.push({
        label: t('nav.staffInbox'),
        icon: 'material-symbols:inbox-outline-rounded',
        to: `/games/${game.value.id}/staff/inbox`,
        class: 'text-warning',
      });
    }

    if (user.value.urole >= RbUserRole.Admin) {
      children.push({
        label: t('nav.admin'),
        icon: 'material-symbols:space-dashboard-outline-rounded',
        to: `/admin`,
        class: 'text-warning',
      });
    }

    children.push({
      label: t('nav.logout'),
      icon: 'material-symbols:logout-rounded',
      to: `/logout`,
      class: 'text-error',
    });

    result.push({
      value: 'user-menu',
      label: t('nav.user'),
      icon: 'material-symbols:deployed-code-account-outline-rounded',
      avatar: {
        src: user.value.avatar,
        chip: notificationUnread.value > 0 ? { color: 'error' } : undefined,
      },
      slot: 'user-menu',
      active: children.some(isUserMenuChildActive),
      ui: { content: 'w-60 overflow-x-hidden' },
      children: children,
    });
  } else {
    result.push({
      value: 'login',
      label: t('nav.login'),
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
      label: user.value.nickname + (team.value ? ` @ ${team.value?.name}` : ''),
      type: 'label',
    });

    if (team.value) {
      userSpecial.push(
        {
          label: t('nav.profile'),
          icon: 'material-symbols:groups-2-outline-rounded',
          to: `/games/${game.value.id}/profile`,
        },
        {
          label: t('nav.teamActivity'),
          icon: 'material-symbols:dynamic-form-outline-rounded',
          badge: notificationUnread.value > 0 ? { label: notificationUnread.value, color: 'error', variant: 'soft' } : undefined,
          to: notificationUnread.value > 0 ? `/games/${game.value.id}/activity?tab=notifications` : `/games/${game.value.id}/activity`,
        },
        {
          label: t('nav.directMessages'),
          icon: 'material-symbols:mail-outline-rounded',
          badge: dmUnread.value > 0 ? { label: dmUnread.value, color: 'error', variant: 'soft' } : undefined,
          to: `/games/${game.value.id}/ticket`,
        },
      );
    } else {
      userSpecial.push({
        label: t('nav.profile'),
        icon: 'material-symbols:person-2-outline-rounded',
        to: `/games/${game.value.id}/profile`,
      });
    }

    if (user.value.urole >= RbUserRole.Moderator) {
      userSpecial.push({
        label: t('nav.staffInbox'),
        icon: 'material-symbols:inbox-outline-rounded',
        to: `/games/${game.value.id}/staff/inbox`,
        class: 'text-warning',
      });
    }

    result.push(userSpecial);

    const lastSpecial = [] as NavigationMenuItem[];

    if (user.value.urole >= RbUserRole.Admin) {
      lastSpecial.push({
        label: t('nav.admin'),
        icon: 'material-symbols:space-dashboard-outline-rounded',
        to: `/admin`,
        class: 'text-warning',
      });
    }

    lastSpecial.push({
      label: t('nav.logout'),
      icon: 'material-symbols:logout-rounded',
      to: `/logout`,
      class: 'text-error',
    });

    result.push(lastSpecial);
  } else {
    result.push([
      {
        label: t('nav.login'),
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
    <u-navigation-menu :key="`game-nav-${locale}-${game?.id ?? 'none'}-${game?.rounds?.length ?? 'none'}-${user?.id ?? 'guest'}-${team?.id ?? 'none'}`" v-model="userMenuOpen" :items="[...navItems, ...userNav]" content-orientation="vertical">
      <template #user-menu-content="{ item }">
        <ul class="grid w-full min-w-0 gap-1 p-2">
          <li v-for="child in item.children" :key="child.label">
            <u-link
              :to="child.to"
              :target="child.target"
              :external="child.external"
              :active="isUserMenuChildActive(child)"
              raw
              :class="['flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors', child.class]"
              active-class="bg-elevated text-highlighted"
              inactive-class="text-default hover:bg-elevated/50 hover:text-highlighted"
              @click="userMenuOpen = undefined"
            >
              <u-icon v-if="child.icon" :name="child.icon" class="size-5 shrink-0 text-dimmed" />
              <span class="min-w-0 flex-1">
                <span :class="['block truncate font-medium', child.class]">{{ child.label }}</span>
                <span v-if="child.description" class="mt-0.5 block truncate text-xs text-muted">{{ child.description }}</span>
              </span>
              <u-badge v-if="child.badge" v-bind="normalizeNavigationBadge(child.badge)" />
            </u-link>
          </li>
        </ul>
      </template>
    </u-navigation-menu>
    <template #right>
      <rb-language-switcher />
      <u-color-mode-button />
    </template>
    <template #body>
      <u-navigation-menu :key="`game-nav-mobile-${locale}-${game?.id ?? 'none'}-${game?.rounds?.length ?? 'none'}-${user?.id ?? 'guest'}-${team?.id ?? 'none'}`" :items="[navItems, ...userNavMobile]" orientation="vertical" />
    </template>
  </u-header>
</template>
