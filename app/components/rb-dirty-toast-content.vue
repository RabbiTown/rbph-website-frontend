<script setup lang="ts">
const props = defineProps<{
  title: string;
  description: string;
  status: 'idle' | 'confirming-reset' | 'resetting' | 'applying';
  resetLabel: string;
  applyLabel: string;
}>();

const emit = defineEmits<{
  reset: [];
  apply: [];
}>();

const resetBusy = computed(() => props.status === 'confirming-reset' || props.status === 'resetting');
const applyBusy = computed(() => props.status === 'applying');
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium text-highlighted">{{ title }}</div>
      <div class="mt-1 text-sm font-normal text-muted">{{ description }}</div>
    </div>
    <div class="flex shrink-0 gap-1.5">
      <u-button
        size="xs"
        color="neutral"
        variant="soft"
        icon="material-symbols:restart-alt-rounded"
        :label="resetLabel"
        :loading="resetBusy"
        :disabled="status !== 'idle'"
        @click.stop="emit('reset')"
      />
      <u-button
        size="xs"
        color="primary"
        variant="solid"
        icon="material-symbols:check-rounded"
        :label="applyLabel"
        :loading="applyBusy"
        :disabled="status !== 'idle'"
        @click.stop="emit('apply')"
      />
    </div>
  </div>
</template>
