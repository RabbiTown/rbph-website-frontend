<script setup lang="ts">
type BackendExecutionType = 'api' | 'judge' | 'hint_purchase';
type ConsoleLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

interface BackendConsoleEntry {
  level: ConsoleLevel;
  message: string;
}

interface BackendCallLog {
  id: number;
  puzzle_id: number;
  team_id?: number | null;
  team_name?: string | null;
  user_id?: number | null;
  user_nickname?: string | null;
  execution_type: BackendExecutionType;
  request_method?: string | null;
  function_name: string;
  ok: boolean;
  duration_ms: number;
  submission_id?: number | null;
  hint_id?: number | null;
  error?: string | null;
  console: BackendConsoleEntry[];
  console_truncated: boolean;
  ctime_at: string;
}

interface BackendCallLogResponse {
  code: number;
  logs: BackendCallLog[];
  total: number;
}

const props = defineProps<{
  puzzleId: number;
  gameId: number;
}>();

const open = defineModel<boolean>('open', { default: false });
const { t } = useI18n();
const api = useApi();
const pageSize = 50;
const logs = ref<BackendCallLog[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
let loadToken = 0;

const filters = reactive({
  execution_type: null as BackendExecutionType | null,
  function_name: '',
  ok: null as boolean | null,
  team_id: undefined as number | undefined,
  user_id: undefined as number | undefined,
  from: '',
  to: '',
});

const executionTypeItems = computed(() => [
  { label: t('admin.pages.puzzle.settings.backendLogs.allTypes'), value: null },
  { label: t('admin.pages.puzzle.settings.backendLogs.types.api'), value: 'api' },
  { label: t('admin.pages.puzzle.settings.backendLogs.types.judge'), value: 'judge' },
  { label: t('admin.pages.puzzle.settings.backendLogs.types.hintPurchase'), value: 'hint_purchase' },
]);

const statusItems = computed(() => [
  { label: t('admin.pages.puzzle.settings.backendLogs.allStatuses'), value: null },
  { label: t('admin.pages.puzzle.settings.backendLogs.success'), value: true },
  { label: t('admin.pages.puzzle.settings.backendLogs.failed'), value: false },
]);

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === 'number';
}

function executionTypeLabel(type: BackendExecutionType) {
  if (type === 'judge') return t('admin.pages.puzzle.settings.backendLogs.types.judge');
  if (type === 'hint_purchase') return t('admin.pages.puzzle.settings.backendLogs.types.hintPurchase');
  return t('admin.pages.puzzle.settings.backendLogs.types.api');
}

function consoleLevelClass(level: ConsoleLevel) {
  if (level === 'error') return 'text-error';
  if (level === 'warn') return 'text-warning';
  if (level === 'info') return 'text-info';
  if (level === 'debug') return 'text-dimmed';
  return 'text-muted';
}

function queryOf(targetPage: number) {
  const query: Record<string, string | number | boolean> = {
    page: targetPage,
    limit: pageSize,
  };
  if (filters.execution_type) query.execution_type = filters.execution_type;
  if (filters.function_name.trim()) query.function_name = filters.function_name.trim();
  if (filters.ok !== null) query.ok = filters.ok;
  if (hasNumber(filters.team_id)) query.team_id = filters.team_id;
  if (hasNumber(filters.user_id)) query.user_id = filters.user_id;
  if (filters.from) query.from = new Date(filters.from).toISOString();
  if (filters.to) query.to = new Date(filters.to).toISOString();
  return query;
}

