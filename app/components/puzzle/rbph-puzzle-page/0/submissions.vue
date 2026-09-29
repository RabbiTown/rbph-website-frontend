<script setup lang="ts">
const { puzzle } = usePuzzleContext();

const submissionsComp = useTemplateRef('submissions');

useSync().listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
  if (data.puzzle.id === puzzle.value?.data.id) {
    submissionsComp.value?.updateData();
  }
});
</script>

<template>
  <div>
    <rbph-submissions ref="submissions" :puzzle-id="puzzle?.data.id" />
  </div>
</template>
