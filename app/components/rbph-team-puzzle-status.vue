<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

const props = defineProps<{
  gameId: number;
  teamId: number;
  teamName: string;
  puzzle: Pick<RbPuzzle, 'id' | 'slug' | 'title'>;
}>();

const open = defineModel<boolean>('open', { default: false });
const api = useApi();
const { t } = useI18n();
const currentTime = useCurrentTimeSec();
const judgeActions = useJudgeActionConsts();
const status = ref<StaffPuzzleTeamStatus>();
const statusLoading = ref(false);
const statusFailed = ref(false);
const submissions = ref<StaffPuzzleSubmissionPage>();
const submissionsLoading = ref(false);
const submissionPage = ref(1);
const onlySuccessfulSubmissions = ref(false);
const hintContents = ref<Record<number, StaffPuzzleHintContent | undefined>>({});
const hintLoading = reactive(new Set<number>());
const hintFailed = reactive(new Set<number>());
let requestToken = 0;
let submissionsRequestToken = 0;

const Icon = resolveComponent('icon');
const UBadge = resolveComponent('u-badge');
const RbTooltip = resolveComponent('rb-tooltip');

const baseEndpoint = computed(
  () => `/games/${props.gameId}/tickets/staff/puzzle/${props.puzzle.id}/teams/${props.teamId}/status`,
);
const cooldownRemaining = computed(() => {
  const till = status.value?.cooldown_till;
  return till ? Math.max(Date.parse(till) - currentTime.value, 0) : 0;
});
const puzzleState = computed(() => {
  if (status.value?.state === RbTeamPuzzleState.Solved) {
    return { label: t('components.teamPuzzleStatus.solved'), color: 'success' as const, icon: 'material-symbols:check-circle-outline-rounded' };
  }
  if (status.value?.state === RbTeamPuzzleState.Unlocked) {
    return { label: t('components.teamPuzzleStatus.unlocked'), color: 'primary' as const, icon: 'material-symbols:lock-open-right-outline-rounded' };
  }
  return { label: t('components.teamPuzzleStatus.locked'), color: 'warning' as const, icon: 'material-symbols:lock-outline-rounded' };
});
const submissionState = computed(() => {
  const current = status.value;
  if (!current) return undefined;
  if (current.team_banned) {
    return { label: t('components.teamPuzzleStatus.teamBanned'), color: 'error' as const, icon: 'material-symbols:block-outline' };
  }
  if (current.state === RbTeamPuzzleState.Locked) {
    return { label: t('components.teamPuzzleStatus.puzzleLocked'), color: 'warning' as const, icon: 'material-symbols:lock-outline-rounded' };
  }
  if (!current.submission_enabled) {
    return { label: t('components.teamPuzzleStatus.submissionDisabled'), color: 'neutral' as const, icon: 'material-symbols:do-not-disturb-on-outline-rounded' };
  }
  if (cooldownRemaining.value > 0) {
    return {
      label: t('components.teamPuzzleStatus.coolingDown', { time: formatTime(cooldownRemaining.value) }),
      color: 'warning' as const,
      icon: 'material-symbols:hourglass-outline-rounded',
    };
  }
  if (current.remaining_submit === 0) {
    return { label: t('components.teamPuzzleStatus.submissionsExhausted'), color: 'error' as const, icon: 'material-symbols:block-outline' };
  }
  if (!current.submit_requirements_met) {
    return { label: t('components.teamPuzzleStatus.requirementsNotMet'), color: 'warning' as const, icon: 'material-symbols:rule-settings-rounded' };
  }
  return { label: t('components.teamPuzzleStatus.canSubmit'), color: 'success' as const, icon: 'material-symbols:check-rounded' };
});
const columns = computed<TableColumn<StaffPuzzleSubmission>[]>(() => [
  {
    accessorKey: 'user_name',
    header: t('submissions.submitter'),
  },
  {
    accessorKey: 'user_answer',
    header: () =>
      h('span', [
        t('submissions.content'),
        h(
          RbTooltip,
          { text: t('submissions.contentHelp') },
          () => h(Icon, { name: 'material-symbols:help-outline-rounded', class: 'size-4 align-middle mb-0.5 ms-1 text-secondary cursor-help' }),
        ),
      ]),
    cell: ({ row, getValue }) =>
      h(
        RbTooltip,
        { text: row.original.norm_answer },
        () => h('span', { class: 'cursor-help' }, getValue<string>()),
      ),
    meta: {
      class: {
        td: 'min-w-[15em] md:min-w-none max-w-[15em] wrap-anywhere whitespace-normal',
      },
    },
  },
  {
    accessorKey: 'saction',
    header: t('submissions.result'),
    cell: ({ row }) => {
      const action = judgeActions.value[row.original.saction];
      return h('div', { class: 'flex flex-wrap gap-1' }, [
        h(UBadge, { color: action.color, variant: 'soft', icon: action.icon }, () => action.name),
        ...(row.original.ignored
          ? [h(UBadge, { color: 'neutral', variant: 'soft' }, () => t('components.teamPuzzleStatus.ignored'))]
          : []),
      ]);
    },
  },
  {
    id: 'details',
    header: t('submissions.message'),
    cell: ({ row }) => {
      const result = row.original.sresult || judgeActions.value[row.original.saction].desc;
      return h('div', { class: 'max-w-64 wrap-anywhere whitespace-normal' }, result);
    },
  },
  {
    accessorKey: 'ctime_at',
    header: t('submissions.time'),
    cell: ({ row }) => h('time', { class: 'whitespace-nowrap text-xs text-muted' }, formatDate(row.original.ctime_at)),
  },
]);

