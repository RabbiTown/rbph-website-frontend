<script setup lang="ts">
import type { Toast } from '@nuxt/ui/runtime/composables/useToast.js';

const props = defineProps<{
  puzzle?: number;
  success?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', answer: string): void;
  (e: 'submit-success', result: RbJudgeResult, answer: string): void;
  (e: 'submit-fail', reason: string, answer: string): void;
}>();

const api = useApi();
const toast = useToast();

const state = reactive({
  answer: '',
});

const color = ref<'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral'>();

watch(
  () => props.puzzle,
  async () => {
    color.value = props.success ? 'success' : 'neutral';
  },
  { immediate: true }
);

watch(
  () => props.success,
  async () => {
    color.value = props.success ? 'success' : color.value;
  },
  { immediate: true }
);

const submitLoading = ref(false);

async function submitAnswer(answer: string) {
  submitLoading.value = true;

  let curToast: Toast | undefined = undefined;
  try {
    curToast = toast.add({
      title: '提交答案中…',
      description: '请耐心等待。',
      color: judgeActionConsts[RbJudgeAction.Pending].color,
      icon: judgeActionConsts[RbJudgeAction.Pending].icon,
      duration: Infinity,
    });

    const { data } = await api.post<RbJudgeResult>(`/puzzles/${props.puzzle}/submit`, { answer }, { errorHints: { [-1]: '答案无效。', [-2]: '已经提交过这个答案了！' } });
    const action = judgeActionConsts[data.action];

    const toastData = {
      title: h('span', [h('span', { class: `font-bold text-${action.color}` }, action.name), ` [${answer}]`]),
      description: data.result || action.desc,
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

    submitLoading.value = false;
    return data;
  } catch (error) {
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
  if (!submitLoading.value && state.answer.trim()) {
    const answer = state.answer;
    emit('submit', answer);
    submitAnswer(answer)
      .then(result => {
        emit('submit-success', result, answer);
      })
      .catch(reason => emit('submit-fail', reason, answer));
  }
}
</script>

<template>
  <div class="w-full flex">
    <u-input
      v-model="state.answer"
      class="flex-1"
      variant="subtle"
      :leading-icon="success ? 'material-symbols:check-rounded' : 'material-symbols:send-outline-rounded'"
      :color="color"
      :placeholder="success ? '你的队伍已通过本题' : '提交答案'"
      :ui="{ trailing: 'pe-0', base: 'rounded-none rounded-l-lg' }"
      @keyup.enter="submit"
    />
    <u-button :loading="submitLoading" :disabled="state.answer.trim().length < 1" :color="color" class="-ms-px justify-center cursor-pointer h-full rounded-none rounded-r-lg px-3" variant="subtle" @click="submit">提交</u-button>
  </div>
</template>
