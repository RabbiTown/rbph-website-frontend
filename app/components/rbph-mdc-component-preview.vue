<script setup lang="ts">
import type { MDCNode, MDCParserResult, MDCRoot } from '@nuxtjs/mdc';

const props = defineProps<{
  raw: string;
  inline?: boolean;
}>();

const mdParser = useMarkdownParser();
const mdAst = shallowRef<MDCParserResult>();
let seq = 0;

function stripMarkdownHints<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(stripMarkdownHints),
    };
  }

  if (node.type === 'element') {
    return {
      ...node,
      children: node.children.map(stripMarkdownHints),
    };
  }

  if (node.type === 'text') {
    return {
      ...node,
      value: node.value.replaceAll('\u200B', ''),
    };
  }

  return node;
}

watch(
  () => props.raw,
  async raw => {
    const cur = ++seq;
    const newAst = await mdParser(transformMarkdownMath(raw));
    newAst.body = transformAlignBlocks(newAst.body);
    newAst.body = transformImageBlocks(newAst.body);
    newAst.body = transformTableBlocks(newAst.body);
    newAst.body = transformRawHtmlBlocks(newAst.body);
    newAst.body = transformVueAppBlocks(newAst.body);
    newAst.body = transformMathNodes(newAst.body);
    newAst.body = transformColorSpans(newAst.body);
    newAst.body = stripMarkdownHints(newAst.body);
    if (cur !== seq) return;
    mdAst.value = newAst;
  },
  { immediate: true },
);
</script>

<template>
  <span v-if="inline" class="rbph-mdc-component-preview rbph-mdc-component-preview-inline">
    <Suspense>
      <MDCRenderer v-if="mdAst?.body" :body="mdAst.body" :data="mdAst.data" />
    </Suspense>
  </span>
  <div v-else class="rbph-mdc-component-preview rbph-mdc-component-preview-block">
    <Suspense>
      <MDCRenderer v-if="mdAst?.body" :body="mdAst.body" :data="mdAst.data" />
    </Suspense>
  </div>
</template>
