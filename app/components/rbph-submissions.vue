<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

const props = withDefaults(
  defineProps<{
    puzzleId?: number;
    initPage?: number;
    onlyOk?: boolean;
  }>(),
  {
    puzzleId: undefined,
    initPage: 0,
    onlyOk: false,
  }
);

const api = useApi();

const curPage = ref(props.initPage);
const pageData = ref<RbSubmissionPage>();

const Icon = resolveComponent('icon');
const RbTooltip = resolveComponent('rb-tooltip');
const UBadge = resolveComponent('u-badge');

const columns = ref<TableColumn<RbSubmission>[]>([
  {
    accessorKey: 'user_name',
    header: '提交者',
  },
  {
    accessorKey: 'user_answer',
    header: () => h('span', ['内容', h(RbTooltip, { text: '鼠标悬停可查看归一化结果' }, h(Icon, { name: 'material-symbols:help-outline-rounded', class: 'size-4 align-middle mb-0.5 ms-1 text-secondary cursor-help' }))]),
    cell: ({ row, getValue }) => {
      return h(RbTooltip, { text: row.original.norm_answer }, h('span', { variant: 'ghost', color: 'neutral', class: 'cursor-help' }, getValue<string>()));
    },
    meta: {
      class: {
        td: 'max-w-[15em] break-words whitespace-normal',
      },
    },
  },
  {
    accessorKey: 'saction',
    header: '结果',
    cell: ({ getValue }) => {
      const action = judgeActionConsts[getValue<RbJudgeAction>()];
      return h(UBadge, { color: action.color, variant: 'soft', icon: action.icon }, action.name);
    },
    meta: {
      class: {
        th: 'w-0',
      },
    },
  },
  {
    accessorKey: 'sresult',
    header: '信息',
    cell: ({ row, getValue }) => getValue() || judgeActionConsts[row.getValue<RbJudgeAction>('saction')].desc,
    meta: {
      class: {
        th: 'min-w-[15em]',
        td: 'max-w-[15em] break-words whitespace-normal',
      },
    },
  },
  {
    accessorKey: 'ctime_at',
    header: '时间',
    cell: ({ cell }) => formatDate(cell.getValue<string>()),
    meta: {
      class: {
        th: 'w-0 text-center',
      },
    },
  },
]);

async function updateData(newId: number | undefined = undefined) {
  const puzzleId = newId || props.puzzleId;
  if (puzzleId) {
    try {
      const { data } = await api.get<RbSubmissionPage>(`/puzzles/${puzzleId}/submissions`, { query: { only_ok: props.onlyOk, page: curPage.value } });
      pageData.value = data;
    } catch (error) {
      handleError(error, '获取提交记录失败');
    }
  }
}

async function updatePage(newPage: number) {
  curPage.value = newPage;
  updateData();
}

watch(
  () => props.puzzleId,
  async new_id => {
    pageData.value = undefined;
    updateData(new_id);
  },
  { immediate: true }
);

defineExpose({
  updateData,
  submissions: pageData,
});
</script>

<template>
  <div>
    <div v-if="pageData">
      <u-table v-if="pageData.data.length > 0" :data="pageData.data" :columns="columns" />
      <u-empty v-else :description="onlyOk ? '暂无成功提交' : '暂无提交'" />
    </div>
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
    <div class="flex justify-end mt-2 me-2">
      <u-pagination variant="soft" active-variant="subtle" :total="pageData?.total" @update:page="x => updatePage(x - 1)" />
    </div>
  </div>
</template>
