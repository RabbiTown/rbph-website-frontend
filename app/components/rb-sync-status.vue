<script setup lang="ts">
const STORAGE_KEY = 'rbph::sync-status-position';
const HEADER_OFFSET = 72;
const VIEWPORT_MARGIN = 12;

const sync = useSync();
const panel = useTemplateRef<HTMLElement>('panel');
const position = reactive<{ side: 'left' | 'right'; offset: number; y: number; dragX?: number }>({
  side: 'right',
  offset: 16,
  y: 80,
});
let dragStart: { pointerX: number; pointerY: number; panelX: number; panelY: number } | undefined;
const popoverOpen = ref(false);
let dragging = false;
let suppressPopover = false;
let panelResizeObserver: ResizeObserver | undefined;

const status = computed(() => {
  switch (sync.state.value) {
    case 'connecting':
      return { label: '同步中', title: '连接同步服务中', description: '正在建立实时数据连接。', icon: 'material-symbols:sync-rounded', color: 'warning' as const, iconClass: 'text-warning' };
    case 'online':
      return { label: '已连接', title: '同步服务已连接', description: '实时数据同步正常。', icon: 'material-symbols:cloud-done-outline-rounded', color: 'success' as const, iconClass: 'text-success' };
    case 'reconnecting':
      return { label: '重连中', title: '同步服务已断开', description: '正在尝试重新连接。', icon: 'material-symbols:sync-disabled-rounded', color: 'warning' as const, iconClass: 'text-warning' };
    case 'limited':
      return { label: '连接受限', title: '同步连接已被替换', description: '该账号的连接数超过系统上限。重新连接可能断开其他页面。', icon: 'material-symbols:devices-off-outline-rounded', color: 'error' as const, iconClass: 'text-error' };
    case 'unsupported':
      return { label: '不支持', title: '浏览器不支持同步服务', description: '请升级浏览器后重新打开页面。', icon: 'material-symbols:sync-problem-rounded', color: 'error' as const, iconClass: 'text-error' };
    default:
      return undefined;
  }
});

const panelStyle = computed(() => {
  if (position.dragX !== undefined) return { top: `${position.y}px`, left: `${position.dragX}px` };
  return position.side === 'left'
    ? { top: `${position.y}px`, left: `${position.offset}px` }
    : { top: `${position.y}px`, right: `${position.offset}px` };
});

function viewportSize() {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
}

function clampPosition(x: number, y: number) {
  const rect = panel.value?.getBoundingClientRect();
  const width = rect?.width ?? 96;
  const height = rect?.height ?? 24;
  const viewport = viewportSize();
  return {
    x: Math.min(Math.max(x, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN)),
    y: Math.min(Math.max(y, HEADER_OFFSET), Math.max(HEADER_OFFSET, viewport.height - height - VIEWPORT_MARGIN)),
  };
}

function savePosition() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ side: position.side, offset: position.offset, y: position.y }),
  );
}

function anchorCurrentPosition() {
  const rect = panel.value?.getBoundingClientRect();
  if (!rect) return;
  const viewport = viewportSize();
  const leftDistance = rect.left;
  const rightDistance = viewport.width - rect.right;
  position.side = leftDistance <= rightDistance ? 'left' : 'right';
  position.offset = Math.max(VIEWPORT_MARGIN, position.side === 'left' ? leftDistance : rightDistance);
  position.dragX = undefined;
}

function onPointerMove(event: PointerEvent) {
  if (!dragStart) return;
  if (!dragging && Math.hypot(event.clientX - dragStart.pointerX, event.clientY - dragStart.pointerY) < 4) return;
  if (!dragging) {
    dragging = true;
    popoverOpen.value = false;
    document.body.style.userSelect = 'none';
  }
  event.preventDefault();
  const next = clampPosition(dragStart.panelX + event.clientX - dragStart.pointerX, dragStart.panelY + event.clientY - dragStart.pointerY);
  position.dragX = next.x;
  position.y = next.y;
}

function stopDragging() {
  if (!dragStart) return;
  const wasDragging = dragging;
  dragStart = undefined;
  dragging = false;
  document.body.style.removeProperty('user-select');
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', stopDragging);
  window.removeEventListener('pointercancel', stopDragging);
  if (wasDragging) {
    anchorCurrentPosition();
    clampSavedPosition();
    savePosition();
    suppressPopover = true;
    window.setTimeout(() => (suppressPopover = false), 0);
  }
}

function startDragging(event: PointerEvent) {
  if (event.button !== 0) return;
  const rect = panel.value?.getBoundingClientRect();
  if (!rect) return;
  dragStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    panelX: rect.left,
    panelY: rect.top,
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);
}

function updatePopover(open: boolean) {
  if (!suppressPopover) popoverOpen.value = open;
}

function debugTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function clampSavedPosition() {
  if (dragging) return;
  if (position.dragX !== undefined) {
    const next = clampPosition(position.dragX, position.y);
    position.dragX = next.x;
    position.y = next.y;
    anchorCurrentPosition();
  }
  const rect = panel.value?.getBoundingClientRect();
  const viewport = viewportSize();
  const width = rect?.width ?? 96;
  const height = rect?.height ?? 24;
  position.offset = Math.min(
    Math.max(position.offset, VIEWPORT_MARGIN),
    Math.max(VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN),
  );
  position.y = Math.min(
    Math.max(position.y, HEADER_OFFSET),
    Math.max(HEADER_OFFSET, viewport.height - height - VIEWPORT_MARGIN),
  );
  savePosition();
}

