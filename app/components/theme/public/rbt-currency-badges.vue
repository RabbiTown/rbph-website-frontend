<script setup lang="ts">
withDefaults(defineProps<{ currencies?: RbtCurrency[] }>(), { currencies: () => [] });
const rbph = useRbtContext();
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <u-badge v-for="currency in currencies" :key="currency.id" variant="subtle" :icon="currency.icon ?? 'material-symbols:emoji-objects-outline-rounded'">
      <span>{{ currency.name }} {{ rbph.utils.intPrecString(currency.amount, currency.precision) }}</span>
      <span v-if="currency.growth">{{ rbph.utils.intPrecString(currency.growth, currency.precision, true, ' ') }}/min</span>
    </u-badge>
  </div>
</template>
