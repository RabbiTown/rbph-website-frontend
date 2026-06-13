<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';
import { parseBackendExportFunctions } from '~/utils/content-backend';
import type { UnlockGateNode, UnlockPuzzleOptionData, UnlockRoundOptionData } from '~/utils/unlock-condition';

const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { puzzle, backend, round } = useAdmin().usePuzzleContext();

const state = reactive({
  unlock: defaultUnlockGate('default') as UnlockGateNode,
  backend: {
    enabled: false,
    source: '',
    functions: [] as string[],
  },
});

const saving = ref(false);
const backendLoaded = ref(false);
const deleting = ref(false);
const checkingUnlock = ref(false);
const clearingStates = ref(false);
const deleteConfirmOpen = ref(false);
const unlockCheckConfirmOpen = ref(false);
const clearStatesConfirmOpen = ref(false);
const loadingOptions = ref(false);
const rounds = ref<UnlockRoundOptionData[]>([]);
const puzzles = ref<UnlockPuzzleOptionData[]>([]);
const scriptEditorHeight = '32rem';
const scriptEditor = ref<{ focus: () => void }>();
const isRoundPuzzle = computed(() => round.value?.puzzle === puzzle.value?.id);
const functionItems = computed<SelectItem[]>(() =>
  parseBackendExportFunctions(state.backend.source).map(name => ({
    label: name,
    value: name,
    icon: 'material-symbols:function-rounded',
  })),
);
const unlockCheckConfirmDescription = computed(() => {
  if (!puzzle.value) return '';
  return `确认对所有未解锁队伍重新判定谜题「${puzzle.value.title}」的解锁条件？符合条件的队伍将会解锁该谜题。`;
});
const clearStatesConfirmDescription = computed(() => {
  if (!puzzle.value) return '';
  return `确认重置所有队伍对谜题「${puzzle.value.title}」的状态？这会重置解锁状态、提交记录、提示状态和该题人工提示记录，此操作不可恢复。`;
});
const deleteConfirmDescription = computed(() => {
  if (!puzzle.value) return '';
  if (isRoundPuzzle.value && round.value) {
    return `确认删除区域谜题「${round.value.title}」？这将不会删除区域本身，此操作不可恢复。`;
  }
  return `确认删除谜题「${puzzle.value.title}」？此操作不可恢复。`;
});

const unlockCondPatch = computed(() => serializeUnlockGate(state.unlock));
const originalUnlockCond = computed(() => puzzle.value?.unlock_cond ?? 'default');
const unlockCondDirty = computed(() => Boolean(puzzle.value && unlockCondPatch.value !== originalUnlockCond.value));
const backendEnabled = computed(() => state.backend.enabled);
const backendEnabledDirty = computed(() => Boolean(puzzle.value && backendLoaded.value && backendEnabled.value !== (backend.value?.enabled ?? false)));
const backendSourceDirty = computed(() => Boolean(puzzle.value && backendLoaded.value && state.backend.source !== (backend.value?.source ?? '')));
const backendFunctionsDirty = computed(() => Boolean(puzzle.value && backendLoaded.value && JSON.stringify([...state.backend.functions].sort()) !== JSON.stringify([...(backend.value?.functions ?? [])].sort())));
const backendDirty = computed(() => backendEnabledDirty.value || backendSourceDirty.value || backendFunctionsDirty.value);
const dirty = computed(() => unlockCondDirty.value || backendDirty.value);
const previewText = computed(() => translateUnlockCondition(unlockCondPatch.value || ''));
const invalid = computed(() => !unlockCondPatch.value);

function syncFromPuzzle() {
  state.unlock = parseUnlockGate(originalUnlockCond.value);
}

function syncFromBackend() {
  state.backend.enabled = backend.value?.enabled ?? false;
  state.backend.source = backend.value?.source ?? '';
  state.backend.functions = [...(backend.value?.functions ?? [])];
}

function resetUnlockCond() {
  syncFromPuzzle();
}

function resetBackendEnabled() {
  state.backend.enabled = backend.value?.enabled ?? false;
}

function resetBackendSource() {
  state.backend.source = backend.value?.source ?? '';
}

function resetBackendFunctions() {
  state.backend.functions = [...(backend.value?.functions ?? [])];
}

