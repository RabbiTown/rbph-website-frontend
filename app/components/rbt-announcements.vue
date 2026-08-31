<script setup lang="ts">
const props = withDefaults(defineProps<{
  data?: RbtAnnouncement[];
  currentPuzzleId?: number;
}>(), {
  data: undefined,
  currentPuzzleId: undefined,
});
const data = computed(() => props.data as RbAnnouncementInfo[] | undefined);
</script>

<template>
  <RbphAnnoucements :data="data" :current-puzzle-id="props.currentPuzzleId" />
</template>
