<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const route = useRoute();
const api = useApi();

const game = useAdmin().useGame().ref;
const puzzle = ref<AdminPuzzleData>();
const round = ref<AdminRoundData>();
const loading = ref(false);

const gameId = computed(() => Number(route.params.id));
const puzzleId = computed(() => Number(route.params.puzzle));

async function fetchData() {
  if (!Number.isFinite(gameId.value) || !Number.isFinite(puzzleId.value)) return;

  loading.value = true;

  try {
    type PuzzleResponse = { puzzle: AdminPuzzleData };
    type RoundResponse = { round: AdminRoundData };

    const puzzleResp = await api.get<PuzzleResponse>(`/admin/puzzles/${puzzleId.value}`, {
      errorHints: {
        [-1]: '谜题不存在。',
      },
    });

    if (puzzleResp.data.puzzle.game_id !== gameId.value) {
      showError({ statusCode: 404, statusMessage: '谜题不存在' });
      return;
    }

    const roundResp = await api.get<RoundResponse>(`/admin/rounds/${puzzleResp.data.puzzle.round_id}`, {
      errorHints: {
        [-1]: '区域不存在。',
      },
    });

    puzzle.value = puzzleResp.data.puzzle;
    round.value = roundResp.data.round;
  } catch (error) {
    puzzle.value = undefined;
    round.value = undefined;
    handleError(error, '获取谜题信息失败', true);
  } finally {
    loading.value = false;
  }
}

useAdmin().providePuzzleContext({
  puzzle,
  round,
  refresh: fetchData,
});

watch(
  [gameId, puzzleId],
  () => {
    fetchData();
  },
  { immediate: true },
);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: puzzle.value?.title }, { text: game.value?.title, sep: ' - ' }, { text: 'RBPH 管理后台', sep: ' - ' }])),
});

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: '谜题内容',
    icon: 'material-symbols:article-outline-rounded',
    to: Number.isFinite(gameId.value) && Number.isFinite(puzzleId.value) ? `/admin/games/${gameId.value}/puzzles/${puzzleId.value}` : undefined,
    exact: true,
  },
  {
    label: '答案判定',
    icon: 'material-symbols:rule-settings-rounded',
    to: Number.isFinite(gameId.value) && Number.isFinite(puzzleId.value) ? `/admin/games/${gameId.value}/puzzles/${puzzleId.value}/judge` : undefined,
  },
]);
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <template v-if="puzzle">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
        <aside class="hidden xl:block" />

        <div class="flex min-w-0 flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-3xl font-bold">
              {{ puzzle.title }}
            </h1>
            <u-badge v-if="round?.puzzle === puzzle.id" variant="soft" color="primary" icon="material-symbols:grid-view-outline-rounded">区域谜题</u-badge>
            <u-badge v-if="puzzle.slug" variant="soft" color="primary" icon="material-symbols:tag-rounded">{{ puzzle.slug }}</u-badge>
            <u-badge variant="soft" color="neutral">#{{ puzzle.id }}</u-badge>
          </div>

          <u-navigation-menu :items="navItems" class="-mx-1" />
        </div>

        <aside class="hidden xl:block" />
      </div>

      <nuxt-page />
    </template>

    <div v-else-if="loading" class="space-y-4">
      <u-skeleton class="h-6 w-72" />
      <u-skeleton class="h-10 w-96 max-w-full" />
      <u-skeleton class="h-52 w-full" />
    </div>

    <u-empty v-else icon="material-symbols:extension-off-outline-rounded" title="谜题不存在" />
  </div>
</template>