function reset() {
  resetUnlockCond();
  syncFromBackend();
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

async function applyUnlockCond() {
  if (!puzzle.value || !unlockCondDirty.value) return true;
  if (invalid.value) {
    toast.add({
      title: '解锁条件不完整',
      description: '请补全积木块，或填写合法的源码表达式。',
      icon: 'material-symbols:error-med-outline-rounded',
      color: 'error',
    });
    return false;
  }

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

    toast.add({
      title: '解锁条件已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    return true;
  } catch (error) {
    handleError(error, '保存解锁条件失败');
    return false;
  }
}

async function applyBackend() {
  if (!puzzle.value || !backendDirty.value) return true;

  try {
    type Response = { backend: AdminPuzzleBackendData | null };
    const { data } = await api.put<Response>(
      `/admin/puzzles/${puzzle.value.id}/backend`,
      {
        enabled: state.backend.enabled,
        source: state.backend.source,
        functions: state.backend.functions,
      },
      {
        errorHints: {
          [-2]: '后端脚本不合法。',
          [-1]: '谜题不存在。',
        },
      },
    );

    backend.value = data.backend ?? undefined;
    backendLoaded.value = true;
    syncFromBackend();

    toast.add({
      title: '后端脚本已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    return true;
  } catch (error) {
    handleError(error, '保存后端脚本失败');
    return false;
  }
}

async function apply() {
  if (!puzzle.value || !dirty.value || saving.value) return;

  saving.value = true;
  try {
    const unlockSaved = await applyUnlockCond();
    if (!unlockSaved) return;
    await applyBackend();
  } finally {
    saving.value = false;
  }
}

async function saveBackendSection() {
  if (!puzzle.value || !backendLoaded.value || !backendDirty.value || saving.value) return;

  saving.value = true;
  try {
    await applyBackend();
    await nextTick();
    scriptEditor.value?.focus();
  } finally {
    saving.value = false;
  }
}

async function deletePuzzle() {
  if (!puzzle.value || deleting.value) return;

  deleting.value = true;
  try {
    await api.del(`/admin/puzzles/${puzzle.value.id}`, {
      errorHints: {
        [-1]: '谜题不存在。',
      },
    });

    toast.add({
      title: '谜题已删除',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    await navigateTo(`/admin/games/${puzzle.value.game_id}/puzzles`);
  } catch (error) {
    handleError(error, '删除谜题失败');
  } finally {
    deleting.value = false;
    deleteConfirmOpen.value = false;
  }
}

async function runUnlockCheck() {
  if (!puzzle.value || checkingUnlock.value || unlockCondDirty.value) return;

  checkingUnlock.value = true;
  try {
    type Response = { unlocked: number };
    const { data } = await api.post<Response>(
      `/admin/puzzles/${puzzle.value.id}/unlock-check`,
      {},
      {
        errorHints: {
          [-1]: '谜题不存在。',
        },
      },
    );

    toast.add({
      title: '解锁判定已执行',
      description: `本次解锁 ${data.unlocked} 个队伍。`,
      icon: 'material-symbols:lock-open-right-outline-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '执行解锁判定失败');
  } finally {
    checkingUnlock.value = false;
    unlockCheckConfirmOpen.value = false;
  }
}

async function clearPuzzleStates() {
  if (!puzzle.value || clearingStates.value) return;

  clearingStates.value = true;
  try {
    type Response = {
      result: {
        team_count: number;
        submissions: number;
        hints: number;
        tickets: number;
      };
    };
    const { data } = await api.post<Response>(
      `/admin/puzzles/${puzzle.value.id}/clear-states`,
      {},
      {
        errorHints: {
          [-1]: '谜题不存在。',
        },
      },
    );

    toast.add({
      title: '队伍状态已重置',
      description: `影响 ${data.result.team_count} 个队伍，删除 ${data.result.submissions} 条提交、${data.result.hints} 条提示状态、${data.result.tickets} 个人工提示。`,
      icon: 'material-symbols:restart-alt-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '重置队伍状态失败');
  } finally {
    clearingStates.value = false;
    clearStatesConfirmOpen.value = false;
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

watch(
  () => backend.value,
  () => {
    backendLoaded.value = true;
    syncFromBackend();
  },
  { immediate: true },
);

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '额外设置修改尚未保存。',
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
        <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
          <rbph-unlock-condition-editor v-model="state.unlock" :puzzles="puzzles" :rounds="rounds" :disabled="saving" :loading="loadingOptions" />

          <u-separator />

          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <u-button v-if="unlockCondDirty" size="xs" variant="soft" color="warning" icon="material-symbols:restart-alt-rounded" label="重置" @click="resetUnlockCond" />
              <u-badge v-else variant="soft" icon="material-symbols:visibility-outline-rounded">预览</u-badge>
              <span class="text-highlighted">{{ previewText }}</span>
            </div>
            <code class="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted">{{ unlockCondPatch || '未生成表达式' }}</code>
          </div>
        </div>
      </section>

      <u-separator class="my-2" />

      <section class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">后端脚本</h2>
            <p class="mt-1 text-sm text-muted">自定义题目后端，可以用于特殊题目逻辑和答案判定。</p>
          </div>
          <u-badge variant="soft" color="neutral">JavaScript</u-badge>
        </div>

        <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
          <rb-form-field name="backend_enabled" row label="启用状态" :dirty="backendEnabledDirty" :reset="resetBackendEnabled">
            <u-switch v-model="state.backend.enabled" class="mt-1.5" label="启用后端" :disabled="saving" />
          </rb-form-field>
          <u-separator v-if="state.backend.enabled" />
          <rb-form-field v-if="state.backend.enabled" name="backend_functions" row label="导出函数" :dirty="backendFunctionsDirty" :reset="resetBackendFunctions">
            <div class="w-full min-w-0">
              <u-select-menu
                v-model="state.backend.functions"
                :items="functionItems"
                value-key="value"
                multiple
                search-input
                placeholder="选择可对外调用的导出函数"
                class="w-full sm:min-w-48"
                :disabled="saving"
              />
            </div>
          </rb-form-field>
          <u-separator v-if="state.backend.enabled" />
          <rb-form-field v-if="state.backend.enabled" name="backend_source" label="脚本源码" class="space-y-3" :dirty="backendSourceDirty" :reset="resetBackendSource">
            <rb-code-editor ref="scriptEditor" v-model="state.backend.source" language="javascript" :indent="2" aria-label="后端脚本源码" :disabled="saving" :min-height="scriptEditorHeight" :max-height="scriptEditorHeight" :on-save="saveBackendSection" />
          </rb-form-field>
        </div>
      </section>

      <u-separator class="my-2" />

      <section class="space-y-4">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">危险区域</h2>
          <p class="mt-1 text-sm text-muted">这里的选项将会对谜题造成不可逆的后果。</p>
        </div>

        <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
          <rb-form-field row label="执行解锁判定">
            <u-button
              color="warning"
              variant="soft"
              icon="material-symbols:lock-open-right-outline-rounded"
              label="执行解锁判定"
              :disabled="saving || deleting || checkingUnlock || clearingStates || unlockCondDirty"
              :loading="checkingUnlock"
              @click="unlockCheckConfirmOpen = true"
            />
            <div class="text-muted mt-1.5">重新判定所有未解锁队伍的解锁条件，为符合条件的队伍解锁该谜题。</div>
          </rb-form-field>

          <u-separator />

          <rb-form-field row label="重置队伍状态">
            <u-button color="error" variant="soft" icon="material-symbols:restart-alt-rounded" label="重置队伍状态" :disabled="saving || deleting || checkingUnlock || clearingStates" :loading="clearingStates" @click="clearStatesConfirmOpen = true" />
            <div class="text-muted mt-1.5">清除所有队伍在此题上的解锁、提交、提示和人工提示记录。</div>
          </rb-form-field>

          <u-separator />

          <rb-form-field row label="删除谜题">
            <u-button color="error" variant="soft" icon="material-symbols:delete-outline-rounded" label="删除谜题" :disabled="saving || deleting || checkingUnlock || clearingStates" @click="deleteConfirmOpen = true" />
          </rb-form-field>
        </div>

        <rb-confirm-modal
          v-model:open="unlockCheckConfirmOpen"
          title="执行解锁判定"
          :description="unlockCheckConfirmDescription"
          confirm-label="执行判定"
          confirm-color="warning"
          confirm-icon="material-symbols:lock-open-right-outline-rounded"
          :busy="checkingUnlock"
          @confirm="runUnlockCheck"
        />

        <rb-confirm-modal
          v-model:open="clearStatesConfirmOpen"
          title="重置队伍状态"
          :description="clearStatesConfirmDescription"
          confirm-label="重置状态"
          confirm-color="error"
          confirm-icon="material-symbols:restart-alt-rounded"
          :busy="clearingStates"
          @confirm="clearPuzzleStates"
        />

        <rb-confirm-modal
          v-model:open="deleteConfirmOpen"
          title="删除谜题"
          :description="deleteConfirmDescription"
          confirm-label="删除谜题"
          confirm-color="error"
          confirm-icon="material-symbols:delete-outline-rounded"
          :busy="deleting"
          @confirm="deletePuzzle"
        />
      </section>
    </u-form>

    <aside class="hidden xl:block" />
  </div>
</template>
