<script setup lang="ts">
const toast = useToast();
const dirtyToast = useDirtyToast();
const { round, contentEditor, focusTitle, headerDirty, applyHeader, resetHeader } = useAdmin().useRoundContext();
const ownerId = computed(() => round.value?.id);
const blocks = useAdminContentBlocks('rounds', ownerId);
const assetManagerShell = ref<HTMLElement>();
const assetManagerHeight = ref('calc(100vh - 3rem)');
let heightFrame: number | null = null;

const dirty = computed(() => headerDirty.value || blocks.dirty.value);
async function apply() {
  if (!dirty.value || blocks.saving.value) return;
  if (headerDirty.value && !await applyHeader()) return;
  try {
    await blocks.save();
    dirtyToast.clear();
    toast.add({ title: '区域内容已保存', icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '保存区域内容失败');
  }
}

function reset() {
  resetHeader();
  blocks.reset();
  dirtyToast.clear();
}

async function createBlock() {
  try {
    await blocks.create();
  } catch (error) {
    handleError(error, '新建内容块失败');
  }
}

async function removeBlock(id: number) {
  try {
    await blocks.remove(id);
    toast.add({ title: '内容块已删除', icon: 'material-symbols:delete-outline-rounded' });
  } catch (error) {
    handleError(error, '删除内容块失败');
  }
}

async function reorder(ids: number[]) {
  try {
    await blocks.reorder(ids);
  } catch (error) {
    handleError(error, '调整内容块顺序失败');
    await blocks.load();
  }
}

async function clearUnlocks(id: number) {
  try {
    await blocks.clearUnlocks(id);
    toast.add({ title: '内容块解锁记录已清除', icon: 'material-symbols:lock-reset-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '清除内容块解锁记录失败');
  }
}

function updateAssetHeight() {
  const element = assetManagerShell.value;
  if (!element) return;
  assetManagerHeight.value = `${Math.max(320, window.innerHeight - element.getBoundingClientRect().top - 24)}px`;
}

function scheduleAssetHeight() {
  if (heightFrame !== null) return;
  heightFrame = requestAnimationFrame(() => {
    heightFrame = null;
    updateAssetHeight();
  });
}

watch(dirty, value => {
  if (value) dirtyToast.show({ description: '区域内容修改尚未保存。', guardOnLeave: true, apply, reset });
  else dirtyToast.clear();
});

onMounted(() => {
  nextTick(updateAssetHeight);
  window.addEventListener('resize', scheduleAssetHeight);
  document.addEventListener('scroll', scheduleAssetHeight, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleAssetHeight);
  document.removeEventListener('scroll', scheduleAssetHeight, true);
  if (heightFrame !== null) cancelAnimationFrame(heightFrame);
});
</script>

<template>
  <div v-if="round" class="grid min-h-0 gap-6 xl:grid-cols-[18rem_minmax(0,64rem)_minmax(18rem,22rem)]">
    <rbph-content-block-browser
      :blocks="blocks.blocks.value"
      :selected-id="blocks.selectedId.value"
      :game-id="round.game_id"
      :cdn-available="blocks.cdnAvailable.value"
      :save-info="blocks.saveInfo"
      :upload="blocks.upload"
      :remove-upload="blocks.removeUpload"
      :is-dirty="blocks.isDirty"
      :disabled="blocks.loading.value || blocks.saving.value"
      class="h-fit xl:sticky xl:top-6"
      @select="blocks.selectedId.value = $event"
      @create="createBlock"
      @remove="removeBlock"
      @reorder="reorder"
      @clear-unlocks="clearUnlocks"
    />

    <u-form v-if="blocks.selected.value" :state="blocks.selected.value" class="min-h-0 min-w-0" @submit.prevent="apply">
      <rbph-content-editor ref="contentEditor" v-model="blocks.selected.value.content" placeholder="请输入内容" aria-label="区域正文" :disabled="blocks.saving.value" @focus-title="focusTitle" @save="apply" />
    </u-form>
    <div v-else class="flex min-h-80 items-center justify-center text-sm text-muted">新建内容块后开始编辑</div>

    <aside class="hidden min-h-0 xl:block">
      <div ref="assetManagerShell" class="sticky top-6 flex min-h-0 min-w-0 overflow-hidden" :style="{ height: assetManagerHeight }">
        <rbph-puzzle-asset-manager :game-id="round.game_id" :round-id="round.id" class="h-full max-h-full min-w-0" />
      </div>
    </aside>
  </div>
</template>
