<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: '公告' }, { text: game.value?.title, sep: ' - ' }])),
});

const api = useApi();

const rawData = ref<RbAnnouncementInfo[]>();

async function updateData(newId: number | undefined) {
  const gameId = newId;
  if (gameId) {
    try {
      const { data } = await api.get<RbAnnouncementInfo[]>(`/games/${gameId}/announcements`);
      rawData.value = data;
    } catch (error) {
      handleError(error, '获取公告信息失败');
    }
  }
}

watch(
  game,
  async newGame => {
    rawData.value = undefined;
    updateData(newGame?.id);
  },
  { immediate: true }
);
</script>

<template>
  <div>
    <div class="py-6">
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div class="text-3xl font-bold">公告</div>
      </div>
    </div>

    <rbph-annoucements :data="rawData" />
  </div>
</template>
