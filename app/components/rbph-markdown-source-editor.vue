<script setup lang="ts">
const model = defineModel<string>({ default: '' });
const source = ref(model.value);
const isComposing = ref(false);
const textarea = ref<HTMLTextAreaElement>();

defineProps<{
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  focusTitle: [];
}>();

const lines = computed(() => source.value.split('\n'));

function lineMarkerClass(line: string) {
  if (/^\s{0,3}#{1,6}\s/.test(line)) return 'bg-primary';
  if (/^\s{0,3}>/.test(line)) return 'bg-info';
  if (/^\s*([-+*]|\d+\.)\s+/.test(line)) return 'bg-warning';
  if (/^\s*`{3,}/.test(line)) return 'bg-success';
  if (/^\s*::[A-Za-z][\w-]*(?:\{[^}]*\})?\s*$/.test(line)) return 'bg-secondary';
  return 'bg-transparent';
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function highlightLine(line: string) {
  let html = escapeHtml(line);

  html = html.replace(/^(\s{0,3}#{1,6})(\s.*)?$/, '<span class="text-primary font-semibold">$1</span><span class="text-highlighted">$2</span>');
  html = html.replace(/^(\s{0,3}&gt;)(.*)$/, '<span class="text-muted">$1</span><span class="text-info">$2</span>');
  html = html.replace(/^(\s*)([-+*]|\d+\.)(\s+)/, '$1<span class="text-warning">$2</span>$3');
  html = html.replace(/^(\s*`{3,}.*)$/, '<span class="text-success">$1</span>');
  html = html.replace(/(`[^`]+`)/g, '<span class="text-success">$1</span>');
  html = html.replace(/(\*\*|__)(.+?)(\1)/g, '<span class="text-primary">$1</span><span class="font-semibold text-highlighted">$2</span><span class="text-primary">$3</span>');
  html = html.replace(/(\*|_)([^*_]+?)(\1)/g, '<span class="text-primary">$1</span><span class="italic text-highlighted">$2</span><span class="text-primary">$3</span>');
  html = html.replace(/(!?\[[^\]]*\]\([^)]+\))/g, '<span class="text-secondary">$1</span>');
  html = html.replace(/(::[A-Za-z][\w-]*(?:\{[^}]*\})?)/g, '<span class="text-info">$1</span>');

  return html || '&nbsp;';
}

const highlightedLines = computed(() => lines.value.map(highlightLine));

watch(model, value => {
  if (value !== source.value) {
    source.value = value;
  }
});

function updateSource(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  source.value = value;
  model.value = value;
}

function focus() {
  textarea.value?.focus();
  textarea.value?.setSelectionRange(0, 0);
}

function onArrowUp(event: KeyboardEvent) {
  const target = event.target as HTMLTextAreaElement;
  if (target.value.slice(0, target.selectionStart).includes('\n')) return;

  event.preventDefault();
  emit('focusTitle');
}

defineExpose({ focus });
</script>

<template>
  <div class="relative text-sm font-mono leading-[1.625]">
    <div class="pointer-events-none min-h-full text-highlighted" aria-hidden="true">
      <div v-for="(line, index) in lines" :key="index" class="grid grid-cols-[3.5rem_minmax(0,1fr)]">
        <div class="relative select-none border-e border-default pe-3 text-right text-muted">
          <span class="absolute -end-px top-[0.3125em] h-4 w-0.5 rounded-full" :class="lineMarkerClass(line)" />
          {{ index + 1 }}
        </div>

        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="min-w-0 whitespace-pre-wrap break-words px-4 text-highlighted sm:px-5" v-html="highlightedLines[index]" />
      </div>
    </div>

    <textarea
      ref="textarea"
      :value="source"
      v-bind="$attrs"
      :placeholder="placeholder"
      :disabled="disabled"
      class="absolute inset-0 block h-full w-full resize-none overflow-hidden bg-transparent py-0 ps-[4.5rem] pe-4 caret-primary outline-none selection:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-75 sm:pe-5"
      :class="isComposing ? 'text-highlighted' : 'text-transparent'"
      spellcheck="false"
      @keydown.up="onArrowUp"
      @input="updateSource"
      @compositionstart="isComposing = true"
      @compositionend="isComposing = false"
    />
  </div>
</template>
