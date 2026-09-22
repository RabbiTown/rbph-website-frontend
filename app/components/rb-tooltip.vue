<script setup lang="ts">
const props = defineProps<{
  text?: string;
}>();

const attrs = useAttrs();
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <u-tooltip ref="base" v-bind="attrs" v-model:open="open" :text="text" :disable-closing-trigger="true">
    <template #default>
      <span class="inline-flex" @click.capture="open = true">
        <slot name="default" />
      </span>
    </template>
    <template #content>
      <slot name="content">
        <span>{{ props.text }}</span>
      </slot>
    </template>
  </u-tooltip>
</template>
