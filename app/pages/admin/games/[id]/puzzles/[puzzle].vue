<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const route = useRoute();
const api = useApi();
const toast = useToast();

const game = useAdmin().useGame().ref;
const puzzle = ref<AdminPuzzleData>();
const backend = ref<AdminPuzzleBackendData>();
const round = ref<AdminRoundData>();
const loading = ref(false);
const headerSaving = ref(false);
const contentEditor = ref<{ focus: () => void }>();
const titleInput = ref<HTMLInputElement>();

const headerState = reactive({
  slug: '',
  title: '',
});

const gameId = computed(() => Number(route.params.id));
const puzzleId = computed(() => Number(route.params.puzzle));
const contentPagePath = computed(() => (Number.isFinite(gameId.value) && Number.isFinite(puzzleId.value) ? `/admin/games/${gameId.value}/puzzles/${puzzleId.value}` : undefined));
const isContentPage = computed(() => Boolean(contentPagePath.value && route.path.replace(/\/$/, '') === contentPagePath.value));
const isRoundPuzzle = computed(() => round.value?.puzzle === puzzle.value?.id);
const displayTitle = computed(() => (isRoundPuzzle.value ? (round.value?.title ?? puzzle.value?.title ?? '') : (puzzle.value?.title ?? '')));
const displaySlug = computed(() => (isRoundPuzzle.value ? (round.value?.slug ?? '') : (puzzle.value?.slug ?? '')));
const normalizedPuzzleSlug = computed(() => displaySlug.value);
const normalizedPuzzleTitle = computed(() => displayTitle.value);
const slugDirty = computed(() => Boolean(puzzle.value && !isRoundPuzzle.value && headerState.slug.trim() !== normalizedPuzzleSlug.value));
const titleDirty = computed(() => Boolean(puzzle.value && !isRoundPuzzle.value && headerState.title !== normalizedPuzzleTitle.value));
const headerDirty = computed(() => slugDirty.value || titleDirty.value);
const slugInputWidth = computed(() => `${Math.max(4, headerState.slug.length || 4)}ch`);

function syncHeaderFromPuzzle() {
  headerState.slug = displaySlug.value;
  headerState.title = displayTitle.value;
}

function resetHeader() {
  syncHeaderFromPuzzle();
}

function focusContentEditor() {
  contentEditor.value?.focus();
}

function focusTitle() {
  titleInput.value?.focus();
  titleInput.value?.setSelectionRange(headerState.title.length, headerState.title.length);
}

async function applyHeader() {
  if (!puzzle.value || !headerDirty.value || isRoundPuzzle.value) return true;
  if (headerSaving.value) return false;

  const body: {
    slug?: string | null;
    title?: string;
  } = {};

  if (slugDirty.value) body.slug = headerState.slug.trim() || null;
  if (titleDirty.value) body.title = headerState.title;

  headerSaving.value = true;

  try {
    type Response = { puzzle: AdminPuzzleData };
    const response = await api.patch<Response>(`/admin/puzzles/${puzzle.value.id}`, body, {
      errorHints: {
        [-2]: '谜题标题或 slug 不合法。',
        [-3]: '谜题 slug 不合法或已被使用。',
        [-1]: '谜题不存在。',
      },
    });

    puzzle.value = response.data.puzzle;
    syncHeaderFromPuzzle();
    await fetchData();

    toast.add({
      title: '谜题信息已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    return true;
  } catch (error) {
    handleError(error, '保存谜题信息失败');
    return false;
  } finally {
    headerSaving.value = false;
  }
}

async function fetchData() {
  if (!Number.isFinite(gameId.value) || !Number.isFinite(puzzleId.value)) return;

  loading.value = true;

  try {
    type PuzzleResponse = { puzzle: AdminPuzzleData };
    type RoundResponse = { round: AdminRoundData };
    type BackendResponse = { backend: AdminPuzzleBackendData | null };

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
    const backendResp = await api.get<BackendResponse>(`/admin/puzzles/${puzzleId.value}/backend`, {
      errorHints: {
        [-1]: '后端脚本不存在。',
      },
    });

    puzzle.value = puzzleResp.data.puzzle;
    round.value = roundResp.data.round;
    backend.value = backendResp.data.backend ?? undefined;
    syncHeaderFromPuzzle();

    if (isContentPage.value && isRoundPuzzle.value && round.value) {
      await navigateTo(`/admin/games/${gameId.value}/rounds/${round.value.id}`, { replace: true });
      return;
    }
  } catch (error) {
    puzzle.value = undefined;
    backend.value = undefined;
    round.value = undefined;
    syncHeaderFromPuzzle();
    handleError(error, '获取谜题信息失败', true);
  } finally {
    loading.value = false;
  }
}

useAdmin().providePuzzleContext({
  puzzle,
  backend,
  round,
  contentEditor,
  focusTitle,
  headerDirty,
  applyHeader,
  resetHeader,
  refresh: fetchData,
});

watch(
  [gameId, puzzleId],
  () => {
    fetchData();
  },
  { immediate: true },
);

watch(
  () => puzzle.value?.id,
  () => {
    syncHeaderFromPuzzle();
  },
  { immediate: true },
);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: displayTitle.value }, { text: game.value?.title, sep: ' - ' }, { text: 'RBPH 管理后台', sep: ' - ' }])),
});

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: isRoundPuzzle.value ? '区域内容' : '谜题内容',
    icon: 'material-symbols:article-outline-rounded',
    to: isRoundPuzzle.value && round.value ? `/admin/games/${gameId.value}/rounds/${round.value.id}` : Number.isFinite(gameId.value) && Number.isFinite(puzzleId.value) ? `/admin/games/${gameId.value}/puzzles/${puzzleId.value}` : undefined,
    exact: true,
  },
  {
    label: '答案提交',
    icon: 'material-symbols:rule-settings-rounded',
    to: Number.isFinite(gameId.value) && Number.isFinite(puzzleId.value) ? `/admin/games/${gameId.value}/puzzles/${puzzleId.value}/judge` : undefined,
  },
  {
    label: '提示编辑',
    icon: 'material-symbols:lightbulb-outline-rounded',
    to: Number.isFinite(gameId.value) && Number.isFinite(puzzleId.value) ? `/admin/games/${gameId.value}/puzzles/${puzzleId.value}/hints` : undefined,
  },
  {
    label: '额外设置',
    icon: 'material-symbols:tune-rounded',
    to: Number.isFinite(gameId.value) && Number.isFinite(puzzleId.value) ? `/admin/games/${gameId.value}/puzzles/${puzzleId.value}/settings` : undefined,
  },
]);

