<script setup lang="ts">
const attrs = useAttrs();

const open = ref(false);
</script>

<template>
  <u-tooltip ref="base" v-bind="attrs" v-model:open="open">
    <template #default>
      <span @click="open = true">
        <slot name="default" />
      </span>
    </template>
    <template #content>
      <slot name="content" />
    </template>
  </u-tooltip>
</template>
