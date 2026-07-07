<script setup lang="ts">
useHead({ titleTemplate: '系统维护 - RBPH' });

const status = useSystemStatus();
const user = useUser(false).ref;
const checking = ref(false);
const sync = useSync();

onMounted(() => {
  sync.disconnect();
});

async function check() {
  if (checking.value) return;
  checking.value = true;
  try {
    const current = await status.refresh(true);
    if (!current?.maintenance_enabled) await navigateTo('/transit');
  } catch (error) {
    handleError(error, '检查维护状态失败');
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-12">
    <div class="w-full text-center">
      <u-icon name="material-symbols:construction-rounded" class="size-12 text-warning" />
      <h1 class="mt-4 text-2xl font-semibold text-highlighted">系统维护中</h1>
      <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{{ status.ref.value?.maintenance_message }}</p>
      <div class="mt-8 flex flex-wrap justify-center gap-2">
        <u-button icon="material-symbols:refresh-rounded" color="neutral" variant="outline" :loading="checking" label="重新检查" @click="check" />
        <u-button v-if="user" to="/logout" icon="material-symbols:logout-rounded" color="neutral" variant="ghost" label="退出登录" />
        <u-button v-else to="/login" icon="material-symbols:login-rounded" label="登录" />
      </div>
    </div>
  </main>
</template>
