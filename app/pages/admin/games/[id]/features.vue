<script setup lang="ts">
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
  team_formation: { label: '组队', icon: 'material-symbols:group-add-outline-rounded' },
  direct_message: { label: '站内信', icon: 'material-symbols:mail-outline-rounded' },
  puzzle_ticket: { label: '人工提示', icon: 'material-symbols:near-me-outline-rounded' },
  leaderboard: { label: '排行榜', icon: 'material-symbols:leaderboard-outline-rounded' },
};

const featureDescriptions: Record<RbGameFeature, Partial<Record<RbGameFeatureState, string>>> = {
  team_formation: {
    closed: '玩家不能创建或加入队伍，现有队伍不受影响。',
    open: '玩家可以创建或加入队伍。',
  },
  direct_message: {
    closed: '玩家不能发送站内信。',
    existing_only: '只有发送过站内信的队伍可以发送站内信。',
    open: '玩家可以发送站内信。',
  },
  puzzle_ticket: {
    closed: '玩家不能发起或回复人工提示。',
    existing_only: '玩家不能发起，但可以回复已有人工提示。',
    open: '玩家可以发起和回复人工提示。',
  },
  leaderboard: {
    live: '排行榜根据当前解题和提交结果实时更新。',
    locked: '排行榜保留锁定时的排名；新的提交仍然有效，但不会改变展示结果。',
  },
};

const stateLabels: Record<RbGameFeatureState, string> = {
  closed: '关闭',
  existing_only: '仅已有会话/工单',
  open: '开放',
  live: '实时',
  locked: '锁定',
};

const stateIcons: Record<RbGameFeatureState, string> = {
  closed: 'material-symbols:block-outline',
  existing_only: 'material-symbols:history-rounded',
  open: 'material-symbols:check-rounded',
  live: 'material-symbols:podcasts-rounded',
  locked: 'material-symbols:lock-clock-outline-rounded',
};

function stateLabel(feature: RbGameFeature, state: RbGameFeatureState) {
  if (state === 'existing_only') {
    if (feature === 'direct_message') return '仅已有会话';
    if (feature === 'puzzle_ticket') return '仅已有工单';
  }

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
    handleError(error, '获取比赛功能失败');
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
          errorHints: { [-2]: '功能状态不合法。', [-1]: '比赛不存在。' },
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
    toast.add({ title: '比赛功能已保存', icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '保存比赛功能失败');
  } finally {
    saving.value = false;
  }
}

watch(() => game.value?.id, () => fetchFeatures(), { immediate: true });
watch(dirty, value => {
  if (value) {
    dirtyToast.show({
      description: '比赛功能修改尚未保存。',
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
          <h2 class="text-xl font-semibold text-highlighted">比赛功能</h2>
          <p class="mt-1 text-sm text-muted">可以手动修改比赛功能的开放状态，保存后立即生效。</p>
        </div>
        <u-button size="sm" variant="ghost" icon="material-symbols:refresh-rounded" :loading="loading" :disabled="dirty || saving" @click="fetchFeatures()" />
      </div>

      <div v-if="loading" class="space-y-2"><u-skeleton v-for="i in 4" :key="i" class="h-24 w-full" /></div>
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
                  :label="stateLabel(feature.feature, state)"
                  :disabled="saving"
                  class="justify-center"
                  @click="drafts[feature.feature] = state"
                />
              </u-field-group>
              <p v-if="feature.next_change" class="text-xs text-muted">{{ formatDate(feature.next_change.release_at) }} 将在「{{ feature.next_change.phase_title }}」切换为 {{ stateLabel(feature.feature, feature.next_change.state) }}</p>
            </div>
          </rb-form-field>
        </template>
      </div>
    </section>

    <u-separator />
    <rbph-release-phase-manager ref="phaseManager" :game-id="game?.id" @update:dirty="phaseDirty = $event" />
  </u-form>
</template>
