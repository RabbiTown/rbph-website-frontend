<script setup lang="ts">
import type { Schema } from 'inspector/promises';
import * as v from 'valibot';
import type { FormSubmitEvent } from '@nuxt/ui';

useHead({
  titleTemplate: '注册 - RBPH',
});

const route = useRoute();

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
const systemStatus = useSystemStatus();
await systemStatus.refresh();
const authConfig = useAuthConfig();
await authConfig.refresh();
const captcha = useTemplateRef<{ reset: () => void }>('captcha');
const captchaToken = ref<string>();
const captchaConfig = computed(() => authConfig.ref.value?.captcha ?? undefined);
const captchaRequired = computed(() => Boolean(captchaConfig.value?.registration_required));
const submitLoading = computed(() => loginLoading.value || waitingCaptcha.value);
const submitLabel = computed(() => (waitingCaptcha.value ? '等待验证码' : '注册'));

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
    const { code } = await api.post('/auth/register', { ...event.data, captcha_token: captchaToken.value }, {
      errorHints: {
        [-3]: '系统已关闭注册。',
        [-2]: '请求无效。',
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

      const currentPath = route.fullPath;
      setTimeout(() => {
        if (route.fullPath === currentPath) {
          navigateTo('/login');
        }
      }, 3000);
    } else if (code == 1) {
      toast.add({
        title: '验证码已发送！',
        description: `请检查收件箱和垃圾信箱。`,
        icon: 'material-symbols:check-rounded',
        color: 'success',
        duration: 10000,
      });
    } else if (code == 2) {
      toast.add({
        title: '已发送过验证码',
        description: `请检查收件箱和垃圾信箱，或寻求站方帮助。`,
        icon: 'material-symbols:error-med-outline-rounded',
        color: 'error',
        duration: 10000,
      });
    }
  } catch (error) {
    pendingSubmit.value = undefined;
    waitingCaptcha.value = false;
    captchaInteractive.value = false;
    captcha.value?.reset();
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
        <u-empty v-if="!systemStatus.ref.value?.registration_open" icon="material-symbols:person-cancel-outline-rounded" title="注册已关闭" description="当前不接受新用户注册。">
          <template #actions><u-button to="/login" icon="material-symbols:login-rounded" label="前往登录" /></template>
        </u-empty>
        <template v-else>
          <div class="w-full flex justify-center my-4">
            <u-icon name="material-symbols:deployed-code" size="40px" />
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
            <rb-captcha v-if="captchaRequired && captchaConfig" ref="captcha" v-model="captchaToken" :config="captchaConfig" action="register" @interactive="onCaptchaInteractive" />
            <div class="mt-8">
              <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">{{ submitLabel }}</u-button>
            </div>
            <div>
              <u-button class="w-full justify-center cursor-pointer" variant="outline" size="md" to="/login">前往登录页面</u-button>
            </div>
          </u-form>
        </template>
      </div>
    </div>
  </div>
</template>
