<script setup lang="ts">
const props = defineProps<{
  puzzleId?: number;
  utimeAt?: string;
}>();

const utimeAtMs = computed(() => new Date(props.utimeAt || '').getTime());

const api = useApi();
const toast = useToast();
const currency = useCurrency().getAllCurrent();
const sidStore = useSid();

const currentTime = useCurrentTimeSec();

const rawData = ref<RbPuzzleHintTeamData>();
const syncingDueHints = ref(false);
let dueHintTimer: ReturnType<typeof setTimeout> | undefined = undefined;

const processedData = computed(() => {
  if (!rawData.value) return undefined;
  return rawData.value.data.map(x => {
    const state = rawData.value?.state.find(s => s.id === x.id);
    return {
      ...x,
      state,
      displayTitle: state?.title ?? x.title ?? '这条提示以后再来探索吧！',
    };
  });
});

interface SyncDueHintsResponse {
  server_time: string;
  next_unlock_at?: string | null;
}

function clearDueHintTimer() {
  if (dueHintTimer) {
    clearTimeout(dueHintTimer);
    dueHintTimer = undefined;
  }
}

function hintUnlockAt(hint: RbHint) {
  if (!props.utimeAt || Number.isNaN(utimeAtMs.value)) return Infinity;
  return utimeAtMs.value + hint.cooldown * 1000;
}

function nextLocalUnlockAt() {
  if (!rawData.value) return Infinity;
  return rawData.value.data.reduce((next, hint) => {
    const state = rawData.value?.state.find(item => item.id === hint.id);
    if (state || !hint.title_hidden || hint.title !== null) return next;
    return Math.min(next, hintUnlockAt(hint));
  }, Infinity);
}

function scheduleDueHintSync(nextUnlockAt: string | null | undefined = undefined) {
  clearDueHintTimer();
  if (!props.puzzleId || !rawData.value) return;
  if (nextUnlockAt === null) return;

  const target = nextUnlockAt === undefined ? nextLocalUnlockAt() : new Date(nextUnlockAt).getTime();
  if (!Number.isFinite(target)) return;

  const delay = Math.max(target - currentTime.value + 250, 0);
  dueHintTimer = setTimeout(() => {
    syncDueHints();
  }, Math.min(delay, 2_147_483_647));
}

async function syncDueHints() {
  if (!props.puzzleId || syncingDueHints.value) return;

  syncingDueHints.value = true;
  try {
    const { data } = await api.post<SyncDueHintsResponse>(`/puzzles/${props.puzzleId}/hints/sync`, {});
    useSyncTime().syncWith(new Date(data.server_time));
    await updateData();
  } catch (error) {
    console.warn('Failed to sync due hints', error);
    dueHintTimer = setTimeout(() => {
      syncDueHints();
    }, 15_000);
  } finally {
    syncingDueHints.value = false;
  }
}

let fetchToken = 0;
async function updateData(newId: number | undefined = undefined) {
  const token = ++fetchToken;

  const puzzleId = newId || props.puzzleId;
  if (puzzleId) {
    try {
      const { data } = await api.get<RbPuzzleHintTeamData>(`/puzzles/${puzzleId}/hints`);
      if (token !== fetchToken) return;

      rawData.value = data;
      scheduleDueHintSync();
    } catch (error) {
      handleError(error, '获取提示失败');
    }
  }
}

const purchaseLoading = ref(false);

