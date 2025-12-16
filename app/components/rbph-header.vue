<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const user = await useUser(false);

const game = useState<RbGame>('game');
const team = await useTeam();

const gameStarted = computed(() => game.value && team.value && new Date(Date.now()) >= new Date(game.value.start_at));

const userMenuItems = computed(() => {
  if (user.value) {
    return [
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
        ...(game.value
          ? [
              {
                label: '队伍信息',
                icon: 'material-symbols:groups-2-outline-rounded',
                to: `/games/${game.value.id}/team`,
              },
            ]
          : []),
      ],
      [
        {
          label: '退出登录',
          icon: 'material-symbols:logout-rounded',
          to: `/logout`,
        },
      ],
    ];
  } else {
    return [];
  }
});
</script>

<template>
  <u-header :toggle="false">
    <template #title>
      {{ game?.title }}
    </template>
    <template #right>
      <u-tooltip v-if="gameStarted" text="迷题">
        <u-button color="neutral" variant="ghost" :to="`/games/${game.id}/rounds`" icon="material-symbols:group-work-outline" />
      </u-tooltip>
      <u-tooltip v-if="game" text="公告">
        <u-button color="neutral" variant="ghost" :to="`/games/${game.id}/info`" icon="material-symbols:chat-info-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="gameStarted" text="排行榜">
        <u-button color="neutral" variant="ghost" :to="`/games/${game.id}/leaderboard`" icon="material-symbols:leaderboard-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="team" text="站内信">
        <u-button color="neutral" variant="ghost" :to="`/games/${game.id}/mail`" icon="material-symbols:mail-outline-rounded" />
      </u-tooltip>
      <u-dropdown-menu :items="userMenuItems">
        <u-tooltip v-if="user" text="用户信息">
          <u-button color="neutral" variant="ghost" class="cursor-pointer" icon="material-symbols:deployed-code-account-outline-rounded" />
        </u-tooltip>
      </u-dropdown-menu>
      <u-tooltip v-if="!user && game" text="登录">
        <u-button color="neutral" variant="ghost" :to="`/login?url=/games/${game.id}`" icon="material-symbols:login-rounded" />
      </u-tooltip>
      <u-color-mode-button />
    </template>
  </u-header>
</template>
