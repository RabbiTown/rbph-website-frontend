<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const route = useRoute();
const api = useApi();
const toast = useToast();

const game = useAdmin().useGame().ref;
const round = ref<AdminRoundData>();
const loading = ref(false);
const headerSaving = ref(false);
const creatingRoundPuzzle = ref(false);
const createRoundPuzzleOpen = ref(false);
const contentEditor = ref<{ focus: () => void }>();
const titleInput = ref<HTMLInputElement>();

const headerState = reactive({
  slug: '',
  title: '',
});

const gameId = computed(() => Number(route.params.id));
const roundId = computed(() => Number(route.params.round));
const roundPuzzleId = computed(() => round.value?.puzzle ?? null);
const contentPagePath = computed(() => (Number.isFinite(gameId.value) && Number.isFinite(roundId.value) ? `/admin/games/${gameId.value}/rounds/${roundId.value}` : undefined));
const isContentPage = computed(() => Boolean(contentPagePath.value && route.path.replace(/\/$/, '') === contentPagePath.value));
const normalizedRoundSlug = computed(() => round.value?.slug ?? '');
const slugDirty = computed(() => Boolean(round.value && headerState.slug.trim() !== normalizedRoundSlug.value));
const titleDirty = computed(() => Boolean(round.value && headerState.title !== round.value.title));
const headerDirty = computed(() => slugDirty.value || titleDirty.value);
const slugInputWidth = computed(() => `${Math.max(4, headerState.slug.length || 4)}ch`);
const roundPuzzleRoute = computed(() => (roundPuzzleId.value ? `/admin/games/${gameId.value}/puzzles/${roundPuzzleId.value}/judge` : undefined));

function syncHeaderFromRound() {
  headerState.slug = round.value?.slug ?? '';
  headerState.title = round.value?.title ?? '';
}

function resetHeader() {
  syncHeaderFromRound();
}

function focusContentEditor() {
  contentEditor.value?.focus();
}

function focusTitle() {
  titleInput.value?.focus();
  titleInput.value?.setSelectionRange(headerState.title.length, headerState.title.length);
}

function openRoundPuzzle() {
  if (roundPuzzleId.value) {
    navigateTo(`/admin/games/${gameId.value}/puzzles/${roundPuzzleId.value}/judge`);
    return;
  }

  createRoundPuzzleOpen.value = true;
}

