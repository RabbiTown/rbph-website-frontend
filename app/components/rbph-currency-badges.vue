<script setup lang="ts">
const currency = useCurrency().getAllCurrent();
</script>

<template>
  <div>
    <u-badge v-for="x in currency" :key="x.id" variant="subtle" icon="material-symbols:emoji-objects-outline-rounded">
      <span>{{ x.name }}：{{ intPrecString(x.current, x.prec) }}</span>
      <span v-if="x.growth">（ {{ intPrecString(x.growth, x.prec, true, ' ') }} / min）</span>
    </u-badge>
  </div>
</template>
