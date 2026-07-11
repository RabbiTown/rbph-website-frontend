<script setup lang="ts">const { t } = useI18n();


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

useHead({
  titleTemplate: t('admin.pages.settings.pageTitle'),
});

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
    handleError(error, t('admin.pages.settings.loadSystemSettingsFailed'));
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
      { errorHints: { [-1]: t('admin.pages.settings.invalidSettings') } },
    );
    settings.value = data.settings;
    emailDeliveryEnabled.value = data.email_delivery_enabled;
    captchaProvider.value = data.captcha_provider ?? undefined;
    syncDraft(data.settings);
    await useSystemStatus().refresh(true);
    dirtyToast.clear();
    toast.add({ title: t('admin.pages.settings.systemSettingsSaved'), icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
  } catch (error) {
    handleError(error, t('admin.pages.settings.saveSystemSettingsFailed'), true);
  } finally {
    saving.value = false;
  }
}

watch(dirty, value => {
  if (value) dirtyToast.show({ description: t('admin.pages.settings.systemSettingsUpdateNotYetSave'), guardOnLeave: true, apply: save, reset });
  else dirtyToast.clear();
});
onMounted(load);
onBeforeUnmount(() => dirtyToast.clear());
</script>

<template>
  <u-dashboard-panel id="admin-system-settings">
    <template #header>
      <u-dashboard-navbar :title="t('admin.common.systemSettings')">
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
                <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.common.systemSettings') }}</h2>
                <p class="mt-1 text-sm text-muted">{{ t('admin.pages.settings.globalPolicyUpdateImmediate') }}</p>
              </div>
              <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="ghost" :loading="loading" :disabled="dirty || saving" @click="load" />
            </div>

            <div v-if="loading && !settings" class="space-y-3">
              <u-skeleton class="h-48 w-full" />
              <u-skeleton class="h-48 w-full" />
            </div>
            <u-form v-else-if="settings" :state="draft" class="flex flex-col gap-8" @submit.prevent="save">
              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.pages.settings.accessRegistration') }}</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    :label="t('admin.common.registrationOpen')"
                    icon="material-symbols:how-to-reg-rounded"
                    :description="t('admin.pages.settings.closeNewUserRegistration')"
                    :dirty="draft.registration_open !== settings.registration_open"
                    :reset="() => (draft.registration_open = settings!.registration_open)"
                  >
                    <u-switch v-model="draft.registration_open" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field
                    row
                    :label="t('admin.pages.settings.requirementEmailVerification')"
                    icon="material-symbols:mark-email-read-outline-rounded"
                    :description="emailDeliveryEnabled ? t('admin.pages.settings.emailVerificationDescription') : t('admin.pages.settings.emailServiceDisabled')"
                    :dirty="draft.require_email_verification !== settings.require_email_verification"
                    :reset="() => (draft.require_email_verification = settings!.require_email_verification)"
                  >
                    <u-switch v-model="draft.require_email_verification" :disabled="saving || !emailDeliveryEnabled" />
                  </rb-form-field>
                </div>
              </section>

              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.pages.settings.captcha') }}</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    :label="t('admin.pages.settings.loginVerification')"
                    icon="material-symbols:shield-lock-outline-rounded"
                    :description="captchaProvider ? t('admin.pages.settings.passVerificationLogin', { method: captchaProvider }) : t('admin.pages.settings.captchaServiceDisabled')"
                    :dirty="draft.captcha_login_required !== settings.captcha_login_required"
                    :reset="() => (draft.captcha_login_required = settings!.captcha_login_required)"
                  >
                    <u-switch v-model="draft.captcha_login_required" :disabled="saving || !captchaProvider" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field
                    row
                    :label="t('admin.pages.settings.registrationVerification')"
                    icon="material-symbols:person-shield-outline-rounded"
                    :description="captchaProvider ? t('admin.pages.settings.passVerificationRegistration', { method: captchaProvider }) : t('admin.pages.settings.captchaServiceDisabled')"
                    :dirty="draft.captcha_registration_required !== settings.captcha_registration_required"
                    :reset="() => (draft.captcha_registration_required = settings!.captcha_registration_required)"
                  >
                    <u-switch v-model="draft.captcha_registration_required" :disabled="saving || !captchaProvider" />
                  </rb-form-field>
                </div>
              </section>

              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.pages.settings.sessionPolicy') }}</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    :label="t('admin.common.maxConcurrentSessions')"
                    icon="material-symbols:devices-rounded"
                    :description="t('admin.pages.settings.itemUserLoginSessionCount')"
                    :dirty="draft.max_sessions !== settings.max_sessions"
                    :reset="() => (draft.max_sessions = settings!.max_sessions)"
                  >
                    <u-input-number v-model="draft.max_sessions" :min="1" :max="20" :disabled="saving" class="w-32" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field
                    row
                    :label="t('admin.common.maxConcurrentConnections')"
                    icon="material-symbols:device-hub-rounded"
                    :description="t('admin.pages.settings.connectionLimitDescription')"
                    :dirty="draft.max_websocket_connections !== settings.max_websocket_connections"
                    :reset="() => (draft.max_websocket_connections = settings!.max_websocket_connections)"
                  >
                    <u-input-number v-model="draft.max_websocket_connections" :min="1" :max="20" :disabled="saving" class="w-32" />
                  </rb-form-field>
                </div>
              </section>

              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-highlighted">{{ t('admin.common.maintenanceMode') }}</h3>
                <div class="space-y-3 rounded-md bg-elevated/60 p-4 ring ring-default">
                  <rb-form-field
                    row
                    :label="t('admin.pages.settings.enableMaintenanceMode')"
                    icon="material-symbols:construction-rounded"
                    :description="t('admin.pages.settings.maintenanceDescription')"
                    :dirty="draft.maintenance_enabled !== settings.maintenance_enabled"
                    :reset="() => (draft.maintenance_enabled = settings!.maintenance_enabled)"
                  >
                    <u-switch v-model="draft.maintenance_enabled" :disabled="saving" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field row :label="t('admin.common.maintenanceMessage')" icon="material-symbols:notes-rounded" :dirty="draft.maintenance_message !== settings.maintenance_message" :reset="() => (draft.maintenance_message = settings!.maintenance_message)">
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
