<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

const userState = useUser();
await userState.updateData(true);
if (!userState.ref.value) await navigateToLogin();

useHead({ titleTemplate: '修改临时密码 - RBPH' });

const schema = v.object({
  new_password: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(64, '最多可用 64 个字符'), v.regex(/^[!-~]{8,64}$/, '存在无效字符')),
  confirm_password: v.string(),
});
type Schema = v.InferOutput<typeof schema>;

const state = reactive({ new_password: '', confirm_password: '' });
const loading = ref(false);
const showPasswords = ref(false);
const api = useApi();
const toast = useToast();
const route = useRoute();
const ready = computed(() => state.new_password.length >= 8 && state.new_password === state.confirm_password);

async function submit(event: FormSubmitEvent<Schema>) {
  if (event.data.new_password !== event.data.confirm_password) return;
  loading.value = true;
  try {
    await api.patch('/user/password', { new_password: event.data.new_password }, { errorHints: { [-3]: '密码格式不合法', [-2]: '新密码不能与临时密码相同', [-1]: '当前账号不需要强制修改密码' } });
    await userState.updateData(true);
    toast.add({ title: '密码已修改', icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
    const target = typeof route.query.url === 'string' && route.query.url !== '/change-password' ? route.query.url : '/';
    await navigateTo(target);
  } catch (error) {
    handleError(error, '修改密码失败', true);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="mx-auto w-full max-w-xs py-12">
      <div class="mb-8 text-center">
        <u-icon name="material-symbols:password-rounded" class="size-10 text-warning" />
        <h1 class="mt-3 text-2xl font-bold">修改临时密码</h1>
        <p class="mt-2 text-sm text-muted">继续使用平台前，需要设置你自己的密码。</p>
      </div>
      <u-form :schema="schema" :state="state" class="space-y-4" @submit="submit">
        <u-form-field label="新密码" name="new_password"><u-input v-model="state.new_password" class="w-full" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" /></u-form-field>
        <u-form-field label="确认新密码" name="confirm_password"><u-input v-model="state.confirm_password" class="w-full" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" /></u-form-field>
        <div class="flex items-center justify-between gap-3">
          <u-button
            type="button"
            color="neutral"
            variant="ghost"
            :icon="showPasswords ? 'material-symbols:visibility-off-outline-rounded' : 'material-symbols:visibility-outline-rounded'"
            :label="showPasswords ? '隐藏密码' : '显示密码'"
            @click="showPasswords = !showPasswords"
          /><u-button type="submit" label="修改密码" icon="material-symbols:check-rounded" :loading="loading" :disabled="!ready" />
        </div>
      </u-form>
      <div class="mt-4 flex justify-center"><u-button to="/logout" color="neutral" variant="link" icon="material-symbols:logout-rounded" label="退出登录" /></div>
    </div>
  </div>
</template>
