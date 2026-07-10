<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

definePageMeta({
  layout: 'game',
});

const { t } = useI18n();
useUser().required();

const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: t('pages.leaderboard.title') }, { text: game.value?.title, sep: ' - ' }])),
});

const api = useApi();
const team = useTeam();

const pageData = ref<LeaderBoardInfo>();

const Icon = resolveComponent('icon');
const UBadge = resolveComponent('u-badge');

function solveCountText(count: unknown) {
  const value = Number(count);
  if (!Number.isFinite(value)) return `${String(count ?? '')} solves`;
  return t('pages.leaderboard.solvedCount', { count: value });
}

const columns = computed<TableColumn<LeaderBoardTeamInfo>[]>(() => [
  {
    header: '#',
    cell: ({ row }) => row.original.rank,
    meta: {
      class: {
        th: 'md:w-none w-0',
      },
    },
  },
  {
    accessorKey: 'name',
    header: t('pages.leaderboard.team'),
    cell: ({ row, getValue }) => [
      h('div', { class: 'text-lg text-highlighted font-bold' }, [getValue<string>(), row.original.id === team.ref.value?.id ? h(Icon, { name: 'material-symbols:location-on-outline-rounded', class: 'text-warning align-middle ms-1 mb-0.5' }) : null]),
      h('div', row.original.bio),
    ],
    meta: {
      class: {
        td: 'overflow-hidden text-pretty wrap-anywhere whitespace-normal',
      },
    },
  },
  {
    accessorKey: 'finish_at',
    header: t('pages.leaderboard.finishStatus'),
    cell: ({ getValue }) => {
      const state = getValue<string>();

      if (state) {
        return [h(UBadge, { color: 'success', variant: 'soft', icon: 'material-symbols:flag-rounded' }, () => t('pages.leaderboard.finished')), h('div', { class: 'mt-1 ms-1 text-xs' }, formatDate(state))];
      }
      return h(UBadge, { color: 'secondary', variant: 'soft', icon: 'material-symbols:flag-outline-rounded' }, () => t('pages.leaderboard.unfinished'));
    },
    meta: {
      class: {
        th: 'hidden md:table-cell',
        td: 'hidden md:table-cell',
      },
    },
  },
  {
    accessorKey: 'solves',
    header: t('pages.leaderboard.solvedCountHeader'),
    cell: ({ row, getValue }) => {
      const state = getValue<string>();

      if (state) {
        return [h(UBadge, { color: 'success', variant: 'soft', icon: 'material-symbols:check-rounded' }, () => solveCountText(state)), h('div', { class: 'mt-1 ms-1 text-xs' }, formatDate(row.original.last_solved_at))];
      }
      return h(UBadge, { color: 'secondary', variant: 'soft', icon: 'material-symbols:coffee-rounded' }, () => t('pages.leaderboard.noSolved'));
    },
    meta: {
      class: {
        th: 'hidden md:table-cell',
        td: 'hidden md:table-cell',
      },
    },
  },
  {
    header: t('pages.leaderboard.status'),
    cell: ({ row }) => {
      const result = [];

      const finishState = row.getValue<string>('finish_at');
      if (finishState) {
        result.push(h('div', h(UBadge, { color: 'success', variant: 'soft', icon: 'material-symbols:flag-rounded' }, () => t('pages.leaderboard.finished'))));
      } else {
        result.push(h('div', h(UBadge, { color: 'secondary', variant: 'soft', icon: 'material-symbols:flag-outline-rounded' }, () => t('pages.leaderboard.unfinished'))));
      }

      const solveState = row.getValue<string>('solves');
      if (solveState) {
        result.push(h('div', { class: 'mt-1 ms-1' }, () => solveCountText(solveState)));
      } else {
        result.push(h('div', { class: 'mt-1 ms-1' }, () => t('pages.leaderboard.noSolved')));
      }

      return result;
    },
    meta: {
      class: {
        th: 'md:hidden w-28',
        td: 'md:hidden',
      },
    },
  },
]);

const pageSize = 50;
const loadingMore = ref(false);

async function updateData(newId: number | undefined = undefined): Promise<boolean> {
  const gameId = newId || game.value?.id;
  if (gameId) {
    try {
      const previousVersion = pageData.value?.version;
      const { data } = await api.get<LeaderBoardInfo>(`/games/${gameId}/leaderboard`, { query: { version: previousVersion, offset: 0, limit: pageSize } });
      if (data) {
        pageData.value = previousVersion === data.version ? { ...data, data: pageData.value?.data ?? data.data } : data;
        if (data.state === 'locked' && timer) {
          clearInterval(timer);
          timer = null;
        }
        return true;
      }
    } catch (error) {
      handleError(error, t('pages.leaderboard.loadFailed'));
    }
  }
  return false;
}

async function loadMore() {
  if (!game.value?.id || !pageData.value?.has_more || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const current = pageData.value;
    const { data } = await api.get<LeaderBoardInfo>(`/games/${game.value.id}/leaderboard`, {
      query: { version: current.version, offset: current.data.length, limit: pageSize },
    });
    if (!data) return;
    if (data.reset || data.version !== current.version) {
      pageData.value = data;
    } else {
      const seen = new Set(current.data.map(item => item.id));
      pageData.value = { ...data, data: [...current.data, ...data.data.filter(item => !seen.has(item.id))] };
    }
  } catch (error) {
    handleError(error, t('pages.leaderboard.loadMoreFailed'));
  } finally {
    loadingMore.value = false;
  }
}

watch(game, async newGame => {
  pageData.value = undefined;
  updateData(newGame?.id);
}, { immediate: true });

const updateTime = ref(Date.now());
let timer: number | null = null;

onMounted(() => {
  useInfiniteScroll(window, loadMore, {
    distance: 50,
    canLoadMore: () => Boolean(pageData.value?.has_more) && !loadingMore.value,
  });

  timer = window.setInterval(() => {
    if (pageData.value?.state === 'locked') return;
    updateData().then(updated => {
      if (updated) updateTime.value = Date.now();
    });
  }, 5000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div>
    <div class="py-6">
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div class="text-3xl font-bold">{{ t('pages.leaderboard.title') }}</div>
        <div class="mt-2 text-secondary ms-0.5 text-xs">
          <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
          {{ t('pages.leaderboard.updatedAt', { time: formatDate(updateTime) }) }}
        </div>
      </div>
    </div>
    <div v-if="pageData">
      <u-alert
        v-if="pageData.state === 'locked'"
        class="mb-4"
        variant="subtle"
        color="warning"
        icon="material-symbols:lock-clock-outline-rounded"
        :title="t('pages.leaderboard.locked')"
        :description="pageData.locked_at ? t('pages.leaderboard.lockedDesc', { time: formatDate(pageData.locked_at) }) : t('pages.leaderboard.lockedDescShort')"
      />
      <u-table v-if="pageData.data.length > 0" :data="pageData.data" :columns="columns" :ui="{ base: 'md:table-auto table-fixed w-full' }" />
      <div v-if="loadingMore" class="flex justify-center py-4"><u-icon name="material-symbols:progress-activity" class="size-5 animate-spin text-muted" /></div>
      <u-empty v-if="pageData.data.length === 0" :description="t('pages.leaderboard.noValidTeams')" />
    </div>
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
  </div>
</template>
