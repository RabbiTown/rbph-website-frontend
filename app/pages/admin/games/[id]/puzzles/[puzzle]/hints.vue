<script setup lang="ts">
interface HintState {
  id: number | null;
  sort: number;
  title: string;
  title_hidden: boolean;
  content: string;
  content_type: RbContentType;
  cooldown: number;
  cost_id: number | null;
  cost_amount: number;
  backend_function: string | null;
  deleting?: boolean;
  open?: boolean;
}

interface HintPatch {
  sort: number;
  title: string;
  title_hidden: boolean;
  content: string;
  content_type: RbContentType;
  cooldown: number;
  cost_id: number | null;
  cost_amount: number;
  backend_function: string | null;
  puzzle_id: number;
}

interface HintDropTarget {
  id: number;
  side: 'top' | 'bottom';
}

interface HintDropEntry {
  id: number;
  index: number;
  centerY: number;
}

const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const route = useRoute();
const { puzzle, backend, refresh } = useAdmin().usePuzzleContext();
const dragAutoScroll = useDragAutoScroll({
  onScroll: () => {
    if (draggingHintId.value !== null) cacheHintDropEntries();
  },
});

const hints = ref<AdminHintData[]>([]);
const currencies = ref<AdminCurrencyData[]>([]);
const state = ref<HintState[]>([]);
const ticketEnabled = ref(true);
const ticketCooldown = ref(0);
const loading = ref(false);
const saving = ref(false);
const draggingHintId = ref<number | null>(null);
const dragOverHint = ref<HintDropTarget | null>(null);
const hintOriginPlaceholderVisible = ref(false);
let nextDraftId = -1;
let hintDropEntries: HintDropEntry[] = [];

const routeGameId = computed(() => Number(route.params.id));
const routePuzzleId = computed(() => Number(route.params.puzzle));
const currentGameId = computed(() => puzzle.value?.game_id ?? routeGameId.value);
const currentPuzzleId = computed(() => puzzle.value?.id ?? routePuzzleId.value);

const currencyItems = computed(() => [
  { label: '免费', value: null, icon: 'material-symbols:money-off-outline-rounded' },
  ...currencies.value.map(currency => ({
    label: currency.name,
    value: currency.id,
    icon: 'material-symbols:emoji-objects-outline-rounded',
  })),
]);

function selectedCurrencyIcon(id: number | null) {
  return currencyItems.value.find(item => item.value === id)?.icon;
}

function selectedCurrencyLabel(id: number | null) {
  return currencyItems.value.find(item => item.value === id)?.label;
}

const ticketCooldownPatch = computed(() => Math.max(0, Math.trunc(ticketCooldown.value || 0)));
const backendEnabled = computed(() => backend.value?.enabled ?? false);
const originalTicketEnabled = computed(() => puzzle.value?.ticket_enabled ?? true);
const originalTicketCooldown = computed(() => puzzle.value?.ticket_cooldown ?? 0);
const ticketEnabledDirty = computed(() => Boolean(puzzle.value && ticketEnabled.value !== originalTicketEnabled.value));
const ticketCooldownDirty = computed(() => Boolean(puzzle.value && ticketCooldownPatch.value !== originalTicketCooldown.value));
const ticketSettingsDirty = computed(() => ticketEnabledDirty.value || ticketCooldownDirty.value);
const hintDirty = computed(() => JSON.stringify(serializeState(state.value)) !== JSON.stringify(serializeHints(hints.value)));
const dirty = computed(() => hintDirty.value || ticketSettingsDirty.value);
const dirtyHintIds = computed(() => {
  const original = new Map(hints.value.map(hint => [hint.id, stateToDirtySnapshot(hintToState(hint))]));
  return new Set(
    state.value
      .filter(hint => !hint.deleting)
      .filter(hint => {
        const current = stateToDirtySnapshot(hint);
        const originalHint = hint.id && hint.id > 0 ? original.get(hint.id) : undefined;
        return JSON.stringify(current) !== JSON.stringify(originalHint ?? current);
      })
      .map(hint => hint.id)
      .filter((id): id is number => id !== null),
  );
});
const activeHints = computed(() => state.value.filter(hint => !hint.deleting));
const orderedHints = computed(() => [...state.value].sort((a, b) => a.sort - b.sort || (a.id ?? 0) - (b.id ?? 0)));
const orderedActiveHints = computed(() => [...activeHints.value].sort((a, b) => a.sort - b.sort || (a.id ?? 0) - (b.id ?? 0)));

