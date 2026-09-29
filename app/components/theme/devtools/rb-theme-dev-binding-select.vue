<script setup lang="ts">
defineOptions({ inheritAttrs: false });

type BindingItem = {
  label: string;
  value: string;
  icon: string;
  development?: boolean;
  published?: boolean;
};

const props = defineProps<{ items: BindingItem[] }>();
const model = defineModel<string>({ required: true });
const { t } = useI18n();
const selected = computed(() => props.items.find(item => item.value === model.value));
</script>

<template>
  <u-select v-model="model" :items="items" v-bind="$attrs">
    <template #default>
      <span class="truncate">{{ selected?.label ?? t('admin.frontend.common.selectPageConfig') }}</span>
      <u-badge v-if="selected?.development" size="sm" color="primary" variant="soft" class="ml-1 mb-0.5 shrink-0">{{ t('admin.frontend.badges.development') }}</u-badge>
      <u-badge v-if="selected?.published" size="sm" color="success" variant="soft" class="ml-1 mb-0.5 shrink-0">{{ t('admin.frontend.badges.online') }}</u-badge>
    </template>
    <template #item-trailing="{ item }">
      <div v-if="item.development || item.published" class="flex items-center gap-1">
        <u-badge v-if="item.development" size="sm" color="primary" variant="soft">{{ t('admin.frontend.badges.development') }}</u-badge>
        <u-badge v-if="item.published" size="sm" color="success" variant="soft">{{ t('admin.frontend.badges.online') }}</u-badge>
      </div>
    </template>
  </u-select>
</template>
