<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false });

defineProps<{
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'neutral' | 'error' | 'success' | 'warning';
  confirmIcon?: string;
  confirmDisabled?: boolean;
  busy?: boolean;
}>();

const emits = defineEmits<{
  confirm: [];
}>();

function onConfirm() {
  emits('confirm');
}
</script>

<template>
  <u-modal v-model:open="open" :title="title" :description="description" :dismissible="!busy" :close="!busy">
    <template v-if="$slots.body" #body>
      <slot name="body" />
    </template>
    <template #footer>
      <slot name="footer">
        <div class="flex justify-end gap-2 w-full">
          <u-button color="neutral" variant="soft" :disabled="busy" @click="open = false"> 取消 </u-button>
          <u-button :color="confirmColor ?? 'primary'" :icon="confirmIcon" :loading="busy" :disabled="busy || confirmDisabled" :label="confirmLabel ?? '确认'" @click="onConfirm" />
        </div>
      </slot>
    </template>
  </u-modal>
</template>
