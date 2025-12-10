<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const route = useRoute();
const gameId = computed(() => route.params.id as string);
const user = await useUser(false);

const game = useState<RbGame>('game');
const team = await useTeam();

const inGame = computed(() => team.value?.tstate === RbTeamState.InGame);

const userMenuItems = ref<DropdownMenuItem[]>([]);

if (user.value) {
  userMenuItems.value = [
    [
      {
        label: user.value.nickname,
        type: 'label',
      },
    ],
    [
      {
        label: '用户信息',
        icon: 'material-symbols:person-2-outline-rounded',
      },
      {
        label: '队伍信息',
        icon: 'material-symbols:groups-2-outline-rounded',
        to: `/games/${gameId.value}/team`,
      },
    ],
    [
      {
        label: '退出登录',
        icon: 'material-symbols:logout-rounded',
        to: `/logout`,
      },
    ],
  ];
}
</script>

<template>
  <u-header :toggle="false">
    <template #title>
      {{ game?.title }}
    </template>
    <template #right>
      <u-tooltip v-if="inGame" text="迷题">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/areas`" icon="material-symbols:group-work-outline" />
      </u-tooltip>
      <u-tooltip text="公告">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/info`" icon="material-symbols:chat-info-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="inGame" text="排行榜">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/leaderboard`" icon="material-symbols:leaderboard-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="user" text="站内信">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/mail`" icon="material-symbols:mail-outline-rounded" />
      </u-tooltip>
      <u-dropdown-menu :items="userMenuItems">
        <u-tooltip v-if="user" text="用户信息">
          <u-button color="neutral" variant="ghost" icon="material-symbols:deployed-code-account-outline-rounded" />
        </u-tooltip>
      </u-dropdown-menu>
      <u-tooltip v-if="!user" text="登录">
        <u-button color="neutral" variant="ghost" :to="`/login?url=/games/${gameId}`" icon="material-symbols:login-rounded" />
      </u-tooltip>
      <u-color-mode-button />
    </template>
  </u-header>
</template>
