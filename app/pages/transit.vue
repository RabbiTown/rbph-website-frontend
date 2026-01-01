<script setup lang="ts">
useHead({
  titleTemplate: '请稍后…',
});

try {
  const { data } = await useApi().get<RbGame[]>('/games/online');
  if (data.length == 1) {
    useState('game').value = data[0];
    await navigateTo(`/games/${data[0]?.id}`);
  } else {
    useToast().add({
      title: '没有公开活动。',
      color: 'error',
      icon: 'material-symbols:error-med-outline-rounded',
      orientation: 'horizontal',
      actions: [
        {
          icon: 'material-symbols:login-rounded',
          label: '登录',
          color: 'neutral',
          variant: 'outline',
          to: '/login',
        },
      ],
    });
  }
} catch (error) {
  showError(error instanceof Error ? error : String(error));
}
</script>