function hintToState(hint: AdminHintData, open = false): HintState {
  return {
    id: hint.id,
    sort: hint.sort,
    title: hint.title,
    title_hidden: hint.title_hidden,
    content: hint.content,
    content_type: hint.content_type,
    cooldown: hint.cooldown,
    cost_id: hint.cost_id ?? null,
    cost_amount: hint.cost_amount,
    backend_function: hint.backend_function ?? null,
    open,
  };
}

function stateToPatch(hint: HintState): HintPatch {
  return {
    sort: Math.trunc(hint.sort || 0),
    title: hint.title.trim(),
    title_hidden: hint.title_hidden,
    content: hint.content,
    content_type: RbContentType.Markdown,
    cooldown: Math.max(0, Math.trunc(hint.cooldown || 0)),
    cost_id: hint.cost_id,
    cost_amount: hint.cost_id === null ? 0 : Math.max(0, Math.trunc(hint.cost_amount || 0)),
    backend_function: hint.backend_function?.trim() || null,
    puzzle_id: currentPuzzleId.value,
  };
}

function stateToDirtySnapshot(hint: HintState) {
  const patch = stateToPatch(hint);
  return {
    title: patch.title,
    title_hidden: patch.title_hidden,
    content: patch.content,
    content_type: patch.content_type,
    cooldown: patch.cooldown,
    cost_id: patch.cost_id,
    cost_amount: patch.cost_amount,
    backend_function: patch.backend_function,
  };
}

function serializeHints(value: AdminHintData[]) {
  return value.map(hint => stateToPatch(hintToState(hint)));
}

function serializeState(value: HintState[]) {
  return value.filter(hint => !hint.deleting).map(stateToPatch);
}

function syncTicketCooldownFromPuzzle() {
  ticketEnabled.value = originalTicketEnabled.value;
  ticketCooldown.value = originalTicketCooldown.value;
}

function resetTicketEnabled() {
  ticketEnabled.value = originalTicketEnabled.value;
}

function resetTicketCooldown() {
  ticketCooldown.value = originalTicketCooldown.value;
}

function expandedHintIds() {
  return new Set(state.value.filter(hint => hint.open && hint.id !== null && hint.id > 0).map(hint => hint.id as number));
}

function reset(openIds = expandedHintIds()) {
  state.value = hints.value.map(hint => hintToState(hint, openIds.has(hint.id)));
  syncTicketCooldownFromPuzzle();
  dirtyToast.clear();
}

function addHint() {
  const nextSort = activeHints.value.reduce((max, hint) => Math.max(max, hint.sort), -1) + 1;
  state.value.push({
    id: nextDraftId--,
    sort: nextSort,
    title: '',
    title_hidden: true,
    content: '',
    content_type: RbContentType.Markdown,
    cooldown: 0,
    cost_id: null,
    cost_amount: 0,
    backend_function: null,
    open: true,
  });
}

function normalizeSort() {
  [...activeHints.value]
    .sort((a, b) => a.sort - b.sort || (a.id ?? 0) - (b.id ?? 0))
    .forEach((hint, index) => {
      hint.sort = index;
    });
}

function removeHint(hint: HintState) {
  if (hint.id && hint.id > 0) {
    hint.deleting = true;
    normalizeSort();
  } else {
    state.value = state.value.filter(item => item !== hint);
    normalizeSort();
  }
}

function restoreHint(hint: HintState) {
  hint.deleting = false;
  normalizeSort();
}

function currencyPrec(id: number | null): number {
  if (id === null) return 0;
  return currencies.value.find(currency => currency.id === id)?.prec ?? 0;
}

function setHintDragTransfer(event: DragEvent, value: string) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.dropEffect = 'move';
  event.dataTransfer.setData('text/plain', value);
}

