<script setup lang="ts">
import type { MDCNode, MDCParserResult, MDCRoot } from '@nuxtjs/mdc';

const props = withDefaults(
  defineProps<{
    content: RbContent;
    debounce?: number;
  }>(),
  {
    debounce: 0,
  },
);

const mdParser = useMarkdownParser();

const mdAst = ref<MDCParserResult>();

let dynTimer: ReturnType<typeof setTimeout> | undefined = undefined;
let dynSeq = 0;

const mdWhitelists = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'hr', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'em', 'strong'];

function sanitizedMdNode<T extends MDCNode | MDCRoot>(node: T): T | null {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(sanitizedMdNode).filter(Boolean),
    };
  } else if (node.type === 'element') {
    if (!mdWhitelists.includes(node.tag)) return null;

    return {
      ...node,
      children: node.children.map(sanitizedMdNode).filter(Boolean),
    };
  } else if (node.type === 'text' || node.type === 'comment') {
    return node;
  }

  return null;
}

function sanitizeMdAst(ast: MDCParserResult) {
  ast.body = sanitizedMdNode(ast.body) as MDCRoot;
}

watch(
  () => [props.content.content, props.content.content_type],
  async ([content, content_type], oldVal) => {
    if (oldVal && content_type !== oldVal[1]) {
      mdAst.value = undefined;
    }

    if (content_type === RbContentType.Markdown || content_type === RbContentType.UnsafeMarkdown) {
      if (dynTimer) {
        clearTimeout(dynTimer);
        dynTimer = undefined;
      }

      const dynCur = ++dynSeq;
      const updater = async () => {
        if (dynCur !== dynSeq) return;
        const newAst = await mdParser(content as string);
        if (content_type === RbContentType.UnsafeMarkdown) {
          sanitizeMdAst(newAst);
        }
        if (dynCur !== dynSeq) return;
        mdAst.value = newAst;
      };

      if (props.debounce) {
        dynTimer = setTimeout(updater, props.debounce);
      } else {
        updater();
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-if="content.content_type === RbContentType.Html" v-html="content.content" />
  <template v-else-if="[RbContentType.Markdown, RbContentType.UnsafeMarkdown].includes(content.content_type)">
    <MDCRenderer v-if="mdAst?.body" class="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0" :body="mdAst.body" :data="mdAst.data" />
    <u-skeleton v-else class="h-24 w-full" />
  </template>
  <u-empty v-else description="内容类型无效" />
</template>
