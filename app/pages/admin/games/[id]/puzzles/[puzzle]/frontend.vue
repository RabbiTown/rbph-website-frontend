<script setup lang="ts">
const route = useRoute();
await navigateTo(`/admin/games/${route.params.id}/puzzles/${route.params.puzzle}/settings`, { replace: true });
</script>
