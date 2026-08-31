<script setup lang="ts">
const props = withDefaults(defineProps<{
  success?: boolean;
  cooldownTill?: string;
  maxSubmit?: number | null;
  submitCount?: number;
  externallyBlocked?: boolean;
  blockedHint?: string;
  feedback?: 'host-toast' | 'none';
}>(), {
  success: false,
  cooldownTill: undefined,
  maxSubmit: undefined,
  submitCount: undefined,
  externallyBlocked: false,
  blockedHint: '',
  feedback: 'host-toast',
});

const emit = defineEmits<{
  submit: [answer: string];
  'submit-success': [result: unknown, answer: string];
  'submit-fail': [reason: string, answer: string];
}>();
const rbph = useRbtContext();
const answer = ref('');
const submitting = ref(false);
const color = ref<'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral'>('neutral');

const cooldown = computed(() => {
  const till = props.cooldownTill ? new Date(props.cooldownTill).getTime() : 0;
  return Math.max(0, till - rbph.sync.time.currentTime.value);
});
const submitCount = computed(() => Number.isFinite(props.submitCount) ? props.submitCount! : 0);
const remaining = computed(() => props.maxSubmit == null
  ? undefined
  : Math.max(0, props.maxSubmit - submitCount.value));
const blocked = computed(() => props.externallyBlocked || cooldown.value > 0 || remaining.value === 0 || !rbph.actions.submitAnswer);
const inputStyle = computed(() => {
  if (cooldown.value > 0) return { placeholder: rbph.i18n.t('puzzleSubmit.cooldown', { time: rbph.utils.formatTime(cooldown.value) }), icon: 'material-symbols:schedule-outline-rounded' };
  if (remaining.value === 0) return { placeholder: rbph.i18n.t('puzzleSubmit.remainingZero', { max: props.maxSubmit ?? 0 }), icon: 'material-symbols:block-outline' };
  if (props.externallyBlocked) return { placeholder: props.blockedHint || rbph.i18n.t('puzzleSubmit.blocked'), icon: 'material-symbols:lock-outline' };
  if (props.success) return { placeholder: rbph.i18n.t('puzzleSubmit.solved'), icon: 'material-symbols:check-rounded' };
  return { placeholder: rbph.i18n.t('puzzleSubmit.placeholder'), icon: 'material-symbols:send-outline-rounded' };
});
const hint = computed(() => {
  if (props.blockedHint) return props.blockedHint;
  if (remaining.value !== undefined) return rbph.i18n.t('puzzleSubmit.remaining', { remain: remaining.value, max: props.maxSubmit ?? remaining.value });
  return '';
});

watch(() => props.success, value => { color.value = value ? 'success' : color.value; }, { immediate: true });
watch(() => props.cooldownTill, () => { if (cooldown.value > 0) answer.value = ''; }, { immediate: true });

async function submit() {
  const value = answer.value;
  if (!value.trim() || blocked.value || submitting.value || !rbph.actions.submitAnswer) return;
  submitting.value = true;
  emit('submit', value);
  try {
    const result = await rbph.actions.submitAnswer(value, { feedback: props.feedback });
    const action = (result as { result?: { action?: RbJudgeAction } })?.result?.action;
    if (!props.success && action !== undefined) color.value = rbph.judgeActionConsts.value[action].color;
    emit('submit-success', result, value);
  } catch (error) {
    emit('submit-fail', error instanceof Error ? error.message : String(error), value);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="w-full">
    <div class="w-full flex">
      <u-input
        v-model="answer"
        class="flex-1"
        variant="subtle"
        :leading-icon="inputStyle.icon"
        :color="color"
        :placeholder="inputStyle.placeholder"
        :disabled="blocked"
        :ui="{ trailing: 'pe-0', base: 'rounded-none rounded-l-lg' }"
        @keyup.enter="submit"
      />
      <u-button
        class="-ms-px justify-center cursor-pointer h-full rounded-none rounded-r-lg px-3"
        variant="subtle"
        :color="color"
        :loading="submitting"
        :disabled="blocked || !answer.trim()"
        @click="submit"
      >{{ rbph.i18n.t('puzzleSubmit.submit') }}</u-button>
    </div>
    <div v-if="hint" class="mt-1 text-right text-xs text-muted">{{ hint }}</div>
  </div>
</template>
