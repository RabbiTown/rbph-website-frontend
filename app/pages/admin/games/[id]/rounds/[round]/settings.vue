<script setup lang="ts">
type FrontendSettings = { apply: () => Promise<boolean>; reset: () => void };

const route = useRoute();
const { t } = useI18n();
const dirtyToast = useDirtyToast();
const { round } = useAdmin().useRoundContext();
const gameId = computed(() => Number(route.params.id));
const roundId = computed(() => Number(route.params.round));
const frontendSettings = ref<FrontendSettings>();
const dirty = ref(false);
const editors = computed(() => [
  { surface: 'round-page' as const, label: t('admin.frontend.editors.roundPage'), icon: 'material-symbols:grid-view-outline-rounded' },
  { surface: 'puzzle-page' as const, label: t('admin.frontend.editors.roundPuzzleDefault'), icon: 'material-symbols:send-time-extension-outline-rounded' },
]);

async function apply() {
  if (!dirty.value || !frontendSettings.value) return;
  if (await frontendSettings.value.apply()) dirtyToast.clear();
}

function reset() {
  frontendSettings.value?.reset();
  dirtyToast.clear();
}

watch(dirty, (value) => {
  if (value) dirtyToast.show({ guardOnLeave: true, apply, reset });
  else dirtyToast.clear();
});
</script>

<template>
  <div v-if="round" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />
    <main class="min-w-0">
      <rbph-frontend-scope-settings
        ref="frontendSettings"
        v-model:dirty="dirty"
        :game-id="gameId"
        scope-kind="round"
        :scope-id="roundId"
        :editors="editors"
        :preview-path="`/games/${gameId}/rounds/${roundId}`"
      />
    </main>
    <aside class="hidden xl:block" />
  </div>
</template>
