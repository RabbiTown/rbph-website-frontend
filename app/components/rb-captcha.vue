<script setup lang="ts">
const props = defineProps<{
  config: AuthCaptchaConfig;
  action: CaptchaAction;
}>();

const model = defineModel<string>();
const provider = useTemplateRef<{ reset: () => void }>('provider');

function reset() {
  model.value = undefined;
  provider.value?.reset();
}

defineExpose({ reset });
</script>

<template>
  <rb-captcha-cloudflare v-if="props.config.provider === 'cloudflare'" ref="provider" v-model="model" :site-key="props.config.site_key" :action="props.action" />
</template>
