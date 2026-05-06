<script setup lang="ts">
const user = useUser().ref;

const game = useState<RbGame>('game');
const team = useTeam().ref;

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
          color: 'error',
          to: `/logout`,
        },
      ],
    ];
  } else {
    return [];
  }
});

const roundMenuItems = computed(() => {
  return [
    [
      {
        label: '主页',
        icon: 'material-symbols:home-outline-rounded',
        to: `/games/${game.value.id}`,
      },
    ],
    ...(game.value && game.value.rounds
      ? [
          game.value.rounds.map(x => {
            return {
              label: x.title,
              icon: 'material-symbols:grid-view-outline-rounded',
              to: `/rounds/${x.id}`,
            };
          }),
        ]
      : []),
  ];
});
</script>

<template>
  <u-header :toggle="false" :to="game ? `/games/${game.id}` : '/'">
    <template #title>
      {{ game?.title }}
    </template>
    <template #right>
      <u-dropdown-menu v-if="gameStarted" :items="roundMenuItems" class="cursor-pointer" :ui="{ content: 'w-40' }">
        <u-tooltip text="谜题">
          <u-button color="neutral" variant="ghost" icon="material-symbols:group-work-outline" />
        </u-tooltip>
      </u-dropdown-menu>
      <u-tooltip v-if="game" text="公告">
        <u-button color="neutral" variant="ghost" :to="`/games/${game.id}/info`" icon="material-symbols:chat-info-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="gameStarted" text="排行榜">
        <u-button color="neutral" variant="ghost" :to="`/games/${game.id}/leaderboard`" icon="material-symbols:leaderboard-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="team" text="站内信">
        <u-button color="neutral" variant="ghost" :to="`/games/${game.id}/ticket`" icon="material-symbols:mail-outline-rounded" />
      </u-tooltip>
      <u-dropdown-menu v-if="user" :items="userMenuItems" :ui="{ content: 'w-40' }">
        <u-tooltip text="用户信息">
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
