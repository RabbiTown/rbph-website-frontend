<script setup lang="ts">
const model = defineModel<number | null>({ default: null });

const props = withDefaults(
  defineProps<{
    prec?: number;
  }>(),
  {
    prec: 0,
  },
);

const attrs = useAttrs();
const scale = computed(() => 10 ** props.prec);

const displayValue = computed<number | null>({
  get() {
    return model.value === null || model.value === undefined ? null : model.value / scale.value;
  },
  set(value) {
    model.value = value === null || value === undefined ? null : Math.round(value * scale.value);
  },
});

const displayStep = computed(() => {
  const step = attrs.step as number | undefined;
  return step === undefined ? 1 : step / scale.value;
});

const displayMin = computed(() => {
  const min = attrs.min as number | undefined;
  return min === undefined ? undefined : min / scale.value;
});

const displayMax = computed(() => {
  const max = attrs.max as number | undefined;
  return max === undefined ? undefined : max / scale.value;
});

const formatOptions = computed(() => ({
  minimumFractionDigits: props.prec,
  maximumFractionDigits: props.prec,
}));
</script>

<template>
  <u-input-number
    v-bind="attrs"
    v-model="displayValue"
    :min="displayMin"
    :max="displayMax"
    :step="displayStep"
    :step-snapping="false"
    :format-options="formatOptions"
  />
</template>
