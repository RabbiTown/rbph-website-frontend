<script setup lang="ts">const { t } = useI18n();


const props = defineProps<{
  href?: string | null;
}>();

const emit = defineEmits<{
  apply: [href: string];
  remove: [];
}>();

const link = ref(props.href ?? '');

watch(
  () => props.href,
  value => {
    link.value = value ?? '';
  },
);

function apply() {
  const href = link.value.trim();
  if (!href) return;
  emit('apply', href);
}
</script>

<template>
  <form class="w-80 p-2" @submit.prevent="apply">
    <div class="flex items-center gap-2">
      <u-button
        size="sm"
        color="error"
        variant="ghost"
        square
        icon="material-symbols:link-off-rounded"
        :aria-label="t('components.rbLinkEditorPanel.removeLink')"
        :disabled="!href"
        @click="emit('remove')"
      />
      <u-input v-model="link" class="min-w-0 flex-1" size="sm" placeholder="https://example.com" icon="material-symbols:link-rounded" autofocus />
      <u-button type="submit" size="sm" color="primary" variant="soft" icon="material-symbols:check-rounded" :disabled="!link.trim()" />
    </div>
  </form>
</template>
