<script setup lang="ts">
const props = withDefaults(defineProps<{
  puzzleId?: number;
  initPage?: number;
  onlyOk?: boolean;
}>(), {
  puzzleId: undefined,
  initPage: 0,
  onlyOk: false,
});

const submissions = useTemplateRef<{ updateData(newId?: number): Promise<void>; submissions: RbSubmissionPage | undefined }>('submissions');

function updateData(newId?: number) {
  return submissions.value?.updateData(newId);
}

defineExpose({
  updateData,
  submissions: computed(() => submissions.value?.submissions),
});
</script>

<template>
  <RbphSubmissions ref="submissions" :puzzle-id="props.puzzleId" :init-page="props.initPage" :only-ok="props.onlyOk" />
</template>
