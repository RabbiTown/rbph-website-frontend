<script setup lang="ts">
import type { Schema } from 'inspector/promises';
import * as v from 'valibot';
import type { FormSubmitEvent } from '@nuxt/ui';

useHead({
  titleTemplate: '登录 - RBPH',
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
const waitingCaptcha = ref(false);
const captchaInteractive = ref(false);
const pendingSubmit = ref<FormSubmitEvent<Schema>>();

const toast = useToast();
const api = useApi();
const route = useRoute();
const systemStatus = useSystemStatus();
await systemStatus.refresh();
const authConfig = useAuthConfig();
await authConfig.refresh();
const captcha = useTemplateRef<{ reset: () => void }>('captcha');
const captchaToken = ref<string>();
const captchaConfig = computed(() => authConfig.ref.value?.captcha ?? undefined);
const captchaRequired = computed(() => Boolean(captchaConfig.value?.login_required));
const submitLoading = computed(() => loginLoading.value || waitingCaptcha.value);
const submitLabel = computed(() => (waitingCaptcha.value ? '等待验证码' : '登录'));

watch(captchaToken, token => {
  if (!token || !pendingSubmit.value) return;
  const event = pendingSubmit.value;
  pendingSubmit.value = undefined;
  waitingCaptcha.value = false;
  void submit(event);
});

function onCaptchaInteractive() {
  captchaInteractive.value = true;
  if (!waitingCaptcha.value) return;
  pendingSubmit.value = undefined;
  waitingCaptcha.value = false;
}

async function submit(event: FormSubmitEvent<Schema>) {
  if (loginLoading.value) return;
  if (captchaRequired.value && !captchaToken.value) {
    if (captchaInteractive.value) return;
    pendingSubmit.value = event;
    waitingCaptcha.value = true;
    return;
  }

  loginLoading.value = true;
  try {
    const { code, data } = await api.post<{ uid: number; must_change_password: boolean }>(
      '/auth/login',
      { ...event.data, captcha_token: captchaToken.value },
      {
      errorHints: {
        [-1]: '用户名或密码错误。',
      },
      },
    );

    if (code == 0) {
      toast.add({
        title: '登录成功',
        description: '将在三秒内进行跳转…',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      if (data.must_change_password) {
        const target = typeof route.query.url === 'string' ? route.query.url : '/';
        await navigateTo(`/change-password?url=${encodeURIComponent(target)}`);
        return;
      }
      await useUser().updateData(true);
      const currentPath = route.fullPath;
      setTimeout(() => {
        if (route.fullPath === currentPath) {
          const target = typeof route.query.url === 'string' ? route.query.url : '/';
          navigateTo(target);
        }
      }, 1000);
    }
  } catch (error) {
    pendingSubmit.value = undefined;
    waitingCaptcha.value = false;
    captchaInteractive.value = false;
    captcha.value?.reset();
    handleError(error, '登录失败', true);
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
          <u-icon name="material-symbols:login-rounded" size="40px" />
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
          <rb-captcha v-if="captchaRequired && captchaConfig" ref="captcha" v-model="captchaToken" :config="captchaConfig" action="login" @interactive="onCaptchaInteractive" />
          <div class="mt-8">
            <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">{{ submitLabel }}</u-button>
          </div>
          <div class="">
            <u-button v-if="systemStatus.ref.value?.registration_open" class="w-full justify-center cursor-pointer" variant="outline" size="md" to="/register">注册</u-button>
          </div>
        </u-form>
      </div>
    </div>
  </div>
</template>
