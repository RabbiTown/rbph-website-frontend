<script setup lang="ts">
const props = defineProps<{
  data: RbPuzzleShowData;
}>();

const submissionsComp = useTemplateRef('submissions');

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  if (data.puzzle.id === props.data.data.id) {
    submissionsComp.value?.updateData();
  }
});
</script>

<template>
  <div>
    <rbph-submissions ref="submissions" :puzzle-id="data.data.id" />
  </div>
</template>
