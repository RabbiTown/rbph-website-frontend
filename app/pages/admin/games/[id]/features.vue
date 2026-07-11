<script setup lang="ts">const { t } = useI18n();


const game = useAdmin().useGame().ref;
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const features = ref<AdminGameFeatureData[]>([]);
const drafts = reactive<Partial<Record<RbGameFeature, RbGameFeatureState>>>({});
const loading = ref(false);
const saving = ref(false);
const phaseDirty = ref(false);
const phaseManager = ref<{ apply: () => Promise<boolean>; reset: () => void }>();

const featureMeta: Record<RbGameFeature, { label: string; icon: string }> = {
  team_formation: { label: t('admin.common.teamFormation'), icon: 'material-symbols:group-add-outline-rounded' },
  direct_message: { label: t('admin.common.directMessage'), icon: 'material-symbols:mail-outline-rounded' },
  puzzle_ticket: { label: t('admin.common.ticket'), icon: 'material-symbols:near-me-outline-rounded' },
  leaderboard: { label: t('admin.common.leaderboard'), icon: 'material-symbols:leaderboard-outline-rounded' },
  currency: { label: t('admin.common.currency'), icon: 'material-symbols:payments-outline-rounded' },
};

const featureDescriptions: Record<RbGameFeature, Partial<Record<RbGameFeatureState, string>>> = {
  team_formation: {
    closed: t('admin.pages.game.features.teamFormation.closed'),
    open: t('admin.pages.game.features.teamFormation.open'),
  },
  direct_message: {
    closed: t('admin.pages.game.features.directMessage.closed'),
    existing_only: t('admin.pages.game.features.directMessage.existingOnly'),
    open: t('admin.pages.game.features.directMessage.open'),
  },
  puzzle_ticket: {
    closed: t('admin.pages.game.features.puzzleTicket.closed'),
    existing_only: t('admin.pages.game.features.puzzleTicket.existingOnly'),
    open: t('admin.pages.game.features.puzzleTicket.open'),
  },
  leaderboard: {
    live: t('admin.pages.game.features.leaderboard.live'),
    locked: t('admin.pages.game.features.leaderboard.locked'),
  },
  currency: {
    closed: t('admin.pages.game.features.currency.closed'),
    open: t('admin.pages.game.features.currency.open'),
  },
};

const stateLabels: Record<RbGameFeatureState, string> = {
  closed: t('admin.common.featureState.disabled'),
  existing_only: t('admin.common.featureState.existingOnly'),
  open: t('admin.common.featureState.enabled'),
  live: t('admin.common.realtime'),
  locked: t('admin.common.locked'),
};

const stateIcons: Record<RbGameFeatureState, string> = {
  closed: 'material-symbols:block-outline',
  existing_only: 'material-symbols:history-rounded',
  open: 'material-symbols:check-rounded',
  live: 'material-symbols:podcasts-rounded',
  locked: 'material-symbols:lock-clock-outline-rounded',
};

function stateLabel(state: RbGameFeatureState) {
  return stateLabels[state];
}

function featureDescription(feature: RbGameFeature, state: RbGameFeatureState) {
  return featureDescriptions[feature][state] ?? '';
}

function featureDirty(feature: AdminGameFeatureData) {
  return drafts[feature.feature] !== feature.state;
}

const featuresDirty = computed(() => features.value.some(featureDirty));
const dirty = computed(() => featuresDirty.value || phaseDirty.value);

function resetFeature(feature: AdminGameFeatureData) {
  drafts[feature.feature] = feature.state;
}

function reset() {
  for (const feature of features.value) resetFeature(feature);
  phaseManager.value?.reset();
  dirtyToast.clear();
}

function syncFeatures(nextFeatures: AdminGameFeatureData[]) {
  features.value = nextFeatures;
  for (const feature of nextFeatures) drafts[feature.feature] = feature.state;
}

