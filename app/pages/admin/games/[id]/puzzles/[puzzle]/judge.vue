<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';

type JudgeRuleType = 'exact' | 'all';
type JudgeActionKey = 'fail' | 'correct' | 'milestone' | 'start_game' | 'easter_egg' | 'finish_game' | 'pending';
type PenaltyType = 1 | 2 | 3;
type CooldownPenaltyType = 'none' | 'fixed' | 'linear';
type SubmitLimitType = 'none' | 'limited';

interface RawJudgeRule {
  type?: unknown;
  text?: unknown;
  action?: unknown;
  result?: unknown;
  answer?: unknown;
}

interface JudgeRuleState {
  id: string;
  type: JudgeRuleType;
  text: string;
  action: JudgeActionKey;
  result: string;
  answer: string;
}

interface SerializedJudgeRule {
  type: JudgeRuleType;
  text?: string;
  action: JudgeActionKey;
  result?: string;
  answer?: string;
}

interface RawPenaltyRule {
  type?: unknown;
  args?: unknown;
}

interface PenaltyState {
  cooldownType: CooldownPenaltyType;
  fixedTime: number;
  linearTime: number;
  currencyId: number | null;
  currencyAmount: number;
  submitLimitType: SubmitLimitType;
  maxSubmit: number;
}

interface SerializedPenaltyRule {
  type: PenaltyType;
  args: number[];
}

interface AdminCurrencyData {
  id: number;
  name: string;
  growth: number;
  prec: number;
  max_amount: number;
}

interface RuleDropTarget {
  id: string;
  side: 'top' | 'bottom';
}

interface RuleDropEntry {
  id: string;
  index: number;
  centerY: number;
}

const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const { puzzle, refresh } = useAdmin().usePuzzleContext();
const dragAutoScroll = useDragAutoScroll({
  onScroll: () => {
    if (draggingRuleId.value) cacheRuleDropEntries();
  },
});
const currencies = ref<AdminCurrencyData[]>([]);

const state = reactive({
  rules: [] as JudgeRuleState[],
  penalty: {
    cooldownType: 'none',
    fixedTime: 0,
    linearTime: 0,
    currencyId: null,
    currencyAmount: 0,
    submitLimitType: 'none',
    maxSubmit: 0,
  } as PenaltyState,
});

const saving = ref(false);
const draggingRuleId = ref<string | null>(null);
const dragOverRule = ref<RuleDropTarget | null>(null);
const ruleOriginPlaceholderVisible = ref(false);
let nextRuleId = 0;
let ruleDropEntries: RuleDropEntry[] = [];

const ruleTypeItems = [
  { label: '精确匹配', value: 'exact', icon: 'material-symbols:match-case-rounded' },
  { label: '兜底规则', value: 'all', icon: 'material-symbols:keyboard-double-arrow-down-rounded' },
] satisfies SelectItem[];

const actionItems = [
  { label: judgeActionConsts[RbJudgeAction.Correct].name, value: 'correct', icon: judgeActionConsts[RbJudgeAction.Correct].icon },
  { label: judgeActionConsts[RbJudgeAction.Milestone].name, value: 'milestone', icon: judgeActionConsts[RbJudgeAction.Milestone].icon },
  { label: judgeActionConsts[RbJudgeAction.EasterEgg].name, value: 'easter_egg', icon: judgeActionConsts[RbJudgeAction.EasterEgg].icon },
  { label: judgeActionConsts[RbJudgeAction.StartGame].name, value: 'start_game', icon: judgeActionConsts[RbJudgeAction.StartGame].icon },
  { label: judgeActionConsts[RbJudgeAction.FinishGame].name, value: 'finish_game', icon: judgeActionConsts[RbJudgeAction.FinishGame].icon },
  { label: judgeActionConsts[RbJudgeAction.Fail].name, value: 'fail', icon: judgeActionConsts[RbJudgeAction.Fail].icon },
] satisfies SelectItem[];

