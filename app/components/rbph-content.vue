<script setup lang="ts">
import type { MDCParserResult } from '@nuxtjs/mdc';

const props = defineProps<{
  content: RbContent;
}>();

const mdParser = useMarkdownParser();

const mdAst = ref<MDCParserResult>();

watch(
  () => props.content,
  async newVal => {
    mdAst.value = undefined;
    if (newVal.content_type === RbContentType.Markdown) {
      mdAst.value = await mdParser(newVal.content);
    }
  },
  { immediate: true }
);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-if="content.content_type == RbContentType.Html" v-html="content.content" />
  <template v-else-if="content.content_type == RbContentType.Markdown">
    <MDCRenderer v-if="mdAst?.body" :body="mdAst.body" :data="mdAst.data" />
    <u-skeleton v-else class="h-24 w-full" />
  </template>
  <u-empty v-else description="内容类型无效" />
</template>
