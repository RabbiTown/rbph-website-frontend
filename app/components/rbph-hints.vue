<script setup lang="ts">
const props = defineProps<{
  puzzleId?: number;
  utimeAt?: string;
}>();

const utimeAtMs = computed(() => new Date(props.utimeAt || '').getTime());

const api = useApi();
const toast = useToast();
const currency = useCurrency().getAllCurrent();
const syncTime = useSyncTime().currentTimeRef;

const currentTime = ref(0);

watch(
  syncTime,
  () => {
    currentTime.value = syncTime.value;
  },
  { immediate: true }
);

setInterval(() => {
  currentTime.value += 1000;
}, 1000);

const rawData = ref<RbPuzzleHintTeamData>();

const processedData = computed(() => {
  if (!rawData.value) return undefined;
  return rawData.value.data.map(x => {
    return {
      ...x,
      state: rawData.value?.state.find(s => s.id === x.id),
    };
  });
});

let fetchToken = 0;
async function updateData(newId: number | undefined = undefined) {
  const token = ++fetchToken;

  const puzzleId = newId || props.puzzleId;
  if (puzzleId) {
    try {
      const { data } = await api.get<RbPuzzleHintTeamData>(`/puzzles/${puzzleId}/hints`);
      if (token !== fetchToken) return;

      rawData.value = data;
    } catch (error) {
      handleError(error, '获取提示失败');
    }
  }
}

const purchaseLoading = ref(false);

async function purchaseHint(hintId: number) {
  const api = useApi();

  purchaseLoading.value = true;

  try {
    const hint = rawData.value?.data.find(x => x.id === hintId);

    const { data } = await api.post<RbHintTeamState>(
      `/hints/${hintId}/purchase`,
      {},
      {
        errorHints: {
          [-2]: '余额不足。',
          [-1]: '提示不存在或已购买。',
        },
      }
    );

    if (rawData.value && rawData.value?.data.find(x => x.id === hintId)) {
      rawData.value.state.push(data);
    }

    if (hint) {
      const cur = currency.value[hint.cost_id];
      toast.add({
        title: '已购买提示',
        description: `已花费 ${intPrecString(hint.cost_amount, cur?.prec || 0)} ${cur?.name} 购买提示【${hint.title}】`,
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
    }

    useCurrency().updateData();
  } catch (error) {
    handleError(error, '提示购买失败');
  }

  purchaseLoading.value = false;
}

function checkEnough(hint: RbHint): boolean {
  const cur = currency.value[hint.cost_id];
  return cur ? cur.current >= hint.cost_amount : false;
}

function calcCooldown(hint: RbHint): number {
  if (!props.utimeAt) return Infinity;
  console.log(Math.max(hint.cooldown * 1000 - (currentTime.value - utimeAtMs.value), 0));
  return Math.max(hint.cooldown * 1000 - (currentTime.value - utimeAtMs.value), 0);
}

watch(
  () => props.puzzleId,
  async new_id => {
    rawData.value = undefined;
    updateData(new_id);
  },
  { immediate: true }
);

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
          <icon :class="['align-middle me-2', hint.state ? 'text-success' : 'text-error']" :name="hint.state ? 'material-symbols:lock-open-right-outline-rounded' : 'material-symbols:lock-outline'" />
          <div :class="['text-sm flex-1', !hint.state ? 'text-secondary' : '']">
            {{ hint.title }}
          </div>
          <template v-if="!hint.state">
            <u-tooltip v-if="!calcCooldown(hint)" :disabled="checkEnough(hint)" arrow :text="`还需 ${intPrecString(hint.cost_amount - (currency[hint.cost_id]?.current || 0), currency[hint.cost_id]?.prec || 0)} ${currency[hint.cost_id]?.name}`">
              <u-button variant="soft" size="xs" class="cursor-pointer -my-8" icon="material-symbols:emoji-objects-outline-rounded" :loading="purchaseLoading" :disabled="!checkEnough(hint)" @click="() => purchaseHint(hint.id)">
                <template v-if="hint.cost_amount === 0"> 解锁 </template>
                <template v-else> {{ currency[hint.cost_id]?.name }} {{ intPrecString(-hint.cost_amount, currency[hint.cost_id]?.prec || 0, true, ' ') }} </template>
              </u-button>
            </u-tooltip>
            <u-tooltip v-else :disabled="checkEnough(hint)" arrow text="等待时间结束后才可购买">
              <u-button variant="soft" size="xs" class="-my-8" icon="material-symbols:hourglass-outline-rounded" :disabled="true"> {{ formatTime(calcCooldown(hint)) }} </u-button>
            </u-tooltip>
          </template>
          <icon v-else name="material-symbols:expand-more-rounded" class="-me-1 size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
        </div>
        <template v-if="hint.state" #content>
          <div class="px-4 py-px border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
            <rbph-content :content="hint.state" />
          </div>
        </template>
      </u-collapsible>
    </u-card>
  </div>
  <u-empty v-else-if="processedData" icon="material-symbols:contact-support-outline-rounded" title="暂无提示" description="没有可用提示" />
</template>
