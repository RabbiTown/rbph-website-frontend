<script setup lang="ts">
const api = useApi();
const route = useRoute();
const toast = useToast();

const success = ref('load');

useHead({
  titleTemplate: '退出登录 - RBPH',
});

onMounted(async () => {
  try {
    const { code } = await api.post('/auth/logout');
    if (code == 0) {
      toast.add({
        title: '已退出登录！',
        description: '将在三秒内进行跳转…',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      resetStates();

      success.value = 'ok';

      const currentPath = route.fullPath;
      setTimeout(() => {
        if (route.fullPath === currentPath) {
          const target = typeof route.query.url === 'string' ? route.query.url : '/';
          navigateTo(target);
        }
      }, 1000);
    }
  } catch {
    success.value = 'err';
  }
});
</script>

<template>
  <div>
    <u-main class="flex justify-center items-center">
      <div class="">
        <icon v-if="success == 'ok'" name="material-symbols:check-rounded" class="text-green-500" size="60px" />
        <icon v-else-if="success == 'err'" name="material-symbols:close-rounded" class="text-red-400" size="60px" />
        <icon v-else name="i-lucide:loader-circle" class="animate-spin" size="60px" />
      </div>
    </u-main>
  </div>
</template>