function setDragOverHint(target: HintDropTarget | null) {
  const current = dragOverHint.value;
  if (current?.id === target?.id && current?.side === target?.side) return;
  dragOverHint.value = target;
}

function clearHintDragState() {
  draggingHintId.value = null;
  dragOverHint.value = null;
  hintOriginPlaceholderVisible.value = false;
  hintDropEntries = [];
  window.removeEventListener('dragover', onHintGlobalDragOver);
  window.removeEventListener('drop', onHintGlobalDrop);
  dragAutoScroll.stop();
}

function cacheHintDropEntries() {
  const cards = document.querySelectorAll<HTMLElement>('[data-hint-card-drop="true"]:not([data-hint-deleting="true"])');
  hintDropEntries = Array.from(cards)
    .map(card => {
      const id = Number(card.dataset.hintId);
      const index = orderedActiveHints.value.findIndex(hint => hint.id === id);
      const rect = card.getBoundingClientRect();
      return {
        id,
        index,
        centerY: rect.top + rect.height / 2,
      };
    })
    .filter(entry => Number.isFinite(entry.id) && entry.index >= 0)
    .sort((a, b) => a.index - b.index);
}

function getHintDropTarget(event: Pick<MouseEvent, 'clientY'>): HintDropTarget | null {
  const sourceId = draggingHintId.value;
  if (sourceId === null) return null;
  if (hintDropEntries.length === 0) cacheHintDropEntries();
  if (hintDropEntries.length === 0) return null;

  const fromIndex = orderedActiveHints.value.findIndex(hint => hint.id === sourceId);
  if (fromIndex < 0) return null;

  const insertIndex = hintDropEntries.findIndex(entry => event.clientY < entry.centerY);
  const rawInsertIndex = insertIndex < 0 ? hintDropEntries.length : insertIndex;
  if (rawInsertIndex === fromIndex || rawInsertIndex === fromIndex + 1) return null;

  if (rawInsertIndex <= 0) {
    return {
      id: hintDropEntries[0]?.id ?? sourceId,
      side: 'top',
    };
  }

  if (rawInsertIndex >= hintDropEntries.length) {
    return {
      id: hintDropEntries.at(-1)?.id ?? sourceId,
      side: 'bottom',
    };
  }

  return {
    id: hintDropEntries[rawInsertIndex]?.id ?? sourceId,
    side: 'top',
  };
}

function isOriginalHintDropTarget(sourceId: number, targetId: number, side: HintDropTarget['side']) {
  const list = orderedActiveHints.value;
  const fromIndex = list.findIndex(hint => hint.id === sourceId);
  const targetIndex = list.findIndex(hint => hint.id === targetId);
  if (fromIndex < 0 || targetIndex < 0) return false;

  const rawInsertIndex = side === 'top' ? targetIndex : targetIndex + 1;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  return insertIndex === fromIndex;
}

function isValidHintDropSide(sourceId: number, targetId: number, side: HintDropTarget['side']) {
  if (sourceId === targetId) return false;
  if (isOriginalHintDropTarget(sourceId, targetId, side)) return false;
  return true;
}

function canonicalHintDropTarget(sourceId: number, targetId: number, side: HintDropTarget['side']): HintDropTarget | null {
  if (!isValidHintDropSide(sourceId, targetId, side)) return null;

  const list = orderedActiveHints.value;
  const targetIndex = list.findIndex(hint => hint.id === targetId);
  if (targetIndex < 0) return null;

  const rawInsertIndex = side === 'top' ? targetIndex : targetIndex + 1;
  if (rawInsertIndex >= list.length) {
    const target = list.at(-1);
    return target?.id !== null && target?.id !== undefined ? { id: target.id, side: 'bottom' } : null;
  }

  const target = list[rawInsertIndex];
  return target?.id !== null && target?.id !== undefined ? { id: target.id, side: 'top' } : null;
}