const cooldownTypeItems = [
  { label: '无冷却', value: 'none', icon: 'material-symbols:timer-off-outline-rounded' },
  { label: '固定冷却', value: 'fixed', icon: 'material-symbols:timer-outline-rounded' },
  { label: '线性冷却', value: 'linear', icon: 'material-symbols:timer-play-outline-rounded' },
] satisfies SelectItem[];

const submitLimitItems = [
  { label: '不限制', value: 'none', icon: 'material-symbols:all-inclusive' },
  { label: '限制错误次数', value: 'limited', icon: 'material-symbols:pin-outline-rounded' },
] satisfies SelectItem[];

const actionValueMap: Record<JudgeActionKey, RbJudgeAction> = {
  fail: RbJudgeAction.Fail,
  correct: RbJudgeAction.Correct,
  milestone: RbJudgeAction.Milestone,
  start_game: RbJudgeAction.StartGame,
  easter_egg: RbJudgeAction.EasterEgg,
  finish_game: RbJudgeAction.FinishGame,
  pending: RbJudgeAction.Pending,
};

const currencyItems = computed<SelectItem[]>(() => [
  { label: '不扣除', value: null, icon: 'material-symbols:money-off-outline-rounded' },
  ...currencies.value.map(currency => ({
    label: currency.name,
    value: currency.id,
    icon: 'material-symbols:emoji-objects-outline-rounded',
  })),
]);
const selectedCurrency = computed(() => currencies.value.find(currency => currency.id === state.penalty.currencyId));
const selectedCooldownTypeIcon = computed(() => cooldownTypeItems.find(item => item.value === state.penalty.cooldownType)?.icon);
const selectedCurrencyIcon = computed(() => currencyItems.value.find(item => item.value === state.penalty.currencyId)?.icon);
const selectedSubmitLimitIcon = computed(() => submitLimitItems.find(item => item.value === state.penalty.submitLimitType)?.icon);

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function actionValue(value: unknown): JudgeActionKey {
  const raw = stringValue(value);
  return raw === 'pending' || actionItems.some(item => item.value === raw) ? (raw as JudgeActionKey) : 'correct';
}

function ruleTypeValue(value: unknown): JudgeRuleType {
  return value === 'all' ? 'all' : 'exact';
}

function makeRule(data: Partial<RawJudgeRule> = {}): JudgeRuleState {
  return {
    id: `judge-rule-${nextRuleId++}`,
    type: ruleTypeValue(data.type),
    text: stringValue(data.text),
    action: actionValue(data.action),
    result: stringValue(data.result),
    answer: stringValue(data.answer),
  };
}

function serializeRule(rule: Pick<JudgeRuleState, 'type' | 'text' | 'action' | 'result' | 'answer'>): SerializedJudgeRule {
  const result: SerializedJudgeRule = {
    type: rule.type,
    action: rule.action,
  };

  if (rule.type === 'exact') result.text = rule.text.trim();
  if (rule.result.trim()) result.result = rule.result.trim();
  if (rule.answer.trim()) result.answer = rule.answer.trim();

  return result;
}

function normalizeRawRule(rule: RawJudgeRule): SerializedJudgeRule {
  return serializeRule({
    type: ruleTypeValue(rule.type),
    text: stringValue(rule.text),
    action: actionValue(rule.action),
    result: stringValue(rule.result),
    answer: stringValue(rule.answer),
  });
}

function normalizeRawRules(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(item => item && typeof item === 'object').map(item => normalizeRawRule(item as RawJudgeRule));
}

function normalizeRules(value: unknown): JudgeRuleState[] {
  return normalizeRawRules(value).map(rule => makeRule(rule));
}

function serializeRules(rules: JudgeRuleState[]) {
  return rules.map(serializeRule);
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeRawPenalty(value: unknown): SerializedPenaltyRule[] {
  if (!Array.isArray(value)) return [];

  const result: SerializedPenaltyRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;

    const rule = item as RawPenaltyRule;
    const type = numberValue(rule.type);
    const args = Array.isArray(rule.args) ? rule.args.map(numberValue) : [];

    if (type === 1 || type === 2 || type === 3) {
      result.push({
        type,
        args,
      });
    }
  }

  return result;
}

