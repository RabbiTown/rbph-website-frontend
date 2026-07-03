<script setup lang="ts">
interface AdminSystemSettings {
  registration_open: boolean;
  require_email_verification: boolean;
  captcha_login_required: boolean;
  captcha_registration_required: boolean;
  max_sessions: number;
  max_websocket_connections: number;
  maintenance_enabled: boolean;
  maintenance_message: string;
  updated_by?: number | null;
  updated_at: string;
}

interface AdminSystemSettingsResponse {
  settings: AdminSystemSettings;
  email_delivery_enabled: boolean;
  captcha_provider?: string | null;
}

definePageMeta({ middleware: ['root'] });

const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const settings = ref<AdminSystemSettings>();
const emailDeliveryEnabled = ref(false);
const captchaProvider = ref<string>();
const loading = ref(false);
const saving = ref(false);

const draft = reactive({
  registration_open: true,
  require_email_verification: false,
  captcha_login_required: false,
  captcha_registration_required: false,
  max_sessions: 3,
  max_websocket_connections: 5,
  maintenance_enabled: false,
  maintenance_message: '',
});

const dirty = computed(() => {
  const current = settings.value;
  return Boolean(
    current &&
    (draft.registration_open !== current.registration_open ||
      draft.require_email_verification !== current.require_email_verification ||
      draft.captcha_login_required !== current.captcha_login_required ||
      draft.captcha_registration_required !== current.captcha_registration_required ||
      draft.max_sessions !== current.max_sessions ||
      draft.max_websocket_connections !== current.max_websocket_connections ||
      draft.maintenance_enabled !== current.maintenance_enabled ||
      draft.maintenance_message !== current.maintenance_message),
  );
});
const valid = computed(() => draft.max_sessions >= 1 && draft.max_sessions <= 20 && draft.max_websocket_connections >= 1 && draft.max_websocket_connections <= 20 && draft.maintenance_message.length <= 500);

function syncDraft(current: AdminSystemSettings) {
  draft.registration_open = current.registration_open;
  draft.require_email_verification = current.require_email_verification;
  draft.captcha_login_required = current.captcha_login_required;
  draft.captcha_registration_required = current.captcha_registration_required;
  draft.max_sessions = current.max_sessions;
  draft.max_websocket_connections = current.max_websocket_connections;
  draft.maintenance_enabled = current.maintenance_enabled;
  draft.maintenance_message = current.maintenance_message;
}

async function load() {
  if (dirty.value || loading.value) return;
  loading.value = true;
  try {
    const { data } = await api.get<AdminSystemSettingsResponse>('/admin/system-settings');
    settings.value = data.settings;
    emailDeliveryEnabled.value = data.email_delivery_enabled;
    captchaProvider.value = data.captcha_provider ?? undefined;
    syncDraft(data.settings);
  } catch (error) {
    handleError(error, '获取系统设置失败');
  } finally {
    loading.value = false;
  }
}

function reset() {
  if (settings.value) syncDraft(settings.value);
  dirtyToast.clear();
}