function hintDropHintClass(hint: HintState) {
  const sourceId = draggingHintId.value;
  if (sourceId === null || sourceId === hint.id || hint.id === null || hint.deleting) return '';

  const topTarget = canonicalHintDropTarget(sourceId, hint.id, 'top');
  const bottomTarget = canonicalHintDropTarget(sourceId, hint.id, 'bottom');
  const topValid = topTarget?.id === hint.id && topTarget.side === 'top';
  const bottomValid = bottomTarget?.id === hint.id && bottomTarget.side === 'bottom';
  const activeSide = dragOverHint.value?.id === hint.id ? dragOverHint.value.side : null;
  if (!topValid && !bottomValid) return '';

  return [
    "before:content-[''] after:content-['']",
    'before:absolute after:absolute before:left-1 after:left-1 before:right-1 after:right-1',
    'before:top-0 after:bottom-0 before:-translate-y-1.5 after:translate-y-1.5',
    'before:rounded-full after:rounded-full before:bg-primary after:bg-primary',
    'before:h-px after:h-px before:transition-all after:transition-all before:duration-100 after:duration-100',
    topValid ? (activeSide === 'top' ? 'before:left-px before:right-px before:opacity-90 before:shadow-[0_0_0_0.75px_var(--ui-primary)]' : 'before:opacity-45 before:shadow-none') : 'before:opacity-0 before:shadow-none',
    bottomValid ? (activeSide === 'bottom' ? 'after:left-px after:right-px after:opacity-90 after:shadow-[0_0_0_0.75px_var(--ui-primary)]' : 'after:opacity-45 after:shadow-none') : 'after:opacity-0 after:shadow-none',
  ].join(' ');
}

function isHintDirty(hint: HintState) {
  return hint.id !== null && dirtyHintIds.value.has(hint.id);
}

function hintDirtyLineClass(hint: HintState) {
  return isHintDirty(hint) ? "before:content-[''] before:pointer-events-none before:absolute before:-start-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-warning" : '';
}

function onHintDragStart(hint: HintState, event: DragEvent) {
  if (hint.id === null || hint.deleting || saving.value) return;
  draggingHintId.value = hint.id;
  dragOverHint.value = null;
  hintOriginPlaceholderVisible.value = false;
  setHintDragTransfer(event, `hint:${hint.id}`);
  dragAutoScroll.start();
  window.addEventListener('dragover', onHintGlobalDragOver);
  window.addEventListener('drop', onHintGlobalDrop);
  requestAnimationFrame(() => {
    if (draggingHintId.value === hint.id) hintOriginPlaceholderVisible.value = true;
    if (draggingHintId.value === hint.id) cacheHintDropEntries();
  });
}

function onHintGlobalDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dragAutoScroll.update(event);
  if (draggingHintId.value === null) return;

  setDragOverHint(getHintDropTarget(event));
}

function onHintGlobalDrop(event: DragEvent) {
  if (draggingHintId.value === null) return;
  onHintDrop(event);
}

function onHintListDragOver(event: DragEvent) {
  onHintGlobalDragOver(event);
}

function onHintDragOver(event: DragEvent) {
  onHintGlobalDragOver(event);
}