function normalizePenalty(value: unknown): PenaltyState {
  const rules = normalizeRawPenalty(value);
  const fixed = rules.find(rule => rule.type === 1);
  const linear = rules.find(rule => rule.type === 2);
  const cooldown = rules.find(rule => rule.type === 1 || rule.type === 2);
  const currency = rules.find(rule => rule.type === 3);

  return {
    cooldownType: cooldown?.type === 1 ? 'fixed' : cooldown?.type === 2 ? 'linear' : 'none',
    fixedTime: fixed?.args[0] ?? 0,
    linearTime: linear?.args[0] ?? 0,
    currencyId: currency?.args[0] ?? null,
    currencyAmount: currency?.args[1] ?? 0,
    submitLimitType: puzzle.value?.max_submit === null || puzzle.value?.max_submit === undefined ? 'none' : 'limited',
    maxSubmit: puzzle.value?.max_submit ?? 0,
  };
}

function serializePenalty(penalty: PenaltyState): SerializedPenaltyRule[] {
  const result: SerializedPenaltyRule[] = [];

  if (penalty.cooldownType === 'fixed') {
    result.push({
      type: 1,
      args: [Math.max(0, Math.trunc(penalty.fixedTime || 0))],
    });
  }

  if (penalty.cooldownType === 'linear') {
    result.push({
      type: 2,
      args: [Math.max(0, Math.trunc(penalty.linearTime || 0))],
    });
  }

  if (penalty.currencyId !== null) {
    result.push({
      type: 3,
      args: [Math.max(0, Math.trunc(penalty.currencyId || 0)), Math.max(0, Math.trunc(penalty.currencyAmount || 0))],
    });
  }

  return result;
}

const judgePatch = computed(() => serializeRules(state.rules));
const originalJudge = computed(() => normalizeRawRules(puzzle.value?.judge));
const penaltyPatch = computed(() => serializePenalty(state.penalty));
const originalPenalty = computed(() => normalizeRawPenalty(puzzle.value?.penalty));
const originalPenaltyState = computed(() => normalizePenalty(puzzle.value?.penalty));
const maxSubmitPatch = computed(() => (state.penalty.submitLimitType === 'limited' ? Math.max(0, Math.trunc(state.penalty.maxSubmit || 0)) : null));
const originalMaxSubmit = computed(() => puzzle.value?.max_submit ?? null);
const judgeDirty = computed(() => JSON.stringify(judgePatch.value) !== JSON.stringify(originalJudge.value));
const penaltyDirty = computed(() => JSON.stringify(penaltyPatch.value) !== JSON.stringify(originalPenalty.value));
const maxSubmitDirty = computed(() => maxSubmitPatch.value !== originalMaxSubmit.value);
const dirty = computed(() => judgeDirty.value || penaltyDirty.value || maxSubmitDirty.value);
const invalidRules = computed(() => state.rules.filter(rule => (rule.type === 'exact' && !rule.text.trim()) || rule.action === 'pending').map(rule => rule.id));
const hasInvalidRules = computed(() => invalidRules.value.length > 0);
const penaltyInvalid = computed(
  () =>
    (state.penalty.cooldownType === 'fixed' && state.penalty.fixedTime < 0) ||
    (state.penalty.cooldownType === 'linear' && state.penalty.linearTime < 0) ||
    (state.penalty.currencyId !== null && (!selectedCurrency.value || state.penalty.currencyAmount <= 0)) ||
    (state.penalty.submitLimitType === 'limited' && state.penalty.maxSubmit < 0),
);
const cooldownPenaltyDirty = computed(
  () =>
    state.penalty.cooldownType !== originalPenaltyState.value.cooldownType ||
    (state.penalty.cooldownType === 'fixed' && Math.max(0, Math.trunc(state.penalty.fixedTime || 0)) !== originalPenaltyState.value.fixedTime) ||
    (state.penalty.cooldownType === 'linear' && Math.max(0, Math.trunc(state.penalty.linearTime || 0)) !== originalPenaltyState.value.linearTime),
);
const currencyPenaltyDirty = computed(
  () => state.penalty.currencyId !== originalPenaltyState.value.currencyId || (state.penalty.currencyId !== null && Math.max(0, Math.trunc(state.penalty.currencyAmount || 0)) !== originalPenaltyState.value.currencyAmount),
);
const submitLimitDirty = computed(() => maxSubmitDirty.value);

