<script setup lang="ts">
import type { FormFieldProps } from '@nuxt/ui';

const props = defineProps<
  FormFieldProps & {
    dirty?: boolean;
    reset?: () => void;
    row?: boolean;
  }
>();

const attrs = useAttrs();

const formFieldProps = computed(() => {
  const { dirty: _dirty, reset: _reset, row: _row, ...rest } = props;
  return props.row && !rest.orientation ? { ...rest, orientation: 'horizontal' as const } : rest;
});
const fieldClass = computed(() => [attrs.class, 'relative border-s-2 ps-4 transition-colors', props.row ? 'grid min-h-7 gap-2 md:grid-cols-[7rem_minmax(0,1fr)] md:items-center' : '', props.dirty ? 'border-warning' : 'border-transparent']);
const labelClass = computed(() => ['inline-flex min-h-6 items-center align-middle transition-colors', props.dirty ? 'text-warning' : '']);
const resetButtonClass = 'group relative ms-2 inline-flex h-5 w-12 items-center justify-center overflow-hidden px-0 align-middle text-[11px] cursor-pointer';

function onReset() {
  props.reset?.();
}
</script>

<template>
  <u-form-field v-bind="{ ...attrs, ...formFieldProps }" :class="fieldClass">
    <template #label="{ label }">
      <span :class="labelClass">
        <slot name="label" :label="label">
          {{ label }}
        </slot>
        <u-button v-if="dirty && reset" size="xs" variant="soft" color="warning" :class="resetButtonClass" @click.stop.prevent="onReset">
          <span class="absolute inset-0 inline-flex items-center justify-center transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-0">已修改</span>
          <span class="absolute inset-0 inline-flex translate-y-1 items-center justify-center gap-0.5 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
            <u-icon name="material-symbols:restart-alt-rounded" class="size-3" />
            重置
          </span>
        </u-button>
      </span>
    </template>

    <template v-if="$slots.hint" #hint="{ hint }">
      <slot name="hint" :hint="hint" />
    </template>

    <template v-if="$slots.description" #description="{ description }">
      <slot name="description" :description="description" />
    </template>

    <template v-if="$slots.help" #help="{ help }">
      <slot name="help" :help="help" />
    </template>

    <template v-if="$slots.error" #error="{ error }">
      <slot name="error" :error="error" />
    </template>

    <template #default="{ error }">
      <slot :error="error" />
    </template>
  </u-form-field>
</template>
