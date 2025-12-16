<script setup lang="ts">
const props = defineProps<{
  data?: RbPuzzleShowData;
  page?: string;
}>();

const UEmpty = resolveComponent('u-empty');
const USkeleton = resolveComponent('u-skeleton');

const page = computed(() => {
  if (!props.data) return null;

  const type = props.data.data.ptype;
  return defineAsyncComponent({
    loader: async () => {
      if (props.page) {
        return await import(`~/components/rbph-puzzle-page/${type}/${props.page}.vue`);
      } else {
        return await import(`~/components/rbph-puzzle-page/${type}.vue`);
      }
    },
    loadingComponent: h(USkeleton, { class: 'w-full min-h-24' }),
    errorComponent: h(UEmpty, { icon: 'material-symbols:extension-off-outline-rounded', title: '页面缺失', description: '没有对应页面' }),
  });
});
</script>

<template>
  <component :is="page" :data="data" />
</template>
