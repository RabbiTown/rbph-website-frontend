<script setup lang="ts">const { t } = useI18n();


interface PuzzleSelectItem extends UnlockPuzzleOptionData {
  label: string;
  icon: string;
}

const props = defineProps<{
  puzzles: UnlockPuzzleOptionData[];
  placeholder?: string;
  emptyLabel?: string;
  multiple?: boolean;
  disabled?: boolean;
  loading?: boolean;
}>();
const placeholderText = computed(() => props.placeholder ?? t('admin.common.selectOrPuzzleFilterPlaceholder'));

const model = defineModel<number | number[] | null>({ required: true });
const emptyValue = 'none';
const searchTerm = ref('');

const items = computed(() => {
  const puzzles: PuzzleSelectItem[] = props.puzzles.map(puzzle => ({
    ...puzzle,
    label: puzzle.slug ? `${puzzle.title} (#${puzzle.id}, ${puzzle.slug})` : `${puzzle.title} (#${puzzle.id})`,
    icon: 'material-symbols:extension-outline-rounded',
  }));
  return props.emptyLabel && !props.multiple
    ? [{ label: props.emptyLabel, id: emptyValue, icon: 'material-symbols:public-rounded' }, ...puzzles]
    : puzzles;
});

const selection = computed<number | string | number[]>({
  get: () => {
    if (props.multiple) return Array.isArray(model.value) ? model.value : [];
    return typeof model.value === 'number' ? model.value : emptyValue;
  },
  set: value => {
    if (Array.isArray(value)) model.value = value.map(Number);
    else model.value = value === emptyValue ? null : Number(value);
  },
});

const selectedIcon = computed(() => {
  if (props.multiple) return 'material-symbols:extension-outline-rounded';
  return model.value === null ? 'material-symbols:public-rounded' : 'material-symbols:extension-outline-rounded';
});
</script>

<template>
  <u-select-menu
    v-model="selection"
    v-model:search-term="searchTerm"
    :items="items"
    value-key="id"
    label-key="label"
    :filter-fields="['label']"
    :multiple="multiple"
    :placeholder="placeholderText"
    search-input
    :loading="loading"
    :disabled="disabled"
    :icon="selectedIcon"
    class="w-full"
  />
</template>
