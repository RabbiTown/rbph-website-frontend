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
const { t } = useI18n();
const activeTab = ref(route.query.tab === 'phases' ? 'phases' : 'announcements');

const tabItems = [
  {
    label: t('pages.info.announcementsTab'),
    icon: 'material-symbols:chat-info-outline-rounded',
    value: 'announcements',
  },
  {
    label: t('pages.info.phasesTab'),
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
  titleTemplate: computed(() => buildTitleParts([{ text: activeTab.value === 'phases' ? t('pages.info.phaseTitle') : t('pages.info.announcementTitle') }, { text: game.value?.title, sep: ' - ' }])),
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
      handleError(error, t('pages.info.loadFailed'));
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

useSync().listen(SyncMessageType.GameNewAnnouncement, ({ data }) => {
  const gameId = game.value?.id;
  if (gameId && (data.game_id === null || data.game_id === gameId)) updateData(gameId);
});
</script>

<template>
  <u-main class="py-8">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <h1 class="text-2xl font-semibold text-highlighted">{{ t('pages.info.title') }}</h1>

      <u-tabs v-model="activeTab" :items="tabItems" variant="link" :content="false" class="-mb-2" />

      <rbph-annoucements v-if="activeTab === 'announcements'" :data="rawData" />

      <div v-else>
        <u-timeline v-if="timelineItems.length" :items="timelineItems" color="success" class="ms-8 mt-2">
          <template #description="{ item }">
            <rbph-content v-if="item.phase.description" class="mt-3 text-sm" :content="{ content: item.phase.description, content_type: item.phase.content_type }" />
          </template>
        </u-timeline>

        <u-empty v-else icon="material-symbols:event-busy-outline-rounded" :title="user ? t('pages.info.noPhases') : t('pages.info.loginToView')" :actions="user ? undefined : [{ label: t('auth.login'), to: `/login?url=${route.fullPath}` }]" />
      </div>
    </div>
  </u-main>
</template>