function clearHintContent() {
  hintContents.value = {};
  hintLoading.clear();
  hintFailed.clear();
}

async function loadStatus(token = requestToken) {
  statusLoading.value = true;
  statusFailed.value = false;
  try {
    const { data } = await api.get<StaffPuzzleTeamStatus>(baseEndpoint.value);
    if (token !== requestToken) return;
    useSyncTime().syncWith(new Date(data.server_time));
    status.value = data;
  } catch (error) {
    if (token !== requestToken) return;
    statusFailed.value = true;
    handleError(error, t('components.teamPuzzleStatus.loadFailed'));
  } finally {
    if (token === requestToken) statusLoading.value = false;
  }
}

async function loadSubmissions(page = 1, token = requestToken) {
  const submissionsToken = ++submissionsRequestToken;
  submissionsLoading.value = true;
  try {
    const { data } = await api.get<StaffPuzzleSubmissionPage>(`${baseEndpoint.value}/submissions`, {
      query: {
        page: page - 1,
        only_ok: onlySuccessfulSubmissions.value,
      },
    });
    if (token !== requestToken || submissionsToken !== submissionsRequestToken) return;
    submissionPage.value = page;
    submissions.value = data;
  } catch (error) {
    if (token !== requestToken || submissionsToken !== submissionsRequestToken) return;
    handleError(error, t('components.teamPuzzleStatus.submissionsLoadFailed'));
  } finally {
    if (token === requestToken && submissionsToken === submissionsRequestToken) submissionsLoading.value = false;
  }
}

function updateSubmissionFilter(value: boolean) {
  onlySuccessfulSubmissions.value = value;
  submissions.value = undefined;
  submissionPage.value = 1;
  void loadSubmissions();
}

async function loadHintContent(hintId: number) {
  if (hintContents.value[hintId] || hintLoading.has(hintId)) return;
  const token = requestToken;
  hintLoading.add(hintId);
  hintFailed.delete(hintId);
  try {
    const { data } = await api.get<StaffPuzzleHintContent>(`${baseEndpoint.value}/hints/${hintId}`);
    if (token !== requestToken) return;
    hintContents.value[hintId] = data;
  } catch (error) {
    if (token !== requestToken) return;
    hintFailed.add(hintId);
    handleError(error, t('components.teamPuzzleStatus.hintLoadFailed'));
  } finally {
    if (token === requestToken) hintLoading.delete(hintId);
  }
}

function hintPrice(hint: StaffPuzzleHintStatus) {
  if (hint.cost_id === null || hint.cost_id === undefined || hint.cost_amount <= 0) {
    return t('components.teamPuzzleStatus.free');
  }
  return `${hint.cost_name ?? `#${hint.cost_id}`} ${intPrecString(hint.cost_amount, hint.cost_prec ?? 0)}`;
}

function hintRemaining(hint: StaffPuzzleHintStatus) {
  if (!hint.available_at) return 0;
  return Math.max(Date.parse(hint.available_at) - currentTime.value, 0);
}

function hintStatusLabel(hint: StaffPuzzleHintStatus) {
  if (!hint.enabled) return t('components.teamPuzzleStatus.hintNotEnabled');
  if (!hint.unlocked) return t('components.teamPuzzleStatus.hintNotPurchased');
  return hint.cost_id !== null && hint.cost_id !== undefined && hint.cost_amount > 0
    ? t('components.teamPuzzleStatus.hintPurchased')
    : t('components.teamPuzzleStatus.hintUnlocked');
}

function reload() {
  const token = ++requestToken;
  status.value = undefined;
  submissions.value = undefined;
  submissionPage.value = 1;
  clearHintContent();
  void Promise.all([loadStatus(token), loadSubmissions(1, token)]);
}

watch(
  () => [open.value, props.gameId, props.teamId, props.puzzle.id] as const,
  ([isOpen]) => {
    if (isOpen) reload();
  },
);
</script>

