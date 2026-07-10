<script setup lang="ts">
const { t } = useI18n();
const props = defineProps<{ gameId?: number }>();
const emit = defineEmits<{ 'update:dirty': [value: boolean] }>();

interface PhaseState {
  id: number;
  title: string;
  description: string;
  releaseAt: Date;
  isPublic: boolean;
  states: Partial<Record<RbGameFeature, RbGameFeatureState>>;
  puzzleCount: number;
  released: boolean;
  deleting?: boolean;
  removing?: boolean;
  open?: boolean;
  pendingFeature?: RbGameFeature;
  pendingState?: RbGameFeatureState;
  featurePopoverOpen?: boolean;
}

const api = useApi();
const toast = useToast();
const phases = ref<AdminReleasePhaseData[]>([]);
const state = ref<PhaseState[]>([]);
const loading = ref(false);
const saving = ref(false);
let nextDraftId = -1;

const featureOptions: { feature: RbGameFeature; label: string; icon: string; states: { label: string; value: RbGameFeatureState; icon: string }[] }[] = [
  {
    feature: 'team_formation',
    label: '组队',
    icon: 'material-symbols:group-add-outline-rounded',
    states: [
      { label: '关闭', value: 'closed', icon: 'material-symbols:block-outline' },
      { label: '开放', value: 'open', icon: 'material-symbols:check-rounded' },
    ],
  },
  {
    feature: 'direct_message',
    label: '站内信',
    icon: 'material-symbols:mail-outline-rounded',
    states: [
      { label: '关闭', value: 'closed', icon: 'material-symbols:block-outline' },
      { label: '仅已有会话', value: 'existing_only', icon: 'material-symbols:history-rounded' },
      { label: '开放', value: 'open', icon: 'material-symbols:check-rounded' },
    ],
  },
  {
    feature: 'puzzle_ticket',
    label: '人工提示',
    icon: 'material-symbols:near-me-outline-rounded',
    states: [
      { label: '关闭', value: 'closed', icon: 'material-symbols:block-outline' },
      { label: '仅已有工单', value: 'existing_only', icon: 'material-symbols:history-rounded' },
      { label: '开放', value: 'open', icon: 'material-symbols:check-rounded' },
    ],
  },
  {
    feature: 'leaderboard',
    label: '排行榜',
    icon: 'material-symbols:leaderboard-outline-rounded',
    states: [
      { label: '实时', value: 'live', icon: 'material-symbols:podcasts-rounded' },
      { label: '锁定', value: 'locked', icon: 'material-symbols:lock-clock-outline-rounded' },
    ],
  },
  {
    feature: 'currency',
    label: '货币',
    icon: 'material-symbols:payments-outline-rounded',
    states: [
      { label: '关闭', value: 'closed', icon: 'material-symbols:block-outline' },
      { label: '开放', value: 'open', icon: 'material-symbols:check-rounded' },
    ],
  },
];

function statesFromChanges(changes: RbFeatureChange[]) {
  return Object.fromEntries(changes.map(change => [change.feature, change.state])) as PhaseState['states'];
}

function changesFromStates(states: PhaseState['states']): RbFeatureChange[] {
  return featureOptions.flatMap(({ feature }) => (states[feature] ? ([{ feature, state: states[feature] }] as RbFeatureChange[]) : []));
}

function featureOption(feature?: RbGameFeature) {
  return featureOptions.find(option => option.feature === feature);
}

function availableFeatureItems(phase: PhaseState) {
  return featureOptions.filter(option => !phase.states[option.feature]).map(option => ({ label: option.label, value: option.feature, icon: option.icon }));
}

function pendingStateItems(phase: PhaseState) {
  return featureOption(phase.pendingFeature)?.states ?? [];
}

function setPendingFeature(phase: PhaseState, value: unknown) {
  phase.pendingFeature = value as RbGameFeature | undefined;
  phase.pendingState = undefined;
}

function addFeatureChange(phase: PhaseState) {
  const option = featureOption(phase.pendingFeature);
  if (!option || !phase.pendingState || !option.states.some(state => state.value === phase.pendingState)) return;
  phase.states[option.feature] = phase.pendingState;
  phase.pendingFeature = undefined;
  phase.pendingState = undefined;
  phase.featurePopoverOpen = false;
}

function removeFeatureChange(phase: PhaseState, feature: RbGameFeature) {
  phase.states[feature] = undefined;
}