async function purchaseHint(hintId: number) {
  const api = useApi();
  const sid = sidStore.create('hint-purchase');

  purchaseLoading.value = true;

  try {
    const hint = rawData.value?.data.find(x => x.id === hintId);

    const { data } = await api.post<RbHintTeamState>(
      `/hints/${hintId}/purchase`,
      { sid },
      {
        errorHints: {
          [-2]: '余额不足。',
          [-1]: '提示暂未开放或已购买。',
        },
      }
    );

    if (rawData.value) {
      const stateIndex = rawData.value.state.findIndex(item => item.id === data.id);
      if (stateIndex >= 0) {
        rawData.value.state.splice(stateIndex, 1, data);
      } else {
        rawData.value.state.push(data);
      }

      const hint = rawData.value.data.find(item => item.id === data.id);
      if (hint) hint.title = data.title;
    }

    if (hint) {
      const cur = hint.cost_id ? currency.value[hint.cost_id] : undefined;
      const title = data.title ?? hint.title ?? '提示';
      toast.add({
        title: hint.cost_id ? '已购买提示' : '已解锁提示',
        description: hint.cost_id ? `已花费 ${intPrecString(hint.cost_amount, cur?.prec || 0)} ${cur?.name} 购买提示【${title}】` : `已解锁提示【${title}】`,
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
    }

    useCurrency().updateData();
  } catch (error) {
    sidStore.clear(sid);
    handleError(error, '提示购买失败');
  }

  purchaseLoading.value = false;
}

function checkEnough(hint: RbHint): boolean {
  if (!hint.cost_id || hint.cost_amount <= 0) return true;
  const cur = currency.value[hint.cost_id];
  return cur ? cur.current >= hint.cost_amount : false;
}

function calcCooldown(hint: RbHint): number {
  return Math.max(hintUnlockAt(hint) - currentTime.value, 0);
}

watch(
  () => props.puzzleId,
  async new_id => {
    clearDueHintTimer();
    rawData.value = undefined;
    updateData(new_id);
  },
  { immediate: true }
);

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    syncDueHints();
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onUnmounted(() => {
  clearDueHintTimer();
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

useSync().listen(SyncMessageType.PuzzleHintUnlocked, ({ data }) => {
  if (useSid().consume(data.sid)) return;

  if (data.puzzle.id === props.puzzleId) {
    updateData();
  }
});

defineExpose({
  updateData,
  hints: rawData,
});
</script>

<template>
  <div v-if="processedData && processedData?.length > 0" class="flex flex-wrap gap-4">
    <u-card v-for="hint in processedData" :key="hint.id" class="w-full" variant="subtle" :ui="{ body: 'sm:p-0 p-0' }">
      <u-collapsible :unmount-on-hide="false">
        <div :class="['px-5 py-3 flex items-center group dark:bg-slate-800 bg-slate-100', hint.state ? 'cursor-pointer' : '']">
          <u-icon :class="['align-middle me-2', hint.state ? 'text-success' : 'text-error']" :name="hint.state ? 'material-symbols:lock-open-right-outline-rounded' : 'material-symbols:lock-outline'" />
          <div :class="['text-sm flex-1', !hint.state ? 'text-secondary' : '']">
            {{ hint.displayTitle }}
          </div>
          <template v-if="!hint.state">
            <u-tooltip v-if="!calcCooldown(hint)" :disabled="checkEnough(hint)" arrow :text="`还需 ${intPrecString(hint.cost_amount - (currency[hint.cost_id ?? 0]?.current || 0), currency[hint.cost_id ?? 0]?.prec || 0)} ${currency[hint.cost_id ?? 0]?.name}`">
              <u-button variant="soft" size="xs" class="cursor-pointer -my-8" icon="material-symbols:emoji-objects-outline-rounded" :loading="purchaseLoading || syncingDueHints" :disabled="!checkEnough(hint)" @click="() => purchaseHint(hint.id)">
                <template v-if="!hint.cost_id"> 解锁 </template>
                <template v-else> {{ currency[hint.cost_id]?.name }} {{ intPrecString(-hint.cost_amount, currency[hint.cost_id]?.prec || 0, true, ' ') }} </template>
              </u-button>
            </u-tooltip>
            <u-tooltip v-else :disabled="checkEnough(hint)" arrow text="等待时间结束后才可购买">
              <u-button variant="soft" size="xs" class="-my-8" icon="material-symbols:hourglass-outline-rounded" :disabled="true"> {{ formatTime(calcCooldown(hint)) }} </u-button>
            </u-tooltip>
          </template>
          <u-icon v-else name="material-symbols:expand-more-rounded" class="-me-1 size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
        </div>
        <template v-if="hint.state" #content>
          <div class="px-4 py-4 border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
            <rbph-content :content="hint.state" />
          </div>
        </template>
      </u-collapsible>
    </u-card>
  </div>
  <u-empty v-else-if="processedData" icon="material-symbols:contact-support-outline-rounded" title="暂无提示" description="没有可用提示" />
</template>
