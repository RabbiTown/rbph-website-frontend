<script setup lang="ts">
defineProps<{
  data: RbPuzzleShowData;
}>();

const currency = useCurrency().getAllCurrent();
</script>

<template>
  <div>
    <div>
      <u-badge v-for="x in currency" :key="x.id" variant="subtle" icon="material-symbols:emoji-objects-outline-rounded">
        <span>{{ x.name }}：{{ intPrecString(x.current, x.prec) }}</span>
        <span v-if="x.growth">（ {{ intPrecString(x.growth, x.prec, true, ' ') }} / min）</span>
      </u-badge>
    </div>
    <div class="mt-4">
      <rbph-hints :puzzle-id="data.data.id" :utime-at="data.state.utime_at" />
    </div>
  </div>
</template>
