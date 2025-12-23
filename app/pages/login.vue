<script setup lang="ts">
import type { Schema } from 'inspector/promises';
import * as v from 'valibot';
import type { FormSubmitEvent } from '@nuxt/ui';

useHead({
  titleTemplate:  '登录 - RBPH',
});

const schema = v.object({
  email: v.pipe(v.string(), v.email('无效邮箱')),
  password: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(64, '最多可用 64 个字符'), v.regex(/^[!-~]{8,64}$/, '存在无效字符')),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  email: '',
  password: '',
});

const showPwd = ref(false);
const loginLoading = ref(false);

const toast = useToast();
const api = useApi();
const route = useRoute();

async function submit(event: FormSubmitEvent<Schema>) {
  loginLoading.value = true;
  try {
    const { code } = await api.post('/auth/login', event.data, {
      errorHints: {
        [-2]: '用户不存在。',
        [-1]: '用户名或密码错误。',
      },
    });

    useUser().updateData();

    if (code == 0) {
      toast.add({
        title: '登录成功',
        description: '将在三秒内进行跳转…',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      setTimeout(() => {
        const target = typeof route.query.url === 'string' ? route.query.url : '/';
        navigateTo(target);
      }, 1000);
    }
  } catch (error) {
    handleError(error, '登录失败', true);
    loginLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen">
    <div class="flex items-center justify-center p-6">
      <div class="w-full max-w-xs">
        <div class="w-full flex justify-center my-4">
          <icon name="material-symbols:login-rounded" size="40px" />
        </div>
        <div class="text-2xl font-bold mb-8 text-center">登录</div>
        <u-form :schema="schema" :state="state" class="space-y-4" @submit="submit">
          <u-form-field label="邮箱" name="email">
            <u-input v-model="state.email" class="w-full" icon="material-symbols:alternate-email-rounded" />
          </u-form-field>
          <u-form-field label="密码" name="password">
            <u-input v-model="state.password" class="w-full" :type="showPwd ? 'text' : 'password'" icon="material-symbols:password-rounded">
              <template #trailing>
                <u-button
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showPwd ? 'material-symbols:visibility-off-outline-rounded' : 'material-symbols:visibility-outline-rounded'"
                  :aria-label="showPwd ? '隐藏密码' : '显示密码'"
                  :aria-pressed="showPwd"
                  aria-controls="password"
                  @click="showPwd = !showPwd"
                />
              </template>
            </u-input>
          </u-form-field>
          <div class="mt-8">
            <u-button type="submit" :loading="loginLoading" class="w-full justify-center cursor-pointer" size="lg">登录</u-button>
          </div>
          <div class="">
            <u-button class="w-full justify-center cursor-pointer" variant="outline" size="md" to="/register">注册</u-button>
          </div>
        </u-form>
      </div>
    </div>
  </div>
</template>
