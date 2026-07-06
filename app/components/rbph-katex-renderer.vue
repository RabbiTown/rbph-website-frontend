<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    tex: string;
    display?: boolean | string;
  }>(),
  {
    display: false,
  },
);

const displayMode = computed(() => props.display === true || props.display === 'true');
const katexRenderer = useKatex();

const rendered = computed(() => {
  try {
    return {
      html: katexRenderer.renderToString(props.tex, displayMode.value),
      error: false,
    };
  } catch {
    return {
      html: '',
      error: true,
    };
  }
});
</script>

<template>
  <span
    v-if="rendered.error"
    class="rbph-katex rbph-katex-error font-mono text-error"
    :class="displayMode ? 'my-4 block overflow-x-auto whitespace-pre-wrap rounded-md bg-error/5 px-3 py-2' : 'rounded bg-error/5 px-1'"
  >{{ tex }}</span>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-else-if="displayMode" class="rbph-katex rbph-katex-block" v-html="rendered.html" />
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-else class="rbph-katex rbph-katex-inline" v-html="rendered.html" />
</template>
