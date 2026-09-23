<script setup lang="ts">
const { t } = useI18n();

interface HintState {
  id: number | null;
  sort: number;
  title: string;
  hidden_title: string;
  content: string;
  content_type: RbContentType;
  cooldown: number;
  title_display_condition: string | null;
  display_condition: string | null;
  enable_cond: string | null;
  cooldown_origin: HintCooldownOrigin;
  cost_id: number | null;
  cost_amount: number;
  backend_function: string | null;
  triggers: string[];
  open?: boolean;
  advancedOpen?: boolean;
}

interface HintPatch {
  sort: number;
  title: string;
  hidden_title: string | null;
  content: string;
  content_type: RbContentType;
  cooldown: number;
  title_display_condition: string | null;
  display_condition: string | null;
  enable_cond: string | null;
  cooldown_origin: HintCooldownOrigin;
  cost_id: number | null;
  cost_amount: number;
  backend_function: string | null;
  triggers: string[];
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

enum HintCooldownOrigin {
  PuzzleUnlock = 0,
  HintEnabled = 1,
  HintDisplayed = 2,
  HintTitleDisplayed = 3,
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
const maxCooldownSeconds = 2_147_483_647;
const initialHintEnableCondition = '(true)';
const initialHintDisplayCondition = '(true)';
const initialHintTitleDisplayCondition = '(hint-cooled-down)';
const hintEditor = useListEditor(state, {
  getId: hint => hint.id as number,
  isPersisted: hint => Boolean(hint.id && hint.id > 0),
  keepDraft: hint => Boolean(hint.title.trim() || hint.content.trim()),
  pendingDeletion: true,
  reorderable: true,
});
const activeHints = hintEditor.activeItems;

const routeGameId = computed(() => Number(route.params.id));
const routePuzzleId = computed(() => Number(route.params.puzzle));
const currentGameId = computed(() => puzzle.value?.game_id ?? routeGameId.value);
const currentPuzzleId = computed(() => puzzle.value?.id ?? routePuzzleId.value);

const currencyItems = computed(() => [
  { label: t('admin.pages.puzzle.hints.free'), value: null, icon: 'material-symbols:money-off-outline-rounded' },
  ...currencies.value.map(currency => ({
    label: currency.name,
    value: currency.id,
    icon: 'material-symbols:emoji-objects-outline-rounded',
  })),
]);

const cooldownOriginItems = computed(() => [
  { label: t('admin.pages.puzzle.hints.fromPuzzleUnlock'), value: HintCooldownOrigin.PuzzleUnlock, icon: 'material-symbols:lock-open-right-outline-rounded' },
  { label: t('admin.pages.puzzle.hints.fromHintEnabled'), value: HintCooldownOrigin.HintEnabled, icon: 'material-symbols:rule-rounded' },
  { label: t('admin.pages.puzzle.hints.fromHintDisplayed'), value: HintCooldownOrigin.HintDisplayed, icon: 'material-symbols:visibility-outline-rounded' },
  { label: t('admin.pages.puzzle.hints.fromHintTitleDisplayed'), value: HintCooldownOrigin.HintTitleDisplayed, icon: 'material-symbols:title-rounded' },
]);

function selectedCurrencyIcon(id: number | null) {
  return currencyItems.value.find(item => item.value === id)?.icon;
}

function selectedCurrencyLabel(id: number | null) {
  return currencyItems.value.find(item => item.value === id)?.label;
}

function cooldownOriginLabel(origin: HintCooldownOrigin) {
  return cooldownOriginItems.value.find(item => item.value === origin)?.label;
}

function cooldownOriginDisabled(hint: HintState, origin: HintCooldownOrigin) {
  return (
    (origin === HintCooldownOrigin.HintEnabled && hint.enable_cond === null) ||
    (origin === HintCooldownOrigin.HintDisplayed && (hint.display_condition === null || unlockConditionUsesHintCooldown(hint.display_condition))) ||
    (origin === HintCooldownOrigin.HintTitleDisplayed && (hint.title_display_condition === null || unlockConditionUsesHintCooldown(hint.title_display_condition)))
  );
}

const ticketCooldownPatch = computed(() => Math.max(0, Math.trunc(ticketCooldown.value || 0)));
const backendEnabled = computed(() => backend.value?.enabled ?? false);
const originalTicketEnabled = computed(() => puzzle.value?.ticket_enabled ?? true);
const originalTicketCooldown = computed(() => puzzle.value?.ticket_cooldown ?? 0);
const ticketEnabledDirty = computed(() => Boolean(puzzle.value && ticketEnabled.value !== originalTicketEnabled.value));
const ticketCooldownDirty = computed(() => Boolean(puzzle.value && ticketCooldownPatch.value !== originalTicketCooldown.value));
const ticketSettingsDirty = computed(() => ticketEnabledDirty.value || ticketCooldownDirty.value);
const hintDirty = computed(() => state.value.some(hint => Boolean(hint.id && hint.id < 0 && hintEditor.isPendingDeletion(hint))) || JSON.stringify(serializeState(state.value)) !== JSON.stringify(serializeHints(hints.value)));
const dirty = computed(() => hintDirty.value || ticketSettingsDirty.value);
const dirtyHintIds = computed(() => {
  const original = new Map(hints.value.map(hint => [hint.id, stateToDirtySnapshot(hintToState(hint))]));
  return new Set(
    state.value
      .filter(hint => !hintEditor.isPendingDeletion(hint))
      .filter(hint => {
        const current = stateToDirtySnapshot(hint);
        const originalHint = hint.id && hint.id > 0 ? original.get(hint.id) : undefined;
        return JSON.stringify(current) !== JSON.stringify(originalHint ?? current);
      })
      .map(hint => hint.id)
      .filter((id): id is number => id !== null),
  );
});

function hintHasNonDefaultAdvancedSettings(hint: Pick<HintState, 'hidden_title' | 'title_display_condition' | 'display_condition' | 'enable_cond' | 'cooldown_origin' | 'backend_function' | 'triggers'>) {
  return Boolean(hint.hidden_title.trim()) || hint.title_display_condition !== null || hint.display_condition !== null || hint.enable_cond !== null || hint.cooldown_origin !== HintCooldownOrigin.PuzzleUnlock || Boolean(hint.backend_function?.trim()) || hint.triggers.length > 0;
}

function hintToState(hint: AdminHintData, open = false): HintState {
  const result: HintState = {
    id: hint.id,
    sort: hint.sort,
    title: hint.title,
    hidden_title: hint.hidden_title ?? '',
    content: hint.content,
    content_type: hint.content_type,
    cooldown: hint.cooldown,
    title_display_condition: hint.title_display_condition,
    display_condition: hint.display_condition,
    enable_cond: hint.enable_cond ?? null,
    cooldown_origin: hint.cooldown_origin ?? HintCooldownOrigin.PuzzleUnlock,
    cost_id: hint.cost_id ?? null,
    cost_amount: hint.cost_amount,
    backend_function: hint.backend_function ?? null,
    triggers: [...(hint.triggers ?? [])],
    open,
  };
  result.advancedOpen = hintHasNonDefaultAdvancedSettings(result);
  return result;
}

function stateToPatch(hint: HintState, sort = hint.sort): HintPatch {
  return {
    sort: Math.trunc(sort || 0),
    title: hint.title.trim(),
    hidden_title: hint.hidden_title.trim() || null,
    content: hint.content,
    content_type: RbContentType.Markdown,
    cooldown: Math.max(0, Math.trunc(hint.cooldown || 0)),
    title_display_condition: hint.title_display_condition,
    display_condition: hint.display_condition,
    enable_cond: hint.enable_cond,
    cooldown_origin: hint.cooldown_origin,
    cost_id: hint.cost_id,
    cost_amount: hint.cost_id === null ? 0 : Math.max(0, Math.trunc(hint.cost_amount || 0)),
    backend_function: hint.backend_function?.trim() || null,
    triggers: hint.triggers.map(value => value.trim()).filter(Boolean),
    puzzle_id: currentPuzzleId.value,
  };
}

function stateToDirtySnapshot(hint: HintState) {
  const patch = stateToPatch(hint);
  return {
    title: patch.title,
    hidden_title: patch.hidden_title,
    content: patch.content,
    content_type: patch.content_type,
    cooldown: patch.cooldown,
    title_display_condition: patch.title_display_condition,
    display_condition: patch.display_condition,
    enable_cond: patch.enable_cond,
    cooldown_origin: patch.cooldown_origin,
    cost_id: patch.cost_id,
    cost_amount: patch.cost_amount,
    backend_function: patch.backend_function,
    triggers: patch.triggers,
  };
}

function serializeHints(value: AdminHintData[]) {
  return value.map((hint, index) => stateToPatch(hintToState(hint), index));
}

function serializeState(value: HintState[]) {
  return value.filter(hint => !hintEditor.isPendingDeletion(hint)).map((hint, index) => stateToPatch(hint, index));
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

function expandedAdvancedHintIds() {
  return new Set(state.value.filter(hint => hint.advancedOpen && hint.id !== null && hint.id > 0).map(hint => hint.id as number));
}

function reset(openIds = expandedHintIds(), advancedOpenIds?: Set<number>) {
  state.value = hints.value.map(hint => {
    const result = hintToState(hint, openIds.has(hint.id));
    if (advancedOpenIds?.has(hint.id)) result.advancedOpen = true;
    return result;
  });
  hintEditor.resetPendingDeletion();
  syncTicketCooldownFromPuzzle();
  dirtyToast.clear();
}

function addHint() {
  state.value.push({
    id: nextDraftId--,
    sort: activeHints.value.length,
    title: '',
    hidden_title: '',
    content: '',
    content_type: RbContentType.Markdown,
    cooldown: 0,
    title_display_condition: null,
    display_condition: null,
    enable_cond: null,
    cooldown_origin: HintCooldownOrigin.PuzzleUnlock,
    cost_id: null,
    cost_amount: 0,
    backend_function: null,
    triggers: [],
    open: true,
  });
}

function removeHint(hint: HintState) {
  hintEditor.markForDeletion(hint);
}

function restoreHint(hint: HintState) {
  hintEditor.restore(hint);
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
      const index = activeHints.value.findIndex(hint => hint.id === id);
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

  const fromIndex = activeHints.value.findIndex(hint => hint.id === sourceId);
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
  const list = activeHints.value;
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

  const list = activeHints.value;
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
  if (sourceId === null || sourceId === hint.id || hint.id === null || hintEditor.isPendingDeletion(hint)) return '';

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
  if (hint.id === null || hintEditor.isPendingDeletion(hint) || saving.value) return;
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

  const list = activeHints.value;
  const fromIndex = list.findIndex(item => item.id === sourceId);
  const toIndex = list.findIndex(item => item.id === dropTarget.id);
  if (fromIndex < 0 || toIndex < 0) return;

  const rawInsertIndex = dropTarget.side === 'top' ? toIndex : toIndex + 1;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  if (insertIndex === fromIndex) return;

  hintEditor.moveActive(fromIndex, insertIndex);
}

function validate(): boolean {
  return (
    ticketCooldownPatch.value >= 0 &&
    activeHints.value.every(hint => {
      const patch = stateToPatch(hint);
      const costValid = patch.cost_id === null || currencies.value.some(currency => currency.id === patch.cost_id);
      const backendFunctionValid = patch.backend_function === null || /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(patch.backend_function);
      const enableConditionValid = patch.enable_cond === null || patch.enable_cond.length > 0;
      const displayConditionsValid = (patch.title_display_condition === null || patch.title_display_condition.trim().length > 0) && (patch.display_condition === null || patch.display_condition.trim().length > 0);
      const cooldownOriginValid = !cooldownOriginDisabled(hint, patch.cooldown_origin);
      const triggersValid = patch.triggers.every(value => /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value));
      return patch.title.length > 0 && (patch.hidden_title === null || [...patch.hidden_title].length <= 120) && patch.cooldown >= 0 && patch.cost_amount >= 0 && costValid && backendFunctionValid && enableConditionValid && displayConditionsValid && cooldownOriginValid && triggersValid;
    })
  );
}

function showBackendFunction(hint: HintState) {
  return backendEnabled.value || Boolean(hint.backend_function?.trim());
}

function setHintConditionEnabled(hint: HintState, field: 'enable_cond' | 'display_condition' | 'title_display_condition', enabled: boolean) {
  if (!enabled) {
    hint[field] = null;
    if (
      (field === 'enable_cond' && hint.cooldown_origin === HintCooldownOrigin.HintEnabled) ||
      (field === 'display_condition' && hint.cooldown_origin === HintCooldownOrigin.HintDisplayed) ||
      (field === 'title_display_condition' && hint.cooldown_origin === HintCooldownOrigin.HintTitleDisplayed)
    ) {
      hint.cooldown_origin = HintCooldownOrigin.PuzzleUnlock;
    }
    return;
  }
  hint[field] = field === 'enable_cond' ? initialHintEnableCondition : field === 'display_condition' ? initialHintDisplayCondition : initialHintTitleDisplayCondition;
}

function hintBackendWarning(hint: HintState) {
  return !backendEnabled.value && Boolean(hint.backend_function?.trim());
}

function toggleHintAdvanced(hint: HintState) {
  hint.advancedOpen = !hint.advancedOpen;
}

async function fetchData(openIds = expandedHintIds(), advancedOpenIds?: Set<number>) {
  if (!Number.isFinite(currentPuzzleId.value) || !Number.isFinite(currentGameId.value)) return;

  loading.value = true;
  try {
    type HintResponse = { hints: AdminHintData[] };
    type CurrencyResponse = { currencies: AdminCurrencyData[] };
    const [hintResp, currencyResp] = await Promise.all([api.get<HintResponse>('/admin/hints', { query: { puzzle_id: currentPuzzleId.value } }), api.get<CurrencyResponse>(`/admin/games/${currentGameId.value}/currencies`)]);

    hints.value = hintResp.data.hints;
    currencies.value = currencyResp.data.currencies;
    reset(openIds, advancedOpenIds);
  } catch (error) {
    handleError(error, t('admin.pages.puzzle.hints.loadHintInfoFailed'), true);
  } finally {
    loading.value = false;
  }
}

async function apply() {
  if (!Number.isFinite(currentPuzzleId.value) || !dirty.value || saving.value) return;
  if (!validate()) {
    toast.add({
      title: t('admin.pages.puzzle.hints.hintConfigurationInvalid'),
      description: t('admin.pages.puzzle.hints.invalidHintDescription'),
      icon: 'material-symbols:error-med-outline-rounded',
      color: 'error',
    });
    return;
  }

  const openIds = expandedHintIds();
  const advancedOpenIds = expandedAdvancedHintIds();
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
        errorHints: { [-2]: t('admin.pages.puzzle.hints.ticketConfigurationInvalid'), [-1]: t('admin.common.puzzleNotFound') },
      });
      puzzle.value = response.data.puzzle;
      syncTicketCooldownFromPuzzle();
      await refresh();
    }

    if (hintDirty.value) {
      for (const hint of state.value) {
        if (hintEditor.isPendingDeletion(hint) && hint.id && hint.id > 0) {
          await api.del(`/admin/hints/${hint.id}`, {
            errorHints: { [-1]: t('admin.pages.puzzle.hints.hintNotFound') },
          });
        }
      }

      for (const { item: hint, sort } of hintEditor.activeSortEntries.value) {
        const body = stateToPatch(hint, sort);
        if (hint.id && hint.id > 0) {
          await api.patch(`/admin/hints/${hint.id}`, body, {
            errorHints: { [-2]: t('admin.pages.puzzle.hints.hintConfigurationInvalidDescription'), [-1]: t('admin.pages.puzzle.hints.hintNotFound') },
          });
        } else {
          const { data } = await api.post<{ hint: AdminHintData }>('/admin/hints', body, {
            errorHints: { [-2]: t('admin.pages.puzzle.hints.hintConfigurationInvalidDescription'), [-1]: t('admin.common.puzzleNotFound') },
          });
          if (hint.open) openIds.add(data.hint.id);
          if (hint.advancedOpen) advancedOpenIds.add(data.hint.id);
        }
      }

      await fetchData(openIds, advancedOpenIds);
    }
    dirtyToast.clear();
    toast.add({
      title: t('admin.pages.puzzle.hints.hintConfigurationSaved'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('admin.pages.puzzle.hints.saveHintConfigurationFailed'));
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
      description: t('admin.pages.puzzle.hints.hintConfigurationUpdateNotYetSave'),
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
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.pages.puzzle.hints.hint') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('admin.pages.puzzle.hints.allPlayerUnlockViewHint') }}</p>
          </div>

          <u-empty v-if="!loading && state.length === 0" icon="material-symbols:lightbulb-outline-rounded" :title="t('admin.pages.puzzle.hints.emptyHint')" :description="t('admin.pages.puzzle.hints.addItemHintPlayerHintUnlock')">
            <template #actions>
              <u-button icon="material-symbols:add-rounded" :label="t('admin.pages.puzzle.hints.createHint')" :disabled="loading || saving" @click="addHint" />
            </template>
          </u-empty>

          <template v-else>
            <div
              v-for="hint in state"
              :key="hint.id ?? 0"
              data-hint-card-drop="true"
              :data-hint-id="hint.id"
              :data-hint-deleting="hintEditor.isPendingDeletion(hint) ? 'true' : undefined"
              class="relative transition-colors"
              :class="[hintEditor.isPendingDeletion(hint) ? 'opacity-50' : '', hintDropHintClass(hint), hintDirtyLineClass(hint)]"
              @dragover="onHintDragOver"
              @dragleave="onHintDragLeave(hint.id, $event)"
              @drop="onHintDrop"
            >
              <u-collapsible v-model:open="hint.open" :unmount-on-hide="false">
                <rbph-collapsible-header class="rounded-lg bg-elevated/60 px-4 py-2 ring ring-default">
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <u-icon name="material-symbols:lightbulb-outline-rounded" class="shrink-0 text-warning" />
                    <u-textarea
                      v-if="hint.open"
                      v-model="hint.title"
                      :rows="1"
                      autoresize
                      :ui="{ base: 'field-sizing-content resize-none' }"
                      class="min-w-0 flex-1 w-full -mx-2.5 -my-1.5 font-medium"
                      :placeholder="t('admin.pages.puzzle.hints.hintTitle')"
                      variant="ghost"
                      :disabled="saving || hintEditor.isPendingDeletion(hint)"
                      @click.stop
                      @keydown.stop
                    />
                    <div v-else class="min-w-0 flex-1 whitespace-normal wrap-anywhere text-sm font-medium text-highlighted">
                      {{ hint.title || t('admin.pages.puzzle.hints.notMemberHint') }}
                    </div>
                  </div>
                  <template #badges>
                    <u-badge v-if="hint.display_condition !== null || hint.enable_cond !== null" variant="soft" color="info">
                      <u-icon name="material-symbols:rule-rounded" class="me-1 size-3.5" />
                      {{ t('admin.pages.puzzle.hints.conditional') }}
                    </u-badge>
                    <u-badge v-if="hint.cooldown > 0" variant="soft" color="warning">
                      <u-icon name="material-symbols:schedule-outline-rounded" class="me-1 size-3.5" />
                      {{ formatTime(hint.cooldown * 1000) }}
                    </u-badge>
                    <u-badge v-if="hint.cost_id !== null && hint.cost_amount > 0" variant="soft" color="primary">
                      <u-icon :name="selectedCurrencyIcon(hint.cost_id) || 'material-symbols:money-bag-outline-rounded'" class="me-1 size-3.5" />
                      {{ selectedCurrencyLabel(hint.cost_id) }} {{ intPrecString(-hint.cost_amount, currencyPrec(hint.cost_id), true, ' ') }}
                    </u-badge>
                  </template>
                  <template #actions>
                    <div class="flex items-center gap-1" @click.stop>
                      <u-button
                        icon="material-symbols:drag-indicator"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        :aria-label="t('admin.common.dragToReorder')"
                        class="cursor-grab active:cursor-grabbing"
                        draggable="true"
                        :disabled="saving || hintEditor.isPendingDeletion(hint)"
                        @dragstart.stop="onHintDragStart(hint, $event)"
                        @dragend="clearHintDragState"
                      />
                      <u-button v-if="hintEditor.isPendingDeletion(hint)" icon="material-symbols:undo-rounded" color="neutral" variant="ghost" size="sm" :disabled="saving" @click="restoreHint(hint)" />
                      <u-button v-else icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="sm" :disabled="saving" @click="removeHint(hint)" />
                    </div>
                  </template>
                </rbph-collapsible-header>

                <template #content>
                  <div class="border-t border-default bg-elevated/40 px-4 pt-4 pb-4">
                    <div class="flex flex-col gap-4">
                      <div>
                        <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <rb-form-field row narrow-label class="min-w-0 flex-1" :label="t('admin.pages.puzzle.hints.cooldown')">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="text-sm text-muted">{{ cooldownOriginLabel(hint.cooldown_origin) }}</span>
                              <rb-input-duration
                                v-model="hint.cooldown"
                                :max-seconds="maxCooldownSeconds"
                                icon="material-symbols:timer-outline-rounded"
                                variant="subtle"
                                :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                :aria-label="t('admin.pages.puzzle.hints.cooldown')"
                              />
                            </div>
                          </rb-form-field>

                          <rb-form-field row narrow-label class="min-w-0 flex-1" :label="t('admin.pages.puzzle.hints.unlockCost')">
                            <div class="flex flex-wrap items-center gap-2">
                              <u-select v-model="hint.cost_id" :items="currencyItems" :leading-icon="selectedCurrencyIcon(hint.cost_id)" variant="subtle" class="w-40" :disabled="saving || hintEditor.isPendingDeletion(hint)" />
                              <rb-input-number
                                v-if="hint.cost_id !== null"
                                v-model="hint.cost_amount"
                                :prec="currencyPrec(hint.cost_id)"
                                :min="0"
                                :step="1"
                                orientation="vertical"
                                variant="subtle"
                                class="w-36"
                                :disabled="saving || hintEditor.isPendingDeletion(hint)"
                              />
                            </div>
                          </rb-form-field>
                        </div>

                        <u-separator class="mt-2">
                          <u-button
                            :color="hintHasNonDefaultAdvancedSettings(hint) ? 'primary' : 'neutral'"
                            variant="ghost"
                            size="sm"
                            icon="material-symbols:tune-rounded"
                            :label="t('admin.pages.puzzle.hints.advancedSettings')"
                            trailing-icon="material-symbols:expand-more-rounded"
                            :aria-expanded="Boolean(hint.advancedOpen)"
                            :ui="{ trailingIcon: ['transition-transform duration-200', { 'rotate-180': hint.advancedOpen }] }"
                            @click="toggleHintAdvanced(hint)"
                          />
                        </u-separator>

                        <u-collapsible v-model:open="hint.advancedOpen">
                          <template #content>
                            <div class="mt-2 space-y-4">
                              <rb-form-field :label="t('admin.pages.puzzle.hints.displayCondition')" :tooltip="t('admin.pages.puzzle.hints.displayConditionDescription')">
                                <template #label-action>
                                  <span class="whitespace-nowrap text-xs font-normal text-muted">{{ t('admin.pages.puzzle.hints.defaultDisplayCondition') }}</span>
                                  <u-switch
                                    :model-value="hint.display_condition !== null"
                                    :label="t('admin.pages.puzzle.hints.customCondition')"
                                    size="sm"
                                    :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                    @update:model-value="value => setHintConditionEnabled(hint, 'display_condition', value)"
                                  />
                                </template>
                                <rbph-hint-display-condition-editor
                                  v-if="hint.display_condition !== null"
                                  v-model="hint.display_condition"
                                  :game-id="currentGameId"
                                  :current-puzzle-id="currentPuzzleId"
                                  :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                />
                              </rb-form-field>

                              <rb-form-field :label="t('admin.pages.puzzle.hints.enableCondition')" :tooltip="t('admin.pages.puzzle.hints.enableConditionDescription')">
                                <template #label-action>
                                  <span class="whitespace-nowrap text-xs font-normal text-muted">{{ t('admin.pages.puzzle.hints.defaultEnableCondition') }}</span>
                                  <u-switch
                                    :model-value="hint.enable_cond !== null"
                                    :label="t('admin.pages.puzzle.hints.customCondition')"
                                    size="sm"
                                    :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                    @update:model-value="value => setHintConditionEnabled(hint, 'enable_cond', value)"
                                  />
                                </template>
                                <rbph-content-block-visibility-editor
                                  v-if="hint.enable_cond !== null"
                                  v-model="hint.enable_cond"
                                  :game-id="currentGameId"
                                  :current-puzzle-id="currentPuzzleId"
                                  :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                />
                              </rb-form-field>

                              <rb-form-field :label="t('admin.pages.puzzle.hints.titleDisplayCondition')" :tooltip="t('admin.pages.puzzle.hints.titleDisplayConditionDescription')">
                                <template #label-action>
                                  <span class="whitespace-nowrap text-xs font-normal text-muted">{{ t('admin.pages.puzzle.hints.defaultTitleDisplayCondition') }}</span>
                                  <u-switch
                                    :model-value="hint.title_display_condition !== null"
                                    :label="t('admin.pages.puzzle.hints.customCondition')"
                                    size="sm"
                                    :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                    @update:model-value="value => setHintConditionEnabled(hint, 'title_display_condition', value)"
                                  />
                                </template>
                                <rbph-hint-display-condition-editor
                                  v-if="hint.title_display_condition !== null"
                                  v-model="hint.title_display_condition"
                                  :game-id="currentGameId"
                                  :current-puzzle-id="currentPuzzleId"
                                  :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                />
                              </rb-form-field>

                              <rb-form-field :label="t('admin.pages.puzzle.hints.hiddenTitle')" :tooltip="t('admin.pages.puzzle.hints.hiddenTitleDescription')">
                                <u-input
                                  v-model="hint.hidden_title"
                                  class="w-full"
                                  :maxlength="120"
                                  :placeholder="t('hints.hiddenTitle')"
                                  :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                />
                              </rb-form-field>

                              <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <rb-form-field row narrow-label class="min-w-0 flex-1" :label="t('admin.pages.puzzle.hints.cooldownOrigin')">
                                  <u-field-group class="flex-wrap">
                                    <u-button
                                      v-for="item in cooldownOriginItems"
                                      :key="item.value"
                                      :variant="hint.cooldown_origin === item.value ? 'solid' : 'outline'"
                                      :icon="item.icon"
                                      :label="item.label"
                                      :disabled="saving || hintEditor.isPendingDeletion(hint) || cooldownOriginDisabled(hint, item.value)"
                                      @click="hint.cooldown_origin = item.value"
                                    />
                                  </u-field-group>
                                </rb-form-field>
                              </div>

                              <div class="grid gap-4" :class="{ 'sm:grid-cols-2': showBackendFunction(hint) }">
                                <rb-form-field row narrow-label :label="t('admin.common.trigger')" :tooltip="t('admin.pages.puzzle.hints.triggerDescription')">
                                  <u-input-tags v-model="hint.triggers" class="w-full font-mono" :disabled="saving || hintEditor.isPendingDeletion(hint)" />
                                </rb-form-field>

                                <rb-form-field v-if="showBackendFunction(hint)" row narrow-label :error="hintBackendWarning(hint) ? true : undefined">
                                  <template #label>
                                    {{ t('admin.pages.puzzle.hints.unlockFunction') }}
                                    <rb-tooltip :text="t('admin.pages.puzzle.hints.backendFunctionDescription')">
                                      <u-icon name="material-symbols:help-outline-rounded" class="size-4 align-middle mb-0.5 ms-1 cursor-help" :class="hintBackendWarning(hint) ? 'text-error' : 'text-secondary'" />
                                    </rb-tooltip>
                                  </template>
                                  <div class="flex flex-col gap-1">
                                    <u-input
                                      v-model="hint.backend_function"
                                      placeholder="(optional)"
                                      icon="material-symbols:function-rounded"
                                      class="w-full font-mono"
                                      :color="hintBackendWarning(hint) ? 'error' : 'neutral'"
                                      :disabled="saving || hintEditor.isPendingDeletion(hint)"
                                    />
                                    <div v-if="hintBackendWarning(hint)" class="text-xs text-error">{{ t('admin.pages.puzzle.hints.backendDisabledWarning') }}</div>
                                  </div>
                                </rb-form-field>
                              </div>
                            </div>
                          </template>
                        </u-collapsible>
                      </div>

                      <rbph-content-editor v-model="hint.content" framed :placeholder="t('admin.pages.puzzle.hints.hintContent')" :disabled="saving || hintEditor.isPendingDeletion(hint)" @save="apply" />
                    </div>
                  </div>
                </template>
              </u-collapsible>
            </div>

            <div class="rb-sticky-actions z-20 flex justify-end">
              <u-button icon="material-symbols:add-rounded" :label="t('admin.pages.puzzle.hints.createHint')" size="lg" class="shadow-lg shadow-primary/20" :disabled="loading || saving" @click="addHint" />
            </div>
          </template>
        </section>

        <u-separator class="my-2" />

        <section class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.ticket') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('admin.pages.puzzle.hints.playerRequestTicket') }}</p>
          </div>

          <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
            <rb-form-field row narrow-label :label="t('admin.common.enabledState')" :dirty="ticketEnabledDirty" :reset="resetTicketEnabled">
              <u-switch v-model="ticketEnabled" class="mt-1.5" :label="t('admin.pages.puzzle.hints.enableTicket')" :disabled="saving" />
            </rb-form-field>

            <u-separator v-if="ticketEnabled" />

            <rb-form-field v-if="ticketEnabled" row narrow-label :label="t('admin.pages.puzzle.hints.cooldown')" :dirty="ticketCooldownDirty" :reset="resetTicketCooldown">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm text-muted">{{ t('admin.pages.puzzle.hints.puzzleUnlock') }}</span>
                <rb-input-duration v-model="ticketCooldown" :max-seconds="maxCooldownSeconds" icon="material-symbols:timer-outline-rounded" variant="subtle" :disabled="saving" :aria-label="t('admin.pages.puzzle.hints.cooldown')" />
              </div>
            </rb-form-field>
          </div>
        </section>
      </u-form>
    </div>

    <aside class="hidden xl:block" />
  </div>
</template>
