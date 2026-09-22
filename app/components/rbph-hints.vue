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
const syncingHintCooldowns = ref(false);
let hintCooldownTimer: ReturnType<typeof setTimeout> | undefined = undefined;
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

interface SyncHintCooldownsResponse extends RbPuzzleHintTeamData {
  server_time: string;
}

interface HintPurchaseResponse extends RbHintTeamState {
  unlocks?: { id: number; slug?: string | null; title: string; round_id: number; round_slug?: string | null }[];
  content_changed?: boolean;
}

function clearHintCooldownTimer() {
  if (hintCooldownTimer) {
    clearTimeout(hintCooldownTimer);
    hintCooldownTimer = undefined;
  }
}

function hintCooldownUntil(hint: RbHint) {
  if (!hint.cooldown_until) return Infinity;
  const cooldownUntil = new Date(hint.cooldown_until).getTime();
  return Number.isNaN(cooldownUntil) ? Infinity : cooldownUntil;
}

function scheduleHintCooldownSync(nextCooldownAt: string | null | undefined) {
  clearHintCooldownTimer();
  if (!props.puzzleId || !rawData.value) return;
  if (!nextCooldownAt) return;

  const target = new Date(nextCooldownAt).getTime();
  if (!Number.isFinite(target)) return;

  const delay = Math.max(target - currentTime.value + 250, 0);
  hintCooldownTimer = setTimeout(
    () => {
      syncHintCooldowns();
    },
    Math.min(delay, 2_147_483_647),
  );
}

async function syncHintCooldowns() {
  if (!props.puzzleId || syncingHintCooldowns.value) return;

  syncingHintCooldowns.value = true;
  try {
    const { data } = await api.post<SyncHintCooldownsResponse>(`/puzzles/${props.puzzleId}/hints/sync`, {});
    useSyncTime().syncWith(new Date(data.server_time));
    rawData.value = {
      data: data.data,
      state: data.state,
      next_cooldown_at: data.next_cooldown_at,
    };
    scheduleHintCooldownSync(data.next_cooldown_at);
  } catch (error) {
    console.warn('Failed to sync hint cooldowns', error);
    hintCooldownTimer = setTimeout(() => {
      syncHintCooldowns();
    }, 15_000);
  } finally {
    syncingHintCooldowns.value = false;
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
      scheduleHintCooldownSync(data.next_cooldown_at);
    } catch (error) {
      handleError(error, t('hints.getFailed'));
    }
  }
}

const purchaseLoading = ref(false);
const purchaseConfirmId = ref<number>();

async function purchaseHint(hintId: number) {
  if (syncingHintCooldowns.value) {
    pendingPurchaseHintIds.add(hintId);
    return;
  }

  const target = rawData.value?.data.find(hint => hint.id === hintId);
  if (purchaseLoading.value || !target || !target.enabled || calcCooldown(target) > 0 || !checkEnough(target) || rawData.value?.state.some(hint => hint.id === hintId)) return;
  const api = useApi();
  const sid = sidStore.create('hint-purchase');

  purchaseLoading.value = true;

  try {
    const hint = rawData.value?.data.find(x => x.id === hintId);

    const { data } = await api.post<HintPurchaseResponse>(
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
    if (data.unlocks?.length) useGame().updateRoundState();
    if (data.content_changed) {
      await updateData();
      await usePuzzle().updateContents();
    }
  } catch (error) {
    sidStore.clear(sid);
    handleError(error, t('hints.purchaseFailed'));
  }

  purchaseLoading.value = false;
}

async function flushPendingHintPurchases() {
  while (!syncingHintCooldowns.value && !purchaseLoading.value && pendingPurchaseHintIds.size > 0) {
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
  return Math.max(hintCooldownUntil(hint) - currentTime.value, 0);
}

watch(
  () => props.puzzleId,
  async new_id => {
    clearHintCooldownTimer();
    pendingPurchaseHintIds.clear();
    purchaseConfirmId.value = undefined;
    rawData.value = undefined;
    updateData(new_id);
  },
  { immediate: true },
);

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    syncHintCooldowns();
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onUnmounted(() => {
  clearHintCooldownTimer();
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
          v-if="hint.enabled && !calcCooldown(hint)"
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
                </span>
                <u-button class="shrink-0 cursor-pointer" color="success" variant="soft" size="xs" :loading="purchaseLoading" :disabled="!checkEnough(hint) || calcCooldown(hint) > 0" @click="purchaseHint(hint.id)">{{ t('hints.unlock') }}</u-button>
              </div>
            </template>
          </u-popover>
        </u-tooltip>
        <u-tooltip v-else-if="hint.enabled" arrow :text="t('hints.cooldownPending')">
          <u-button variant="soft" size="xs" icon="material-symbols:hourglass-outline-rounded" :disabled="true"> {{ formatTime(calcCooldown(hint)) }} </u-button>
        </u-tooltip>
        <u-tooltip v-else arrow :text="t('hints.notEnabledDescription')">
          <u-button variant="soft" size="xs" icon="material-symbols:block-outline-rounded" :disabled="true">{{ t('hints.notEnabled') }}</u-button>
        </u-tooltip>
      </template>
      <rbph-content v-if="hint.state" :content="hint.state" />
    </rbph-collapsible-content-card>
  </div>
  <u-empty v-else-if="processedData" icon="material-symbols:contact-support-outline-rounded" :title="t('hints.noHints')" :description="t('hints.noAvailable')" />
</template>