function syncFromPuzzle() {
  state.rules = normalizeRules(puzzle.value?.judge);
  state.penalty = normalizePenalty(puzzle.value?.penalty);
}

function reset() {
  syncFromPuzzle();
  dirtyToast.clear();
}

function resetCooldownPenalty() {
  state.penalty.cooldownType = originalPenaltyState.value.cooldownType;
  state.penalty.fixedTime = originalPenaltyState.value.fixedTime;
  state.penalty.linearTime = originalPenaltyState.value.linearTime;
}

function resetCurrencyPenalty() {
  state.penalty.currencyId = originalPenaltyState.value.currencyId;
  state.penalty.currencyAmount = originalPenaltyState.value.currencyAmount;
}

function resetSubmitLimit() {
  state.penalty.submitLimitType = originalPenaltyState.value.submitLimitType;
  state.penalty.maxSubmit = originalPenaltyState.value.maxSubmit;
}

async function fetchCurrency(gameId: number | undefined) {
  if (!gameId) {
    currencies.value = [];
    return;
  }

  try {
    type Response = { currencies: AdminCurrencyData[] };
    const response = await api.get<Response>(`/admin/games/${gameId}/currencies`, {
      errorHints: {
        [-1]: '比赛不存在。',
      },
    });
    currencies.value = response.data.currencies;
  } catch (error) {
    currencies.value = [];
    handleError(error, '获取货币列表失败');
  }
}

function addRule(type: JudgeRuleType = 'exact') {
  state.rules.push(makeRule({ type, action: type === 'all' ? 'fail' : 'correct' }));
}

function removeRule(index: number) {
  state.rules.splice(index, 1);
}

function isRuleInvalid(rule: JudgeRuleState) {
  return invalidRules.value.includes(rule.id);
}

function selectedRuleTypeIcon(type: JudgeRuleType) {
  return ruleTypeItems.find(item => item.value === type)?.icon;
}

function selectedActionIcon(action: JudgeActionKey) {
  return actionItems.find(item => item.value === action)?.icon;
}

function selectedActionColor(action: JudgeActionKey) {
  return judgeActionConsts[actionValueMap[action]].color;
}

function setRuleDragTransfer(event: DragEvent, value: string) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.dropEffect = 'move';
  event.dataTransfer.setData('text/plain', value);
}

function setDragOverRule(target: RuleDropTarget | null) {
  const current = dragOverRule.value;
  if (current?.id === target?.id && current?.side === target?.side) return;
  dragOverRule.value = target;
}

function clearRuleDragState() {
  draggingRuleId.value = null;
  dragOverRule.value = null;
  ruleOriginPlaceholderVisible.value = false;
  ruleDropEntries = [];
  window.removeEventListener('dragover', onRuleGlobalDragOver);
  window.removeEventListener('drop', onRuleGlobalDrop);
  dragAutoScroll.stop();
}

function cacheRuleDropEntries() {
  const sections = document.querySelectorAll<HTMLElement>('[data-judge-rule-card="true"]');
  ruleDropEntries = Array.from(sections)
    .map(section => {
      const id = section.dataset.ruleId ?? '';
      const index = state.rules.findIndex(rule => rule.id === id);
      const rect = section.getBoundingClientRect();
      return {
        id,
        index,
        centerY: rect.top + rect.height / 2,
      };
    })
    .filter(entry => entry.id && entry.index >= 0)
    .sort((a, b) => a.index - b.index);
}

