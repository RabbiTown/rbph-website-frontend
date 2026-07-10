<script setup lang="ts">
const STORAGE_KEY = 'rbph::sync-status-position';
const HEADER_OFFSET = 72;
const VIEWPORT_MARGIN = 12;

const { t, locale } = useI18n();
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
      return { label: t('components.syncStatus.connecting.label'), title: t('components.syncStatus.connecting.title'), description: t('components.syncStatus.connecting.description'), icon: 'material-symbols:sync-rounded', color: 'warning' as const, iconClass: 'text-warning' };
    case 'online':
      return { label: t('components.syncStatus.online.label'), title: t('components.syncStatus.online.title'), description: t('components.syncStatus.online.description'), icon: 'material-symbols:cloud-done-outline-rounded', color: 'success' as const, iconClass: 'text-success' };
    case 'reconnecting':
      return { label: t('components.syncStatus.reconnecting.label'), title: t('components.syncStatus.reconnecting.title'), description: t('components.syncStatus.reconnecting.description'), icon: 'material-symbols:sync-disabled-rounded', color: 'warning' as const, iconClass: 'text-warning' };
    case 'limited':
      return { label: t('components.syncStatus.limited.label'), title: t('components.syncStatus.limited.title'), description: t('components.syncStatus.limited.description'), icon: 'material-symbols:devices-off-outline-rounded', color: 'error' as const, iconClass: 'text-error' };
    case 'unsupported':
      return { label: t('components.syncStatus.unsupported.label'), title: t('components.syncStatus.unsupported.title'), description: t('components.syncStatus.unsupported.description'), icon: 'material-symbols:sync-problem-rounded', color: 'error' as const, iconClass: 'text-error' };
    default:
      return undefined;
  }
});

const transportLabel = computed(() => {
  if (sync.debug.transport.value === 'shared-worker') return t('components.syncStatus.transport.sharedWorker', { count: sync.debug.sharedClientCount.value });
  if (sync.debug.transport.value === 'direct') return t('components.syncStatus.transport.directWebSocket');
  return t('components.syncStatus.transport.unset');
});

const panelStyle = computed(() => {
  if (position.dragX !== undefined) return { top: `${position.y}px`, left: `${position.dragX}px` };
  return position.side === 'left' ? { top: `${position.y}px`, left: `${position.offset}px` } : { top: `${position.y}px`, right: `${position.offset}px` };
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ side: position.side, offset: position.offset, y: position.y }));
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
  return new Date(value).toLocaleString(locale.value, { hour12: false });
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
  position.offset = Math.min(Math.max(position.offset, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN));
  position.y = Math.min(Math.max(position.y, HEADER_OFFSET), Math.max(HEADER_OFFSET, viewport.height - height - VIEWPORT_MARGIN));
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
        <button type="button" class="grid cursor-grab touch-none rounded active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" :aria-label="t('components.syncStatus.buttonAria')" @pointerdown="startDragging">
          <u-badge aria-hidden="true" size="sm" variant="soft" color="error" icon="material-symbols:devices-off-outline-rounded" class="invisible col-start-1 row-start-1">{{ t('components.syncStatus.limited.label') }}</u-badge>
          <transition enter-active-class="transition-all duration-150" enter-from-class="translate-y-1 opacity-0" leave-active-class="transition-all duration-150" leave-to-class="-translate-y-1 opacity-0">
            <u-badge :key="sync.state.value" size="sm" variant="soft" :color="status.color" :icon="status.icon" class="col-start-1 row-start-1 justify-self-center">{{ status.label }}</u-badge>
          </transition>
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
              <u-button size="xs" color="neutral" variant="soft" icon="material-symbols:sync-rounded" :label="t('components.syncStatus.reconnect')" @click="sync.reconnect" />
            </div>
            <u-collapsible class="mt-3 border-t border-default pt-3" :unmount-on-hide="false">
              <button type="button" class="group flex w-full cursor-pointer items-center justify-between gap-2 text-xs font-medium text-highlighted">
                <span>{{ t('components.syncStatus.debug.title') }}</span>
                <u-icon name="material-symbols:expand-more-rounded" class="size-4 text-muted transition-transform group-data-[state=open]:rotate-180" />
              </button>
              <template #content>
                <dl class="mt-2 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
                  <dt class="text-muted">{{ t('components.syncStatus.debug.state') }}</dt>
                  <dd class="font-mono text-toned">{{ sync.state.value }}</dd>
                  <dt class="text-muted">{{ t('components.syncStatus.debug.transport') }}</dt>
                  <dd class="font-mono text-toned">{{ transportLabel }}</dd>
                  <dt class="text-muted">{{ t('components.syncStatus.debug.endpoint') }}</dt>
                  <dd class="break-all font-mono text-toned">{{ sync.debug.endpoint.value ?? t('components.syncStatus.debug.unset') }}</dd>
                  <dt class="text-muted">{{ t('components.syncStatus.debug.clientId') }}</dt>
                  <dd class="break-all font-mono text-toned">{{ sync.debug.clientId }}</dd>
                  <dt class="text-muted">{{ t('components.syncStatus.debug.stateChangedAt') }}</dt>
                  <dd class="font-mono text-toned">{{ debugTime(sync.debug.stateChangedAt.value) }}</dd>
                  <template v-if="sync.debug.lastClose.value">
                    <dt class="text-muted">{{ t('components.syncStatus.debug.lastClose') }}</dt>
                    <dd class="font-mono text-toned">{{ sync.debug.lastClose.value.code }} · {{ sync.debug.lastClose.value.wasClean ? t('components.syncStatus.debug.clean') : t('components.syncStatus.debug.unclean') }}</dd>
                    <dt class="text-muted">{{ t('components.syncStatus.debug.closeReason') }}</dt>
                    <dd class="break-all font-mono text-toned">{{ sync.debug.lastClose.value.reason || t('components.syncStatus.debug.notProvided') }}</dd>
                    <dt class="text-muted">{{ t('components.syncStatus.debug.closeAt') }}</dt>
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
