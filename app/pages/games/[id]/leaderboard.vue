<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

definePageMeta({
  layout: 'game',
});

useUser().required();

const game = useGame().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: '排行榜' }, { text: game.value?.title, sep: ' - ' }])),
});

const api = useApi();
const team = useTeam();

const pageData = ref<LeaderBoardInfo>();

const Icon = resolveComponent('icon');
const UBadge = resolveComponent('u-badge');

const columns = ref<TableColumn<LeaderBoardTeamInfo>[]>([
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
    header: '队伍',
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
    header: '完赛状态',
    cell: ({ getValue }) => {
      const state = getValue<string>();

      if (state) {
        return [h(UBadge, { color: 'success', variant: 'soft', icon: 'material-symbols:flag-rounded' }, () => '已完赛'), h('div', { class: 'mt-1 ms-1 text-xs' }, formatDate(state))];
      } else {
        return h(UBadge, { color: 'secondary', variant: 'soft', icon: 'material-symbols:flag-outline-rounded' }, () => '未完赛');
      }
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
    header: '解出题数',
    cell: ({ row, getValue }) => {
      const state = getValue<string>();

      if (state) {
        return [h(UBadge, { color: 'success', variant: 'soft', icon: 'material-symbols:check-rounded' }, () => `解出 ${state} 题`), h('div', { class: 'mt-1 ms-1 text-xs' }, formatDate(row.original.last_solved_at))];
      } else {
        return h(UBadge, { color: 'secondary', variant: 'soft', icon: 'material-symbols:coffee-rounded' }, () => '暂无解出');
      }
    },
    meta: {
      class: {
        th: 'hidden md:table-cell',
        td: 'hidden md:table-cell',
      },
    },
  },
  {
    header: '状态',
    cell: ({ row }) => {
      const result = [];

      const finishState = row.getValue<string>('finish_at');
      if (finishState) {
        result.push(
          h(
            'div',
            h(UBadge, { color: 'success', variant: 'soft', icon: 'material-symbols:flag-rounded' }, () => '已完赛')
          )
        );
      } else {
        result.push(
          h(
            'div',
            h(UBadge, { color: 'secondary', variant: 'soft', icon: 'material-symbols:flag-outline-rounded' }, () => '未完赛')
          )
        );
      }

      const solveState = row.getValue<string>('solves');
      if (solveState) {
        result.push(h('div', { class: 'mt-1 ms-1' }, () => `解出 ${solveState} 题`));
      } else {
        result.push(h('div', { class: 'mt-1 ms-1' }, () => '暂无解出'));
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
      handleError(error, '获取排行榜信息失败');
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
    handleError(error, '加载更多排行榜队伍失败');
  } finally {
    loadingMore.value = false;
  }
}

watch(
  game,
  async newGame => {
    pageData.value = undefined;
    updateData(newGame?.id);
  },
  { immediate: true }
);

const updateTime = ref(Date.now());

let timer: number | null = null;

onMounted(() => {
  useInfiniteScroll(
    window,
    loadMore,
    {
      distance: 50,
      canLoadMore: () => Boolean(pageData.value?.has_more) && !loadingMore.value,
    }
  );

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
        <div class="text-3xl font-bold">排行榜</div>
        <div class="mt-2 text-secondary ms-0.5 text-xs">
          <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
          更新于 {{ formatDate(updateTime) }}
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
        title="排行榜已锁定"
        :description="pageData.locked_at ? `当前展示的是 ${formatDate(pageData.locked_at)} 的排名快照，之后的提交仍然有效但不会改变此处排名。` : '之后的提交仍然有效，但不会改变此处排名。'"
      />
      <u-table v-if="pageData.data.length > 0" :data="pageData.data" :columns="columns" :ui="{ base: 'md:table-auto table-fixed w-full' }" />
      <div v-if="loadingMore" class="flex justify-center py-4"><u-icon name="material-symbols:progress-activity" class="size-5 animate-spin text-muted" /></div>
      <u-empty v-if="pageData.data.length === 0" description="暂无有效队伍" />
    </div>
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
  </div>
</template>
