<script setup lang="ts">
interface BlockDropTarget {
  id: number;
  side: 'top' | 'bottom';
}

interface BlockDropEntry {
  id: number;
  index: number;
  centerY: number;
}

const props = defineProps<{
  blocks: AdminContentBlock[];
  selectedId?: number;
  gameId: number;
  currentPuzzleId?: number;
  disabled?: boolean;
  saveInfo: (id: number, info: Pick<AdminContentBlock, 'name' | 'content_type' | 'visibility_cond'>) => Promise<void>;
}>();

const emit = defineEmits<{
  select: [id: number];
  create: [];
  remove: [id: number];
  reorder: [ids: number[]];
  clearUnlocks: [id: number];
}>();

const draggingId = ref<number | null>(null);
const toast = useToast();
const dragOver = ref<BlockDropTarget | null>(null);
const originPlaceholderVisible = ref(false);
const infoOpen = ref(false);
const savingInfo = ref(false);
const clearUnlocksOpen = ref(false);
const infoTargetId = ref<number>();
const infoState = reactive({
  name: '',
  contentType: RbContentType.Markdown,
  visibilityCond: 'default',
});
let dropEntries: BlockDropEntry[] = [];

const dragAutoScroll = useDragAutoScroll({
  onScroll: () => {
    if (draggingId.value !== null) cacheDropEntries();
  },
});

const infoTarget = computed(() => props.blocks.find(block => block.id === infoTargetId.value));
const contentTypeItems = [
  { label: 'Markdown', value: RbContentType.Markdown, icon: 'material-symbols:markdown-rounded' },
  { label: 'HTML', value: RbContentType.Html, icon: 'material-symbols:html-rounded' },
  { label: '不安全 Markdown', value: RbContentType.UnsafeMarkdown, icon: 'material-symbols:code-rounded' },
];

function openInfo(block: AdminContentBlock) {
  clearUnlocksOpen.value = false;
  infoTargetId.value = block.id;
  infoState.name = block.name;
  infoState.contentType = block.content_type;
  infoState.visibilityCond = block.visibility_cond;
  infoOpen.value = true;
}

function confirmClearUnlocks() {
  const id = infoTargetId.value;
  if (!id) return;
  clearUnlocksOpen.value = false;
  emit('clearUnlocks', id);
}

async function applyInfo() {
  const block = infoTarget.value;
  if (!block || !infoState.name.trim() || savingInfo.value) return;
  savingInfo.value = true;
  try {
    await props.saveInfo(block.id, {
      name: infoState.name.trim(),
      content_type: infoState.contentType,
      visibility_cond: infoState.visibilityCond,
    });
    infoOpen.value = false;
    toast.add({ title: '内容块信息已保存', icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '保存内容块信息失败');
  } finally {
    savingInfo.value = false;
  }
}

function setDragTransfer(event: DragEvent, id: number) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.dropEffect = 'move';
  event.dataTransfer.setData('text/plain', `content-block:${id}`);
}

function setDragOver(target: BlockDropTarget | null) {
  if (dragOver.value?.id === target?.id && dragOver.value?.side === target?.side) return;
  dragOver.value = target;
}

function clearDragState() {
  draggingId.value = null;
  dragOver.value = null;
  originPlaceholderVisible.value = false;
  dropEntries = [];
  window.removeEventListener('dragover', onGlobalDragOver);
  window.removeEventListener('drop', onGlobalDrop);
  dragAutoScroll.stop();
}

function cacheDropEntries() {
  const cards = document.querySelectorAll<HTMLElement>('[data-content-block-drop="true"]');
  dropEntries = Array.from(cards)
    .map(card => {
      const id = Number(card.dataset.contentBlockId);
      const index = props.blocks.findIndex(block => block.id === id);
      const rect = card.getBoundingClientRect();
      return { id, index, centerY: rect.top + rect.height / 2 };
    })
    .filter(entry => Number.isFinite(entry.id) && entry.index >= 0)
    .sort((a, b) => a.index - b.index);
}

function getDropTarget(event: Pick<MouseEvent, 'clientY'>): BlockDropTarget | null {
  const sourceId = draggingId.value;
  if (sourceId === null) return null;
  if (dropEntries.length === 0) cacheDropEntries();
  if (dropEntries.length === 0) return null;

  const fromIndex = props.blocks.findIndex(block => block.id === sourceId);
  if (fromIndex < 0) return null;
  const index = dropEntries.findIndex(entry => event.clientY < entry.centerY);
  const rawIndex = index < 0 ? dropEntries.length : index;
  if (rawIndex === fromIndex || rawIndex === fromIndex + 1) return null;
  if (rawIndex <= 0) return { id: dropEntries[0]?.id ?? sourceId, side: 'top' };
  if (rawIndex >= dropEntries.length) return { id: dropEntries.at(-1)?.id ?? sourceId, side: 'bottom' };
  return { id: dropEntries[rawIndex]?.id ?? sourceId, side: 'top' };
}