<template>
  <u-button
    type="button"
    size="xs"
    color="neutral"
    variant="soft"
    icon="material-symbols:extension-outline-rounded"
    :label="t('components.teamPuzzleStatus.menu')"
    @click="open = true"
  />

  <u-modal
    v-model:open="open"
    :title="t('components.teamPuzzleStatus.title', { team: teamName, puzzle: puzzle.title })"
    :description="t('components.teamPuzzleStatus.description')"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div v-if="statusLoading && !status" class="space-y-4">
        <u-skeleton class="h-24 w-full" />
        <u-skeleton class="h-36 w-full" />
        <u-skeleton class="h-48 w-full" />
      </div>
      <u-empty
        v-else-if="statusFailed || !status"
        icon="material-symbols:error-med-outline-rounded"
        :title="t('components.teamPuzzleStatus.loadFailed')"
      >
        <template #actions>
          <u-button color="neutral" variant="soft" icon="material-symbols:refresh-rounded" :label="t('components.teamPuzzleStatus.retry')" @click="reload" />
        </template>
      </u-empty>
      <div v-else class="space-y-5">
        <section class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg bg-elevated/60 p-4 ring ring-default">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <u-badge :color="puzzleState.color" variant="soft" :icon="puzzleState.icon">{{ puzzleState.label }}</u-badge>
            </div>
            <dl class="space-y-2 text-sm">
              <div class="flex items-start justify-between gap-4">
                <dt class="text-muted">{{ t('components.teamPuzzleStatus.unlockTime') }}</dt>
                <dd class="text-right text-highlighted">{{ formatDate(status.unlock_at) }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4">
                <dt class="text-muted">{{ t('components.teamPuzzleStatus.solveTime') }}</dt>
                <dd class="text-right text-highlighted">
                  {{ status.solve_at ? formatDate(status.solve_at) : t('components.teamPuzzleStatus.notSolved') }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="rounded-lg bg-elevated/60 p-4 ring ring-default">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <u-badge v-if="submissionState" :color="submissionState.color" variant="soft" :icon="submissionState.icon">
                {{ submissionState.label }}
              </u-badge>
            </div>
            <dl class="space-y-2 text-sm">
              <div class="flex items-start justify-between gap-4">
                <dt class="text-muted">{{ t('components.teamPuzzleStatus.incorrectSubmissions') }}</dt>
                <dd class="text-right text-highlighted">{{ status.submit_count }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4">
                <dt class="text-muted">{{ t('components.teamPuzzleStatus.remainingSubmissions') }}</dt>
                <dd class="text-right text-highlighted">
                  {{ status.remaining_submit === null || status.remaining_submit === undefined ? t('components.teamPuzzleStatus.unlimited') : `${status.remaining_submit}/${status.max_submit}` }}
                </dd>
              </div>
              <div v-if="status.cooldown_till" class="flex items-start justify-between gap-4">
                <dt class="text-muted">{{ t('components.teamPuzzleStatus.cooldownUntil') }}</dt>
                <dd class="text-right text-highlighted">{{ formatDate(status.cooldown_till) }}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section>
          <h3 class="mb-2 text-base font-semibold text-highlighted">{{ t('components.teamPuzzleStatus.hints') }}</h3>
          <u-empty v-if="status.hints.length === 0" icon="material-symbols:contact-support-outline-rounded" :title="t('components.teamPuzzleStatus.noHints')" />
          <div v-else class="max-h-80 space-y-2 overflow-y-auto p-1">
            <u-collapsible
              v-for="hint in status.hints"
              :key="hint.id"
              class="group block overflow-hidden rounded-lg ring ring-default"
              :unmount-on-hide="false"
              @update:open="value => value && loadHintContent(hint.id)"
            >
              <div class="flex cursor-pointer items-center gap-2 bg-elevated/60 px-4 py-2">
                <u-icon
                  :name="hint.unlocked ? 'material-symbols:lock-open-right-outline-rounded' : 'material-symbols:lock-outline'"
                  :class="hint.unlocked ? 'text-success' : 'text-muted'"
                  class="size-4 shrink-0"
                />
                <div class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ hint.title }}</div>
                <u-button
                  v-if="hint.unlocked"
                  type="button"
                  size="xs"
                  color="success"
                  variant="soft"
                  icon="material-symbols:check-rounded"
                  :label="hintStatusLabel(hint)"
                  class="pointer-events-none shrink-0"
                  tabindex="-1"
                />
                <u-button
                  v-else-if="!hint.enabled"
                  type="button"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="material-symbols:block-rounded"
                  :label="hintStatusLabel(hint)"
                  class="pointer-events-none shrink-0"
                  tabindex="-1"
                />
                <u-button
                  v-else-if="hintRemaining(hint) > 0"
                  type="button"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="material-symbols:hourglass-outline-rounded"
                  :label="formatTime(hintRemaining(hint))"
                  class="pointer-events-none shrink-0"
                  tabindex="-1"
                />
                <u-button
                  v-else
                  type="button"
                  size="xs"
                  color="warning"
                  variant="soft"
                  icon="material-symbols:emoji-objects-outline-rounded"
                  :label="hintPrice(hint)"
                  class="pointer-events-none shrink-0"
                  tabindex="-1"
                />
                <u-icon name="material-symbols:expand-more-rounded" class="size-4 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" />
              </div>
              <template #content>
                <div class="border-t border-default px-4 py-4">
                  <u-skeleton v-if="hintLoading.has(hint.id)" class="h-24 w-full" />
                  <u-alert
                    v-else-if="hintFailed.has(hint.id)"
                    color="error"
                    variant="subtle"
                    icon="material-symbols:error-med-outline-rounded"
                    :title="t('components.teamPuzzleStatus.hintLoadFailed')"
                  >
                    <template #actions>
                      <u-button color="error" variant="soft" size="xs" icon="material-symbols:refresh-rounded" :label="t('components.teamPuzzleStatus.retry')" @click="loadHintContent(hint.id)" />
                    </template>
                  </u-alert>
                  <template v-else-if="hintContents[hint.id]">
                    <dl class="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <div class="flex items-start justify-between gap-3">
                        <dt class="text-muted">{{ t('components.teamPuzzleStatus.hintState') }}</dt>
                        <dd class="text-right text-highlighted">{{ hintStatusLabel(hint) }}</dd>
                      </div>
                      <div class="flex items-start justify-between gap-3">
                        <dt class="text-muted">{{ t('components.teamPuzzleStatus.hintPrice') }}</dt>
                        <dd class="text-right text-highlighted">{{ hintPrice(hint) }}</dd>
                      </div>
                      <div class="flex items-start justify-between gap-3">
                        <dt class="text-muted">{{ t('components.teamPuzzleStatus.hintAvailableAt') }}</dt>
                        <dd class="text-right text-highlighted">{{ hint.available_at ? formatDate(hint.available_at) : t('components.teamPuzzleStatus.hintNotEnabled') }}</dd>
                      </div>
                      <div class="flex items-start justify-between gap-3">
                        <dt class="text-muted">{{ t('components.teamPuzzleStatus.hintUnlockedAt') }}</dt>
                        <dd class="text-right text-highlighted">
                          {{ hint.unlocked_at ? formatDate(hint.unlocked_at) : t('components.teamPuzzleStatus.notUnlocked') }}
                        </dd>
                      </div>
                    </dl>
                    <div class="border-t border-default pt-4">
                      <rbph-content :content="hintContents[hint.id]!" />
                    </div>
                  </template>
                </div>
              </template>
            </u-collapsible>
          </div>
        </section>

        <section>
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-base font-semibold text-highlighted">{{ t('components.teamPuzzleStatus.submissions') }}</h3>
            <u-switch
              :model-value="onlySuccessfulSubmissions"
              size="sm"
              :label="t('components.teamPuzzleStatus.onlySuccessfulSubmissions')"
              :disabled="submissionsLoading"
              @update:model-value="updateSubmissionFilter"
            />
          </div>
          <div class="max-h-80 overflow-auto rounded-lg ring ring-default">
            <u-table
              v-if="submissions?.data.length"
              :data="submissions.data"
              :columns="columns"
              :loading="submissionsLoading"
              :ui="{ base: 'w-full min-w-[48rem]', td: 'px-4 py-3' }"
            />
            <div v-else-if="submissionsLoading" class="space-y-2 p-4">
              <u-skeleton class="h-10 w-full" />
              <u-skeleton class="h-10 w-full" />
            </div>
            <u-empty
              v-else
              icon="material-symbols:assignment-outline-rounded"
              :title="onlySuccessfulSubmissions ? t('submissions.noSuccessfulSubmissions') : t('submissions.noSubmissions')"
            />
          </div>
          <div v-if="submissions && submissions.total > 10" class="mt-3 flex justify-end">
            <u-pagination
              :page="submissionPage"
              :total="submissions.total"
              :items-per-page="10"
              :disabled="submissionsLoading"
              @update:page="loadSubmissions"
            />
          </div>
        </section>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <u-button
          :to="gamePuzzleSimpleRoute(gameId, puzzle)"
          icon="material-symbols:open-in-new-rounded"
          :label="t('components.teamPuzzleStatus.openPuzzle')"
        />
        <div class="flex gap-2">
          <u-button color="neutral" variant="soft" icon="material-symbols:refresh-rounded" :label="t('components.teamPuzzleStatus.refresh')" :loading="statusLoading" @click="reload" />
        </div>
      </div>
    </template>
  </u-modal>
</template>
