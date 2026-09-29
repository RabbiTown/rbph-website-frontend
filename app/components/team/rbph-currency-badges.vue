<script setup lang="ts">
const props = defineProps<{
  currency?: Record<number, RbTeamCurrency & { current: number }>;
}>();
const { t } = useI18n();
const actual = computed(() => props.currency ?? useCurrency().getAllCurrent().value);
</script>

<template>
  <div class="space-x-2">
    <u-badge v-for="x in actual" :key="x.id" variant="subtle" icon="material-symbols:emoji-objects-outline-rounded">
      <span>{{ t('currency.currentBalance', { currency: x.name, amount: intPrecString(x.current, x.prec) }) }}</span>
      <span v-if="x.growth">{{ t('currency.growthPerMinute', { growth: intPrecString(x.growth, x.prec, true, ' ') }) }}</span>
    </u-badge>
  </div>
</template>