async function save() {
  if (!dirty.value || !valid.value || saving.value) return;
  saving.value = true;
  try {
    const { data } = await api.patch<AdminSystemSettingsResponse>(
      '/admin/system-settings',
      {
        registration_open: draft.registration_open,
        require_email_verification: draft.require_email_verification,
        captcha_login_required: draft.captcha_login_required,
        captcha_registration_required: draft.captcha_registration_required,
        max_sessions: draft.max_sessions,
        max_websocket_connections: draft.max_websocket_connections,
        maintenance_enabled: draft.maintenance_enabled,
        maintenance_message: draft.maintenance_message.trim(),
      },
      { errorHints: { [-1]: '设置值无效，请检查邮件服务和填写内容' } },
    );
    settings.value = data.settings;
    emailDeliveryEnabled.value = data.email_delivery_enabled;
    captchaProvider.value = data.captcha_provider ?? undefined;
    syncDraft(data.settings);
    await useSystemStatus().refresh(true);
    dirtyToast.clear();
    toast.add({ title: '系统设置已保存', icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '保存系统设置失败', true);
  } finally {
    saving.value = false;
  }
}

watch(dirty, value => {
  if (value) dirtyToast.show({ description: '系统设置修改尚未保存。', guardOnLeave: true, apply: save, reset });
  else dirtyToast.clear();
});
onMounted(load);
onBeforeUnmount(() => dirtyToast.clear());
</script>

<template>
  <u-dashboard-panel id="admin-system-settings">
    <template #header>
      <u-dashboard-navbar title="系统设置">
        <template #leading>
          <u-dashboard-sidebar-collapse />
        </template>
      </u-dashboard-navbar>
    </template>
    <template #body>
      <div>
        <div class="grid min-h-0 gap-6 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,64rem)_minmax(14rem,18rem)]">
          <aside class="hidden xl:block" />
          <main class="min-w-0 space-y-8">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-xl font-semibold text-highlighted">系统设置</h2>
                <p class="mt-1 text-sm text-muted">全局运行策略，修改后立即生效。</p>
              </div>
              <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" :disabled="dirty || saving" @click="load" />
            </div>

            <div v-if="loading && !settings" class="space-y-3">
              <u-skeleton class="h-48 w-full" />
              <u-skeleton class="h-48 w-full" />
            </div>
            <u-form v-else-if="settings" :state="draft" class="flex flex-col gap-8" @submit.prevent="save">
              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">访问与注册</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    label="开放注册"
                    icon="material-symbols:how-to-reg-rounded"
                    description="关闭后不再接受新用户注册。"
                    :dirty="draft.registration_open !== settings.registration_open"
                    :reset="() => (draft.registration_open = settings!.registration_open)"
                  >
                    <u-switch v-model="draft.registration_open" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field
                    row
                    label="要求邮箱验证"
                    icon="material-symbols:mark-email-read-outline-rounded"
                    :description="emailDeliveryEnabled ? '用户需通过验证邮件完成注册。' : '部署配置未启用邮件服务。'"
                    :dirty="draft.require_email_verification !== settings.require_email_verification"
                    :reset="() => (draft.require_email_verification = settings!.require_email_verification)"
                  >
                    <u-switch v-model="draft.require_email_verification" :disabled="saving || !emailDeliveryEnabled" />
                  </rb-form-field>
                </div>
              </section>

              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">验证码</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    label="登录验证"
                    icon="material-symbols:shield-lock-outline-rounded"
                    :description="captchaProvider ? `通过 ${captchaProvider} 验证后才能登录。` : '部署配置未启用验证码服务。'"
                    :dirty="draft.captcha_login_required !== settings.captcha_login_required"
                    :reset="() => (draft.captcha_login_required = settings!.captcha_login_required)"
                  >
                    <u-switch v-model="draft.captcha_login_required" :disabled="saving || !captchaProvider" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field
                    row
                    label="注册验证"
                    icon="material-symbols:person-shield-outline-rounded"
                    :description="captchaProvider ? `通过 ${captchaProvider} 验证后才能注册。` : '部署配置未启用验证码服务。'"
                    :dirty="draft.captcha_registration_required !== settings.captcha_registration_required"
                    :reset="() => (draft.captcha_registration_required = settings!.captcha_registration_required)"
                  >
                    <u-switch v-model="draft.captcha_registration_required" :disabled="saving || !captchaProvider" />
                  </rb-form-field>
                </div>
              </section>

              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">会话策略</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    label="最大并发会话"
                    icon="material-symbols:devices-rounded"
                    description="一个用户最多可同时维持的登录会话数量。"
                    :dirty="draft.max_sessions !== settings.max_sessions"
                    :reset="() => (draft.max_sessions = settings!.max_sessions)"
                  >
                    <u-input-number v-model="draft.max_sessions" :min="1" :max="20" :disabled="saving" class="w-32" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field
                    row
                    label="最大并发连接"
                    icon="material-symbols:device-hub-rounded"
                    description="一个用户最多可同时保持的同步连接数，超限时新连接会替换最旧连接。"
                    :dirty="draft.max_websocket_connections !== settings.max_websocket_connections"
                    :reset="() => (draft.max_websocket_connections = settings!.max_websocket_connections)"
                  >
                    <u-input-number v-model="draft.max_websocket_connections" :min="1" :max="20" :disabled="saving" class="w-32" />
                  </rb-form-field>
                </div>
              </section>

              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">维护模式</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    label="启用维护模式"
                    icon="material-symbols:construction-rounded"
                    description="普通用户和工作人员将无法使用平台，管理员可继续访问。"
                    :dirty="draft.maintenance_enabled !== settings.maintenance_enabled"
                    :reset="() => (draft.maintenance_enabled = settings!.maintenance_enabled)"
                  >
                    <u-switch v-model="draft.maintenance_enabled" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row label="维护提示" icon="material-symbols:notes-rounded" :dirty="draft.maintenance_message !== settings.maintenance_message" :reset="() => (draft.maintenance_message = settings!.maintenance_message)">
                    <u-textarea v-model="draft.maintenance_message" class="w-full sm:w-64" :rows="4" :maxlength="500" :disabled="saving" />
                  </rb-form-field>
                </div>
              </section>
            </u-form>
          </main>
          <aside class="hidden xl:block" />
        </div>
      </div>
    </template>
  </u-dashboard-panel>
</template>