const isEditablePuzzleHeader = computed(() => isContentPage.value && !isRoundPuzzle.value);
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <template v-if="puzzle">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
        <aside class="hidden xl:block" />

        <div class="flex min-w-0 flex-col gap-2">
          <u-form :state="headerState" class="space-y-2" @submit.prevent="applyHeader">
            <div class="flex flex-wrap items-center gap-2">
              <label v-if="isEditablePuzzleHeader" class="flex min-w-0 flex-1 items-center gap-3 py-1.5">
                <span class="shrink-0 text-3xl/10 font-bold text-muted">#</span>
                <input
                  ref="titleInput"
                  v-model="headerState.title"
                  class="min-w-0 flex-1 bg-transparent text-3xl/10 font-bold text-highlighted outline-none placeholder:text-dimmed"
                  placeholder="谜题标题"
                  aria-label="谜题标题"
                  :disabled="headerSaving"
                  @keydown.enter.prevent="focusContentEditor"
                  @keydown.down.prevent="focusContentEditor"
                >
              </label>
              <div v-else class="flex min-w-0 flex-1 items-center gap-3 py-1.5">
                <span class="shrink-0 text-3xl/10 font-bold text-muted">#</span>
                <h1 class="min-w-0 flex-1 truncate text-3xl/10 font-bold text-highlighted">
                  {{ displayTitle }}
                </h1>
              </div>

              <div class="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                <u-badge v-if="isRoundPuzzle" variant="soft" color="primary" icon="material-symbols:grid-view-outline-rounded">区域谜题</u-badge>
                <label
                  v-if="isContentPage || displaySlug"
                  class="inline-flex w-max max-w-full items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted transition"
                  :class="isContentPage ? 'bg-elevated ring ring-default focus-within:text-highlighted focus-within:ring-primary' : 'bg-muted/40'"
                >
                  <span class="shrink-0 font-semibold">#</span>
                  <input
                    v-if="isContentPage && !isRoundPuzzle"
                    v-model="headerState.slug"
                    class="min-w-[4ch] max-w-[min(36ch,calc(100vw-8rem))] bg-transparent outline-none placeholder:text-dimmed"
                    :style="{ width: slugInputWidth }"
                    placeholder="slug"
                    aria-label="谜题 slug"
                    :disabled="headerSaving"
                  >
                  <input
                    v-else-if="isContentPage && isRoundPuzzle"
                    :value="displaySlug"
                    class="min-w-[4ch] max-w-[min(36ch,calc(100vw-8rem))] bg-transparent outline-none placeholder:text-dimmed"
                    :style="{ width: slugInputWidth }"
                    placeholder="slug"
                    aria-label="区域 slug"
                    disabled
                  >
                  <span v-else>{{ displaySlug }}</span>
                </label>
                <u-badge variant="soft" color="neutral">#{{ puzzle.id }}</u-badge>
              </div>
            </div>
          </u-form>

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
