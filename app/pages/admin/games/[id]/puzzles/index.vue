<script setup lang="ts">
interface AdminRound {
  id: number;
  slug?: string | null;
  title: string;
  content: string;
  content_type: number;
  cover?: string | null;
  game_id: number;
  puzzle?: number | null;
  sort: number;
}

interface AdminPuzzle {
  id: number;
  game_id: number;
  slug?: string | null;
  title: string;
  ptype: number;
  content: string;
  content_type: number;
  judge: unknown;
  penalty: unknown;
  max_submit?: number | null;
  unlock_cond: string;
  round_id: number;
  sort: number;
  ticket_enabled: boolean;
  ticket_cooldown: number;
  ctime_at: string;
}

interface RoundGroup {
  round: AdminRound;
  puzzles: AdminPuzzle[];
}

interface SortPatch {
  id: number;
  sort: number;
}

interface PuzzlePositionPatch extends SortPatch {
  round_id: number;
}

interface DraggingPuzzle {
  id: number;
  roundId: number;
}

interface PuzzleDropTarget {
  id: number;
  side: 'left' | 'right';
}

interface RoundDropTarget {
  id: number;
  side: 'top' | 'bottom';
}

interface RoundDropEntry {
  id: number;
  index: number;
  centerY: number;
}

interface PuzzleDropEntry {
  id: number;
  roundId: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface PuzzleDropCandidate {
  target?: PuzzleDropTarget;
  emptyRoundId?: number;
  score: number;
}

const route = useRoute();
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const dragAutoScroll = useDragAutoScroll({
  onScroll: () => {
    if (draggingRoundId.value) cacheRoundDropEntries();
    if (draggingPuzzle.value) cachePuzzleDropEntries();
  },
});

const loading = ref(false);
const applyLoading = ref(false);
const rounds = ref<AdminRound[]>([]);
const puzzles = ref<AdminPuzzle[]>([]);
const originalRounds = ref<AdminRound[]>([]);
const originalPuzzles = ref<AdminPuzzle[]>([]);
const deletingRoundIds = ref<Set<number>>(new Set());
const draggingRoundId = ref<number | null>(null);
const draggingPuzzle = ref<DraggingPuzzle | null>(null);
const dragOverPuzzle = ref<PuzzleDropTarget | null>(null);
const dragOverRound = ref<RoundDropTarget | null>(null);
const dragOverEmptyRoundId = ref<number | null>(null);
const roundOriginPlaceholderVisible = ref(false);
const puzzleOriginPlaceholderVisible = ref(false);
const creatingRoundId = ref<number | null>(null);
let roundDropEntries: RoundDropEntry[] = [];
let puzzleDropEntries: PuzzleDropEntry[] = [];

const gameId = computed(() => Number(route.params.id));

const groupedRounds = computed<RoundGroup[]>(() => {
  const byRound = new Map<number, AdminPuzzle[]>();

  for (const puzzle of puzzles.value) {
    const list = byRound.get(puzzle.round_id) ?? [];
    list.push(puzzle);
    byRound.set(puzzle.round_id, list);
  }

  return rounds.value.map(round => ({
    round,
    puzzles: orderRoundPuzzles(byRound.get(round.id) ?? [], round),
  }));
});

function sortBySortId<T extends { id: number; sort: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sort - b.sort || a.id - b.id);
}

function cloneRounds(items: AdminRound[]) {
  return items.map(item => ({ ...item }));
}

function clonePuzzles(items: AdminPuzzle[]) {
  return items.map(item => ({ ...item }));
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return items;
  next.splice(toIndex, 0, item);
  return next;
}

function reindexSort<T extends { sort: number }>(items: T[]) {
  return items.map((item, index) => ({
    ...item,
    sort: index,
  }));
}

function isRoundDeleting(roundId: number) {
  return deletingRoundIds.value.has(roundId);
}

function isRoundPuzzle(puzzle: AdminPuzzle, roundId: number = puzzle.round_id) {
  return rounds.value.find(round => round.id === roundId)?.puzzle === puzzle.id;
}

function hasAnyPuzzle(roundId: number) {
  return puzzles.value.some(puzzle => puzzle.round_id === roundId);
}

function orderRoundPuzzles(items: AdminPuzzle[], round: AdminRound) {
  const roundPuzzle = items.find(puzzle => puzzle.id === round.puzzle);
  const rest = items.filter(puzzle => puzzle.id !== round.puzzle);
  return roundPuzzle ? [roundPuzzle, ...rest] : rest;
}

function orderAllPuzzles(items: AdminPuzzle[]) {
  const byRound = new Map<number, AdminPuzzle[]>();

  for (const puzzle of items) {
    const list = byRound.get(puzzle.round_id) ?? [];
    list.push(puzzle);
    byRound.set(puzzle.round_id, list);
  }

  const ordered: AdminPuzzle[] = [];
  for (const round of rounds.value) {
    ordered.push(...orderRoundPuzzles(byRound.get(round.id) ?? [], round));
    byRound.delete(round.id);
  }
  for (const rest of byRound.values()) ordered.push(...rest);

  return ordered;
}

function getRoundPuzzles(roundId: number) {
  const round = rounds.value.find(item => item.id === roundId);
  const items = puzzles.value.filter(puzzle => puzzle.round_id === roundId);
  return round ? orderRoundPuzzles(items, round) : items;
}

function reindexMovablePuzzles(items: AdminPuzzle[], roundId: number) {
  let sort = 0;
  return items.map(puzzle => {
    if (isRoundPuzzle(puzzle, roundId)) return puzzle;

    const next = {
      ...puzzle,
      sort,
    };
    sort += 1;
    return next;
  });
}

