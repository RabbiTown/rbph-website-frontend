<script setup lang="ts">
import type { Schema } from 'inspector/promises';
import * as v from 'valibot';
import type { FormSubmitEvent } from '@nuxt/ui';

useHead({
  titleTemplate:  '注册 - RBPH',
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

async function submit(event: FormSubmitEvent<Schema>) {
  loginLoading.value = true;
  try {
    const { code } = await api.post('/auth/register', event.data, {
      errorHints: {
        [-3]: '请求错误。',
        [-2]: '请求错误。',
        [-1]: '邮箱已占用。',
      },
    });
    if (code == 0) {
      toast.add({
        title: '注册成功！',
        description: '即将跳转到登录页面…',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      setTimeout(() => {
        navigateTo('/login');
      }, 3000);
    } else if (code == 1) {
      toast.add({
        title: '验证码已发送！',
        description: `请检查收件箱和垃圾信箱。`,
        icon: 'material-symbols:check-rounded',
        color: 'success',
        duration: 10000,
      });
    }
  } catch (error) {
    handleError(error, '注册失败', true);
  } finally {
    loginLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen">
    <div class="flex items-center justify-center p-6">
      <div class="w-full max-w-xs">
        <div class="w-full flex justify-center my-4">
          <icon name="material-symbols:deployed-code" size="40px" />
        </div>
        <div class="text-2xl font-bold mb-8 text-center">注册</div>
        <u-form :schema="schema" :state="state" class="space-y-4" @submit="submit">
          <u-form-field label="邮箱" name="email">
            <u-input v-model="state.email" class="w-full" icon="material-symbols:alternate-email-rounded" />
          </u-form-field>
          <u-form-field label="密码" name="password">
            <u-input v-model="state.password" class="w-full" :type="showPwd ? 'text' : 'password'" icon="material-symbols:password-rounded">
              <template #trailing>
                <UButton
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
            <u-button type="submit" :loading="loginLoading" class="w-full justify-center cursor-pointer" size="lg">注册</u-button>
          </div>
          <div class="">
            <u-button class="w-full justify-center cursor-pointer" variant="outline" size="md" to="/login">前往登录页面</u-button>
          </div>
        </u-form>
      </div>
    </div>
  </div>
</template>