function featureChangeLabel(change: RbFeatureChange) {
  const option = featureOption(change.feature);
  const state = option?.states.find(item => item.value === change.state);
  return t('releasePhase.featureState', { feature: option?.label ?? change.feature, state: state?.label ?? change.state });
}

function setFeaturePopoverOpen(phase: PhaseState, open: boolean) {
  phase.featurePopoverOpen = open;
  if (!open) {
    phase.pendingFeature = undefined;
    phase.pendingState = undefined;
  }
}

function phaseToState(phase: AdminReleasePhaseData, open = false): PhaseState {
  return {
    id: phase.id,
    title: phase.title,
    description: phase.description,
    releaseAt: new Date(phase.release_at),
    isPublic: phase.visibility === 1,
    states: statesFromChanges(phase.feature_changes),
    puzzleCount: phase.puzzle_count,
    released: phase.released,
    open,
  };
}

function requestBody(phase: PhaseState) {
  return {
    title: phase.title.trim(),
    description: phase.description.trim(),
    content_type: RbContentType.Markdown,
    release_at: phase.releaseAt.toISOString(),
    visibility: phase.isPublic ? 1 : 0,
    feature_changes: changesFromStates(phase.states),
  };
}

function occurredRequestBody(phase: PhaseState) {
  return {
    title: phase.title.trim(),
    description: phase.description.trim(),
  };
}

function originalBody(phase: AdminReleasePhaseData) {
  return {
    title: phase.title,
    description: phase.description,
    content_type: RbContentType.Markdown,
    release_at: new Date(phase.release_at).toISOString(),
    visibility: phase.visibility,
    feature_changes: [...phase.feature_changes].sort((a, b) => a.feature.localeCompare(b.feature)),
  };
}

function comparableBody(phase: PhaseState) {
  const body = requestBody(phase);
  return { ...body, feature_changes: [...body.feature_changes].sort((a, b) => a.feature.localeCompare(b.feature)) };
}

function isPhaseDirty(phase: PhaseState) {
  if (phase.id < 0 || phase.deleting) return true;
  const original = phases.value.find(item => item.id === phase.id);
  if (original?.released) {
    return phase.title.trim() !== original.title || phase.description.trim() !== original.description;
  }
  return Boolean(original && JSON.stringify(comparableBody(phase)) !== JSON.stringify(originalBody(original)));
}

const dirty = computed(() => state.value.some(isPhaseDirty));

function expandedPhaseIds() {
  return new Set(state.value.filter(phase => phase.open && phase.id > 0).map(phase => phase.id));
}

function reset(openIds = expandedPhaseIds()) {
  state.value = phases.value.map(phase => phaseToState(phase, openIds.has(phase.id)));
}

function nextReleaseAt() {
  const latest = state.value.reduce((value, phase) => Math.max(value, phase.releaseAt.getTime()), Date.now());
  return new Date(latest + 60 * 60 * 1000);
}

function addPhase() {
  state.value.push({
    id: nextDraftId--,
    title: '',
    description: '',
    releaseAt: nextReleaseAt(),
    isPublic: true,
    states: {},
    puzzleCount: 0,
    released: false,
    open: true,
  });
}

function removePhase(phase: PhaseState) {
  if (phase.id < 0) {
    if (phase.removing) return;
    phase.removing = true;
    const id = phase.id;
    window.setTimeout(() => {
      state.value = state.value.filter(item => item.id !== id);
    }, 0);
  } else {
    phase.deleting = true;
  }
}

function restorePhase(phase: PhaseState) {
  phase.deleting = false;
}

function phaseDirtyLineClass(phase: PhaseState) {
  return isPhaseDirty(phase) ? "before:content-[''] before:pointer-events-none before:absolute before:-start-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-warning" : '';
}

function validate() {
  return state.value.filter(phase => !phase.deleting).every(phase => phase.title.trim().length > 0 && (phase.released || (Number.isFinite(phase.releaseAt.getTime()) && phase.releaseAt.getTime() > Date.now())));
}

async function fetchPhases(openIds = expandedPhaseIds()) {
  if (!props.gameId) {
    phases.value = [];
    reset(openIds);
    return;
  }
  loading.value = true;
  try {
    const { data } = await api.get<{ phases: AdminReleasePhaseData[] }>(`/admin/games/${props.gameId}/release-phases`);
    phases.value = data.phases;
    reset(openIds);
  } catch (error) {
    handleError(error, '获取阶段失败');
  } finally {
    loading.value = false;
  }
}

