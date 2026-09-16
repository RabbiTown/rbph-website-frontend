type ListEditorId = string | number;

interface ListEditorOptions<T extends object, TId extends ListEditorId> {
  getId: (item: T) => TId;
  pendingDeletion: boolean;
  reorderable: boolean;
  isPersisted?: (item: T) => boolean;
  keepDraft?: (item: T) => boolean;
}

export function useListEditor<T extends object, TId extends ListEditorId>(items: Ref<T[]>, options: ListEditorOptions<T, TId>) {
  const pendingDeletionIds = ref(new Set<TId>()) as Ref<Set<TId>>;
  const activeItems = computed(() => (options.pendingDeletion ? items.value.filter(item => !pendingDeletionIds.value.has(options.getId(item))) : items.value));
  const activeSortEntries = computed(() => activeItems.value.map((item, sort) => ({ item, sort })));

  function resolveId(itemOrId: T | TId) {
    return typeof itemOrId === 'object' ? options.getId(itemOrId) : itemOrId;
  }

  function isPendingDeletion(itemOrId: T | TId) {
    return options.pendingDeletion && pendingDeletionIds.value.has(resolveId(itemOrId));
  }

  function markForDeletion(item: T) {
    if (!options.pendingDeletion) return false;
    if (options.isPersisted && !options.isPersisted(item) && !options.keepDraft?.(item)) {
      items.value = items.value.filter(candidate => candidate !== item);
      return false;
    }

    pendingDeletionIds.value = new Set([...pendingDeletionIds.value, options.getId(item)]);
    return true;
  }

  function restore(itemOrId: T | TId) {
    if (!options.pendingDeletion) return;
    const id = resolveId(itemOrId);
    if (!pendingDeletionIds.value.has(id)) return;

    const next = new Set(pendingDeletionIds.value);
    next.delete(id);
    pendingDeletionIds.value = next;
  }

  function resetPendingDeletion() {
    pendingDeletionIds.value = new Set();
  }

  function moveActive(fromIndex: number, toIndex: number) {
    if (!options.reorderable) return false;
    const active = [...activeItems.value];
    if (fromIndex < 0 || fromIndex >= active.length || toIndex < 0 || toIndex >= active.length || fromIndex === toIndex) return false;

    const [moved] = active.splice(fromIndex, 1);
    if (!moved) return false;
    active.splice(toIndex, 0, moved);

    let activeIndex = 0;
    items.value = items.value.map(item => (isPendingDeletion(item) ? item : active[activeIndex++]!));
    return true;
  }

  return {
    pendingDeletionIds,
    activeItems,
    activeSortEntries,
    isPendingDeletion,
    markForDeletion,
    restore,
    resetPendingDeletion,
    moveActive,
  };
}
