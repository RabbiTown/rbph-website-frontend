<script setup lang="ts">
import { useLocale } from 'reka-ui';

type DurationSegment = 'hour' | 'minute' | 'second';

const props = withDefaults(
  defineProps<{
    maxSeconds?: number;
    disabled?: boolean;
    icon?: string;
    ariaLabel?: string;
    variant?: 'soft' | 'subtle';
    locale?: string;
  }>(),
  {
    maxSeconds: 24 * 60 * 60,
    disabled: false,
    icon: undefined,
    ariaLabel: undefined,
    variant: 'soft',
    locale: undefined,
  },
);

const model = defineModel<number>({ default: 0 });
const locale = useLocale(toRef(props, 'locale'));
const root = ref<HTMLElement>();
const activeSegment = ref<DurationSegment>();
const inputBuffer = ref('');
let inputBufferTimer: ReturnType<typeof setTimeout> | undefined;

const maximumSeconds = computed(() => {
  const value = Math.trunc(props.maxSeconds);
  if (!Number.isFinite(value)) return 24 * 60 * 60;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, value));
});

const parts = computed(() => {
  const value = Math.min(maximumSeconds.value, Math.max(0, Math.trunc(model.value)));
  return {
    hour: Math.floor(value / 3600),
    minute: Math.floor((value % 3600) / 60),
    second: value % 60,
  };
});

const numberFormatter = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      useGrouping: false,
      minimumIntegerDigits: 2,
      maximumFractionDigits: 0,
    }),
);

const formattedDuration = computed(
  () => `${formatSegment(parts.value.hour)}:${formatSegment(parts.value.minute)}:${formatSegment(parts.value.second)}`,
);

const variantClass = computed(() =>
  props.variant === 'subtle'
    ? 'bg-elevated ring ring-inset ring-accented'
    : 'bg-elevated/50 hover:bg-elevated focus-visible:bg-elevated',
);

