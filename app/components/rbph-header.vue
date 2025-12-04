<script setup lang="ts">
const route = useRoute();
const gameId = computed(() => route.params.id as string);
const user = await useUser();

const game = useState<RbGame>('game');
</script>

<template>
  <u-header :toggle="false">
    <template #title>
      {{ game?.title }}
    </template>
    <template #right>
      <u-tooltip v-if="user" text="迷题">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/areas`" icon="material-symbols:group-work-outline" />
      </u-tooltip>
      <u-tooltip text="公告">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/info`" icon="material-symbols:chat-info-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="user" text="排行榜">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/leaderboard`" icon="material-symbols:leaderboard-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="user" text="站内信">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/mail`" icon="material-symbols:mail-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="user" text="用户信息">
        <u-button color="neutral" variant="ghost" :to="`/games/${gameId}/profile`" icon="material-symbols:deployed-code-account-outline-rounded" />
      </u-tooltip>
      <u-tooltip v-if="!user" text="登录">
        <u-button color="neutral" variant="ghost" :to="`/login?url=/games/${gameId}`" icon="material-symbols:login-rounded" />
      </u-tooltip>
      <u-color-mode-button />
    </template>
  </u-header>
</template>
