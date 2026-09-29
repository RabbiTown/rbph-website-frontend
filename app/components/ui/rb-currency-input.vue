<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    currency: Pick<RbTeamCurrency, 'prec' | 'max_amount'>;
    min?: number;
    step?: number;
  }>(),
  {
    min: 0,
    step: undefined,
  },
);

const model = defineModel<number | null>({ default: null });
const inputValue = defineModel<number | null>('inputValue', { default: null });
const { locale } = useI18n();

watch(
  model,
  value => {
    inputValue.value = value;
  },
  { immediate: true },
);

function parseLocalizedNumber(value: string) {
  const parts = new Intl.NumberFormat(locale.value).formatToParts(12345.6);
  const group = parts.find(part => part.type === 'group')?.value;
  const decimal = parts.find(part => part.type === 'decimal')?.value;
  let normalized = value.trim();
  if (!normalized) return null;
  if (group) normalized = normalized.replaceAll(group, '');
  if (decimal && decimal !== '.') normalized = normalized.replace(decimal, '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function updateInputValue(event: Event) {
  const value = parseLocalizedNumber((event.target as HTMLInputElement).value);
  inputValue.value = value === null ? null : Math.round(value * 10 ** props.currency.prec);
}

function commitInputValue(value: number | null) {
  inputValue.value = value;
}
</script>

<template>
  <rb-input-number
    v-bind="$attrs"
    v-model="model"
    :prec="currency.prec"
    :min="min"
    :max="currency.max_amount"
    :step="step"
    @input="updateInputValue"
    @update:model-value="commitInputValue"
  />
</template>