async function apply(): Promise<boolean> {
  if (!props.gameId || !dirty.value || saving.value) return true;
  if (!validate()) {
    toast.add({ title: '阶段信息不合法', description: '请检查阶段名称和发生时间。', icon: 'material-symbols:error-outline-rounded', color: 'error' });
    return false;
  }

  const openIds = expandedPhaseIds();
  saving.value = true;
  try {
    for (const phase of state.value.filter(item => item.deleting && item.id > 0)) {
      await api.del(`/admin/games/${props.gameId}/release-phases/${phase.id}`, {
        errorHints: { [-2]: '关联谜题的阶段不能删除。', [-1]: '阶段不存在。' },
      });
    }
    for (const phase of state.value.filter(item => !item.deleting && item.id > 0 && isPhaseDirty(item))) {
      await api.patch(`/admin/games/${props.gameId}/release-phases/${phase.id}`, phase.released ? occurredRequestBody(phase) : requestBody(phase), {
        errorHints: { [-3]: '阶段时间发生冲突。', [-2]: '阶段不可修改或信息不合法。', [-1]: '阶段不存在。' },
      });
    }
    for (const phase of state.value.filter(item => !item.deleting && item.id < 0)) {
      const { data } = await api.post<{ phase: AdminReleasePhaseData }>(`/admin/games/${props.gameId}/release-phases`, requestBody(phase), {
        errorHints: { [-3]: '阶段时间发生冲突。', [-2]: '阶段信息不合法。', [-1]: '比赛不存在。' },
      });
      if (phase.open) openIds.add(data.phase.id);
    }
    await fetchPhases(openIds);
    return true;
  } catch (error) {
    handleError(error, '保存阶段失败');
    return false;
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.gameId,
  () => fetchPhases(new Set()),
  { immediate: true },
);
watch(dirty, value => emit('update:dirty', value), { immediate: true });

defineExpose({ apply, reset });
</script>

<template>
  <section class="space-y-4 mb-4">
    <div>
      <h2 class="text-xl font-semibold text-highlighted">阶段管理</h2>
      <p class="mt-1 text-sm text-muted">阶段用于安排赛程，将显示在前台公告中。可以为各个阶段设置相应的行为，以定时控制比赛功能。</p>
    </div>

    <div v-if="loading" class="space-y-2">
      <u-skeleton v-for="i in 2" :key="i" class="h-14 w-full" />
    </div>

    <u-empty v-else-if="state.length === 0" icon="material-symbols:event-busy-outline-rounded" title="暂无阶段">
      <template #actions><u-button icon="material-symbols:add-rounded" label="新建阶段" :disabled="saving" @click="addPhase" /></template>
    </u-empty>

    <template v-else>
      <div v-for="phase in state" :key="phase.id" class="relative transition-colors" :class="[phase.deleting ? 'opacity-50' : '', phase.removing ? 'pointer-events-none opacity-50' : '', phaseDirtyLineClass(phase)]">
        <u-collapsible v-model:open="phase.open" :unmount-on-hide="false">
          <div class="group flex cursor-pointer items-center gap-3 rounded-lg bg-elevated/60 px-4 py-2 ring ring-default">
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <u-icon name="material-symbols:event-outline-rounded" class="shrink-0 text-primary" />
              <u-input v-if="phase.open" v-model="phase.title" class="-mx-2.5 -my-1.5 w-full font-medium" placeholder="阶段名称" variant="ghost" :disabled="saving || phase.deleting" @click.stop />
              <div v-else class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ phase.title || '未命名阶段' }}</div>
            </div>

            <div class="flex min-w-0 flex-none flex-wrap justify-end gap-1" @click.stop>
              <u-badge v-if="!phase.isPublic" color="neutral" variant="soft">隐藏</u-badge>
              <u-badge v-if="changesFromStates(phase.states).length" color="warning" variant="soft">{{ changesFromStates(phase.states).length }} 项修改</u-badge>
              <u-badge v-if="phase.puzzleCount" color="info" variant="soft" icon="material-symbols:extension-outline-rounded">{{ phase.puzzleCount }} 道谜题</u-badge>
              <u-badge variant="soft" color="neutral" icon="material-symbols:schedule-outline-rounded">{{ formatDate(phase.releaseAt) }}</u-badge>
              <u-badge v-if="phase.released" color="success" variant="soft">已发生</u-badge>
            </div>

            <div v-if="phase.deleting || phase.puzzleCount === 0" class="flex items-center" @pointerdown.stop @click.stop>
              <u-button v-if="phase.deleting" type="button" icon="material-symbols:undo-rounded" color="neutral" variant="ghost" size="sm" :disabled="saving" @click.stop="restorePhase(phase)" />
              <u-button v-else type="button" icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="sm" :disabled="saving || phase.removing" @click.stop="removePhase(phase)" />
            </div>
            <u-icon name="material-symbols:expand-more-rounded" class="size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>

          <template #content>
            <div class="border-t border-default bg-elevated/40 px-4 pb-4 pt-4">
              <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <rb-form-field row narrow-label class="flex-1" label="发生时间">
                    <rb-input-date-time v-model="phase.releaseAt" class="w-full" :disabled="saving || phase.deleting || phase.released" />
                  </rb-form-field>
                  <rb-form-field row narrow-label class="flex-1" label="提前公开">
                    <u-switch v-model="phase.isPublic" class="mt-1.5" label="允许玩家提前查看" :disabled="saving || phase.deleting || phase.released" />
                  </rb-form-field>
                </div>

                <rbph-content-editor v-model="phase.description" framed content-class="min-h-28" placeholder="向玩家展示的阶段说明" :disabled="saving || phase.deleting" @save="apply" />

                <rb-form-field row narrow-label label="修改功能">
                  <div class="flex w-full min-w-0 flex-wrap gap-2">
                    <u-popover v-for="change in changesFromStates(phase.states)" :key="change.feature" arrow :content="{ side: 'top', align: 'center', sideOffset: 8 }">
                      <u-button
                        type="button"
                        size="sm"
                        color="warning"
                        variant="soft"
                        :icon="featureOption(change.feature)?.icon"
                        trailing-icon="material-symbols:close-rounded"
                        :label="featureChangeLabel(change)"
                        :disabled="saving || phase.deleting || phase.released"
                      />
                      <template #content="{ close }">
                        <div class="w-64 p-3 text-sm">
                          <div class="flex items-start gap-2">
                            <u-icon name="material-symbols:warning-outline-rounded" class="mt-0.5 size-4 shrink-0 text-error" />
                            <div class="min-w-0">
                              <div class="font-medium text-highlighted">删除功能修改？</div>
                              <div class="mt-1 text-xs text-muted">确认从该阶段移除「{{ featureChangeLabel(change) }}」？</div>
                            </div>
                          </div>
                          <div class="mt-3 flex justify-end">
                            <u-button size="xs" color="error" variant="soft" icon="material-symbols:delete-outline-rounded" label="删除" @click="(removeFeatureChange(phase, change.feature), close())" />
                          </div>
                        </div>
                      </template>
                    </u-popover>

                    <u-popover :open="phase.featurePopoverOpen" arrow :content="{ side: 'top', align: 'start', sideOffset: 8 }" @update:open="open => setFeaturePopoverOpen(phase, open)">
                      <u-button type="button" size="sm" color="neutral" variant="soft" icon="material-symbols:add-rounded" label="修改功能" :disabled="saving || phase.deleting || phase.released || availableFeatureItems(phase).length === 0" />
                      <template #content>
                        <div class="w-72 space-y-3 p-3">
                          <u-select
                            :model-value="phase.pendingFeature"
                            :items="availableFeatureItems(phase)"
                            :leading-icon="featureOption(phase.pendingFeature)?.icon"
                            placeholder="选择功能"
                            variant="subtle"
                            class="w-full"
                            @update:model-value="value => setPendingFeature(phase, value)"
                          />
                          <u-select
                            v-model="phase.pendingState"
                            :items="pendingStateItems(phase)"
                            :leading-icon="pendingStateItems(phase).find(item => item.value === phase.pendingState)?.icon"
                            placeholder="选择状态"
                            variant="subtle"
                            class="w-full"
                            :disabled="!phase.pendingFeature"
                          />
                          <div class="flex justify-end">
                            <u-button type="button" size="sm" icon="material-symbols:add-rounded" label="添加" variant="soft" :disabled="!phase.pendingFeature || !phase.pendingState" @click="addFeatureChange(phase)" />
                          </div>
                        </div>
                      </template>
                    </u-popover>
                  </div>
                </rb-form-field>
              </div>
            </div>
          </template>
        </u-collapsible>
      </div>

      <div class="sticky bottom-4 z-20 flex justify-end">
        <u-button icon="material-symbols:add-rounded" label="新建阶段" size="lg" class="shadow-lg shadow-primary/20" :disabled="loading || saving" @click="addPhase" />
      </div>
    </template>
  </section>
</template>