async function load(targetPage = 1) {
  const token = ++loadToken;
  loading.value = true;
  try {
    const { data } = await api.get<BackendCallLogResponse>(`/admin/puzzles/${props.puzzleId}/backend/logs`, {
      query: queryOf(targetPage),
      errorHints: {
        [-2]: t('admin.pages.puzzle.settings.backendLogs.invalidFilter'),
        [-1]: t('admin.common.puzzleNotFound'),
      },
    });
    if (token !== loadToken) return;
    logs.value = data.logs;
    total.value = data.total;
    page.value = targetPage;
  } catch (error) {
    if (token === loadToken) handleError(error, t('admin.pages.puzzle.settings.backendLogs.loadFailed'));
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

function resetFilters() {
  filters.execution_type = null;
  filters.function_name = '';
  filters.ok = null;
  filters.team_id = undefined;
  filters.user_id = undefined;
  filters.from = '';
  filters.to = '';
  void load(1);
}

watch(
  () => [open.value, props.puzzleId] as const,
  ([isOpen]) => {
    if (isOpen) void load(1);
  },
);
</script>

<template>
  <u-modal v-model:open="open" :title="t('admin.pages.puzzle.settings.backendLogs.title')" :ui="{ content: 'sm:max-w-5xl' }">
    <template #body>
      <div class="space-y-4">
        <form class="space-y-3 rounded-md border border-default bg-elevated/50 p-4" @submit.prevent="load(1)">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <u-form-field :label="t('admin.pages.puzzle.settings.backendLogs.executionType')">
              <u-select v-model="filters.execution_type" :items="executionTypeItems" class="w-full" />
            </u-form-field>
            <u-form-field :label="t('admin.pages.puzzle.settings.backendLogs.functionName')">
              <u-input v-model="filters.function_name" class="w-full font-mono" placeholder="function" />
            </u-form-field>
            <u-form-field :label="t('admin.pages.puzzle.settings.backendLogs.status')">
              <u-select v-model="filters.ok" :items="statusItems" class="w-full" />
            </u-form-field>
            <u-form-field :label="t('admin.pages.puzzle.settings.backendLogs.teamId')">
              <rbph-staff-team-select v-model="filters.team_id" :game-id="gameId" :disabled="loading" />
            </u-form-field>
            <u-form-field :label="t('admin.pages.puzzle.settings.backendLogs.userId')">
              <rbph-admin-user-select v-model="filters.user_id" :game-id="gameId" allow-any-team :disabled="loading" />
            </u-form-field>
            <div class="grid grid-cols-2 gap-2">
              <u-form-field :label="t('admin.pages.puzzle.settings.backendLogs.from')">
                <u-input v-model="filters.from" type="datetime-local" class="w-full" />
              </u-form-field>
              <u-form-field :label="t('admin.pages.puzzle.settings.backendLogs.to')">
                <u-input v-model="filters.to" type="datetime-local" class="w-full" />
              </u-form-field>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <u-button type="submit" icon="material-symbols:search-rounded" :label="t('admin.pages.puzzle.settings.backendLogs.search')" :loading="loading" />
            <u-button color="neutral" variant="soft" icon="material-symbols:refresh-rounded" :label="t('admin.pages.puzzle.settings.backendLogs.refresh')" :disabled="loading" @click="load(page)" />
            <u-button color="neutral" variant="ghost" icon="material-symbols:filter-list-off-rounded" :label="t('admin.common.reset')" :disabled="loading" @click="resetFilters" />
          </div>
        </form>

        <div v-if="loading && logs.length === 0" class="space-y-3">
          <u-skeleton class="h-28 w-full" />
          <u-skeleton class="h-28 w-full" />
          <u-skeleton class="h-28 w-full" />
        </div>
        <u-empty v-else-if="logs.length === 0" icon="material-symbols:receipt-long-outline-rounded" :title="t('admin.pages.puzzle.settings.backendLogs.empty')" />
        <div v-else class="divide-y divide-default rounded-md border border-default bg-default px-4">
          <article v-for="log in logs" :key="log.id" class="space-y-3 py-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 space-y-1.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  <u-badge :color="log.ok ? 'success' : 'error'" variant="soft" :icon="log.ok ? 'material-symbols:check-circle-outline-rounded' : 'material-symbols:error-outline-rounded'">
                    {{ log.ok ? t('admin.pages.puzzle.settings.backendLogs.success') : t('admin.pages.puzzle.settings.backendLogs.failed') }}
                  </u-badge>
                  <u-badge color="neutral" variant="soft">{{ executionTypeLabel(log.execution_type) }}</u-badge>
                  <u-badge v-if="log.request_method" color="neutral" variant="outline" class="font-mono">{{ log.request_method }}</u-badge>
                  <code class="wrap-break-word rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-toned">{{ log.function_name }}</code>
                  <span class="text-xs text-muted">{{ t('admin.pages.puzzle.settings.backendLogs.duration', { duration: log.duration_ms }) }}</span>
                </div>
                <div class="flex flex-wrap gap-1.5 text-xs text-muted">
                  <u-badge v-if="log.team_id !== null && log.team_id !== undefined" size="sm" color="neutral" variant="outline" icon="material-symbols:groups-2-outline-rounded">
                    {{ log.team_name || t('admin.pages.puzzle.settings.backendLogs.unknownTeam') }} (#{{ log.team_id }})
                  </u-badge>
                  <u-badge v-if="log.user_id !== null && log.user_id !== undefined" size="sm" color="neutral" variant="outline" icon="material-symbols:person-outline-rounded">
                    {{ log.user_nickname || t('admin.pages.puzzle.settings.backendLogs.unknownUser') }} (#{{ log.user_id }})
                  </u-badge>
                  <u-badge v-if="log.submission_id !== null && log.submission_id !== undefined" size="sm" color="neutral" variant="outline" icon="material-symbols:assignment-turned-in-outline-rounded">
                    {{ t('admin.pages.puzzle.settings.backendLogs.submission', { id: log.submission_id }) }}
                  </u-badge>
                  <u-badge v-if="log.hint_id !== null && log.hint_id !== undefined" size="sm" color="neutral" variant="outline" icon="material-symbols:emoji-objects-outline-rounded">
                    {{ t('admin.pages.puzzle.settings.backendLogs.hint', { id: log.hint_id }) }}
                  </u-badge>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <time class="block text-xs text-muted">{{ formatDate(log.ctime_at) }}</time>
                <span class="font-mono text-xs text-dimmed">#{{ log.id }}</span>
              </div>
            </div>

            <div v-if="log.error" class="wrap-break-word whitespace-pre-wrap rounded-md bg-error/10 px-3 py-2 font-mono text-xs text-error">{{ log.error }}</div>
            <div v-if="log.console.length > 0 || log.console_truncated" class="overflow-hidden rounded-md bg-muted">
              <div class="border-b border-default px-3 py-2 text-xs font-medium text-toned">{{ t('admin.pages.puzzle.settings.backendLogs.consoleOutput') }}</div>
              <div class="max-h-56 overflow-auto px-3 py-2 font-mono text-xs">
                <div v-for="(entry, index) in log.console" :key="index" class="flex gap-2 whitespace-pre-wrap wrap-break-word">
                  <span :class="['shrink-0 uppercase', consoleLevelClass(entry.level)]">[{{ entry.level }}]</span>
                  <span>{{ entry.message }}</span>
                </div>
                <div v-if="log.console_truncated" class="mt-1 text-warning">{{ t('admin.pages.puzzle.settings.backendLogs.consoleTruncated') }}</div>
              </div>
            </div>
          </article>
        </div>

        <div v-if="total > pageSize" class="flex justify-end">
          <u-pagination :page="page" :total="total" :items-per-page="pageSize" variant="soft" active-variant="subtle" :disabled="loading" @update:page="load" />
        </div>
      </div>
    </template>
  </u-modal>
</template>