function onHintDragLeave(hintId: number | null, event: DragEvent) {
  const el = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
  if (el && event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return;

  if (draggingHintId.value === null && hintId !== null && dragOverHint.value?.id === hintId) setDragOverHint(null);
}

function onHintDrop(event: DragEvent) {
  event.preventDefault();

  const sourceId = draggingHintId.value;
  const dropTarget = dragOverHint.value ?? getHintDropTarget(event);
  clearHintDragState();
  if (sourceId === null || !dropTarget) return;

  const list = orderedActiveHints.value;
  const fromIndex = list.findIndex(item => item.id === sourceId);
  const toIndex = list.findIndex(item => item.id === dropTarget.id);
  if (fromIndex < 0 || toIndex < 0) return;

  const rawInsertIndex = dropTarget.side === 'top' ? toIndex : toIndex + 1;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  if (insertIndex === fromIndex) return;

  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  if (moved) next.splice(insertIndex, 0, moved);
  next.forEach((hint, index) => {
    hint.sort = index;
  });
}

function validate(): boolean {
  return (
    ticketCooldownPatch.value >= 0 &&
    activeHints.value.every(hint => {
      const patch = stateToPatch(hint);
      const costValid = patch.cost_id === null || currencies.value.some(currency => currency.id === patch.cost_id);
      const backendFunctionValid = patch.backend_function === null || /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(patch.backend_function);
      return patch.title.length > 0 && patch.cooldown >= 0 && patch.cost_amount >= 0 && costValid && backendFunctionValid;
    })
  );
}

function showBackendFunction(hint: HintState) {
  return backendEnabled.value || Boolean(hint.backend_function?.trim());
}

function hintBackendWarning(hint: HintState) {
  return !backendEnabled.value && Boolean(hint.backend_function?.trim());
}

async function fetchData(openIds = expandedHintIds()) {
  if (!Number.isFinite(currentPuzzleId.value) || !Number.isFinite(currentGameId.value)) return;

  loading.value = true;
  try {
    type HintResponse = { hints: AdminHintData[] };
    type CurrencyResponse = { currencies: AdminCurrencyData[] };
    const [hintResp, currencyResp] = await Promise.all([api.get<HintResponse>('/admin/hints', { query: { puzzle_id: currentPuzzleId.value } }), api.get<CurrencyResponse>(`/admin/games/${currentGameId.value}/currencies`)]);

    hints.value = hintResp.data.hints;
    currencies.value = currencyResp.data.currencies;
    reset(openIds);
  } catch (error) {
    handleError(error, '获取提示信息失败', true);
  } finally {
    loading.value = false;
  }
}

async function apply() {
  if (!Number.isFinite(currentPuzzleId.value) || !dirty.value || saving.value) return;
  if (!validate()) {
    toast.add({
      title: '提示配置不合法',
      description: '请检查标题、冷却时间、货币消耗和后端函数名。',
      icon: 'material-symbols:error-med-outline-rounded',
      color: 'error',
    });
    return;
  }

  const openIds = expandedHintIds();
  saving.value = true;
  try {
    if (ticketSettingsDirty.value && puzzle.value) {
      type PuzzleResponse = { puzzle: AdminPuzzleData };
      const body: {
        ticket_enabled?: boolean;
        ticket_cooldown?: number;
      } = {};
      if (ticketEnabledDirty.value) body.ticket_enabled = ticketEnabled.value;
      if (ticketCooldownDirty.value) body.ticket_cooldown = ticketCooldownPatch.value;

      const response = await api.patch<PuzzleResponse>(`/admin/puzzles/${puzzle.value.id}`, body, {
        errorHints: { [-2]: '人工提示配置不合法。', [-1]: '谜题不存在。' },
      });
      puzzle.value = response.data.puzzle;
      syncTicketCooldownFromPuzzle();
      await refresh();
    }

    if (hintDirty.value) {
      for (const hint of state.value) {
        if (hint.deleting && hint.id && hint.id > 0) {
          await api.del(`/admin/hints/${hint.id}`, {
            errorHints: { [-1]: '提示不存在。' },
          });
        }
      }

      for (const hint of activeHints.value) {
        const body = stateToPatch(hint);
        if (hint.id && hint.id > 0) {
          await api.patch(`/admin/hints/${hint.id}`, body, {
            errorHints: { [-2]: '提示配置不合法。', [-1]: '提示不存在。' },
          });
        } else {
          const { data } = await api.post<{ hint: AdminHintData }>('/admin/hints', body, {
            errorHints: { [-2]: '提示配置不合法。', [-1]: '谜题不存在。' },
          });
          if (hint.open) openIds.add(data.hint.id);
        }
      }

      await fetchData(openIds);
    }
    dirtyToast.clear();
    toast.add({
      title: '提示配置已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存提示配置失败');
  } finally {
    saving.value = false;
  }
}

watch(
  [currentPuzzleId, currentGameId],
  () => {
    fetchData(new Set());
  },
  { immediate: true },
);

watch(
  () => puzzle.value?.id,
  () => {
    syncTicketCooldownFromPuzzle();
  },
  { immediate: true },
);

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '提示配置修改尚未保存。',
      guardOnLeave: true,
      apply,
      reset,
    });
  } else {
    dirtyToast.clear();
  }
});

