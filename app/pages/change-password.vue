<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

const { t } = useI18n();
const userState = useUser();
await userState.updateData(true);
if (!userState.ref.value) await navigateToLogin();

useHead({ titleTemplate: computed(() => t('pages.changePassword.headTitle')) });

const schema = v.object({
  new_password: v.pipe(v.string(), v.minLength(8, t('auth.passwordMin')), v.maxLength(64, t('auth.passwordMax')), v.regex(/^[!-~]{8,64}$/, t('auth.passwordInvalid'))),
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
    await api.patch('/user/password', { new_password: event.data.new_password }, { errorHints: { [-3]: t('pages.changePassword.invalidFormat'), [-2]: t('pages.changePassword.sameAsTemp'), [-1]: t('pages.changePassword.notRequired') } });
    await userState.updateData(true);
    toast.add({ title: t('pages.changePassword.passwordSaved'), icon: 'material-symbols:check-circle-outline-rounded', color: 'success' });
    const target = typeof route.query.url === 'string' && route.query.url !== '/change-password' ? route.query.url : '/';
    await navigateTo(target);
  } catch (error) {
    handleError(error, t('pages.changePassword.passwordSaveFailed'), true);
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
        <h1 class="mt-3 text-2xl font-bold">{{ t('pages.changePassword.title') }}</h1>
        <p class="mt-2 text-sm text-muted">{{ t('pages.changePassword.description') }}</p>
      </div>
      <u-form :schema="schema" :state="state" class="space-y-4" @submit="submit">
        <u-form-field :label="t('pages.changePassword.newPassword')" name="new_password"><u-input v-model="state.new_password" class="w-full" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" /></u-form-field>
        <u-form-field :label="t('pages.changePassword.confirmPassword')" name="confirm_password"><u-input v-model="state.confirm_password" class="w-full" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" /></u-form-field>
        <div class="flex items-center justify-between gap-3">
          <u-button
            type="button"
            color="neutral"
            variant="ghost"
            :icon="showPasswords ? 'material-symbols:visibility-off-outline-rounded' : 'material-symbols:visibility-outline-rounded'"
            :label="showPasswords ? t('pages.changePassword.hidePassword') : t('pages.changePassword.showPassword')"
            @click="showPasswords = !showPasswords"
          /><u-button type="submit" :label="t('pages.changePassword.submit')" icon="material-symbols:check-rounded" :loading="loading" :disabled="!ready" />
        </div>
      </u-form>
      <div class="mt-4 flex justify-center"><u-button to="/logout" color="neutral" variant="link" icon="material-symbols:logout-rounded" :label="t('pages.changePassword.logout')" /></div>
    </div>
  </div>
</template>
