<script setup lang="ts">
const props = defineProps<{
  currency?: Record<number, RbTeamCurrency & { current: number }>;
}>();
const actual = computed(() => props.currency ?? useCurrency().getAllCurrent().value);
</script>

<template>
  <div>
    <u-badge v-for="x in actual" :key="x.id" variant="subtle" icon="material-symbols:emoji-objects-outline-rounded">
      <span>{{ x.name }}：{{ intPrecString(x.current, x.prec) }}</span>
      <span v-if="x.growth">（ {{ intPrecString(x.growth, x.prec, true, ' ') }} / min）</span>
    </u-badge>
  </div>
</template>
