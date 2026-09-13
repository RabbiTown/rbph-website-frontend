<script setup lang="ts">
const { t } = useI18n();
const props = defineProps<{
  puzzleId?: number;
}>();

const api = useApi();
const toast = useToast();
const currency = useCurrency().getAllCurrent();
const sidStore = useSid();

const currentTime = useCurrentTimeSec();

const rawData = ref<RbPuzzleHintTeamData>();
const syncingDueHints = ref(false);
let dueHintTimer: ReturnType<typeof setTimeout> | undefined = undefined;
const pendingPurchaseHintIds = new Set<number>();

const processedData = computed(() => {
  if (!rawData.value) return undefined;
  return rawData.value.data.map(x => {
    const state = rawData.value?.state.find(s => s.id === x.id);
    return {
      ...x,
      state,
      displayTitle: state?.title ?? x.title ?? t('hints.hiddenTitle'),
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
  const availableAt = new Date(hint.available_at).getTime();
  return Number.isNaN(availableAt) ? Infinity : availableAt;
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
  dueHintTimer = setTimeout(
    () => {
      syncDueHints();
    },
    Math.min(delay, 2_147_483_647),
  );
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
    flushPendingHintPurchases();
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
      handleError(error, t('hints.getFailed'));
    }
  }
}

const purchaseLoading = ref(false);
const purchaseConfirmId = ref<number>();

async function purchaseHint(hintId: number) {
  if (syncingDueHints.value) {
    pendingPurchaseHintIds.add(hintId);
    return;
  }

  const target = rawData.value?.data.find(hint => hint.id === hintId);
  if (purchaseLoading.value || !target || calcCooldown(target) > 0 || !checkEnough(target) || rawData.value?.state.some(hint => hint.id === hintId)) return;
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
          [-2]: t('hints.insufficientBalance'),
          [-1]: t('hints.unavailableOrPurchased'),
        },
      },
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
      const title = data.title ?? hint.title ?? t('hints.title');
      toast.add({
        title: hint.cost_id ? t('hints.purchased') : t('hints.unlocked'),
        description: hint.cost_id ? t('hints.purchaseSuccessDesc', { amount: intPrecString(hint.cost_amount, cur?.prec || 0), currency: cur?.name, title }) : t('hints.unlockSuccessDesc', { title }),
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
    }

    purchaseConfirmId.value = undefined;
    useCurrency().updateData();
  } catch (error) {
    sidStore.clear(sid);
    handleError(error, t('hints.purchaseFailed'));
  }

  purchaseLoading.value = false;
}

async function flushPendingHintPurchases() {
  while (!syncingDueHints.value && !purchaseLoading.value && pendingPurchaseHintIds.size > 0) {
    const hintId = pendingPurchaseHintIds.values().next().value;
    if (hintId === undefined) return;

    pendingPurchaseHintIds.delete(hintId);
    await purchaseHint(hintId);
  }
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
    pendingPurchaseHintIds.clear();
    purchaseConfirmId.value = undefined;
    rawData.value = undefined;
    updateData(new_id);
  },
  { immediate: true },
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
  pendingPurchaseHintIds.clear();
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

useSync().listen(SyncMessageType.PuzzleHintUnlocked, ({ data }) => {
  if (useSid().consume(data.sid)) return;

  if (data.puzzle.id === props.puzzleId) {
    updateData();
  }
});

useSync().listen(SyncMessageType.PuzzleSubmitted, () => {
  updateData();
});

useSync().listen(SyncMessageType.GameReleaseUpdated, () => {
  updateData();
});

defineExpose({
  updateData,
  hints: rawData,
});
</script>

<template>
  <div v-if="processedData && processedData?.length > 0" class="flex flex-wrap gap-4">
    <rbph-collapsible-content-card
      v-for="hint in processedData"
      :key="hint.id"
      :collapsible="Boolean(hint.state)"
      :icon="hint.state ? 'material-symbols:lock-open-right-outline-rounded' : 'material-symbols:lock-outline'"
      :icon-class="hint.state ? 'text-success' : 'text-error'"
      :title-class="!hint.state ? 'text-secondary' : undefined"
    >
      <template #title>{{ hint.displayTitle }}</template>
      <template v-if="!hint.state" #actions>
        <u-tooltip
          v-if="!calcCooldown(hint)"
          :disabled="checkEnough(hint)"
          arrow
          :text="t('hints.needMore', { amount: `${intPrecString(hint.cost_amount - (currency[hint.cost_id ?? 0]?.current || 0), currency[hint.cost_id ?? 0]?.prec || 0)} ${currency[hint.cost_id ?? 0]?.name}` })"
        >
          <u-popover :open="purchaseConfirmId === hint.id" arrow @update:open="purchaseConfirmId = $event ? hint.id : undefined">
            <u-button variant="soft" size="xs" class="cursor-pointer" icon="material-symbols:emoji-objects-outline-rounded" :loading="purchaseLoading" :disabled="!checkEnough(hint)">
              <template v-if="!hint.cost_id"> {{ t('hints.unlock') }} </template>
              <template v-else> {{ currency[hint.cost_id]?.name }} {{ intPrecString(-hint.cost_amount, currency[hint.cost_id]?.prec || 0, true, ' ') }} </template>
            </u-button>
            <template #content>
              <div class="flex max-w-sm items-center gap-1 py-2 px-4 text-xs" @click.stop @keydown.stop>
                <u-icon name="material-symbols:lock-open-right-outline-rounded" class="shrink-0" />
                <span class="min-w-0 mx-1 wrap-anywhere">
                  {{ t('hints.confirmUnlock') }}
                  <span v-if="hint.cost_id && hint.cost_amount > 0" class="text-muted">{{ t('ticket.unlockCost', { cost: `${currency[hint.cost_id]?.name ?? ''} ${intPrecString(hint.cost_amount, currency[hint.cost_id]?.prec || 0)}` }) }}</span>
                </span>
                <u-button class="shrink-0 cursor-pointer" color="success" variant="soft" size="xs" :loading="purchaseLoading" :disabled="!checkEnough(hint) || calcCooldown(hint) > 0" @click="purchaseHint(hint.id)">{{ t('hints.unlock') }}</u-button>
              </div>
            </template>
          </u-popover>
        </u-tooltip>
        <u-tooltip v-else :disabled="checkEnough(hint)" arrow :text="t('hints.waitOver')">
          <u-button variant="soft" size="xs" icon="material-symbols:hourglass-outline-rounded" :disabled="true"> {{ formatTime(calcCooldown(hint)) }} </u-button>
        </u-tooltip>
      </template>
      <rbph-content v-if="hint.state" :content="hint.state" />
    </rbph-collapsible-content-card>
  </div>
  <u-empty v-else-if="processedData" icon="material-symbols:contact-support-outline-rounded" :title="t('hints.noHints')" :description="t('hints.noAvailable')" />
</template>
