<script setup lang="ts">
import type { UnlockGateNode, UnlockPuzzleOptionData, UnlockRoundOptionData } from '~/utils/unlock-condition';

const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { puzzle, refresh } = useAdmin().usePuzzleContext();

const state = reactive({
  unlock: defaultUnlockGate('default') as UnlockGateNode,
});

const saving = ref(false);
const loadingOptions = ref(false);
const rounds = ref<UnlockRoundOptionData[]>([]);
const puzzles = ref<UnlockPuzzleOptionData[]>([]);

const unlockCondPatch = computed(() => serializeUnlockGate(state.unlock));
const originalUnlockCond = computed(() => puzzle.value?.unlock_cond ?? 'default');
const unlockCondDirty = computed(() => Boolean(puzzle.value && unlockCondPatch.value !== originalUnlockCond.value));
const dirty = computed(() => unlockCondDirty.value);
const previewText = computed(() => translateUnlockCondition(unlockCondPatch.value || ''));
const invalid = computed(() => !unlockCondPatch.value);

function syncFromPuzzle() {
  state.unlock = parseUnlockGate(originalUnlockCond.value);
}

function resetUnlockCond() {
  syncFromPuzzle();
}

function reset() {
  resetUnlockCond();
  dirtyToast.clear();
}

async function fetchOptions() {
  if (!puzzle.value?.game_id) return;
  loadingOptions.value = true;
  try {
    type RoundResponse = { rounds: UnlockRoundOptionData[] };
    type PuzzleResponse = { puzzles: UnlockPuzzleOptionData[] };
    const [roundResp, puzzleResp] = await Promise.all([api.get<RoundResponse>('/admin/rounds', { query: { game_id: puzzle.value.game_id } }), api.get<PuzzleResponse>('/admin/puzzles', { query: { game_id: puzzle.value.game_id } })]);
    rounds.value = roundResp.data.rounds;
    puzzles.value = puzzleResp.data.puzzles;
  } catch (error) {
    handleError(error, '获取谜题和区域列表失败');
  } finally {
    loadingOptions.value = false;
  }
}

async function apply() {
  if (!puzzle.value || !dirty.value || saving.value) return;
  if (invalid.value) {
    toast.add({
      title: '解锁条件不完整',
      description: '请补全积木块，或填写合法的源码表达式。',
      icon: 'material-symbols:error-med-outline-rounded',
      color: 'error',
    });
    return;
  }

  saving.value = true;
  try {
    type Response = { puzzle: AdminPuzzleData };
    const response = await api.patch<Response>(
      `/admin/puzzles/${puzzle.value.id}`,
      { unlock_cond: unlockCondPatch.value },
      {
        errorHints: {
          [-2]: '解锁条件表达式不合法。',
          [-1]: '谜题不存在。',
        },
      },
    );

    puzzle.value = response.data.puzzle;
    syncFromPuzzle();
    dirtyToast.clear();
    await refresh();

    toast.add({
      title: '解锁条件已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存解锁条件失败');
  } finally {
    saving.value = false;
  }
}

watch(
  () => puzzle.value?.id,
  () => {
    syncFromPuzzle();
    dirtyToast.clear();
    fetchOptions();
  },
  { immediate: true },
);

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '解锁条件修改尚未保存。',
      guardOnLeave: true,
      apply,
      reset,
    });
  } else {
    dirtyToast.clear();
  }
});
</script>

<template>
  <div v-if="puzzle" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />

    <u-form :state="state" class="flex min-w-0 flex-col gap-4" @submit.prevent="apply">
      <section class="relative space-y-4" :class="unlockCondDirty ? `before:content-[''] before:pointer-events-none before:absolute before:-start-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-warning` : ''">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">解锁条件</h2>
          <p class="mt-1 text-sm text-muted">玩家满足下述条件时，谜题将会自动解锁。</p>
        </div>

        <div class="space-y-4 rounded-lg bg-elevated/60 p-4 ring ring-default">
          <div class="space-y-2">
            <div class="flex min-h-8 items-center justify-between gap-3">
              <span class="text-sm font-medium text-highlighted">条件编辑器</span>
              <u-button v-if="unlockCondDirty" size="xs" variant="soft" color="warning" icon="material-symbols:restart-alt-rounded" label="重置" @click="resetUnlockCond" />
            </div>
            <rbph-unlock-condition-editor v-model="state.unlock" :puzzles="puzzles" :rounds="rounds" :disabled="saving" :loading="loadingOptions" />
          </div>

          <u-separator />

          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <u-badge variant="soft" icon="material-symbols:visibility-outline-rounded">预览</u-badge>
              <span class="text-highlighted">{{ previewText }}</span>
            </div>
            <code class="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted">{{ unlockCondPatch || '未生成表达式' }}</code>
          </div>
        </div>
      </section>
    </u-form>

    <aside class="hidden xl:block" />
  </div>
</template>