function getRuleDropTarget(event: Pick<MouseEvent, 'clientY'>): RuleDropTarget | null {
  const sourceId = draggingRuleId.value;
  if (!sourceId) return null;
  if (ruleDropEntries.length === 0) cacheRuleDropEntries();

  if (ruleDropEntries.length === 0) return null;

  const fromIndex = state.rules.findIndex(rule => rule.id === sourceId);
  if (fromIndex < 0) return null;

  const insertIndex = ruleDropEntries.findIndex(entry => event.clientY < entry.centerY);
  const rawInsertIndex = insertIndex < 0 ? ruleDropEntries.length : insertIndex;
  if (rawInsertIndex === fromIndex || rawInsertIndex === fromIndex + 1) return null;

  if (rawInsertIndex <= 0) {
    return {
      id: ruleDropEntries[0]?.id ?? sourceId,
      side: 'top',
    };
  }

  if (rawInsertIndex >= ruleDropEntries.length) {
    return {
      id: ruleDropEntries.at(-1)?.id ?? sourceId,
      side: 'bottom',
    };
  }

  return {
    id: ruleDropEntries[rawInsertIndex]?.id ?? sourceId,
    side: 'top',
  };
}

function isOriginalRuleDropTarget(sourceId: string, targetId: string, side: RuleDropTarget['side']) {
  const fromIndex = state.rules.findIndex(rule => rule.id === sourceId);
  const targetIndex = state.rules.findIndex(rule => rule.id === targetId);
  if (fromIndex < 0 || targetIndex < 0) return false;

  const rawInsertIndex = side === 'top' ? targetIndex : targetIndex + 1;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  return insertIndex === fromIndex;
}

function isValidRuleDropSide(sourceId: string, targetId: string, side: RuleDropTarget['side']) {
  if (sourceId === targetId) return false;
  if (isOriginalRuleDropTarget(sourceId, targetId, side)) return false;
  return true;
}

function canonicalRuleDropTarget(sourceId: string, targetId: string, side: RuleDropTarget['side']): RuleDropTarget | null {
  if (!isValidRuleDropSide(sourceId, targetId, side)) return null;

  const targetIndex = state.rules.findIndex(rule => rule.id === targetId);
  if (targetIndex < 0) return null;

  const rawInsertIndex = side === 'top' ? targetIndex : targetIndex + 1;
  if (rawInsertIndex >= state.rules.length) {
    const target = state.rules.at(-1);
    return target ? { id: target.id, side: 'bottom' } : null;
  }

  const target = state.rules[rawInsertIndex];
  return target ? { id: target.id, side: 'top' } : null;
}

function ruleDropHintClass(rule: JudgeRuleState) {
  const sourceId = draggingRuleId.value;
  if (!sourceId || sourceId === rule.id) return '';

  const topTarget = canonicalRuleDropTarget(sourceId, rule.id, 'top');
  const bottomTarget = canonicalRuleDropTarget(sourceId, rule.id, 'bottom');
  const topValid = topTarget?.id === rule.id && topTarget.side === 'top';
  const bottomValid = bottomTarget?.id === rule.id && bottomTarget.side === 'bottom';
  const activeSide = dragOverRule.value?.id === rule.id ? dragOverRule.value.side : null;
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

function isOriginalRulePositionActive(rule: JudgeRuleState) {
  return ruleOriginPlaceholderVisible.value && draggingRuleId.value === rule.id && !dragOverRule.value;
}

function ruleOriginPlaceholderClass(rule: JudgeRuleState) {
  return isOriginalRulePositionActive(rule) ? 'bg-primary/10' : 'bg-muted/30';
}

function ruleOriginPlaceholderIconClass(rule: JudgeRuleState) {
  return isOriginalRulePositionActive(rule) ? 'size-10 scale-110 border-solid border-primary bg-primary/10 text-primary shadow-sm' : 'size-9 border-dashed border-primary/60 bg-primary/5 text-primary/80';
}

function isRuleOriginPlaceholderVisible(rule: JudgeRuleState) {
  return ruleOriginPlaceholderVisible.value && draggingRuleId.value === rule.id;
}

function onRuleDragStart(rule: JudgeRuleState, event: DragEvent) {
  draggingRuleId.value = rule.id;
  dragOverRule.value = null;
  ruleOriginPlaceholderVisible.value = false;
  setRuleDragTransfer(event, `judge-rule:${rule.id}`);
  dragAutoScroll.start();
  window.addEventListener('dragover', onRuleGlobalDragOver);
  window.addEventListener('drop', onRuleGlobalDrop);
  requestAnimationFrame(() => {
    if (draggingRuleId.value === rule.id) ruleOriginPlaceholderVisible.value = true;
    if (draggingRuleId.value === rule.id) cacheRuleDropEntries();
  });
}

function onRuleGlobalDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dragAutoScroll.update(event);
  if (!draggingRuleId.value) return;

  setDragOverRule(getRuleDropTarget(event));
}

