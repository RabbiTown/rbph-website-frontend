<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{
  error: NuxtError;
}>();

useHead({
  titleTemplate: ` // ERROR ${props.error.statusCode} / RBPH //`,
});

onMounted(() => (document.body.style.overflow = 'auto'));

function reloadPage() {
  if (import.meta.client) {
    window.location.reload();
  }
}

function getErrorMessage(error: NuxtError) {
  if (error.data && (error.data as RbError).message) {
    const inner = error.data as RbError;
    return `${inner.message} (${inner.code})`;
  }
  return error.statusMessage;
}
</script>

<template>
  <UApp>
    <div class="lang-zh h-screen text-light">
      <div class="error-message">
        <div class="text-5xl font-bold mb-1">{{ error.statusCode }}</div>
        <div class="text-gray-400">
          {{ getErrorMessage(error) }}
        </div>
        <div class="mt-8">
          <div class="text-gray-500 mb-2 text-sm"><span class="text-red-400">$</span> rbph-website</div>
          <UButton variant="soft" @click="reloadPage">Reload</UButton>
        </div>
      </div>
      <div class="error-band">
        <template v-for="i in new Array(30)" :key="i">
          <div>ERROR</div>
          <div>{{ error.statusCode }}</div>
        </template>
      </div>
    </div>
  </UApp>
</template>

<style class="scss">
.error-message {
  position: fixed;
  bottom: 50%;
  left: 25%;
  font-size: 16px;
}

.error-band {
  position: fixed;
  top: 65%;
  left: 50%;
  translate: -50%;
  display: flex;
  flex-wrap: nowrap;
  gap: 15px;
  padding: 12px;
  background: var(--color-error-500);
  line-height: 1;
  user-select: none;

  div {
    font-weight: bold;
    text-wrap: nowrap;
    font-size: 20px;
    color: var(--color-white);
  }
}
</style>
