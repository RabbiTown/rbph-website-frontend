<script setup lang="ts">
const route = useRoute();
await navigateTo(`/admin/games/${route.params.id}/rounds/${route.params.round}/settings`, { replace: true });
</script>
