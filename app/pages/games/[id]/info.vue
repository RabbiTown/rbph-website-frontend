<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui';

definePageMeta({
  layout: 'game',
});

type PhaseTimelineItem = TimelineItem & {
  phase: RbReleasePhase;
};

const game = useGame().ref;
const user = useUser().ref;
const phases = useGameReleaseSync().phases;
const route = useRoute();
const activeTab = ref(route.query.tab === 'phases' ? 'phases' : 'announcements');

const tabItems = [
  {
    label: '比赛公告',
    icon: 'material-symbols:chat-info-outline-rounded',
    value: 'announcements',
  },
  {
    label: '赛程安排',
    icon: 'material-symbols:event-list-outline-rounded',
    value: 'phases',
  },
];

const timelineItems = computed<PhaseTimelineItem[]>(() =>
  phases.value.map(phase => {
    const released = new Date(phase.release_at).getTime() <= useSyncTime().calcCurrentTime();
    return {
      value: phase.id,
      date: formatDate(phase.release_at),
      title: phase.title,
      icon: released ? 'material-symbols:check-rounded' : 'material-symbols:schedule-outline-rounded',
      phase,
      ui: {
        title: 'text-lg',
        indicator: released ? 'bg-success text-inverted' : 'bg-elevated text-muted ring ring-default',
        separator: released ? 'bg-success/50' : 'bg-elevated',
      },
    };
  }),
);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: activeTab.value === 'phases' ? '比赛阶段' : '公告' }, { text: game.value?.title, sep: ' - ' }])),
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
  { immediate: true },
);
</script>

<template>
  <u-main class="py-8">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <h1 class="text-2xl font-semibold text-highlighted">比赛信息</h1>

      <u-tabs v-model="activeTab" :items="tabItems" variant="link" :content="false" class="-mb-2" />

      <rbph-annoucements v-if="activeTab === 'announcements'" :data="rawData" />

      <div v-else class="max-w-4xl">
        <u-timeline v-if="timelineItems.length" :items="timelineItems" color="success" class="ms-8 mt-2">
          <template #description="{ item }">
            <rbph-content v-if="item.phase.description" class="mt-3 text-sm" :content="{ content: item.phase.description, content_type: item.phase.content_type }" />
          </template>
        </u-timeline>

        <u-empty v-else icon="material-symbols:event-busy-outline-rounded" :title="user ? '暂无公开阶段' : '登录后查看比赛阶段'" :actions="user ? undefined : [{ label: '登录', to: `/login?url=${route.fullPath}` }]" />
      </div>
    </div>
  </u-main>
</template>
