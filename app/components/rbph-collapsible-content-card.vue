<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string;
    iconClass?: string;
    titleClass?: string;
    defaultOpen?: boolean;
    collapsible?: boolean;
  }>(),
  {
    iconClass: 'text-primary',
    titleClass: undefined,
    defaultOpen: false,
    collapsible: true,
  },
);
</script>

<template>
  <u-card class="w-full" variant="subtle" :ui="{ body: 'sm:p-0 p-0' }">
    <u-collapsible :default-open="defaultOpen" :disabled="!collapsible" :unmount-on-hide="false">
      <div class="px-5 py-3 flex items-center group dark:bg-slate-800 bg-slate-100" :class="{ 'cursor-pointer': collapsible }">
        <u-icon class="align-middle me-2" :class="iconClass" :name="icon" />
        <div class="text-sm flex-1" :class="titleClass">
          <slot name="title" />
        </div>
        <div v-if="$slots.actions" class="flex items-center" @click.stop @keydown.stop>
          <slot name="actions" />
        </div>
        <u-icon v-if="collapsible" name="material-symbols:expand-more-rounded" class="-me-1 size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
      </div>
      <template v-if="collapsible" #content>
        <div class="px-4 py-4 border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
          <slot />
        </div>
      </template>
    </u-collapsible>
  </u-card>
</template>