function isOriginalDropTarget(sourceId: number, targetId: number, side: BlockDropTarget['side']) {
  const fromIndex = props.blocks.findIndex(block => block.id === sourceId);
  const targetIndex = props.blocks.findIndex(block => block.id === targetId);
  if (fromIndex < 0 || targetIndex < 0) return false;
  const rawIndex = side === 'top' ? targetIndex : targetIndex + 1;
  return (fromIndex < rawIndex ? rawIndex - 1 : rawIndex) === fromIndex;
}

function canonicalDropTarget(sourceId: number, targetId: number, side: BlockDropTarget['side']): BlockDropTarget | null {
  if (sourceId === targetId || isOriginalDropTarget(sourceId, targetId, side)) return null;
  const targetIndex = props.blocks.findIndex(block => block.id === targetId);
  if (targetIndex < 0) return null;
  const rawIndex = side === 'top' ? targetIndex : targetIndex + 1;
  if (rawIndex >= props.blocks.length) {
    const target = props.blocks.at(-1);
    return target ? { id: target.id, side: 'bottom' } : null;
  }
  const target = props.blocks[rawIndex];
  return target ? { id: target.id, side: 'top' } : null;
}

function dropHintClass(block: AdminContentBlock) {
  const sourceId = draggingId.value;
  if (sourceId === null || sourceId === block.id) return '';
  const topTarget = canonicalDropTarget(sourceId, block.id, 'top');
  const bottomTarget = canonicalDropTarget(sourceId, block.id, 'bottom');
  const topValid = topTarget?.id === block.id && topTarget.side === 'top';
  const bottomValid = bottomTarget?.id === block.id && bottomTarget.side === 'bottom';
  const activeSide = dragOver.value?.id === block.id ? dragOver.value.side : null;
  if (!topValid && !bottomValid) return '';
  return [
    "before:content-[''] after:content-['']",
    'before:absolute after:absolute before:left-1 after:left-1 before:right-1 after:right-1',
    'before:top-0 after:bottom-0 before:-translate-y-1.5 after:translate-y-1.5',
    'before:rounded-full after:rounded-full before:bg-primary after:bg-primary',
    'before:h-px after:h-px before:transition-all after:transition-all before:duration-100 after:duration-100',
    topValid ? (activeSide === 'top' ? 'before:left-px before:right-px before:opacity-90 before:shadow-[0_0_0_0.75px_var(--ui-primary)]' : 'before:opacity-45') : 'before:opacity-0',
    bottomValid ? (activeSide === 'bottom' ? 'after:left-px after:right-px after:opacity-90 after:shadow-[0_0_0_0.75px_var(--ui-primary)]' : 'after:opacity-45') : 'after:opacity-0',
  ].join(' ');
}

function onDragStart(block: AdminContentBlock, event: DragEvent) {
  if (props.disabled) return;
  draggingId.value = block.id;
  dragOver.value = null;
  originPlaceholderVisible.value = false;
  setDragTransfer(event, block.id);
  dragAutoScroll.start();
  window.addEventListener('dragover', onGlobalDragOver);
  window.addEventListener('drop', onGlobalDrop);
  requestAnimationFrame(() => {
    if (draggingId.value === block.id) originPlaceholderVisible.value = true;
    if (draggingId.value === block.id) cacheDropEntries();
  });
}

function onGlobalDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dragAutoScroll.update(event);
  if (draggingId.value !== null) setDragOver(getDropTarget(event));
}

function onGlobalDrop(event: DragEvent) {
  if (draggingId.value !== null) onDrop(event);
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  const sourceId = draggingId.value;
  const target = dragOver.value ?? getDropTarget(event);
  clearDragState();
  if (sourceId === null || !target) return;
  const ids = props.blocks.map(block => block.id);
  const fromIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(target.id);
  if (fromIndex < 0 || targetIndex < 0) return;
  const rawIndex = target.side === 'top' ? targetIndex : targetIndex + 1;
  const insertIndex = fromIndex < rawIndex ? rawIndex - 1 : rawIndex;
  if (insertIndex === fromIndex) return;
  ids.splice(fromIndex, 1);
  ids.splice(insertIndex, 0, sourceId);
  emit('reorder', ids);
}

onBeforeUnmount(clearDragState);
</script>

