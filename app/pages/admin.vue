<script setup lang="ts">import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui';


const { t } = useI18n();

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
    if (x.length > 0 && route.name === 'admin') {
      navigateTo(`/admin/games/${x[0]?.id}`);
    }
  })
  .catch(err => {
    handleError(err, t('admin.pages.shell.loadGameListFailed'));
  })
  .finally(() => {
    if (route.name === 'admin') {
      navigateTo('/admin/users');
    }
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
      label: t('admin.common.createGame'),
      icon: 'material-symbols:add-circle-outline-rounded',
      to: '/admin/games/create',
    },
    {
      label: t('admin.pages.shell.managementGame'),
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
    { label: t('admin.common.logout'), icon: 'material-symbols:logout-rounded', color: 'error', to: '/logout' },
  ] satisfies DropdownMenuItem[];
});

function toggleColorMode() {
  colorMode.preference = isDarkMode.value ? 'light' : 'dark';
}

const navBottom = computed(() => {
  return [
    {
      label: isDarkMode.value ? t('admin.pages.shell.lightMode') : t('admin.pages.shell.darkMode'),
      icon: isDarkMode.value ? 'material-symbols:light-mode-outline-rounded' : 'material-symbols:dark-mode-outline-rounded',
      onSelect: toggleColorMode,
    },
    { label: t('admin.pages.shell.backToPlatform'), icon: 'material-symbols:home-outline-rounded', to: '/' },
  ] satisfies NavigationMenuItem[];
});

const nav = computed(() => {
  const result = [] as NavigationMenuItem[][];

  if (game.ref.value) {
    result.push([
      {
        value: 'admin-game-dashboard',
        label: t('admin.common.basicSettings'),
        icon: 'material-symbols:space-dashboard-outline-rounded',
        to: `/admin/games/${game.ref.value.id}`,
        exact: true,
      },
      {
        label: t('admin.common.gameFeatures'),
        icon: 'material-symbols:tune-rounded',
        to: `/admin/games/${game.ref.value.id}/features`,
      },
      {
        value: 'admin-game-puzzles',
        label: t('admin.common.puzzleManagement'),
        icon: 'material-symbols:extension-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/puzzles`,
        active: route.path.startsWith(`/admin/games/${game.ref.value.id}/puzzles`) || route.path.startsWith(`/admin/games/${game.ref.value.id}/rounds`),
      },
      {
        value: 'admin-game-teams',
        label: t('admin.common.teamManagement'),
        icon: 'material-symbols:groups-2-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/teams`,
        active: route.path.startsWith(`/admin/games/${game.ref.value.id}/teams`),
      },
      {
        value: 'admin-game-announcements',
        label: t('admin.common.gameAnnouncements'),
        icon: 'material-symbols:campaign-outline-rounded',
        to: `/admin/games/${game.ref.value.id}/announcements`,
      },
    ]);
  }

  const systemNav = [
    {
      value: 'admin-users',
      label: t('admin.common.userManagement'),
      icon: 'material-symbols:deployed-code-account-outline-rounded',
      to: '/admin/users',
      active: route.path.startsWith('/admin/users'),
    },
    {
      value: 'admin-announcements',
      label: t('admin.common.globalAnnouncements'),
      icon: 'material-symbols:campaign-outline-rounded',
      to: '/admin/announcements',
    },
    {
      value: 'admin-logs',
      label: t('admin.common.systemLogs'),
      icon: 'material-symbols:receipt-long-outline-rounded',
      to: '/admin/logs',
    },
    {
      value: 'admin-settings',
      label: t('admin.common.systemSettings'),
      icon: 'material-symbols:settings-outline-rounded',
      to: '/admin/settings',
    },
  ] satisfies NavigationMenuItem[];
  if (user.value?.urole !== RbUserRole.Root) systemNav.pop();
  result.push(systemNav);

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
            :label="collapsed ? undefined : (selectedGame?.title ?? t('admin.pages.shell.notSelectGame'))"
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
        <div class="mt-auto">
          <rb-language-switcher sidebar class="text-muted" :collapsed="collapsed" />
          <u-navigation-menu :items="navBottom" orientation="vertical" :collapsed="collapsed" />
        </div>
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
