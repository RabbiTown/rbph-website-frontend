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
const { t } = useI18n();
const judgeActions = useJudgeActionConsts();

const curPage = ref(props.initPage);
const pageData = ref<RbSubmissionPage>();

const Icon = resolveComponent('icon');
const RbTooltip = resolveComponent('rb-tooltip');
const UBadge = resolveComponent('u-badge');

const columns = ref<TableColumn<RbSubmission>[]>([
  {
    accessorKey: 'user_name',
    header: t('submissions.submitter'),
  },
  {
    accessorKey: 'user_answer',
    header: () => h('span', [t('submissions.content'), h(RbTooltip, { text: t('submissions.contentHelp') }, () => h(Icon, { name: 'material-symbols:help-outline-rounded', class: 'size-4 align-middle mb-0.5 ms-1 text-secondary cursor-help' }))]),
    cell: ({ row, getValue }) => {
      return h(RbTooltip, { text: row.original.norm_answer }, () => h('span', { variant: 'ghost', color: 'neutral', class: 'cursor-help' }, getValue<string>()));
    },
    meta: {
      class: {
        td: 'min-w-[15em] md:min-w-none max-w-[15em] wrap-anywhere whitespace-normal',
      },
    },
  },
  {
    accessorKey: 'saction',
    header: t('submissions.result'),
    cell: ({ getValue }) => {
      const action = judgeActions.value[getValue<RbJudgeAction>()];
      return h(UBadge, { color: action.color, variant: 'soft', icon: action.icon }, () => action.name);
    },
    meta: {
      class: {
        th: 'w-0',
      },
    },
  },
  {
    accessorKey: 'sresult',
    header: t('submissions.message'),
    cell: ({ row, getValue }) => getValue() || judgeActions.value[row.getValue<RbJudgeAction>('saction')].desc,
    meta: {
      class: {
        th: 'min-w-[15em]',
        td: 'max-w-[15em] wrap-anywhere whitespace-normal',
      },
    },
  },
  {
    accessorKey: 'ctime_at',
    header: t('submissions.time'),
    cell: ({ cell }) => formatDate(cell.getValue<string>()),
    meta: {
      class: {
        th: 'w-0 text-center',
      },
    },
  },
]);

const loading = ref(false);

async function updateData(newId: number | undefined = undefined) {
  loading.value = true;

  const puzzleId = newId || props.puzzleId;
  if (puzzleId) {
    try {
      const { data } = await api.get<RbSubmissionPage>(`/puzzles/${puzzleId}/submissions`, { query: { only_ok: props.onlyOk, page: curPage.value } });
      pageData.value = data;
    } catch (error) {
      handleError(error, t('submissions.fetchFailed'));
    }
  }

  loading.value = false;
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
      <u-table v-if="pageData.data.length > 0" :loading="loading" :data="pageData.data" :columns="columns" />
      <u-empty v-else :description="onlyOk ? t('submissions.noSuccessfulSubmissions') : t('submissions.noSubmissions')" />
    </div>
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
    <div class="flex justify-end mt-2 me-2">
      <u-pagination variant="soft" active-variant="subtle" :total="pageData?.total" @update:page="x => updatePage(x - 1)" />
    </div>
  </div>
</template>
