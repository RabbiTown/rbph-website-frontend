<script setup lang="ts">
definePageMeta({ layout: 'maintenance' });

const { t } = useI18n();

useHead({ titleTemplate: computed(() => t('maintenance.headTitle')) });

const status = useSystemStatus();
const user = useUser();
const userReady = ref(false);
const checking = ref(false);
const sync = useSync();

async function check() {
  if (checking.value) return;
  checking.value = true;
  try {
    const [current] = await Promise.all([
      status.refresh(true),
      user.waitUpdate().finally(() => {
        userReady.value = true;
      }),
    ]);
    const isAdmin = (user.ref.value?.urole ?? RbUserRole.User) >= RbUserRole.Admin;
    if (!current?.maintenance_enabled || isAdmin) {
      await navigateTo('/');
    } else {
      sync.disconnect();
    }
  } catch (error) {
    handleError(error, t('maintenance.checkFailed'));
  } finally {
    checking.value = false;
  }
}

onMounted(() => {
  void check();
});
</script>

<template>
  <rbph-status-page icon="material-symbols:construction-rounded" :title="t('maintenance.title')" :message="status.ref.value?.maintenance_message">
    <template #actions>
      <u-button
        icon="material-symbols:refresh-rounded"
        color="neutral"
        variant="solid"
        size="xl"
        class="min-w-44 justify-center bg-white font-bold text-red-700 shadow-none hover:bg-white/90"
        :loading="checking"
        :label="t('maintenance.check')"
        @click="check"
      />
      <div v-if="userReady && user.ref.value" class="flex max-w-[calc(100vw-3rem)] items-center gap-2">
        <u-avatar :src="user.ref.value.avatar" :text="user.ref.value.nickname" size="sm" class="shrink-0" />
        <span class="min-w-0 max-w-52 truncate font-medium text-white">{{ user.ref.value.nickname }}</span>
        <u-button
          to="/logout"
          icon="material-symbols:logout-rounded"
          color="neutral"
          variant="ghost"
          class="shrink-0 justify-center text-white hover:bg-white/10"
          :label="t('nav.logout')"
        />
      </div>
      <u-button
        v-else-if="userReady"
        to="/login"
        icon="material-symbols:login-rounded"
        color="neutral"
        variant="ghost"
        class="min-w-44 justify-center text-white hover:bg-white/10"
        :label="t('nav.login')"
      />
    </template>
  </rbph-status-page>
</template>