<template>
  <aside class="flex min-w-0 flex-col gap-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-md font-semibold text-highlighted">内容块管理器</h2>
        <p class="text-sm text-muted">创建、选择和调整正文内容块。</p>
      </div>
      <u-button icon="material-symbols:add-rounded" color="neutral" variant="ghost" size="xs" :disabled="disabled" title="新建内容块" @click="emit('create')" />
    </div>

    <div class="space-y-2" @dragover="onGlobalDragOver" @drop="onDrop">
      <div v-for="block in blocks" :key="block.id" data-content-block-drop="true" :data-content-block-id="block.id" class="relative transition-colors" :class="dropHintClass(block)" @dragover="onGlobalDragOver" @drop="onDrop">
        <div v-if="originPlaceholderVisible && draggingId === block.id" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/10">
          <div class="flex size-10 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-primary shadow-sm">
            <u-icon name="material-symbols:drag-pan-rounded" class="size-5" />
          </div>
        </div>

        <div class="flex items-center gap-2 rounded-lg bg-elevated/60 px-3 py-2 ring transition hover:bg-elevated" :class="block.id === selectedId ? 'ring-primary/70' : 'ring-default'">
          <button type="button" class="min-w-0 flex-1 text-left" @click="emit('select', block.id)">
            <span class="block truncate text-sm font-medium text-highlighted">{{ block.name }}</span>
            <span class="mt-0.5 block truncate text-xs text-muted">{{ block.visibility_cond === 'default' ? '始终显示' : '条件显示' }}</span>
          </button>
          <div class="flex shrink-0 items-center gap-1">
            <u-button icon="material-symbols:info-outline-rounded" color="neutral" variant="ghost" size="xs" :disabled="disabled" title="内容块信息" @click="openInfo(block)" />
            <u-button
              icon="material-symbols:drag-indicator"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="拖动排序"
              class="cursor-grab active:cursor-grabbing"
              draggable="true"
              :disabled="disabled"
              @dragstart.stop="onDragStart(block, $event)"
              @dragend="clearDragState"
            />
            <u-popover arrow :content="{ side: 'top', align: 'end', sideOffset: 8 }">
              <u-button icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="xs" :disabled="disabled" title="删除内容块" />
              <template #content>
                <div class="w-64 p-3 text-sm">
                  <div class="flex items-start gap-2">
                    <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                    <div class="min-w-0">
                      <div class="font-medium text-highlighted">删除内容块？</div>
                      <div class="mt-1 text-xs text-muted">此操作立即生效且不可恢复。</div>
                    </div>
                  </div>
                  <div class="mt-3 flex justify-end">
                    <u-button label="删除" icon="material-symbols:delete-outline-rounded" color="error" variant="soft" size="xs" @click="emit('remove', block.id)" />
                  </div>
                </div>
              </template>
            </u-popover>
          </div>
        </div>
      </div>
      <p v-if="blocks.length === 0" class="py-8 text-center text-sm text-muted">暂无内容块</p>
    </div>

    <u-modal v-model:open="infoOpen" title="内容块信息" :dismissible="!disabled && !savingInfo" :close="!disabled && !savingInfo" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <u-form :state="infoState" class="space-y-4" @submit.prevent="applyInfo">
          <rb-form-field label="名称" tooltip="仅便于后台区分内容块，不会向玩家公开。" row narrow-label required>
            <u-input v-model="infoState.name" class="w-full" placeholder="内容块名称" maxlength="120" :disabled="disabled || savingInfo" />
          </rb-form-field>
          <!-- todo -->
          <rb-form-field v-if="false" label="正文格式" row narrow-label>
            <u-field-group>
              <u-button
                v-for="item in contentTypeItems"
                :key="item.value"
                :label="item.label"
                :icon="item.icon"
                :variant="infoState.contentType === item.value ? 'solid' : 'outline'"
                color="primary"
                :disabled="disabled || savingInfo"
                @click="infoState.contentType = item.value"
              />
            </u-field-group>
          </rb-form-field>
          <rb-form-field label="显示条件" tooltip="首次满足后将对该队伍永久解锁。">
            <rbph-content-block-visibility-editor v-model="infoState.visibilityCond" :game-id="gameId" :current-puzzle-id="currentPuzzleId" :disabled="disabled || savingInfo" />
          </rb-form-field>
          <div class="flex justify-end">
            <u-popover v-model:open="clearUnlocksOpen" arrow>
              <u-button label="清除永久解锁记录" icon="material-symbols:lock-reset-rounded" color="warning" variant="soft" :disabled="disabled || savingInfo" />
              <template #content>
                <div class="w-64 p-3 text-sm">
                  <p class="mb-3 text-muted">清除后，各队伍将重新按当前条件判断此内容块。</p>
                  <u-button label="确认清除" color="warning" variant="soft" size="xs" @click="confirmClearUnlocks" />
                </div>
              </template>
            </u-popover>
          </div>
        </u-form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <u-button label="取消" color="neutral" variant="soft" :disabled="disabled || savingInfo" @click="infoOpen = false" />
          <u-button label="保存" icon="material-symbols:save-outline-rounded" :loading="savingInfo" :disabled="disabled || !infoState.name.trim()" @click="applyInfo" />
        </div>
      </template>
    </u-modal>
  </aside>
</template>