async function fetchFeatures(showLoading = true) {
  if (!game.value?.id) return false;
  if (showLoading) loading.value = true;
  try {
    const { data } = await api.get<{ features: AdminGameFeatureData[] }>(`/admin/games/${game.value.id}/features`);
    syncFeatures(data.features);
    return true;
  } catch (error) {
    handleError(error, t('admin.pages.game.features.loadGameFeaturesFailed'));
    return false;
  } finally {
    if (showLoading) loading.value = false;
  }
}

async function apply() {
  if (!game.value?.id || !dirty.value || saving.value) return;
  const changes = features.value.filter(featureDirty).map(feature => ({ feature: feature.feature, state: drafts[feature.feature] }));
  const phasesChanged = phaseDirty.value;
  let updatedFeatures: AdminGameFeatureData[] | undefined;
  saving.value = true;
  try {
    for (const change of changes) {
      const { data } = await api.patch<{ features: AdminGameFeatureData[] }>(
        `/admin/games/${game.value.id}/features/${change.feature}`,
        { state: change.state },
        {
          errorHints: { [-2]: t('admin.pages.game.features.featureStateInvalid'), [-1]: t('admin.common.gameNotFound') },
        },
      );
      updatedFeatures = data.features;
    }
    if (phasesChanged && !(await phaseManager.value?.apply())) {
      await fetchFeatures(false);
      return;
    }
    if (phasesChanged || !updatedFeatures) {
      if (!(await fetchFeatures(false))) return;
    } else {
      syncFeatures(updatedFeatures);
    }
    dirtyToast.clear();
    toast.add({ title: t('admin.pages.game.features.gameFeaturesSaved'), icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    handleError(error, t('admin.pages.game.features.saveGameFeaturesFailed'));
  } finally {
    saving.value = false;
  }
}

watch(
  () => game.value?.id,
  () => fetchFeatures(),
  { immediate: true },
);
watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: t('admin.pages.game.features.gameFeaturesUpdateNotYetSave'),
      guardOnLeave: true,
      apply,
      reset,
    });
  } else {
    dirtyToast.clear();
  }
});

onBeforeUnmount(() => dirtyToast.clear());
</script>

<template>
  <u-form :state="drafts" class="mx-auto flex w-full max-w-5xl flex-col gap-8" @submit.prevent="apply">
    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.gameFeatures') }}</h2>
        </div>
        <u-button size="sm" variant="ghost" icon="material-symbols:refresh-rounded" :loading="loading" :disabled="dirty || saving" @click="fetchFeatures()" />
      </div>

      <div v-if="loading" class="space-y-2"><u-skeleton v-for="i in 5" :key="i" class="h-24 w-full" /></div>
      <div v-else class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
        <template v-for="(feature, index) in features" :key="feature.feature">
          <u-separator v-if="index" />
          <rb-form-field
            row
            :label="featureMeta[feature.feature].label"
            :description="featureDescription(feature.feature, drafts[feature.feature] ?? feature.state)"
            :icon="featureMeta[feature.feature].icon"
            :dirty="featureDirty(feature)"
            :reset="() => resetFeature(feature)"
          >
            <div class="flex min-w-0 flex-col items-start gap-2 sm:items-end">
              <u-field-group class="max-w-full">
                <u-button
                  v-for="state in feature.states"
                  :key="state"
                  type="button"
                  color="neutral"
                  variant="soft"
                  active-color="primary"
                  :active="drafts[feature.feature] === state"
                  :aria-pressed="drafts[feature.feature] === state"
                  :icon="stateIcons[state]"
                  :label="stateLabel(state)"
                  :disabled="saving"
                  class="justify-center"
                  @click="drafts[feature.feature] = state"
                />
              </u-field-group>
              <p v-if="feature.next_change" class="text-xs text-muted">{{ t('admin.pages.game.features.scheduledChange', { time: formatDate(feature.next_change.release_at), phase: feature.next_change.phase_title, state: stateLabel(feature.next_change.state) }) }}</p>
            </div>
          </rb-form-field>
        </template>
      </div>
    </section>

    <u-separator />
    <rbph-release-phase-manager ref="phaseManager" :game-id="game?.id" @update:dirty="phaseDirty = $event" />
  </u-form>
</template>