function onRuleGlobalDrop(event: DragEvent) {
  if (!draggingRuleId.value) return;
  onRuleDrop(event);
}

function onRuleListDragOver(event: DragEvent) {
  onRuleGlobalDragOver(event);
}

function onRuleDragOver(event: DragEvent) {
  onRuleGlobalDragOver(event);
}

function onRuleDragLeave(ruleId: string, event: DragEvent) {
  const el = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
  if (el && event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return;

  if (!draggingRuleId.value && dragOverRule.value?.id === ruleId) setDragOverRule(null);
}

function onRuleDrop(event: DragEvent) {
  event.preventDefault();

  const sourceId = draggingRuleId.value;
  const dropTarget = dragOverRule.value ?? getRuleDropTarget(event);
  clearRuleDragState();
  if (!sourceId || !dropTarget) return;

  const fromIndex = state.rules.findIndex(item => item.id === sourceId);
  const toIndex = state.rules.findIndex(item => item.id === dropTarget.id);
  if (fromIndex < 0 || toIndex < 0) return;

  const rawInsertIndex = dropTarget.side === 'top' ? toIndex : toIndex + 1;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  if (insertIndex === fromIndex) return;

  const [moved] = state.rules.splice(fromIndex, 1);
  if (moved) state.rules.splice(insertIndex, 0, moved);
}

onBeforeUnmount(() => {
  clearRuleDragState();
});

async function apply() {
  if (!puzzle.value || !dirty.value || saving.value) return;

  if (hasInvalidRules.value) {
    toast.add({
      title: '答案判定规则不完整',
      description: '精确匹配规则需要填写匹配答案。',
      icon: 'material-symbols:error-med-outline-rounded',
      color: 'error',
    });
    return;
  }

  if (penaltyInvalid.value) {
    toast.add({
      title: '错误惩罚设置不完整',
      description: '请检查冷却时间、扣除货币和提交次数限制。',
      icon: 'material-symbols:error-med-outline-rounded',
      color: 'error',
    });
    return;
  }

  saving.value = true;

  try {
    type Response = { puzzle: AdminPuzzleData };
    const body: {
      judge?: SerializedJudgeRule[];
      penalty?: SerializedPenaltyRule[];
      max_submit?: number | null;
    } = {};

    if (judgeDirty.value) body.judge = judgePatch.value;
    if (penaltyDirty.value) body.penalty = penaltyPatch.value;
    if (maxSubmitDirty.value) body.max_submit = maxSubmitPatch.value;

    const response = await api.patch<Response>(`/admin/puzzles/${puzzle.value.id}`, body, {
      errorHints: {
        [-2]: '答案判定规则不合法。',
        [-1]: '谜题不存在。',
      },
    });

    puzzle.value = response.data.puzzle;
    syncFromPuzzle();
    dirtyToast.clear();
    await refresh();

    toast.add({
      title: '答案判定设置已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '保存答案判定设置失败');
  } finally {
    saving.value = false;
  }
}

watch(
  () => puzzle.value?.id,
  () => {
    syncFromPuzzle();
    dirtyToast.clear();
  },
  { immediate: true },
);

watch(
  () => puzzle.value?.game_id,
  gameId => {
    fetchCurrency(gameId);
  },
  { immediate: true },
);

watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '答案判定设置修改尚未保存。',
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

    <u-form :state="state" class="min-w-0 space-y-4" @submit.prevent="apply">
      <div>
        <div>
          <h2 class="text-xl font-semibold text-highlighted">评测规则</h2>
          <p class="mt-1 text-sm text-muted">规则按顺序匹配，提交的答案会自动完成规范化。</p>
        </div>
      </div>

      <section class="relative">
        <template v-if="state.rules.length">
          <div class="space-y-3 pb-3" @dragover="onRuleListDragOver" @drop="onRuleDrop">
            <div
              v-for="(rule, index) in state.rules"
              :key="rule.id"
              data-judge-rule-card="true"
              :data-rule-id="rule.id"
              class="relative rounded-lg bg-elevated/60 p-4 ring ring-default"
              :class="[isRuleInvalid(rule) ? 'ring-error/60' : undefined, ruleDropHintClass(rule)]"
              @dragover="onRuleDragOver"
              @dragleave="onRuleDragLeave(rule.id, $event)"
              @drop="onRuleDrop"
            >
              <div v-if="isRuleOriginPlaceholderVisible(rule)" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg transition" :class="ruleOriginPlaceholderClass(rule)">
                <div class="flex items-center justify-center rounded-full border-2 transition-all duration-100" :class="ruleOriginPlaceholderIconClass(rule)">
                  <u-icon name="material-symbols:drag-pan-rounded" class="size-5" />
                </div>
              </div>

              <div class="flex items-center justify-between gap-3">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <u-badge color="neutral" variant="soft"> #{{ index + 1 }} </u-badge>
                </div>

                <div class="flex items-center gap-1">
                  <u-button
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="material-symbols:drag-indicator"
                    class="cursor-grab active:cursor-grabbing"
                    aria-label="拖动排序"
                    draggable="true"
                    :disabled="saving"
                    @dragstart.stop="onRuleDragStart(rule, $event)"
                    @dragend="clearRuleDragState"
                  />
                  <u-button color="error" variant="ghost" size="sm" icon="material-symbols:delete-outline-rounded" :disabled="saving" @click="removeRule(index)" />
                </div>
              </div>

              <div class="mt-3 space-y-3">
                <div class="grid gap-2 sm:grid-cols-[5rem_10rem_minmax(0,1fr)] sm:items-center">
                  <div class="text-sm font-medium text-muted">匹配方式</div>
                  <u-select v-model="rule.type" :items="ruleTypeItems" :leading-icon="selectedRuleTypeIcon(rule.type)" color="neutral" variant="subtle" class="w-full" :disabled="saving" />
                  <u-form-field :error="isRuleInvalid(rule) ? '必须填写匹配答案' : undefined">
                    <u-input v-if="rule.type === 'exact'" v-model="rule.text" placeholder="匹配内容，例如 ORME SHOE" class="w-full font-mono" :disabled="saving" />
                    <u-input v-else model-value="任意答案" class="w-full" disabled />
                  </u-form-field>
                </div>

                <div class="grid gap-2 lg:grid-cols-[5rem_10rem_minmax(0,1fr)_minmax(0,14rem)] lg:items-center">
                  <div class="text-sm font-medium text-muted">匹配正确时</div>
                  <u-select v-model="rule.action" :items="actionItems" :leading-icon="selectedActionIcon(rule.action)" :color="selectedActionColor(rule.action)" variant="subtle" class="w-full" :disabled="saving" />
                  <u-input v-model="rule.result" placeholder="返回提示，留空则使用默认提示" class="w-full" :disabled="saving" />
                  <u-input v-model="rule.answer" placeholder="记录答案，可选" class="w-full font-mono" :disabled="saving" />
                </div>
              </div>
            </div>
          </div>
          <div class="sticky bottom-4 z-20 flex justify-end">
            <u-button icon="material-symbols:add-rounded" label="添加规则" size="lg" class="shadow-lg shadow-primary/20" :disabled="saving" @click="addRule()" />
          </div>
        </template>

        <u-empty v-else icon="material-symbols:rule-settings-rounded" title="还没有判定规则" description="没有规则时所有提交都会判为错误。">
          <template #actions>
            <u-button icon="material-symbols:add-rounded" label="添加精确匹配" :disabled="saving" @click="addRule('exact')" />
            <u-button color="neutral" variant="soft" icon="material-symbols:keyboard-double-arrow-down-rounded" label="添加兜底规则" :disabled="saving" @click="addRule('all')" />
          </template>
        </u-empty>
      </section>

      <u-separator class="my-6" />

      <section class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-highlighted">错误惩罚</h3>
          <p class="mt-1 text-sm text-muted">在评测结果为回答错误时将生效惩罚，多种惩罚可以同时生效。</p>
        </div>

        <div class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
          <rb-form-field row label="冷却惩罚" :dirty="cooldownPenaltyDirty" :reset="resetCooldownPenalty">
            <div class="flex flex-wrap items-center gap-2">
              <u-select v-model="state.penalty.cooldownType" :items="cooldownTypeItems" :leading-icon="selectedCooldownTypeIcon" variant="subtle" class="w-40" :disabled="saving" />
              <u-input-number
                v-if="state.penalty.cooldownType === 'fixed'"
                v-model="state.penalty.fixedTime"
                :min="0"
                :step="10"
                :step-snapping="false"
                orientation="vertical"
                :format-options="{ style: 'unit', unit: 'second' }"
                variant="subtle"
                class="w-36"
                :disabled="saving"
              />
              <template v-else-if="state.penalty.cooldownType === 'linear'">
                <u-input-number v-model="state.penalty.linearTime" :min="0" :step="10" :step-snapping="false" orientation="vertical" :format-options="{ style: 'unit', unit: 'second' }" variant="subtle" class="w-36" :disabled="saving" />
                <span class="text-sm text-muted">乘以累计错误次数</span>
              </template>
            </div>
          </rb-form-field>

          <u-separator />

          <rb-form-field row label="扣除货币" :dirty="currencyPenaltyDirty" :reset="resetCurrencyPenalty">
            <div class="flex flex-wrap items-center gap-2">
              <u-select v-model="state.penalty.currencyId" :items="currencyItems" :leading-icon="selectedCurrencyIcon" placeholder="选择货币" variant="subtle" class="w-40" :disabled="saving" />
              <rb-input-number
                v-if="state.penalty.currencyId !== null"
                v-model="state.penalty.currencyAmount"
                :prec="selectedCurrency?.prec ?? 0"
                :min="1"
                :step="1"
                orientation="vertical"
                placeholder="扣除数量"
                variant="subtle"
                class="w-36"
                :disabled="saving || !selectedCurrency"
              />
            </div>
          </rb-form-field>

          <u-separator />

          <rb-form-field row label="提交次数" :dirty="submitLimitDirty" :reset="resetSubmitLimit">
            <div class="flex flex-wrap items-center gap-2">
              <u-select v-model="state.penalty.submitLimitType" :items="submitLimitItems" :leading-icon="selectedSubmitLimitIcon" variant="subtle" class="w-40" :disabled="saving" />
              <u-input-number v-if="state.penalty.submitLimitType === 'limited'" v-model="state.penalty.maxSubmit" :min="0" :step="1" orientation="vertical" trailing="次" variant="subtle" class="w-36" :disabled="saving" />
            </div>
          </rb-form-field>
        </div>
      </section>
    </u-form>

    <aside class="hidden xl:block" />
  </div>
</template>
