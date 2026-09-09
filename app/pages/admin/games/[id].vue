<script setup lang="ts">
const { t } = useI18n();

const gameMgr = useAdmin().useGame();
const game = gameMgr.ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: game.value?.title }, { text: t('admin.common.adminPanelTitle'), sep: ' - ' }])),
});

const route = useRoute();

const tabs = computed(() => (game.value ? buildAdminGameNavigation(game.value.id, route.path, t) : []));
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