watch(
  [model, maximumSeconds],
  ([value, maximum]) => {
    const normalized = Math.min(maximum, Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
    if (value !== normalized) model.value = normalized;
  },
  { immediate: true },
);

onBeforeUnmount(clearInputBuffer);

function formatSegment(value: number) {
  return numberFormatter.value.format(value);
}

function segmentMaximum(segment: DurationSegment) {
  if (segment === 'hour') return Math.floor(maximumSeconds.value / 3600);

  const afterHours = Math.max(0, maximumSeconds.value - parts.value.hour * 3600);
  if (segment === 'minute') return Math.min(59, Math.floor(afterHours / 60));

  return Math.min(59, Math.max(0, afterHours - parts.value.minute * 60));
}

function segmentValue(segment: DurationSegment) {
  return parts.value[segment];
}

function setSegmentValue(segment: DurationSegment, value: number) {
  const next = { ...parts.value, [segment]: value };
  model.value = Math.min(maximumSeconds.value, next.hour * 3600 + next.minute * 60 + next.second);
}

function nextSegment(segment: DurationSegment): DurationSegment | undefined {
  if (segment === 'hour') return 'minute';
  if (segment === 'minute') return 'second';
  return undefined;
}

function previousSegment(segment: DurationSegment): DurationSegment | undefined {
  if (segment === 'second') return 'minute';
  if (segment === 'minute') return 'hour';
  return undefined;
}

function clearInputBuffer() {
  inputBuffer.value = '';
  if (inputBufferTimer !== undefined) {
    clearTimeout(inputBufferTimer);
    inputBufferTimer = undefined;
  }
}

function scheduleInputBufferReset() {
  if (inputBufferTimer !== undefined) clearTimeout(inputBufferTimer);
  inputBufferTimer = setTimeout(() => {
    inputBuffer.value = '';
    inputBufferTimer = undefined;
  }, 1000);
}

function focusSegment(segment: DurationSegment) {
  clearInputBuffer();
  activeSegment.value = segment;
  root.value?.focus();
}

function activateSegment(segment: DurationSegment) {
  if (props.disabled) return;
  focusSegment(segment);
}

function moveToNextSegment(segment: DurationSegment) {
  const next = nextSegment(segment);
  if (next) focusSegment(next);
  return next;
}

function enterDigit(segment: DurationSegment, digit: string) {
  const maximum = segmentMaximum(segment);
  const candidateText = `${activeSegment.value === segment ? inputBuffer.value : ''}${digit}`;
  const candidate = Number(candidateText);

  if (candidate > maximum) {
    if (segment === 'second') {
      const restartedValue = Number(digit);
      setSegmentValue(segment, restartedValue <= maximum ? restartedValue : 0);
      inputBuffer.value = restartedValue <= maximum ? digit : '';
      if (inputBuffer.value) scheduleInputBufferReset();
      return;
    }

    const next = moveToNextSegment(segment);
    if (next) enterDigit(next, digit);
    return;
  }

  setSegmentValue(segment, candidate);
  inputBuffer.value = candidateText;
  scheduleInputBufferReset();

  const maximumDigits = segment === 'hour' ? Math.max(1, String(maximum).length) : 2;
  const segmentComplete = candidateText.length >= maximumDigits || candidate * 10 > maximum;
  if (!segmentComplete) return;

  if (segment === 'second') clearInputBuffer();
  else moveToNextSegment(segment);
}

function adjustSegment(segment: DurationSegment, amount: number) {
  clearInputBuffer();
  const value = Math.min(segmentMaximum(segment), Math.max(0, segmentValue(segment) + amount));
  setSegmentValue(segment, value);
}

function onFocus() {
  if (!activeSegment.value) activeSegment.value = 'hour';
}

function onBlur() {
  activeSegment.value = undefined;
  clearInputBuffer();
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return;
  const segment = activeSegment.value ?? 'hour';

  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    enterDigit(segment, event.key);
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    const previous = previousSegment(segment);
    if (previous) focusSegment(previous);
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    const next = nextSegment(segment);
    if (next) focusSegment(next);
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    adjustSegment(segment, event.key === 'ArrowUp' ? 1 : -1);
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    clearInputBuffer();
    setSegmentValue(segment, 0);
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
    event.preventDefault();
  }
}

defineExpose({
  focus: () => root.value?.focus(),
});
</script>

<template>
  <div
    ref="root"
    role="group"
    :tabindex="disabled ? -1 : 0"
    :aria-label="ariaLabel"
    :aria-disabled="disabled"
    :aria-valuetext="formattedDuration"
    :lang="locale"
    class="group relative inline-block rounded-md px-2.5 py-1.5 text-sm/4 text-highlighted select-none transition-colors focus-visible:outline-none"
    :class="[variantClass, { 'cursor-not-allowed opacity-75': disabled }]"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="onKeydown"
  >
    <div class="flex items-center gap-0.5">
      <u-icon v-if="icon" :name="icon" class="me-1 size-4 shrink-0 text-dimmed" />
      <span
        class="min-w-[2ch] cursor-text rounded px-1 text-center tabular-nums transition-colors"
        :class="{ 'bg-primary/10 text-primary': activeSegment === 'hour' }"
        @pointerdown.prevent="activateSegment('hour')"
      >
        {{ formatSegment(parts.hour) }}
      </span>
      <span class="pointer-events-none text-muted">:</span>
      <span
        class="min-w-[2ch] cursor-text rounded px-1 text-center tabular-nums transition-colors"
        :class="{ 'bg-primary/10 text-primary': activeSegment === 'minute' }"
        @pointerdown.prevent="activateSegment('minute')"
      >
        {{ formatSegment(parts.minute) }}
      </span>
      <span class="pointer-events-none text-muted">:</span>
      <span
        class="min-w-[2ch] cursor-text rounded px-1 text-center tabular-nums transition-colors"
        :class="{ 'bg-primary/10 text-primary': activeSegment === 'second' }"
        @pointerdown.prevent="activateSegment('second')"
      >
        {{ formatSegment(parts.second) }}
      </span>
    </div>
  </div>
</template>
