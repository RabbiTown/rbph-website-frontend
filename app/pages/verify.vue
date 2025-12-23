<script setup lang="ts">
useHead({
  titleTemplate: '验证账号 - RBPH',
});

const api = useApi();
const route = useRoute();
const toast = useToast();

const success = ref('load');

const token = typeof route.query.token === 'string' ? route.query.token : undefined;

if (!token) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Justice is dead.',
  });
}

onMounted(async () => {
  try {
    const { code } = await api.get('/auth/verify', { query: { token } });
    if (code == 0) {
      toast.add({
        title: '邮箱验证成功！',
        description: '即将跳转到登录页面…',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      success.value = 'ok';

      setTimeout(() => {
        navigateTo('/login');
      }, 3000);
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
        <icon v-else name="material-symbols:progress-activity" class="animate-spin" size="60px" />
      </div>
    </u-main>
  </div>
</template>
