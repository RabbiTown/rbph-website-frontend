<script setup lang="ts">
import type { FormFieldProps } from '@nuxt/ui';

const props = defineProps<
  FormFieldProps & {
    dirty?: boolean;
    icon?: string;
    narrowLabel?: boolean;
    reset?: () => void;
    row?: boolean;
  }
>();

const attrs = useAttrs();

const formFieldProps = computed(() => {
  const { dirty: _dirty, icon: _icon, narrowLabel: _narrowLabel, reset: _reset, row: _row, ui, ...rest } = props;
  const resolved = {
    ...rest,
    ui: {
      ...ui,
      wrapper: [ui?.wrapper, props.icon ? 'relative ps-10' : '', props.row && !props.narrowLabel ? 'w-full min-w-0 sm:flex-1' : ''],
      container: [ui?.container, props.row ? (props.narrowLabel ? 'w-full min-w-0' : 'w-full min-w-0 sm:w-auto sm:shrink-0') : '', props.dirty ? 'static' : ''],
    },
  };

  return props.row && !resolved.orientation ? { ...resolved, orientation: 'horizontal' as const } : resolved;
});
const fieldClass = computed(() => [
  attrs.class,
  'relative',
  props.row
    ? props.narrowLabel
      ? 'grid min-h-8 grid-cols-1 items-start gap-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4'
      : 'flex min-h-8 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4'
    : '',
]);
const labelClass = computed(() => ['inline-flex min-h-6 items-center align-middle transition-colors mt-0.5', props.dirty ? 'text-warning' : '']);
const dirtyIndicatorClass = 'absolute inset-y-0 -start-4 z-10 w-4 cursor-pointer focus-visible:outline-none';
const dirtyLineClass = 'pointer-events-none absolute inset-y-0 -start-px w-0.5 rounded-full bg-warning transition-[width] duration-200 ease-out group-hover:w-1 group-focus-visible:w-1';

function onReset() {
  props.reset?.();
}
</script>

<template>
  <u-form-field v-bind="{ ...attrs, ...formFieldProps }" :class="fieldClass">
    <template #label="{ label }">
      <span :class="labelClass">
        <u-icon v-if="icon" :name="icon" class="pointer-events-none absolute inset-s-0 top-1/2 size-5 left-2 -translate-y-1/2 text-muted mt-0.25" />
        <span class="min-w-0">
          <slot name="label" :label="label">
            {{ label }}
          </slot>
        </span>
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
      <button v-if="dirty && reset" type="button" :class="['group', dirtyIndicatorClass]" title="撤销修改" aria-label="撤销修改" @click.stop.prevent="onReset">
        <span :class="dirtyLineClass" />
      </button>
      <span v-else-if="dirty" aria-hidden="true" :class="[dirtyIndicatorClass, 'pointer-events-none']">
        <span :class="dirtyLineClass" />
      </span>
      <slot :error="error" />
    </template>
  </u-form-field>
</template>
