<script setup lang="ts">const { t } = useI18n();


const props = defineProps<{
  modelValue?: RbTextColor;
}>();

const emit = defineEmits<{
  update: [value: RbTextColor, close?: boolean];
}>();

const customColor = ref(normalizeTextColor(props.modelValue) ?? '#ef4444');
const customColorPreview = computed(() => normalizeTextColor(customColor.value));

watch(
  () => props.modelValue,
  value => {
    customColor.value = normalizeTextColor(value) ?? customColor.value;
  },
);

function selectColor(value: RbTextColor, close = true) {
  emit('update', value, close);
}

function selectCustomColor(event: Event) {
  const rawValue = (event.target as HTMLInputElement).value;
  customColor.value = rawValue;

  const color = normalizeTextColor(rawValue);
  if (!color) return;

  customColor.value = color;
  selectColor(color, false);
}

function isSelected(value: RbTextColor) {
  return normalizeTextColor(value) === normalizeTextColor(props.modelValue);
}
</script>

<template>
  <div class="w-64 space-y-2 p-2">
    <div class="flex items-center justify-between gap-2">
      <u-button color="neutral" variant="ghost" size="xs" icon="material-symbols:format-color-reset-rounded" :label="t('components.rbColorPickerPanel.default')" :active="!modelValue" @click="selectColor(null)" />

      <label class="flex h-7 w-32 items-center gap-1.5 rounded-md bg-elevated px-1.5 ring ring-inset ring-default">
        <span class="size-4 shrink-0 rounded ring ring-inset ring-default" :style="{ backgroundColor: customColorPreview ?? 'transparent' }" />
        <input :value="customColor" class="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" spellcheck="false" placeholder="#hex" @input="selectCustomColor">
      </label>
    </div>

    <div class="grid grid-cols-10 gap-1">
      <button
        v-for="color in rbTextColorGrid"
        :key="color.value"
        type="button"
        class="grid size-5 place-items-center rounded-md ring ring-inset ring-default transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="isSelected(color.value) ? 'ring-2 ring-primary' : ''"
        :style="{ backgroundColor: color.value }"
        :aria-label="color.label"
        @click="selectColor(color.value)"
      >
        <u-icon v-if="isSelected(color.value)" name="material-symbols:check-small-rounded" class="size-4 text-white drop-shadow" />
      </button>
    </div>
  </div>
</template>