async function createRoundPuzzle() {
  if (!round.value || roundPuzzleId.value || creatingRoundPuzzle.value) return;

  creatingRoundPuzzle.value = true;
  try {
    type PuzzleResponse = { puzzle: AdminPuzzleData };
    const nextSort = 0;
    const body = {
      round_id: round.value.id,
      title: round.value.title,
      content: '',
      content_type: RbContentType.Markdown,
      ptype: RbPuzzleType.Normal,
      judge: [],
      penalty: [],
      max_submit: null,
      unlock_cond: 'default',
      release_at: null,
      ticket_enabled: true,
      ticket_cooldown: 0,
      sort: nextSort,
      slug: null,
    };

    const { data } = await api.post<PuzzleResponse>('/admin/puzzles', body, {
      errorHints: {
        [-2]: '谜题信息不合法。',
        [-1]: '谜题不存在。',
      },
    });

    type RoundResponse = { round: AdminRoundData };
    const roundResp = await api.patch<RoundResponse>(
      `/admin/rounds/${round.value.id}`,
      { puzzle: data.puzzle.id },
      {
        errorHints: {
          [-2]: '区域信息不合法。',
          [-1]: '区域不存在。',
        },
      },
    );

    round.value = roundResp.data.round;
    syncHeaderFromRound();
    createRoundPuzzleOpen.value = false;
    toast.add({
      title: '区域谜题已创建',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    await navigateTo(`/admin/games/${gameId.value}/puzzles/${data.puzzle.id}/judge`, { replace: true });
  } catch (error) {
    handleError(error, '创建区域谜题失败');
  } finally {
    creatingRoundPuzzle.value = false;
  }
}

async function applyHeader() {
  if (!round.value || !headerDirty.value) return true;
  if (headerSaving.value) return false;

  const body: {
    slug?: string | null;
    title?: string;
  } = {};

  if (slugDirty.value) body.slug = headerState.slug.trim() || null;
  if (titleDirty.value) body.title = headerState.title;

  headerSaving.value = true;

  try {
    type Response = { round: AdminRoundData };
    const response = await api.patch<Response>(`/admin/rounds/${round.value.id}`, body, {
      errorHints: {
        [-2]: '区域标题或 slug 不合法。',
        [-3]: '区域 slug 不合法或已被使用。',
        [-1]: '区域不存在。',
      },
    });

    round.value = response.data.round;
    syncHeaderFromRound();
    await fetchData();

    toast.add({
      title: '区域信息已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    return true;
  } catch (error) {
    handleError(error, '保存区域信息失败');
    return false;
  } finally {
    headerSaving.value = false;
  }
}

async function fetchData() {
  if (!Number.isFinite(gameId.value) || !Number.isFinite(roundId.value)) return;

  loading.value = true;

  try {
    type RoundResponse = { round: AdminRoundData };
    const roundResp = await api.get<RoundResponse>(`/admin/rounds/${roundId.value}`, {
      errorHints: {
        [-1]: '区域不存在。',
      },
    });

    if (roundResp.data.round.game_id !== gameId.value) {
      showError({ statusCode: 404, statusMessage: '区域不存在' });
      return;
    }

    round.value = roundResp.data.round;
    syncHeaderFromRound();
  } catch (error) {
    round.value = undefined;
    syncHeaderFromRound();
    handleError(error, '获取区域信息失败', true);
  } finally {
    loading.value = false;
  }
}

useAdmin().provideRoundContext({
  round,
  contentEditor,
  focusTitle,
  headerDirty,
  applyHeader,
  resetHeader,
  refresh: fetchData,
});

watch(
  [gameId, roundId],
  () => {
    fetchData();
  },
  { immediate: true },
);

watch(
  () => round.value?.id,
  () => {
    syncHeaderFromRound();
  },
  { immediate: true },
);

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: round.value?.title }, { text: game.value?.title, sep: ' - ' }, { text: 'RBPH 管理后台', sep: ' - ' }])),
});

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: '区域内容',
    icon: 'material-symbols:article-outline-rounded',
    to: Number.isFinite(gameId.value) && Number.isFinite(roundId.value) ? `/admin/games/${gameId.value}/rounds/${roundId.value}` : undefined,
    exact: true,
  },
  {
    label: '区域谜题',
    icon: 'material-symbols:grid-view-outline-rounded',
    to: roundPuzzleRoute.value,
    onSelect: event => {
      if (roundPuzzleId.value) return;
      event.preventDefault();
      openRoundPuzzle();
    },
  },
]);
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <template v-if="round">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
        <aside class="hidden xl:block" />

        <div class="flex min-w-0 flex-col gap-2">
          <u-form :state="headerState" class="space-y-2" @submit.prevent="applyHeader">
            <div class="flex flex-wrap items-center gap-2">
              <label v-if="isContentPage" class="flex min-w-0 flex-1 items-center gap-3 py-1.5">
                <span class="shrink-0 text-3xl/10 font-bold text-muted">#</span>
                <input
                  ref="titleInput"
                  v-model="headerState.title"
                  class="min-w-0 flex-1 bg-transparent text-3xl/10 font-bold text-highlighted outline-none placeholder:text-dimmed"
                  placeholder="区域标题"
                  aria-label="区域标题"
                  :disabled="headerSaving"
                  @keydown.enter.prevent="focusContentEditor"
                  @keydown.down.prevent="focusContentEditor"
                />
              </label>
              <div v-else class="flex min-w-0 flex-1 items-center gap-3 py-1.5">
                <span class="shrink-0 text-3xl/10 font-bold text-muted">#</span>
                <h1 class="min-w-0 flex-1 truncate text-3xl/10 font-bold text-highlighted">
                  {{ round.title }}
                </h1>
              </div>

              <div class="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                <u-badge v-if="round.puzzle" variant="soft" color="primary" icon="material-symbols:extension-outline-rounded">区域谜题</u-badge>
                <label
                  v-if="isContentPage || round.slug"
                  class="inline-flex w-max max-w-full items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted transition"
                  :class="isContentPage ? 'bg-elevated ring ring-default focus-within:text-highlighted focus-within:ring-primary' : 'bg-muted/40'"
                >
                  <span class="shrink-0 font-semibold">#</span>
                  <input
                    v-if="isContentPage"
                    v-model="headerState.slug"
                    class="min-w-[4ch] max-w-[min(36ch,calc(100vw-8rem))] bg-transparent outline-none placeholder:text-dimmed"
                    :style="{ width: slugInputWidth }"
                    placeholder="slug"
                    aria-label="区域 slug"
                    :disabled="headerSaving"
                  />
                  <span v-else>{{ round.slug }}</span>
                </label>
                <u-badge variant="soft" color="neutral">#{{ round.id }}</u-badge>
              </div>
            </div>
          </u-form>

          <u-navigation-menu :items="navItems" class="-mx-1" />
        </div>

        <aside class="hidden xl:block" />
      </div>

      <nuxt-page />
      <rb-confirm-modal
        v-model:open="createRoundPuzzleOpen"
        title="创建区域谜题"
        description="当前区域还没有区域谜题，是否现在创建？"
        confirm-label="创建"
        confirm-icon="material-symbols:add-circle-outline-rounded"
        :busy="creatingRoundPuzzle"
        @confirm="createRoundPuzzle"
      />
    </template>

    <div v-else-if="loading" class="space-y-4">
      <u-skeleton class="h-6 w-72" />
      <u-skeleton class="h-10 w-96 max-w-full" />
      <u-skeleton class="h-52 w-full" />
    </div>

    <u-empty v-else icon="material-symbols:grid-view-outline-rounded" title="区域不存在" />
  </div>
</template>