onBeforeUnmount(() => {
  clearHintDragState();
});
</script>

<template>
  <div v-if="puzzle" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />

    <div class="flex min-w-0 flex-col gap-4">
      <u-form :state="{ hints: state, ticketCooldown }" class="flex flex-col gap-4" @submit.prevent="apply" @dragover="onHintListDragOver" @drop="onHintDrop">
        <section class="flex flex-col gap-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">预设提示</h2>
            <p class="mt-1 text-sm text-muted">所有玩家都能解锁并查看预设提示。</p>
          </div>

          <u-empty v-if="!loading && state.length === 0" icon="material-symbols:lightbulb-outline-rounded" title="暂无预设提示" description="添加一个提示后，玩家可在提示页解锁。">
            <template #actions>
              <u-button icon="material-symbols:add-rounded" label="新建提示" :disabled="loading || saving" @click="addHint" />
            </template>
          </u-empty>

          <template v-else>
            <div
              v-for="hint in orderedHints"
              :key="hint.id ?? 0"
              data-hint-card-drop="true"
              :data-hint-id="hint.id"
              :data-hint-deleting="hint.deleting ? 'true' : undefined"
              class="relative transition-colors"
              :class="[hint.deleting ? 'opacity-50' : '', hintDropHintClass(hint), hintDirtyLineClass(hint)]"
              @dragover="onHintDragOver"
              @dragleave="onHintDragLeave(hint.id, $event)"
              @drop="onHintDrop"
            >
              <u-collapsible v-model:open="hint.open" :unmount-on-hide="false">
                <div class="flex items-center gap-3 rounded-lg bg-elevated/60 px-4 py-2 group cursor-pointer ring ring-default">
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <u-icon name="material-symbols:lightbulb-outline-rounded" class="text-warning" />
                    <u-input v-if="hint.open" v-model="hint.title" class="w-full -mx-2.5 -my-1.5 font-medium" placeholder="提示标题" variant="ghost" :disabled="saving || hint.deleting" @click.stop />
                    <div v-else class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">
                      {{ hint.title || '未命名提示' }}
                    </div>
                  </div>
                  <div class="flex min-w-0 flex-none flex-wrap justify-end gap-1" @click.stop>
                    <u-badge v-if="hint.cooldown > 0" variant="soft" color="warning" class="shrink-0">
                      <u-icon name="material-symbols:schedule-outline-rounded" class="me-1 size-3.5" />
                      {{ formatTime(hint.cooldown * 1000) }}
                    </u-badge>
                    <u-badge v-if="hint.cost_id !== null && hint.cost_amount > 0" variant="soft" color="primary" class="shrink-0">
                      <u-icon :name="selectedCurrencyIcon(hint.cost_id) || 'material-symbols:money-bag-outline-rounded'" class="me-1 size-3.5" />
                      {{ selectedCurrencyLabel(hint.cost_id) }} {{ intPrecString(-hint.cost_amount, currencyPrec(hint.cost_id), true, ' ') }}
                    </u-badge>
                  </div>
                  <div class="flex items-center gap-1" @click.stop>
                    <u-button
                      icon="material-symbols:drag-indicator"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      aria-label="拖动排序"
                      class="cursor-grab active:cursor-grabbing"
                      draggable="true"
                      :disabled="saving || hint.deleting"
                      @dragstart.stop="onHintDragStart(hint, $event)"
                      @dragend="clearHintDragState"
                    />
                    <u-button v-if="hint.deleting" icon="material-symbols:undo-rounded" color="neutral" variant="ghost" size="sm" :disabled="saving" @click="restoreHint(hint)" />
                    <u-button v-else icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="sm" :disabled="saving" @click="removeHint(hint)" />
                  </div>
                  <u-icon name="material-symbols:expand-more-rounded" class="size-5 text-muted group-data-[state=open]:rotate-180 transition-transform duration-200" />
                </div>

                <template #content>
                  <div class="border-t border-default bg-elevated/40 px-4 pt-4 pb-4">
                    <div class="flex flex-col gap-4">
                      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <rb-form-field row narrow-label class="flex-1" label="开放时间">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm text-muted">谜题解锁后</span>
                            <u-input-number
                              v-model="hint.cooldown"
                              :min="0"
                              :step="10"
                              :step-snapping="false"
                              orientation="vertical"
                              :format-options="{ style: 'unit', unit: 'second' }"
                              variant="subtle"
                              class="w-40"
                              :disabled="saving || hint.deleting"
                            />
                          </div>
                        </rb-form-field>

                        <rb-form-field row narrow-label class="flex-1" label="未开放时">
                          <div class="flex flex-wrap items-center gap-2">
                            <u-switch v-model="hint.title_hidden" class="mt-1.5" label="隐藏标题" :disabled="saving || hint.deleting" />
                          </div>
                        </rb-form-field>
                      </div>

                      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <rb-form-field row narrow-label class="flex-1" label="解锁消耗">
                          <div class="flex flex-wrap items-center gap-2">
                            <u-select v-model="hint.cost_id" :items="currencyItems" :leading-icon="selectedCurrencyIcon(hint.cost_id)" variant="subtle" class="w-40" :disabled="saving || hint.deleting" />
                            <rb-input-number v-if="hint.cost_id !== null" v-model="hint.cost_amount" :prec="currencyPrec(hint.cost_id)" :min="0" :step="1" orientation="vertical" variant="subtle" class="w-36" :disabled="saving || hint.deleting" />
                          </div>
                        </rb-form-field>

                        <rb-form-field v-if="showBackendFunction(hint)" row narrow-label class="flex-1" :error="hintBackendWarning(hint) ? true : undefined">
                          <template #label>
                            解锁调用函数
                            <rb-tooltip text="若非空，购买提示时将调用对应的后端函数，函数失败会导致购买失败。">
                              <u-icon name="material-symbols:help-outline-rounded" class="size-4 align-middle mb-0.5 ms-1 cursor-help" :class="hintBackendWarning(hint) ? 'text-error' : 'text-secondary'" />
                            </rb-tooltip>
                          </template>
                          <div class="flex flex-col gap-1">
                            <u-input v-model="hint.backend_function" placeholder="(optional)" icon="material-symbols:function-rounded" variant="subtle" class="w-full max-w-md font-mono" :color="hintBackendWarning(hint) ? 'error' : 'neutral'" :disabled="saving || hint.deleting" />
                            <div v-if="hintBackendWarning(hint)" class="text-xs text-error">题目后端已关闭，该解锁调用函数不会生效；重新启用后端后会恢复。</div>
                          </div>
                        </rb-form-field>
                      </div>

                      <rbph-content-editor v-model="hint.content" framed placeholder="提示内容" :disabled="saving || hint.deleting" @save="apply" />
                    </div>
                  </div>
                </template>
              </u-collapsible>
            </div>

            <div class="sticky bottom-4 z-20 flex justify-end">
              <u-button icon="material-symbols:add-rounded" label="新建提示" size="lg" class="shadow-lg shadow-primary/20" :disabled="loading || saving" @click="addHint" />
            </div>
          </template>
        </section>

        <u-separator class="my-2" />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">人工提示</h2>
            <p class="mt-1 text-sm text-muted">玩家在特定情况下可以请求人工提示。</p>
          </div>

          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
            <rb-form-field row narrow-label label="启用状态" :dirty="ticketEnabledDirty" :reset="resetTicketEnabled">
              <u-switch v-model="ticketEnabled" class="mt-1.5" label="启用人工提示" :disabled="saving" />
            </rb-form-field>

            <u-separator v-if="ticketEnabled" />

            <rb-form-field v-if="ticketEnabled" row narrow-label label="开放时间" :dirty="ticketCooldownDirty" :reset="resetTicketCooldown">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm text-muted">谜题解锁后</span>
                <u-input-number v-model="ticketCooldown" :min="0" :step="10" :step-snapping="false" orientation="vertical" :format-options="{ style: 'unit', unit: 'second' }" variant="subtle" class="w-40" :disabled="saving" />
              </div>
            </rb-form-field>
          </div>
        </section>
      </u-form>
    </div>

    <aside class="hidden xl:block" />
  </div>
</template>
