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
      <rbph-collapsible-header class="px-5 py-3 dark:bg-slate-800 bg-slate-100" :collapsible="collapsible">
        <div class="flex items-start gap-2">
          <u-icon class="mt-0.5 shrink-0" :class="iconClass" :name="icon" />
          <div class="min-w-0 flex-1 text-sm" :class="titleClass">
            <slot name="title" />
          </div>
        </div>
        <template v-if="$slots.badges" #badges>
          <slot name="badges" />
        </template>
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
      </rbph-collapsible-header>
      <template v-if="collapsible" #content>
        <div class="px-4 py-4 border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
          <slot />
        </div>
      </template>
    </u-collapsible>
  </u-card>
</template>
