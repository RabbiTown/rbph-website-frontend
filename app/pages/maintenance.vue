<script setup lang="ts">
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
    const current = await status.refresh(true);
    if (!current?.maintenance_enabled) await navigateTo('/transit');
  } catch (error) {
    handleError(error, t('maintenance.checkFailed'));
  } finally {
    checking.value = false;
  }
}

onMounted(() => {
  sync.disconnect();
  check();
  user.waitUpdate().finally(() => {
    userReady.value = true;
  });
});
</script>

<template>
  <main class="relative isolate flex min-h-screen w-full overflow-hidden bg-red-500 px-6 py-10 text-white sm:px-10">
    <div aria-hidden="true" class="absolute -left-16 top-[18%] h-px w-72 rotate-[-35deg] bg-white/35 sm:w-[28rem]" />
    <div aria-hidden="true" class="absolute -right-24 bottom-[22%] h-px w-80 rotate-[-35deg] bg-white/35 sm:w-[32rem]" />
    <div class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col items-center">
      <div class="flex flex-1 flex-col items-center justify-center text-center">
        <div class="mb-7 grid size-20 place-items-center border-2 border-white/90 [clip-path:polygon(18%_0,100%_0,100%_82%,82%_100%,0_100%,0_18%)] sm:size-24">
          <u-icon name="material-symbols:construction-rounded" class="size-11 text-white sm:size-14" />
        </div>
        <h1 class="max-w-full text-5xl font-black leading-none tracking-normal text-white sm:text-7xl">{{ t('maintenance.title') }}</h1>
        <div class="my-7 h-1 w-16 bg-white sm:mt-9 sm:mb-4" />
        <p v-if="status.ref.value?.maintenance_message" class="max-w-2xl whitespace-pre-wrap text-base font-medium leading-7 text-white/90 sm:text-lg sm:leading-8">
          {{ status.ref.value.maintenance_message }}
        </p>
      </div>

      <div class="flex flex-col items-center gap-2">
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
      </div>
    </div>
    <div class="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
      <rb-language-switcher inverted />
    </div>
  </main>
</template>
