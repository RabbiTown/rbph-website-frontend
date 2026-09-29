<script setup lang="ts">const { t } = useI18n();


const props = withDefaults(
  defineProps<{
    html?: string;
    src?: string;
    mode?: 'inline' | 'file';
  }>(),
  {
    html: '',
    src: '',
    mode: 'inline',
  },
);

const root = ref<HTMLElement>();
const loading = ref(false);
const error = ref('');
let renderSeq = 0;

function fragmentFromHtml(html: string) {
  const trimmed = html.trim();
  const fragment = document.createDocumentFragment();

  if (/<!doctype|<html[\s>]/i.test(trimmed)) {
    const documentValue = new DOMParser().parseFromString(trimmed, 'text/html');
    fragment.append(...Array.from(documentValue.head.childNodes).map(node => node.cloneNode(true)));
    fragment.append(...Array.from(documentValue.body.childNodes).map(node => node.cloneNode(true)));
    return fragment;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  fragment.append(template.content.cloneNode(true));
  return fragment;
}

function executeScripts(container: HTMLElement) {
  for (const script of Array.from(container.querySelectorAll('script'))) {
    const executable = document.createElement('script');
    for (const attr of Array.from(script.attributes)) {
      executable.setAttribute(attr.name, attr.value);
    }
    executable.textContent = script.textContent;
    script.replaceWith(executable);
  }
}

async function resolveHtml() {
  if (props.mode !== 'file') return props.html;
  if (!props.src.trim()) return '';

  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(props.src, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch {
    error.value = t('components.rbphRawHtmlRenderer.loadFailed');
    return '';
  } finally {
    loading.value = false;
  }
}

async function render() {
  const container = root.value;
  if (!container || !import.meta.client) return;

  const seq = ++renderSeq;
  const html = await resolveHtml();
  if (seq !== renderSeq) return;

  container.replaceChildren(fragmentFromHtml(html));
  executeScripts(container);
}

watch(() => [props.html, props.src, props.mode] as const, render, { immediate: true });
onMounted(render);
</script>

<template>
  <div>
    <u-alert v-if="error" color="error" variant="soft" icon="material-symbols:error-outline-rounded" :description="error" />
    <u-skeleton v-else-if="loading" class="h-24 w-full" />
    <div ref="root" />
  </div>
</template>
