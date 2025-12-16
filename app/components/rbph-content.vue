<script setup lang="ts">
const props = defineProps<{
  content: RbContent;
}>();

const rendered = ref('');

watch(
  props.content,
  async content => {
    if (content.content_type === RbContentType.Markdown) {
      rendered.value = '';
      useMarkdown()
        .render(content.content!)
        .then(html => (rendered.value = html));
    } else if (content.content_type === RbContentType.Html) {
      rendered.value = content.content!;
    } else {
      rendered.value = '内容类型无效，请联系管理员。';
    }
  },
  { immediate: true }
);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-if="rendered" v-html="rendered" />
  <div v-else>
    <u-skeleton class="h-24 w-full" />
  </div>
</template>
