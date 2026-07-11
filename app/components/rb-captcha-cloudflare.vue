<script setup lang="ts">
const { t } = useI18n();

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  appearance: 'interaction-only';
  size: 'flexible';
  theme: 'auto';
  callback: (token: string) => void;
  'before-interactive-callback': () => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile API unavailable')));
    script.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

const props = defineProps<{
  siteKey: string;
  action: CaptchaAction;
}>();
const emit = defineEmits<{
  interactive: [];
}>();

const model = defineModel<string>();
const container = useTemplateRef<HTMLElement>('container');
const loadFailed = ref(false);
let api: TurnstileApi | undefined;
let widgetId: string | undefined;

function clearToken() {
  model.value = undefined;
}

async function render() {
  if (!container.value) return;
  loadFailed.value = false;
  try {
    api = await loadTurnstile();
    widgetId = api.render(container.value, {
      sitekey: props.siteKey,
      action: props.action,
      appearance: 'interaction-only',
      size: 'flexible',
      theme: 'auto',
      callback: token => (model.value = token),
      'before-interactive-callback': () => emit('interactive'),
      'expired-callback': clearToken,
      'error-callback': () => {
        clearToken();
        loadFailed.value = true;
        emit('interactive');
      },
    });
  } catch {
    loadFailed.value = true;
    clearToken();
    emit('interactive');
  }
}

function reset() {
  clearToken();
  if (api && widgetId) api.reset(widgetId);
}

onMounted(render);
onBeforeUnmount(() => {
  if (api && widgetId) api.remove(widgetId);
});
defineExpose({ reset });
</script>

<template>
  <div class="w-full">
    <div ref="container" class="w-full" />
    <u-alert
      v-if="loadFailed"
      color="error"
      variant="subtle"
      icon="material-symbols:error-outline-rounded"
      :title="t('components.captchaCloudflare.loadFailed')"
      :description="t('components.captchaCloudflare.retryAfterRefresh')"
    />
  </div>
</template>