watch(panel, async (current, previous) => {
  if (previous) panelResizeObserver?.unobserve(previous);
  if (current) {
    panelResizeObserver?.observe(current);
    await nextTick();
    clampSavedPosition();
  }
});

watch(status, async () => {
  await nextTick();
  clampSavedPosition();
});

onMounted(async () => {
  panelResizeObserver = new ResizeObserver(clampSavedPosition);
  if (panel.value) panelResizeObserver.observe(panel.value);
  panelResizeObserver.observe(document.documentElement);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if ((saved?.side === 'left' || saved?.side === 'right') && typeof saved?.offset === 'number' && typeof saved?.y === 'number') {
      position.side = saved.side;
      position.offset = saved.offset;
      position.y = saved.y;
      await nextTick();
      clampSavedPosition();
    } else if (typeof saved?.x === 'number' && typeof saved?.y === 'number') {
      position.dragX = saved.x;
      position.y = saved.y;
      await nextTick();
      clampSavedPosition();
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.addEventListener('resize', clampSavedPosition);
  window.visualViewport?.addEventListener('resize', clampSavedPosition);
});

onBeforeUnmount(() => {
  stopDragging();
  panelResizeObserver?.disconnect();
  window.removeEventListener('resize', clampSavedPosition);
  window.visualViewport?.removeEventListener('resize', clampSavedPosition);
});
</script>

<template>
  <transition enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-2 opacity-0" leave-active-class="transition duration-150 ease-in" leave-to-class="translate-y-2 opacity-0">
    <div v-if="status" ref="panel" role="status" :style="panelStyle" class="fixed z-50">
      <u-popover :open="popoverOpen" arrow :content="{ side: 'bottom', align: 'end', sideOffset: 8 }" @update:open="updatePopover">
        <button type="button" class="cursor-grab touch-none rounded active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="查看或拖动同步状态" @pointerdown="startDragging">
          <u-badge size="sm" variant="soft" :color="status.color" :icon="status.icon">{{ status.label }}</u-badge>
        </button>
        <template #content>
          <div class="w-72 p-3 text-sm">
            <div class="flex items-start gap-2">
              <u-icon :name="status.icon" class="mt-0.5 size-5 shrink-0" :class="status.iconClass" />
              <div class="min-w-0">
                <div class="font-medium text-highlighted">{{ status.title }}</div>
                <div class="mt-1 text-xs leading-5 text-muted">{{ status.description }}</div>
              </div>
            </div>
            <div v-if="sync.state.value === 'limited'" class="mt-3 flex justify-end">
              <u-button size="xs" color="neutral" variant="soft" icon="material-symbols:sync-rounded" label="重新连接" @click="sync.reconnect" />
            </div>
            <u-collapsible class="mt-3 border-t border-default pt-3" :unmount-on-hide="false">
              <button type="button" class="group flex w-full cursor-pointer items-center justify-between gap-2 text-xs font-medium text-highlighted">
                <span>调试信息</span>
                <u-icon name="material-symbols:expand-more-rounded" class="size-4 text-muted transition-transform group-data-[state=open]:rotate-180" />
              </button>
              <template #content>
                <dl class="mt-2 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
                  <dt class="text-muted">状态</dt>
                  <dd class="font-mono text-toned">{{ sync.state.value }}</dd>
                  <dt class="text-muted">传输方式</dt>
                  <dd class="font-mono text-toned">SharedWorker ({{ sync.debug.sharedClientCount.value }})</dd>
                  <dt class="text-muted">服务地址</dt>
                  <dd class="break-all font-mono text-toned">{{ sync.debug.endpoint.value ?? '尚未生成' }}</dd>
                  <dt class="text-muted">客户端 ID</dt>
                  <dd class="break-all font-mono text-toned">{{ sync.debug.clientId }}</dd>
                  <dt class="text-muted">状态变更</dt>
                  <dd class="font-mono text-toned">{{ debugTime(sync.debug.stateChangedAt.value) }}</dd>
                  <template v-if="sync.debug.lastClose.value">
                    <dt class="text-muted">最近关闭</dt>
                    <dd class="font-mono text-toned">{{ sync.debug.lastClose.value.code }} · {{ sync.debug.lastClose.value.wasClean ? 'clean' : 'unclean' }}</dd>
                    <dt class="text-muted">关闭原因</dt>
                    <dd class="break-all font-mono text-toned">{{ sync.debug.lastClose.value.reason || '未提供' }}</dd>
                    <dt class="text-muted">关闭时间</dt>
                    <dd class="font-mono text-toned">{{ debugTime(sync.debug.lastClose.value.at) }}</dd>
                  </template>
                </dl>
              </template>
            </u-collapsible>
          </div>
        </template>
      </u-popover>
    </div>
  </transition>
</template>
