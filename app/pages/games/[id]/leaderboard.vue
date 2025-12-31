<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

definePageMeta({
  layout: 'game',
});

useUser().required();

const game = useGame().ref;

useHead({
  titleTemplate:  computed(() => `排行榜 - ${game.value?.title}`),
});

const api = useApi();

const pageData = ref<LeaderBoardInfo>();

const Icon = resolveComponent('icon');
const UBadge = resolveComponent('u-badge');

const columns = ref<TableColumn<LeaderBoardTeamInfo>[]>([
  {
    header: '#',
    cell: ({ row }) => row.index + 1,
    meta: {
      class: {
        th: 'md:w-none w-0',
      },
    },
  },
  {
    accessorKey: 'tname',
    header: '队伍',
    cell: ({ row, getValue }) => [h('div', { class: 'text-lg text-highlighted font-bold' }, getValue<string>()), h('div', row.original.bio)],
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

async function updateData(newId: number | undefined) {
  const gameId = newId;
  if (gameId) {
    try {
      const { data } = await api.get<LeaderBoardInfo>(`/games/${gameId}/leaderboard`);
      pageData.value = data;
    } catch (error) {
      handleError(error, '获取排行榜信息失败');
    }
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

const showLength = ref(0);
const showData = computed(() => pageData.value?.data.slice(0, showLength.value));

onMounted(() => {
  useInfiniteScroll(
    window,
    () => {
      showLength.value += 50;
    },
    {
      distance: 50,
      canLoadMore: () => showLength.value < (pageData.value?.data.length || 0),
    }
  );
});
</script>

<template>
  <div>
    <div class="py-6">
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div class="text-3xl font-bold">排行榜</div>
        <div class="mt-2 text-secondary ms-0.5 text-xs">
          <icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
          更新于 {{ formatDate() }}
        </div>
      </div>
    </div>
    <div v-if="pageData">
      <u-table v-if="pageData.data.length > 0" :data="showData" :columns="columns" :ui="{ base: 'md:table-auto table-fixed w-full' }" />
      <u-empty v-else description="暂无有效队伍" />
    </div>
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
  </div>
</template>