function idsEqual(left: number[], right: number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function roundOrder(items: AdminRound[]) {
  return items.map(round => round.id);
}

function replaceRoundPuzzles(updates: Map<number, AdminPuzzle[]>) {
  const updatedRoundIds = new Set(updates.keys());
  const next: AdminPuzzle[] = [];

  for (const round of rounds.value) {
    if (updates.has(round.id)) {
      next.push(...(updates.get(round.id) ?? []));
    } else {
      next.push(...puzzles.value.filter(puzzle => puzzle.round_id === round.id));
    }
  }

  next.push(...puzzles.value.filter(puzzle => !updatedRoundIds.has(puzzle.round_id) && !rounds.value.some(round => round.id === puzzle.round_id)));
  puzzles.value = next;
}

const changedRoundSortPatches = computed<SortPatch[]>(() => {
  const activeRounds = rounds.value.filter(round => !isRoundDeleting(round.id));
  const originalActiveRounds = originalRounds.value.filter(round => !deletingRoundIds.value.has(round.id));

  if (idsEqual(roundOrder(activeRounds), roundOrder(originalActiveRounds))) return [];
  return activeRounds.map((round, index) => ({
    id: round.id,
    sort: index,
  }));
});

const pendingDeletedRoundIds = computed(() => [...deletingRoundIds.value]);

const hasDeleteChanges = computed(() => pendingDeletedRoundIds.value.length > 0);

const changedPuzzlePatches = computed<PuzzlePositionPatch[]>(() => {
  const originalById = new Map(originalPuzzles.value.map(puzzle => [puzzle.id, puzzle]));

  return puzzles.value
    .filter(puzzle => {
      if (isRoundPuzzle(puzzle)) return false;

      const original = originalById.get(puzzle.id);
      return !original || original.sort !== puzzle.sort || original.round_id !== puzzle.round_id;
    })
    .map(puzzle => ({
      id: puzzle.id,
      sort: puzzle.sort,
      round_id: puzzle.round_id,
    }));
});

const hasSortChanges = computed(() => changedRoundSortPatches.value.length > 0 || changedPuzzlePatches.value.length > 0);
const hasChanges = computed(() => hasSortChanges.value || hasDeleteChanges.value);

function syncDirtyToast() {
  if (!hasChanges.value) {
    dirtyToast.clear();
    return;
  }

  dirtyToast.show({
    guardOnLeave: true,
    apply: applyChanges,
    reset: resetChanges,
  });
}

function resetChanges() {
  rounds.value = cloneRounds(originalRounds.value);
  puzzles.value = clonePuzzles(originalPuzzles.value);
  deletingRoundIds.value = new Set();
  dirtyToast.clear();
}

async function applyChanges() {
  if (applyLoading.value) return;

  const roundPatches = changedRoundSortPatches.value;
  const puzzlePatches = changedPuzzlePatches.value;
  const deletedRoundIds = [...deletingRoundIds.value];
  if (roundPatches.length === 0 && puzzlePatches.length === 0 && deletedRoundIds.length === 0) {
    dirtyToast.clear();
    return;
  }

  applyLoading.value = true;

  try {
    await Promise.all([
      ...roundPatches.map(patch =>
        api.patch<unknown, Pick<SortPatch, 'sort'>>(
          `/admin/rounds/${patch.id}`,
          { sort: patch.sort },
          {
            errorHints: {
              [-2]: '区域信息不合法。',
              [-1]: '区域不存在。',
            },
          },
        ),
      ),
      ...puzzlePatches.map(patch =>
        api.patch<unknown, Pick<PuzzlePositionPatch, 'sort' | 'round_id'>>(
          `/admin/puzzles/${patch.id}`,
          { sort: patch.sort, round_id: patch.round_id },
          {
            errorHints: {
              [-2]: '谜题信息不合法。',
              [-1]: '谜题不存在。',
            },
          },
        ),
      ),
      ...deletedRoundIds.map(roundId =>
        api.del(`/admin/rounds/${roundId}`, {
          errorHints: {
            [-1]: '区域不存在。',
          },
        }),
      ),
    ]);

    dirtyToast.clear();
    toast.add({
      title: deletedRoundIds.length > 0 ? '修改已保存' : '排序已保存',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    await fetchData();
  } catch (error) {
    handleError(error, '保存排序失败', true);
  } finally {
    applyLoading.value = false;
  }
}

function setDragTransfer(event: DragEvent, value: string) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.dropEffect = 'move';
  event.dataTransfer.setData('text/plain', value);
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dragAutoScroll.update(event);
}

function setDragOverRound(target: RoundDropTarget | null) {
  const current = dragOverRound.value;
  if (current?.id === target?.id && current?.side === target?.side) return;
  dragOverRound.value = target;
}

function setDragOverPuzzle(target: PuzzleDropTarget | null) {
  const current = dragOverPuzzle.value;
  if (current?.id === target?.id && current?.side === target?.side) return;
  dragOverPuzzle.value = target;
}

function setDragOverEmptyRound(roundId: number | null) {
  if (dragOverEmptyRoundId.value === roundId) return;
  dragOverEmptyRoundId.value = roundId;
}

function cacheRoundDropEntries() {
  const sections = document.querySelectorAll<HTMLElement>('[data-round-section="true"]');
  roundDropEntries = Array.from(sections)
    .map(section => {
      const id = Number(section.dataset.roundId);
      const index = rounds.value.findIndex(round => round.id === id);
      const rect = section.getBoundingClientRect();
      return {
        id,
        index,
        centerY: rect.top + rect.height / 2,
      };
    })
    .filter(entry => Number.isFinite(entry.id) && entry.index >= 0)
    .sort((a, b) => a.index - b.index);
}

function cachePuzzleDropEntries() {
  const cards = document.querySelectorAll<HTMLElement>('[data-puzzle-card-drop="true"]');
  puzzleDropEntries = Array.from(cards)
    .map(card => {
      const id = Number(card.dataset.puzzleId);
      const roundId = Number(card.dataset.roundId);
      const rect = card.getBoundingClientRect();
      return {
        id,
        roundId,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    })
    .filter(entry => Number.isFinite(entry.id) && Number.isFinite(entry.roundId));
}

function clearDragState() {
  draggingRoundId.value = null;
  draggingPuzzle.value = null;
  dragOverPuzzle.value = null;
  dragOverRound.value = null;
  dragOverEmptyRoundId.value = null;
  roundOriginPlaceholderVisible.value = false;
  puzzleOriginPlaceholderVisible.value = false;
  roundDropEntries = [];
  puzzleDropEntries = [];
  window.removeEventListener('dragover', onGlobalDragOver);
  window.removeEventListener('drop', onGlobalDrop);
  dragAutoScroll.stop();
}

function onRoundDragStart(roundId: number, event: DragEvent) {
  draggingRoundId.value = roundId;
  draggingPuzzle.value = null;
  dragOverRound.value = null;
  roundOriginPlaceholderVisible.value = false;
  setDragTransfer(event, `round:${roundId}`);
  dragAutoScroll.start();
  window.addEventListener('dragover', onGlobalDragOver);
  window.addEventListener('drop', onGlobalDrop);
  requestAnimationFrame(() => {
    if (draggingRoundId.value === roundId) roundOriginPlaceholderVisible.value = true;
    if (draggingRoundId.value === roundId) cacheRoundDropEntries();
  });
}

function onRoundDrop(event: DragEvent) {
  event.preventDefault();

  const sourceRoundId = draggingRoundId.value;
  const currentDropTarget = dragOverRound.value ?? getRoundDropTarget(event);
  clearDragState();
  if (!sourceRoundId || !currentDropTarget || sourceRoundId === currentDropTarget.id) return;

  const fromIndex = rounds.value.findIndex(round => round.id === sourceRoundId);
  const toIndex = rounds.value.findIndex(round => round.id === currentDropTarget.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const side = currentDropTarget.side;
  const rawInsertIndex = side === 'top' ? toIndex : toIndex + 1;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  if (insertIndex === fromIndex) return;

  rounds.value = reindexSort(reorderList(rounds.value, fromIndex, insertIndex));
  syncDirtyToast();
}

function onRoundSectionDrop(_targetRoundId: number, event: DragEvent) {
  if (draggingPuzzle.value) {
    onPuzzleDrop(event);
    return;
  }

  onRoundDrop(event);
}

function onRoundSectionDragOver(group: RoundGroup, event: DragEvent) {
  onDragOver(event);
  if (draggingRoundId.value) {
    const target = getRoundDropTarget(event);
    setDragOverRound(target && isValidRoundDropSide(draggingRoundId.value, target.id, target.side) ? target : null);
    return;
  }

  if (!draggingPuzzle.value) return;

  if (isRoundDeleting(group.round.id)) {
    setDragOverEmptyRound(null);
    setDragOverPuzzle(null);
    return;
  }

  const target = getPuzzleDropTargetByPosition(event);
  setDragOverEmptyRound(target?.emptyRoundId ?? null);
  setDragOverPuzzle(target?.target ?? null);
}

function onGlobalDragOver(event: DragEvent) {
  if (!draggingRoundId.value && !draggingPuzzle.value) return;

  onDragOver(event);

  if (draggingRoundId.value) {
    const target = getRoundDropTarget(event);
    setDragOverRound(target && isValidRoundDropSide(draggingRoundId.value, target.id, target.side) ? target : null);
    return;
  }

  if (draggingPuzzle.value) {
    const target = getPuzzleDropTargetByPosition(event);
    const emptyRoundId = target?.emptyRoundId ?? null;
    setDragOverEmptyRound(emptyRoundId !== null && isRoundDeleting(emptyRoundId) ? null : emptyRoundId);
    setDragOverPuzzle(target?.target ?? null);
  }
}

function onGlobalDrop(event: DragEvent) {
  if (draggingRoundId.value) {
    onRoundDrop(event);
    return;
  }

  if (draggingPuzzle.value) {
    onPuzzleDrop(event);
  }
}

function onRoundSectionDragLeave(roundId: number, event: DragEvent) {
  const el = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
  if (el && event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return;

  if (!draggingRoundId.value && dragOverRound.value?.id === roundId) setDragOverRound(null);
  if (!draggingPuzzle.value && dragOverEmptyRoundId.value === roundId) setDragOverEmptyRound(null);
}

function getRoundDropTarget(event: Pick<MouseEvent, 'clientY'>): RoundDropTarget | null {
  const sourceRoundId = draggingRoundId.value;
  if (!sourceRoundId) return null;
  if (roundDropEntries.length === 0) cacheRoundDropEntries();

  if (roundDropEntries.length === 0) return null;

  const fromIndex = rounds.value.findIndex(round => round.id === sourceRoundId);
  if (fromIndex < 0) return null;

  const insertIndex = roundDropEntries.findIndex(entry => event.clientY < entry.centerY);
  const rawInsertIndex = insertIndex < 0 ? roundDropEntries.length : insertIndex;
  if (rawInsertIndex === fromIndex || rawInsertIndex === fromIndex + 1) return null;

  if (rawInsertIndex <= 0) {
    return {
      id: roundDropEntries[0]?.id ?? sourceRoundId,
      side: 'top',
    };
  }

  if (rawInsertIndex >= roundDropEntries.length) {
    return {
      id: roundDropEntries.at(-1)?.id ?? sourceRoundId,
      side: 'bottom',
    };
  }

  return {
    id: roundDropEntries[rawInsertIndex]?.id ?? sourceRoundId,
    side: 'top',
  };
}

function isOriginalRoundDropTarget(sourceRoundId: number, targetRoundId: number, side: RoundDropTarget['side']) {
  const fromIndex = rounds.value.findIndex(round => round.id === sourceRoundId);
  const targetIndex = rounds.value.findIndex(round => round.id === targetRoundId);
  if (fromIndex < 0 || targetIndex < 0) return false;

  const rawInsertIndex = side === 'top' ? targetIndex : targetIndex + 1;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  return insertIndex === fromIndex;
}

function isValidRoundDropSide(sourceRoundId: number, targetRoundId: number, side: RoundDropTarget['side']) {
  if (sourceRoundId === targetRoundId) return false;
  if (isOriginalRoundDropTarget(sourceRoundId, targetRoundId, side)) return false;
  return true;
}

function canonicalRoundDropTarget(sourceRoundId: number, targetRoundId: number, side: RoundDropTarget['side']): RoundDropTarget | null {
  if (!isValidRoundDropSide(sourceRoundId, targetRoundId, side)) return null;

  const targetIndex = rounds.value.findIndex(round => round.id === targetRoundId);
  if (targetIndex < 0) return null;

  const rawInsertIndex = side === 'top' ? targetIndex : targetIndex + 1;
  if (rawInsertIndex >= rounds.value.length) {
    const target = rounds.value.at(-1);
    return target
      ? {
          id: target.id,
          side: 'bottom',
        }
      : null;
  }

  const target = rounds.value[rawInsertIndex];
  return target
    ? {
        id: target.id,
        side: 'top',
      }
    : null;
}

function roundDropHintClass(round: AdminRound) {
  const sourceRoundId = draggingRoundId.value;
  if (!sourceRoundId || sourceRoundId === round.id) return '';

  const topTarget = canonicalRoundDropTarget(sourceRoundId, round.id, 'top');
  const bottomTarget = canonicalRoundDropTarget(sourceRoundId, round.id, 'bottom');
  const topValid = topTarget?.id === round.id && topTarget.side === 'top';
  const bottomValid = bottomTarget?.id === round.id && bottomTarget.side === 'bottom';
  const activeSide = dragOverRound.value?.id === round.id ? dragOverRound.value.side : null;
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

function isOriginalRoundPositionActive(round: AdminRound) {
  return roundOriginPlaceholderVisible.value && draggingRoundId.value === round.id && !dragOverRound.value;
}

function roundOriginPlaceholderClass(round: AdminRound) {
  return isOriginalRoundPositionActive(round) ? 'bg-primary/10' : 'bg-muted/30';
}

function roundOriginPlaceholderIconClass(round: AdminRound) {
  return isOriginalRoundPositionActive(round) ? 'size-10 scale-110 border-solid border-primary bg-primary/10 text-primary shadow-sm' : 'size-9 border-dashed border-primary/60 bg-primary/5 text-primary/80';
}

function isRoundOriginPlaceholderVisible(round: AdminRound) {
  return roundOriginPlaceholderVisible.value && draggingRoundId.value === round.id;
}

function onPuzzleDragStart(puzzle: AdminPuzzle, event: DragEvent) {
  if (isRoundPuzzle(puzzle)) return;

  draggingPuzzle.value = {
    id: puzzle.id,
    roundId: puzzle.round_id,
  };
  draggingRoundId.value = null;
  puzzleOriginPlaceholderVisible.value = false;
  setDragTransfer(event, `puzzle:${puzzle.id}`);
  dragAutoScroll.start();
  window.addEventListener('dragover', onGlobalDragOver);
  window.addEventListener('drop', onGlobalDrop);
  requestAnimationFrame(() => {
    if (draggingPuzzle.value?.id === puzzle.id) puzzleOriginPlaceholderVisible.value = true;
    if (draggingPuzzle.value?.id === puzzle.id) cachePuzzleDropEntries();
  });
}

function onPuzzleDragOver(puzzle: AdminPuzzle, event: DragEvent) {
  if (draggingRoundId.value) return;

  onDragOver(event);
  event.stopPropagation();
  if (!draggingPuzzle.value) {
    setDragOverPuzzle(null);
    return;
  }

  setDragOverEmptyRound(null);
  const target = getPuzzleDropTargetByPosition(event) ?? getPuzzleDropTargetFromPuzzle(puzzle, event);
  const emptyRoundId = target?.emptyRoundId ?? null;
  setDragOverEmptyRound(emptyRoundId !== null && isRoundDeleting(emptyRoundId) ? null : emptyRoundId);
  setDragOverPuzzle(target?.target ?? null);
}

function onPuzzleDragLeave(puzzleId: number, event: DragEvent) {
  if (draggingRoundId.value) return;

  event.stopPropagation();
  if (dragOverPuzzle.value?.id === puzzleId) setDragOverPuzzle(null);
}

function getPuzzleDropSide(puzzle: AdminPuzzle, event: DragEvent): PuzzleDropTarget['side'] {
  if (isRoundPuzzle(puzzle)) return 'right';

  const el = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
  if (!el) return 'left';

  const rect = el.getBoundingClientRect();
  return event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
}

function getInsertIndex(targetIndex: number, side: PuzzleDropTarget['side']) {
  return side === 'left' ? targetIndex : targetIndex + 1;
}

function getRawPuzzleInsertIndex(targetPuzzle: AdminPuzzle, side: PuzzleDropTarget['side'], roundId: number) {
  const roundPuzzles = getRoundPuzzles(roundId);
  const targetIndex = roundPuzzles.findIndex(puzzle => puzzle.id === targetPuzzle.id);
  if (targetIndex < 0) return undefined;

  return isRoundPuzzle(targetPuzzle, roundId) ? targetIndex + 1 : getInsertIndex(targetIndex, side);
}

function isOriginalDropTarget(source: DraggingPuzzle, targetPuzzle: AdminPuzzle, side: PuzzleDropTarget['side'], roundId: number) {
  if (source.roundId !== roundId) return false;

  const roundPuzzles = getRoundPuzzles(roundId);
  const fromIndex = roundPuzzles.findIndex(puzzle => puzzle.id === source.id);
  const targetIndex = roundPuzzles.findIndex(puzzle => puzzle.id === targetPuzzle.id);
  if (fromIndex < 0 || targetIndex < 0) return false;

  const rawInsertIndex = getRawPuzzleInsertIndex(targetPuzzle, side, roundId);
  if (rawInsertIndex === undefined) return false;
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  return insertIndex === fromIndex;
}

function isValidPuzzleDropSide(source: DraggingPuzzle, targetPuzzle: AdminPuzzle, side: PuzzleDropTarget['side'], roundId: number) {
  if (source.id === targetPuzzle.id) return false;
  if (isRoundPuzzle(targetPuzzle, roundId) && side === 'left') return false;
  if (isOriginalDropTarget(source, targetPuzzle, side, roundId)) return false;
  return true;
}

function canonicalPuzzleDropTarget(source: DraggingPuzzle, targetPuzzle: AdminPuzzle, side: PuzzleDropTarget['side'], roundId: number): PuzzleDropTarget | null {
  if (!isValidPuzzleDropSide(source, targetPuzzle, side, roundId)) return null;

  const roundPuzzles = getRoundPuzzles(roundId);
  const rawInsertIndex = getRawPuzzleInsertIndex(targetPuzzle, side, roundId);
  if (rawInsertIndex === undefined) return null;

  if (rawInsertIndex >= roundPuzzles.length) {
    const target = roundPuzzles.at(-1);
    return target
      ? {
          id: target.id,
          side: 'right',
        }
      : null;
  }

  const target = roundPuzzles[rawInsertIndex];
  if (!target || isRoundPuzzle(target, roundId)) return null;

  return {
    id: target.id,
    side: 'left',
  };
}

function distanceToRect(clientX: number, clientY: number, rect: Pick<PuzzleDropEntry, 'left' | 'right' | 'top' | 'bottom'>) {
  const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
  const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

function candidateFromPuzzleEntry(entry: PuzzleDropEntry, event: Pick<MouseEvent, 'clientX' | 'clientY'>): PuzzleDropCandidate | null {
  const source = draggingPuzzle.value;
  if (!source || source.id === entry.id) return null;

  const targetPuzzle = puzzles.value.find(puzzle => puzzle.id === entry.id);
  if (!targetPuzzle) return null;

  const midpoint = (entry.left + entry.right) / 2;
  const rawSide: PuzzleDropTarget['side'] = isRoundPuzzle(targetPuzzle, entry.roundId) ? 'right' : event.clientX < midpoint ? 'left' : 'right';
  const target = canonicalPuzzleDropTarget(source, targetPuzzle, rawSide, entry.roundId);
  if (!target) return null;

  const edgeX = rawSide === 'left' ? entry.left : entry.right;
  const verticalDistance = event.clientY < entry.top ? entry.top - event.clientY : event.clientY > entry.bottom ? event.clientY - entry.bottom : 0;
  const score = Math.hypot(event.clientX - edgeX, verticalDistance);

  return {
    target,
    score,
  };
}

function candidateFromEmptyRound(round: AdminRound, event: Pick<MouseEvent, 'clientX' | 'clientY'>): PuzzleDropCandidate | null {
  const source = draggingPuzzle.value;
  if (!source || source.roundId === round.id) return null;
  if (isRoundDeleting(round.id)) return null;
  if (getRoundPuzzles(round.id).filter(puzzle => puzzle.id !== source.id).length > 0) return null;

  const section = document.querySelector<HTMLElement>(`[data-round-section="true"][data-round-id="${round.id}"]`);
  if (!section) return null;

  const rect = section.getBoundingClientRect();
  return {
    emptyRoundId: round.id,
    score: distanceToRect(event.clientX, event.clientY, {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    }),
  };
}

function getPuzzleDropTargetByPosition(event: Pick<MouseEvent, 'clientX' | 'clientY'>): PuzzleDropCandidate | null {
  if (!draggingPuzzle.value) return null;
  if (puzzleDropEntries.length === 0) cachePuzzleDropEntries();

  const candidates: PuzzleDropCandidate[] = [];
  for (const entry of puzzleDropEntries) {
    const candidate = candidateFromPuzzleEntry(entry, event);
    if (candidate) candidates.push(candidate);
  }

  for (const round of rounds.value) {
    const candidate = candidateFromEmptyRound(round, event);
    if (candidate) candidates.push(candidate);
  }

  return candidates.sort((a, b) => a.score - b.score)[0] ?? null;
}

function getPuzzleDropTargetFromPuzzle(puzzle: AdminPuzzle, event: DragEvent): PuzzleDropCandidate | null {
  const source = draggingPuzzle.value;
  if (!source) return null;
  const target = canonicalPuzzleDropTarget(source, puzzle, getPuzzleDropSide(puzzle, event), puzzle.round_id);
  return target
    ? {
        target,
        score: 0,
      }
    : null;
}

function isOriginalPositionActive(puzzle: AdminPuzzle) {
  return puzzleOriginPlaceholderVisible.value && draggingPuzzle.value?.id === puzzle.id && !dragOverPuzzle.value;
}

function originPlaceholderClass(puzzle: AdminPuzzle) {
  return isOriginalPositionActive(puzzle) ? 'bg-primary/10' : 'bg-muted/30';
}

function originPlaceholderIconClass(puzzle: AdminPuzzle) {
  return isOriginalPositionActive(puzzle) ? 'size-10 scale-110 border-solid border-primary bg-primary/10 text-primary shadow-sm' : 'size-9 border-dashed border-primary/60 bg-primary/5 text-primary/80';
}

function isPuzzleOriginPlaceholderVisible(puzzle: AdminPuzzle) {
  return puzzleOriginPlaceholderVisible.value && draggingPuzzle.value?.id === puzzle.id;
}

function isRoundBeingCreated(roundId: number) {
  return creatingRoundId.value === roundId;
}

async function addRound() {
  if (applyLoading.value) return;

  const nextSort = rounds.value.reduce((max, round) => Math.max(max, round.sort), -1) + 1;
  const title = `区域 ${rounds.value.length + 1}`;
  const body = {
    game_id: gameId.value,
    title,
    content: '',
    content_type: RbContentType.Markdown,
    cover: null,
    puzzle: null,
    sort: nextSort,
  };

  applyLoading.value = true;
  try {
    type Response = { round: AdminRound };
    const { data } = await api.post<Response>('/admin/rounds', body, {
      errorHints: {
        [-2]: '区域信息不合法。',
        [-1]: '区域不存在。',
      },
    });

    rounds.value = reindexSort([...rounds.value, data.round]);
    puzzles.value = [...puzzles.value];
    originalRounds.value = cloneRounds(rounds.value);
    originalPuzzles.value = clonePuzzles(puzzles.value);
    toast.add({
      title: '区域已创建',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '创建区域失败', true);
  } finally {
    applyLoading.value = false;
  }
}

async function addPuzzle(roundId: number) {
  if (applyLoading.value || creatingRoundId.value !== null) return;
  if (hasChanges.value) {
    toast.add({
      title: '请先保存修改',
      description: '当前页面存在未保存的更改，无法新建谜题。',
      icon: 'material-symbols:warning-rounded',
      color: 'error',
    });
    return;
  }

  const title = '新建谜题';
  const round = rounds.value.find(item => item.id === roundId);
  if (!round) return;

  const nextSort = puzzles.value.filter(puzzle => puzzle.round_id === roundId && !isRoundPuzzle(puzzle, roundId)).reduce((max, puzzle) => Math.max(max, puzzle.sort), -1) + 1;

  const body = {
    round_id: roundId,
    title,
    content: '',
    content_type: RbContentType.Markdown,
    ptype: RbPuzzleType.Normal,
    judge: [],
    penalty: [],
    max_submit: null,
    unlock_cond: 'default',
    ticket_enabled: true,
    ticket_cooldown: 0,
    sort: nextSort,
    slug: null,
  };

  applyLoading.value = true;
  creatingRoundId.value = roundId;
  try {
    type Response = { puzzle: AdminPuzzle };
    const { data } = await api.post<Response>('/admin/puzzles', body, {
      errorHints: {
        [-2]: '谜题信息不合法。',
        [-1]: '谜题不存在。',
      },
    });

    puzzles.value = reindexMovablePuzzles([...puzzles.value, data.puzzle], roundId);
    originalRounds.value = cloneRounds(rounds.value);
    originalPuzzles.value = clonePuzzles(puzzles.value);
    toast.add({
      title: '谜题已创建',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
    await navigateTo(`/admin/games/${gameId.value}/puzzles/${data.puzzle.id}`);
  } catch (error) {
    handleError(error, '创建谜题失败', true);
  } finally {
    creatingRoundId.value = null;
    applyLoading.value = false;
  }
}

async function deleteRound(roundId: number) {
  if (applyLoading.value) return;
  if (hasAnyPuzzle(roundId)) return;
  if (isRoundDeleting(roundId)) return;

  deletingRoundIds.value = new Set([...deletingRoundIds.value, roundId]);
  syncDirtyToast();
}

function restoreRound(roundId: number) {
  if (!isRoundDeleting(roundId)) return;

  const next = new Set(deletingRoundIds.value);
  next.delete(roundId);
  deletingRoundIds.value = next;
  syncDirtyToast();
}

function puzzleDropHintClass(puzzle: AdminPuzzle) {
  const source = draggingPuzzle.value;
  if (!source || source.id === puzzle.id) return '';

  const leftTarget = canonicalPuzzleDropTarget(source, puzzle, 'left', puzzle.round_id);
  const rightTarget = canonicalPuzzleDropTarget(source, puzzle, 'right', puzzle.round_id);
  const leftValid = leftTarget?.id === puzzle.id && leftTarget.side === 'left';
  const rightValid = rightTarget?.id === puzzle.id && rightTarget.side === 'right';
  const activeSide = dragOverPuzzle.value?.id === puzzle.id ? dragOverPuzzle.value.side : null;
  if (!leftValid && !rightValid) return '';

  return [
    "before:content-[''] after:content-['']",
    'before:absolute after:absolute before:top-1 after:top-1 before:bottom-1 after:bottom-1',
    'before:left-0 after:right-0 before:-translate-x-1.5 after:translate-x-1.5',
    'before:rounded-full after:rounded-full before:bg-primary after:bg-primary',
    'before:w-px after:w-px before:transition-all after:transition-all before:duration-100 after:duration-100',
    leftValid ? (activeSide === 'left' ? 'before:top-px before:bottom-px before:opacity-90 before:shadow-[0_0_0_0.75px_var(--ui-primary)]' : 'before:opacity-45 before:shadow-none') : 'before:opacity-0 before:shadow-none',
    rightValid ? (activeSide === 'right' ? 'after:top-px after:bottom-px after:opacity-90 after:shadow-[0_0_0_0.75px_var(--ui-primary)]' : 'after:opacity-45 after:shadow-none') : 'after:opacity-0 after:shadow-none',
  ].join(' ');
}

function isEmptyRoundDropActive(roundId: number) {
  return dragOverEmptyRoundId.value === roundId;
}

function emptyRoundDropClass(roundId: number) {
  return isEmptyRoundDropActive(roundId) ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-muted bg-muted/20 text-muted';
}

function onPuzzleDrop(event: DragEvent) {
  const source = draggingPuzzle.value;
  if (!source) return;

  event.preventDefault();
  event.stopPropagation();

  const emptyRoundId = dragOverEmptyRoundId.value;
  if (emptyRoundId !== null) {
    if (isRoundDeleting(emptyRoundId)) {
      clearDragState();
      return;
    }
    onPuzzleDropToRoundEnd(emptyRoundId, event);
    return;
  }

  const sourcePuzzle = puzzles.value.find(puzzle => puzzle.id === source.id);
  if (!sourcePuzzle || isRoundPuzzle(sourcePuzzle)) {
    clearDragState();
    return;
  }

  const dropTarget = dragOverPuzzle.value ?? getPuzzleDropTargetByPosition(event)?.target ?? null;
  const normalizedTargetPuzzle = dropTarget ? puzzles.value.find(puzzle => puzzle.id === dropTarget.id) : undefined;
  const roundId = normalizedTargetPuzzle?.round_id;
  if (!normalizedTargetPuzzle || !dropTarget || !isValidPuzzleDropSide(source, normalizedTargetPuzzle, dropTarget.side, roundId)) {
    clearDragState();
    return;
  }

  clearDragState();

  if (source.roundId !== roundId) {
    const sourcePuzzles = puzzles.value.filter(puzzle => puzzle.round_id === source.roundId && puzzle.id !== source.id);
    const targetPuzzles = puzzles.value.filter(puzzle => puzzle.round_id === roundId);
    const targetIndex = targetPuzzles.findIndex(puzzle => puzzle.id === dropTarget.id);
    if (targetIndex < 0) return;
    const insertIndex = isRoundPuzzle(normalizedTargetPuzzle, roundId) ? targetIndex + 1 : getInsertIndex(targetIndex, dropTarget.side);

    const targetNext = [...targetPuzzles];
    targetNext.splice(insertIndex, 0, {
      ...sourcePuzzle,
      round_id: roundId,
    });

    replaceRoundPuzzles(
      new Map([
        [source.roundId, reindexMovablePuzzles(sourcePuzzles, source.roundId)],
        [roundId, reindexMovablePuzzles(targetNext, roundId)],
      ]),
    );
    syncDirtyToast();
    return;
  }

  const roundPuzzles = puzzles.value.filter(puzzle => puzzle.round_id === roundId);
  const fromIndex = roundPuzzles.findIndex(puzzle => puzzle.id === source.id);
  const toIndex = roundPuzzles.findIndex(puzzle => puzzle.id === dropTarget.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const rawInsertIndex = isRoundPuzzle(normalizedTargetPuzzle, roundId) ? toIndex + 1 : getInsertIndex(toIndex, dropTarget.side);
  const insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  if (insertIndex === fromIndex) return;

  replaceRoundPuzzles(new Map([[roundId, reindexMovablePuzzles(reorderList(roundPuzzles, fromIndex, insertIndex), roundId)]]));
  syncDirtyToast();
}

function onPuzzleDropToRoundEnd(roundId: number, event: DragEvent) {
  event.preventDefault();

  const source = draggingPuzzle.value;
  if (isRoundDeleting(roundId)) {
    clearDragState();
    return;
  }
  const isEmptyRoundDrop = dragOverEmptyRoundId.value === roundId;
  clearDragState();
  if (!source) return;

  const sourcePuzzle = puzzles.value.find(puzzle => puzzle.id === source.id);
  if (!sourcePuzzle || isRoundPuzzle(sourcePuzzle)) return;

  const currentRoundPuzzles = puzzles.value.filter(puzzle => puzzle.round_id === roundId);
  if (!isEmptyRoundDrop && source.roundId === roundId && currentRoundPuzzles.at(-1)?.id === source.id) return;

  const targetPuzzles = puzzles.value.filter(puzzle => puzzle.round_id === roundId && puzzle.id !== source.id);
  const movedPuzzle = {
    ...sourcePuzzle,
    round_id: roundId,
  };

  const updates = new Map<number, AdminPuzzle[]>();
  if (source.roundId !== roundId) {
    updates.set(
      source.roundId,
      reindexMovablePuzzles(
        puzzles.value.filter(puzzle => puzzle.round_id === source.roundId && puzzle.id !== source.id),
        source.roundId,
      ),
    );
  }
  updates.set(roundId, reindexMovablePuzzles([...targetPuzzles, movedPuzzle], roundId));

  replaceRoundPuzzles(updates);
  syncDirtyToast();
}

async function fetchData() {
  if (!Number.isFinite(gameId.value)) return;

  loading.value = true;

  try {
    type RoundResponse = { rounds: AdminRound[] };
    type PuzzleResponse = { puzzles: AdminPuzzle[] };

    const [roundResp, puzzleResp] = await Promise.all([
      api.get<RoundResponse>('/admin/rounds', {
        query: {
          game_id: gameId.value,
        },
      }),
      api.get<PuzzleResponse>('/admin/puzzles', {
        query: {
          game_id: gameId.value,
        },
      }),
    ]);

    rounds.value = sortBySortId(roundResp.data.rounds);
    puzzles.value = orderAllPuzzles(sortBySortId(puzzleResp.data.puzzles));
    originalRounds.value = cloneRounds(rounds.value);
    originalPuzzles.value = clonePuzzles(puzzles.value);
    deletingRoundIds.value = new Set();
    dirtyToast.clear();
  } catch (error) {
    rounds.value = [];
    puzzles.value = [];
    originalRounds.value = [];
    originalPuzzles.value = [];
    deletingRoundIds.value = new Set();
    dirtyToast.clear();
    handleError(error, '获取谜题列表失败', true);
  } finally {
    loading.value = false;
  }
}

watch(
  gameId,
  () => {
    fetchData();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col gap-5 sm:gap-6 w-full">
    <div v-if="loading && groupedRounds.length === 0" class="flex flex-col gap-4">
      <u-skeleton v-for="item in 3" :key="item" class="h-32 w-full" />
    </div>

    <u-empty v-else-if="groupedRounds.length === 0" icon="material-symbols:extension-off-outline-rounded" title="暂无区域" description="当前比赛还没有区域或谜题" />

    <template v-else>
      <section
        v-for="group in groupedRounds"
        :key="group.round.id"
        data-round-section="true"
        :data-round-id="group.round.id"
        :data-round-deleting="isRoundDeleting(group.round.id) ? 'true' : undefined"
        class="relative flex flex-col gap-1.5 rounded-md transition"
        :class="[isRoundDeleting(group.round.id) ? 'opacity-50' : '', roundDropHintClass(group.round)]"
        @dragover="onRoundSectionDragOver(group, $event)"
        @dragleave="onRoundSectionDragLeave(group.round.id, $event)"
        @drop="onRoundSectionDrop(group.round.id, $event)"
      >
        <div v-if="isRoundOriginPlaceholderVisible(group.round)" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md transition" :class="roundOriginPlaceholderClass(group.round)">
          <div class="flex items-center justify-center rounded-full border-2 transition-all duration-100" :class="roundOriginPlaceholderIconClass(group.round)">
            <u-icon name="material-symbols:drag-pan-rounded" class="size-5" />
          </div>
        </div>

        <div :class="isRoundOriginPlaceholderVisible(group.round) ? 'opacity-25' : ''">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between pb-3">
            <div class="flex min-w-0 items-start gap-2">
              <u-button
                draggable="true"
                color="neutral"
                variant="ghost"
                size="sm"
                square
                icon="material-symbols:drag-indicator"
                class="mt-0.5 shrink-0 cursor-grab text-muted active:cursor-grabbing"
                title="拖动调整区域顺序"
                aria-label="拖动调整区域顺序"
                :disabled="isRoundDeleting(group.round.id)"
                @dragstart="onRoundDragStart(group.round.id, $event)"
                @dragend="clearDragState"
              />
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink :to="`/admin/games/${gameId}/rounds/${group.round.id}`" class="text-lg font-semibold leading-tight text-highlighted transition hover:text-primary">
                    {{ group.round.title }}
                  </NuxtLink>
                  <u-badge size="sm" variant="soft" color="neutral">#{{ group.round.id }}</u-badge>
                  <u-badge v-if="group.round.slug" size="sm" variant="soft" color="primary" icon="material-symbols:tag-rounded">
                    {{ group.round.slug }}
                  </u-badge>
                  <u-tooltip text="编辑区域">
                    <u-button
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      square
                      icon="material-symbols:edit-outline-rounded"
                      aria-label="编辑区域"
                      :disabled="applyLoading || isRoundDeleting(group.round.id)"
                      @click.stop="navigateTo(`/admin/games/${gameId}/rounds/${group.round.id}`)"
                    />
                  </u-tooltip>
                  <u-tooltip text="新建谜题">
                    <u-button
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      square
                      icon="material-symbols:add-circle-outline-rounded"
                      aria-label="新建谜题"
                      :disabled="applyLoading || isRoundBeingCreated(group.round.id) || isRoundDeleting(group.round.id)"
                      @click.stop="addPuzzle(group.round.id)"
                    />
                  </u-tooltip>
                  <u-tooltip :text="isRoundDeleting(group.round.id) ? '恢复区域' : '删除区域'">
                    <u-button
                      :color="isRoundDeleting(group.round.id) ? 'neutral' : 'error'"
                      variant="ghost"
                      size="xs"
                      square
                      :icon="isRoundDeleting(group.round.id) ? 'material-symbols:undo-rounded' : 'material-symbols:delete-outline-rounded'"
                      :aria-label="isRoundDeleting(group.round.id) ? '恢复区域' : '删除区域'"
                      :disabled="applyLoading || (!isRoundDeleting(group.round.id) && hasAnyPuzzle(group.round.id))"
                      @click.stop="isRoundDeleting(group.round.id) ? restoreRound(group.round.id) : deleteRound(group.round.id)"
                    />
                  </u-tooltip>
                </div>
                <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                  <span>{{ group.puzzles.length }} 个谜题</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="group.puzzles.length" class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 pb-1.5">
            <div
              v-for="puzzle in group.puzzles"
              :key="puzzle.id"
              data-puzzle-card-drop="true"
              :data-puzzle-id="puzzle.id"
              :data-round-id="group.round.id"
              class="relative flex flex-col rounded-md transition"
              :class="[isRoundPuzzle(puzzle, group.round.id) ? 'cursor-default' : 'hover:-translate-y-0.5', puzzleDropHintClass(puzzle)]"
              @dragover="onPuzzleDragOver(puzzle, $event)"
              @dragleave="onPuzzleDragLeave(puzzle.id, $event)"
              @drop="onPuzzleDrop"
            >
              <div v-if="isPuzzleOriginPlaceholderVisible(puzzle)" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md transition" :class="originPlaceholderClass(puzzle)">
                <div class="flex items-center justify-center rounded-full border-2 transition-all duration-100" :class="originPlaceholderIconClass(puzzle)">
                  <u-icon name="material-symbols:drag-pan-rounded" class="size-5" />
                </div>
              </div>
              <div class="relative rounded-md" :class="[isPuzzleOriginPlaceholderVisible(puzzle) ? 'opacity-25' : '', isRoundPuzzle(puzzle, group.round.id) ? 'overflow-hidden bg-primary/5' : '']">
                <rbph-puzzle-card-2
                  :puzzle="puzzle"
                  :is-round-puzzle="isRoundPuzzle(puzzle, group.round.id)"
                  :title="isRoundPuzzle(puzzle, group.round.id) ? group.round.title : puzzle.title"
                  :slug="isRoundPuzzle(puzzle, group.round.id) ? group.round.slug : puzzle.slug"
                  class="cursor-pointer"
                  @click="navigateTo(isRoundPuzzle(puzzle, group.round.id) ? `/admin/games/${gameId}/rounds/${group.round.id}` : `/admin/games/${gameId}/puzzles/${puzzle.id}`)"
                >
                  <template v-if="!isRoundPuzzle(puzzle, group.round.id)" #actions>
                    <u-button
                      draggable="true"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      square
                      icon="material-symbols:drag-indicator"
                      class="cursor-grab text-muted active:cursor-grabbing"
                      title="拖动调整谜题位置"
                      aria-label="拖动调整谜题位置"
                      @click.stop
                      @dragstart.stop="onPuzzleDragStart(puzzle, $event)"
                      @dragend="clearDragState"
                    />
                  </template>
                </rbph-puzzle-card-2>
                <div v-if="isRoundPuzzle(puzzle, group.round.id)" class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary/60" />
              </div>
            </div>
          </div>

          <div v-else class="flex min-h-28 items-center justify-center rounded-md border border-dashed transition-all duration-100" :class="emptyRoundDropClass(group.round.id)">
            <div class="flex flex-col items-center gap-2 text-center text-sm">
              <div class="flex size-9 items-center justify-center rounded-full border border-dashed border-current/60 bg-default/60 transition-transform" :class="isEmptyRoundDropActive(group.round.id) ? 'scale-110 border-solid' : ''">
                <u-icon :name="isRoundDeleting(group.round.id) ? 'material-symbols:delete-outline-rounded' : isEmptyRoundDropActive(group.round.id) ? 'material-symbols:add-rounded' : 'material-symbols:extension-off-outline-rounded'" class="size-5" />
              </div>
              <span>{{ isRoundDeleting(group.round.id) ? '即将删除' : '暂无谜题' }}</span>
            </div>
          </div>
        </div>
      </section>

      <div class="sticky bottom-4 z-20 flex justify-start">
        <u-button icon="material-symbols:add-rounded" label="新建区域" size="lg" class="shadow-lg shadow-primary/20" :disabled="applyLoading" @click="addRound" />
      </div>
    </template>
  </div>
</template>
