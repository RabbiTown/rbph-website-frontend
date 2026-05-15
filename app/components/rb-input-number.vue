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

const displayValue = computed<number | null>({
  get() {
    return model.value === null || model.value === undefined ? null : model.value / 10 ** props.prec;
  },
  set(value) {
    model.value = value === null || value === undefined ? null : Math.round(value * 10 ** props.prec);
  },
});

const displayStep = computed(() => {
  const step = attrs.step as number | undefined;
  return step === undefined ? 1 : step / 10 ** props.prec;
});

const formatOptions = computed(() => ({
  minimumFractionDigits: props.prec,
  maximumFractionDigits: props.prec,
}));
</script>

<template>
  <u-input-number v-bind="attrs" v-model="displayValue" :step="displayStep" :step-snapping="false" :format-options="formatOptions" />
</template>
