<script setup lang="ts">
withDefaults(defineProps<{ collapsible?: boolean }>(), { collapsible: true });

const title = ref<HTMLElement>();
const controls = ref<HTMLElement>();
const { top: titleTop } = useElementBounding(title);
const { top: controlsTop } = useElementBounding(controls);
const controlsWrapped = computed(() => controlsTop.value > titleTop.value + 1);
</script>

<template>
  <div class="group flex items-start gap-3" :class="{ 'cursor-pointer': collapsible }">
    <div class="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">
      <div ref="title" class="min-w-[min(100%,14rem)] grow-999 shrink basis-56 self-center whitespace-normal wrap-anywhere">
        <slot />
      </div>
      <div v-if="$slots.badges || $slots.actions" ref="controls" class="flex min-w-0 max-w-full grow basis-auto flex-wrap items-center gap-1 [&>*]:max-w-full [&>*]:shrink-0 [&_button]:max-w-full [&_a]:max-w-full [&_span]:whitespace-normal wrap-anywhere" @click.stop @keydown.stop>
        <slot name="badges" />
        <div v-if="$slots.actions" class="relative ms-auto flex max-w-full flex-wrap items-center justify-end gap-1" :class="{ '-inset-e-9': collapsible && controlsWrapped }">
          <slot name="actions" />
        </div>
      </div>
    </div>
    <u-icon v-if="collapsible" name="material-symbols:expand-more-rounded" class="mt-0.5 size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
  </div>
</template>
