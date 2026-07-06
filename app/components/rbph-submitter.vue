<script setup lang="ts">
const props = defineProps<{
  puzzle?: number;
  success?: boolean;
  cooldownTill?: string;
  maxSubmit?: number | null;
  submitCount?: number;
  externallyBlocked?: boolean;
  blockedHint?: string;
}>();

const emit = defineEmits<{
  (e: 'submit', answer: string): void;
  (e: 'submit-success', resp: RbJudgeResponse, answer: string): void;
  (e: 'submit-fail', reason: string, answer: string): void;
}>();

const api = useApi();
const toast = useToast();
const sidStore = useSid();

const currentTime = useCurrentTimeSec();

const state = reactive({
  answer: '',
});

const color = ref<'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral'>();

watch(
  () => props.puzzle,
  async () => {
    color.value = props.success ? 'success' : 'neutral';
  },
  { immediate: true },
);

watch(
  () => props.success,
  async () => {
    color.value = props.success ? 'success' : color.value;
  },
  { immediate: true },
);

const cooldown = computed(() => {
  const till = props.cooldownTill ? new Date(props.cooldownTill).getTime() : undefined;
  if (!till) return 0;
  return Math.max(till - currentTime.value, 0);
});
const maxSubmit = computed(() => props.maxSubmit ?? undefined);
const submitCount = computed(() => (Number.isFinite(props.submitCount) ? props.submitCount! : 0));
const remainSubmit = computed(() => (maxSubmit.value === undefined ? undefined : Math.max(0, maxSubmit.value - submitCount.value)));
const submitBlocked = computed(() => cooldown.value > 0 || remainSubmit.value === 0 || props.externallyBlocked);

watch(
  () => props.cooldownTill,
  async () => {
    if (cooldown.value > 0) {
      state.answer = '';
    }
  },
  { immediate: true },
);

const submitLoading = ref(false);

async function submitAnswer(answer: string) {
  submitLoading.value = true;
  const sid = sidStore.create('puzzle-submit');

  let curToast: Toast | undefined = undefined;
  try {
    curToast = toast.add({
      title: '提交答案中…',
      description: '请耐心等待。',
      color: judgeActionConsts[RbJudgeAction.Pending].color,
      icon: judgeActionConsts[RbJudgeAction.Pending].icon,
      duration: Infinity,
    });

    const { data } = await api.post<RbJudgeResponse>(`/puzzles/${props.puzzle}/submit`, { answer, sid }, { errorHints: { [-1]: '答案无效。', [-2]: '已经提交过这个答案了！', [-3]: '目前不允许提交。' } });
    const result = data.result;

    const action = judgeActionConsts[result.action];
    const currencyPenaltySuffix = formatCurrencyPenaltySuffix(data.currency_penalty);
    const description = result.result || action.desc;

    const toastData = {
      title: h('span', [h('span', { class: `font-bold text-${action.color}` }, action.name), ` [${answer}]`]),
      description: currencyPenaltySuffix ? `${description} ${currencyPenaltySuffix}` : description,
      icon: action.icon,
      color: action.color,
      duration: 10000,
    };

    if (curToast && toast.toasts.value.find(x => x.id === curToast?.id)) {
      toast.update(curToast.id, toastData);
    } else {
      toast.add(toastData);
    }

    if (!props.success) {
      color.value = action.color;
    }

    if (data.unlocks && data.unlocks.length > 0) {
      toast.add({
        title: `解锁了新的谜题！`,
        actions: data.unlocks.map(puzzle => {
          return {
            icon: 'material-symbols:arrow-forward-rounded',
            label: puzzle.title,
            variant: 'soft',
            to: gamePuzzleSimpleRoute(useGame().ref.value?.id, puzzle),
          };
        }),
        color: 'success',
        icon: 'material-symbols:extension-outline-rounded',
        duration: 10000,
        ui: { actions: 'flex-wrap' },
      });
    }

    useCurrency().updateData();
    submitLoading.value = false;
    return data;
  } catch (error) {
    sidStore.clear(sid);
    const toastData = { duration: 5000, ...getErrorToast(error, `提交失败 [${answer}]`, true) };
    toastData.description = toastData.description || '请尝试稍后重新提交。';

    if (curToast) {
      toast.update(curToast.id, toastData);
    } else {
      toast.add(toastData);
    }

    submitLoading.value = false;
    throw toastData.description;
  }
}

function submit() {
  if (!submitLoading.value && !submitBlocked.value && state.answer.trim()) {
    const answer = state.answer;
    emit('submit', answer);
    submitAnswer(answer)
      .then(result => {
        emit('submit-success', result, answer);
      })
      .catch(reason => emit('submit-fail', reason, answer));
  }
}

const inputStyle = computed(() => {
  if (cooldown.value > 0) return { placeholder: `提交冷却中：${formatTime(cooldown.value)}`, icon: 'material-symbols:schedule-outline-rounded' };
  if (remainSubmit.value === 0) return { placeholder: `剩余提交次数：0/${maxSubmit.value}`, icon: 'material-symbols:block-outline' };
  if (props.externallyBlocked) return { placeholder: props.blockedHint || '尚未满足答案提交要求', icon: 'material-symbols:lock-outline' };
  if (props.success) return { placeholder: `你的队伍已通过本题`, icon: 'material-symbols:check-rounded' };
  return { placeholder: `提交答案`, icon: 'material-symbols:send-outline-rounded' };
});
const submitHint = computed(() => props.blockedHint || (maxSubmit.value === undefined ? undefined : `剩余提交次数：${remainSubmit.value}/${maxSubmit.value}`));
</script>

<template>
  <div class="w-full">
    <div class="w-full flex">
      <u-input
        v-model="state.answer"
        class="flex-1"
        variant="subtle"
        :leading-icon="inputStyle.icon"
        :color="color"
        :placeholder="inputStyle.placeholder"
        :ui="{ trailing: 'pe-0', base: 'rounded-none rounded-l-lg' }"
        :disabled="submitBlocked"
        @keyup.enter="submit"
      />
      <u-button :loading="submitLoading" :disabled="state.answer.trim().length < 1 || submitBlocked" :color="color" class="-ms-px justify-center cursor-pointer h-full rounded-none rounded-r-lg px-3" variant="subtle" @click="submit">提交</u-button>
    </div>
    <div v-if="submitHint" class="mt-1 text-right text-xs text-muted">
      {{ submitHint }}
    </div>
  </div>
</template>
