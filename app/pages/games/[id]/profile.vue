<script setup lang="ts">
import * as v from 'valibot';
import type { FormSubmitEvent } from '@nuxt/ui';

definePageMeta({
  layout: 'game',
});

const { t } = useI18n();
const userStore = useUser();
userStore.required();

const api = useApi();
const toast = useToast();

const user = userStore.ref;
const game = useGame().ref;
const team = useTeam();
const teamData = team.ref;
const releaseSync = useGameReleaseSync();
const teamOpen = computed(() => releaseSync.features.value.team_formation === 'open');

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: t('pages.profile.title') }, { text: game.value?.title, sep: ' - ' }])),
});

const member = computed(() => teamData.value?.members.find(it => it.id === user.value?.id));
const isCaptain = computed(() => member.value?.is_captain);
const teamLocked = computed(() => Boolean(teamData.value?.is_locked));
const disabledTeamFeatures = computed(() => {
  const labels: Record<RbTeamFeature, string> = {
    direct_message: t('pages.profile.disableDirectMessage'),
    puzzle_ticket: t('pages.profile.disablePuzzleTicket'),
    leaderboard: t('pages.profile.disableLeaderboard'),
  };
  return (teamData.value?.features ?? []).filter(feature => !feature.enabled).map(feature => labels[feature.feature]);
});
const teamRestrictionDescription = computed(() => {
  const banned = Boolean(teamData.value?.is_banned);
  const penalties = disabledTeamFeatures.value;
  if (!banned && penalties.length === 0) return '';

  if (banned && penalties.length > 0) return t('pages.profile.teamBannedWithPenalties', { items: penalties });
  if (banned) return t('pages.profile.teamBanned');
  return t('pages.profile.teamPenalties', { items: penalties });
});

async function reloadTeamInfo() {
  team.updateData().catch(error => handleError(error, t('pages.profile.teamInfoFailed')));
}

const submitLoading = ref(false);
const userSubmitLoading = ref(false);
const teamProfileMode = ref<'join' | 'create'>('join');
const teamProfileGridMode = ref<'join' | 'create'>('join');
let teamProfileSwitchTimer: ReturnType<typeof setTimeout> | null = null;

function setTeamProfileMode(mode: 'join' | 'create') {
  if (teamProfileSwitchTimer) {
    clearTimeout(teamProfileSwitchTimer);
    teamProfileSwitchTimer = null;
  }
  teamProfileGridMode.value = mode;
  teamProfileMode.value = mode;
}

function morphTeamProfileMode(mode: 'join' | 'create') {
  if (teamProfileGridMode.value === mode && teamProfileMode.value === mode) return;
  if (teamProfileSwitchTimer) clearTimeout(teamProfileSwitchTimer);

  teamProfileGridMode.value = mode;
  teamProfileSwitchTimer = setTimeout(() => {
    teamProfileMode.value = mode;
    teamProfileSwitchTimer = null;
  }, 140);
}

onBeforeUnmount(() => {
  if (teamProfileSwitchTimer) clearTimeout(teamProfileSwitchTimer);
});

const userProfileSchema = v.object({
  nickname: v.pipe(v.string(), v.minLength(1, t('common.required')), v.maxLength(60, t('common.maxLength', { max: 60 }))),
  bio: v.pipe(v.string(), v.maxLength(200, t('common.maxLength', { max: 200 }))),
});
type UserProfileSchema = v.InferOutput<typeof userProfileSchema>;

const userState = reactive({
  id: 0,
  email: '',
  nickname: '',
  bio: '',
  avatar_provider: AvatarProvider.Cravatar,
});

const userDirty = computed(() => Boolean(user.value && (userState.nickname !== user.value.nickname || userState.bio !== (user.value.bio ?? '') || userState.avatar_provider !== user.value.avatar_provider)));
const avatarPreview = computed(() => buildAvatarUrl(userState.email, userState.avatar_provider));
const avatarProviderItems = [
    { label: 'Cravatar', value: AvatarProvider.Cravatar, icon: 'material-symbols:account-circle-outline' },
    { label: 'Catavatar', value: AvatarProvider.Catavatar, icon: 'material-symbols:pets' },
];

function syncUserState() {
  userState.id = user.value?.id ?? 0;
  userState.email = user.value?.email ?? '';
  userState.nickname = user.value?.nickname ?? '';
  userState.bio = user.value?.bio ?? '';
  userState.avatar_provider = user.value?.avatar_provider ?? AvatarProvider.Cravatar;
}

async function userSubmit(event: FormSubmitEvent<UserProfileSchema>) {
  if (!userDirty.value || userSubmitLoading.value) return;

  userSubmitLoading.value = true;
  try {
    const { data } = await api.patch<RbUser>(
      '/user/info',
      {
        nickname: event.data.nickname.trim(),
        bio: event.data.bio.trim() || null,
        avatar_provider: userState.avatar_provider,
      },
      {
        errorHints: {
          [-2]: t('pages.profile.invalidUserInfo'),
        },
      },
    );

    user.value = data;
    syncUserState();
    toast.add({
      title: t('pages.profile.userSaved'),
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, t('pages.profile.saveUserFailed'), true);
  } finally {
    userSubmitLoading.value = false;
  }
}

const passwordSchema = v.object({
  current_password: v.pipe(v.string(), v.minLength(8, t('common.minLength', { min: 8 })), v.maxLength(64, t('common.maxLength', { max: 64 })), v.regex(/^[!-~]{8,64}$/, t('common.invalidChars'))),
  new_password: v.pipe(v.string(), v.minLength(8, t('common.minLength', { min: 8 })), v.maxLength(64, t('common.maxLength', { max: 64 })), v.regex(/^[!-~]{8,64}$/, t('common.invalidChars'))),
  confirm_password: v.pipe(v.string(), v.minLength(8, t('common.minLength', { min: 8 })), v.maxLength(64, t('common.maxLength', { max: 64 })), v.regex(/^[!-~]{8,64}$/, t('common.invalidChars'))),
});
type PasswordSchema = v.InferOutput<typeof passwordSchema>;

const passwordState = reactive({
  current_password: '',
  new_password: '',
  confirm_password: '',
});
const passwordLoading = ref(false);
const passwordOpen = ref(false);
const showPasswords = ref(false);
const passwordReady = computed(() => passwordState.current_password.length >= 8 && passwordState.new_password.length >= 8 && passwordState.new_password === passwordState.confirm_password);

async function passwordSubmit(event: FormSubmitEvent<PasswordSchema>) {
  if (event.data.new_password !== event.data.confirm_password) {
    toast.add({ title: t('pages.profile.passwordMismatch'), icon: 'material-symbols:error-outline-rounded', color: 'error' });
    return;
  }

  passwordLoading.value = true;
  try {
    await api.patch(
      '/user/password',
      {
        current_password: event.data.current_password,
        new_password: event.data.new_password,
      },
      {
        errorHints: {
          [-3]: t('pages.profile.passwordInvalid'),
          [-2]: t('pages.profile.passwordSame'),
          [-1]: t('pages.profile.currentPasswordWrong'),
        },
      },
    );
    passwordState.current_password = '';
    passwordState.new_password = '';
    passwordState.confirm_password = '';
    showPasswords.value = false;
    passwordOpen.value = false;
    toast.add({ title: t('pages.profile.passwordSaved'), icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    handleError(error, t('pages.profile.passwordSaveFailed'), true);
  } finally {
    passwordLoading.value = false;
  }
}

const editSchema = v.object({
  id: v.pipe(v.number()),
  name: v.pipe(v.string(), v.minLength(1, t('common.required')), v.maxLength(40, t('common.maxLength', { max: 40 }))),
  pass: v.pipe(v.string(), v.minLength(8, t('common.minLength', { min: 8 })), v.maxLength(32, t('common.maxLength', { max: 32 })), v.regex(/^[!-~]{8,32}$/, t('common.invalidChars'))),
  bio: v.pipe(v.string(), v.maxLength(200, t('common.maxLength', { max: 200 }))),
});
type EditSchema = v.InferOutput<typeof editSchema>;

const editState = reactive({
  id: 0,
  name: '',
  pass: '',
  bio: '',
});

async function editSubmit(event: FormSubmitEvent<EditSchema>) {
  submitLoading.value = true;

  try {
    const { code } = await api.patch(
      `/games/${game.value?.id}/teams/self`,
      {
        name: event.data.name,
        pass: event.data.pass,
        bio: event.data.bio,
      },
      {
        errorHints: {
          [-1]: t('pages.profile.noTeamEditPermission'),
          [RbErrorCode.Forbidden]: t('pages.profile.noTeamEditPermission'),
        },
      },
    );

    if (code == 0) {
      toast.add({
        title: t('pages.profile.teamSaved'),
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, t('pages.profile.saveTeamFailed'), true);
  } finally {
    submitLoading.value = false;
  }
}

function editRandomPass() {
  editState.pass = Array.from({ length: 16 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }).join('');
}

async function leaveTeamSubmit() {
  submitLoading.value = true;

  if (member.value?.is_captain) {
    try {
      const { code } = await api.post(
        `/games/${game.value?.id}/teams/self/disband`,
        {},
        {
          errorHints: {
            [-1]: t('pages.profile.disbandUnavailable'),
            [RbErrorCode.Forbidden]: t('pages.profile.noDisbandPermission'),
          },
        },
      );

      if (code == 0) {
        toast.add({
          title: t('pages.profile.disbandedTeam'),
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        reloadTeamInfo();
      }
    } catch (error) {
      handleError(error, t('pages.profile.disbandFailed'), true);
    } finally {
      submitLoading.value = false;
    }
  } else {
    try {
      const { code } = await api.post(
        `/games/${game.value?.id}/teams/self/leave`,
        {},
        {
          errorHints: {
            [-1]: t('pages.profile.leaveNotMember'),
          },
        },
      );

      if (code == 0) {
        toast.add({
          title: t('pages.profile.leftTeam'),
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        reloadTeamInfo();
      }
    } catch (error) {
      handleError(error, t('pages.profile.leaveFailed'), true);
    } finally {
      submitLoading.value = false;
    }
  }
}

async function promoteSubmit(target: number) {
  submitLoading.value = true;

  try {
    const { code } = await api.post(
      `/games/${game.value?.id}/teams/self/promote`,
      { target },
      {
        errorHints: {
          [-2]: t('pages.profile.alreadyCaptain'),
          [-1]: t('pages.profile.memberLeft'),
          [RbErrorCode.Forbidden]: t('pages.profile.noPromotePermission'),
        },
      },
    );

    if (code == 0) {
      const memberName = teamData.value?.members.find(x => x.id === target)?.nickname;
      toast.add({
        title: memberName ? t('pages.profile.promotedMember', { name: memberName }) : t('pages.profile.promotedMemberFallback'),
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, t('pages.profile.promoteMemberFailed'), true);
  } finally {
    submitLoading.value = false;
  }
}

async function kickSubmit(target: number) {
  submitLoading.value = true;

  try {
    const { code } = await api.post(
      `/games/${game.value?.id}/teams/self/kick`,
      { target },
      {
        errorHints: {
          [-2]: t('pages.profile.cannotKickSelf'),
          [-1]: t('pages.profile.memberLeft'),
          [RbErrorCode.Forbidden]: t('pages.profile.noKickPermission'),
        },
      },
    );

    if (code == 0) {
      const memberName = teamData.value?.members.find(x => x.id === target)?.nickname;
      toast.add({
        title: memberName ? t('pages.profile.kickedMember', { name: memberName }) : t('pages.profile.kickedMemberFallback'),
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, t('pages.profile.kickMemberFailed'), true);
  } finally {
    submitLoading.value = false;
  }
}

/* no team - join */
const joinSchema = v.object({
  id: v.pipe(v.number()),
  pass: v.pipe(v.string(), v.minLength(8, t('common.minLength', { min: 8 })), v.maxLength(32, t('common.maxLength', { max: 32 })), v.regex(/^[!-~]{8,32}$/, t('common.invalidChars'))),
});
type JoinSchema = v.InferOutput<typeof joinSchema>;

const joinState = reactive({
  id: 0,
  pass: '',
});

async function joinSubmit(event: FormSubmitEvent<JoinSchema>) {
  submitLoading.value = true;

  try {
    const { code } = await api.post(
      `/teams/${event.data.id}/join`,
      { password: event.data.pass },
      {
        errorHints: {
          [RbErrorCode.NotFound]: t('pages.profile.invalidTeamId'),
          [-4]: t('pages.profile.wrongTeamPassword'),
          [-5]: t('pages.profile.teamFormationUnavailable'),
          [-3]: t('pages.profile.teamFull'),
          [-2]: t('pages.profile.teamLockedContact'),
          [-1]: t('pages.profile.alreadyInTeam'),
        },
      },
    );

    if (code === 0) {
      toast.add({
        title: t('pages.profile.joinedTeam'),
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, t('pages.profile.joinFailed'), true);
  } finally {
    submitLoading.value = false;
  }
}

/* no team - create */
const createSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, t('common.required')), v.maxLength(40, t('common.maxLength', { max: 40 }))),
  pass: v.pipe(v.string(), v.minLength(8, t('common.minLength', { min: 8 })), v.maxLength(32, t('common.maxLength', { max: 32 })), v.regex(/^[!-~]{8,32}$/, t('common.invalidChars'))),
  bio: v.pipe(v.string(), v.maxLength(200, t('common.maxLength', { max: 200 }))),
});
type CreateSchema = v.InferOutput<typeof createSchema>;

const createState = reactive({
  name: '',
  pass: '',
  bio: '',
});
createRandomPass();

async function createSubmit(event: FormSubmitEvent<CreateSchema>) {
  submitLoading.value = true;

  try {
    const { code } = await api.post(
      `/games/${game.value?.id}/teams/self`,
      { name: event.data.name, pass: event.data.pass, bio: event.data.bio },
      {
        errorHints: {
          [-3]: t('pages.profile.teamFormationUnavailable'),
          [-2]: t('pages.profile.invalidCredentials'),
          [-1]: t('pages.profile.alreadyInTeam'),
        },
      },
    );

    if (code == 0) {
      toast.add({
        title: t('pages.profile.createdTeam'),
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, t('pages.profile.createFailed'), true);
  } finally {
    submitLoading.value = false;
  }
}

function createRandomPass() {
  createState.pass = Array.from({ length: 16 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }).join('');
}

function updateAllState() {
  const data = teamData.value;
  if (data) {
    editState.id = data.id || 0;
    editState.name = data.name || '';
    editState.pass = data.pass || '';
    editState.bio = data.bio || '';
  }
  joinState.pass = '';
  createState.name = '';
  createState.bio = '';
  createRandomPass();
}

watch(teamData, () => updateAllState(), { immediate: true });
watch(user, () => syncUserState(), { immediate: true });
</script>

<template>
  <u-main class="py-8">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <div class="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,24rem)_auto_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-8">
          <section class="space-y-4">
            <div>
              <h2 class="text-xl font-semibold text-highlighted">{{ t('pages.profile.userInfo') }}</h2>
            </div>

            <u-form :schema="userProfileSchema" :state="userState" class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default" @submit="userSubmit">
              <rb-form-field
                row
                narrow-label
                :label="t('pages.profile.avatar')"
                icon="material-symbols:account-circle-outline"
                :dirty="userState.avatar_provider !== user?.avatar_provider"
                :reset="() => (userState.avatar_provider = user?.avatar_provider ?? AvatarProvider.Cravatar)"
              >
                <div class="flex flex-wrap items-center gap-3">
                  <u-avatar :src="avatarPreview" :text="userState.nickname" icon="material-symbols:person-2-rounded" size="xl" />
                  <u-select v-model="userState.avatar_provider" :items="avatarProviderItems" class="w-44" :disabled="userSubmitLoading" />
                </div>
              </rb-form-field>
              <u-separator />
              <rb-form-field row narrow-label :label="t('pages.profile.uid')" icon="material-symbols:tag-rounded">
                <u-input v-model="userState.id" class="w-full" disabled type="number" />
              </rb-form-field>
              <u-separator />
              <rb-form-field row narrow-label :label="t('pages.profile.email')" icon="material-symbols:alternate-email-rounded">
                <u-input v-model="userState.email" class="w-full" disabled />
              </rb-form-field>
              <u-separator />
              <rb-form-field name="nickname" row narrow-label :label="t('pages.profile.username')" icon="material-symbols:badge-outline-rounded" :dirty="userState.nickname !== user?.nickname" :reset="() => (userState.nickname = user?.nickname ?? '')">
                <u-input v-model="userState.nickname" class="w-full" :maxlength="60" :disabled="userSubmitLoading">
                  <template #trailing>
                    <div class="text-xs text-muted tabular-nums" role="status">{{ userState.nickname.length }}/60</div>
                  </template>
                </u-input>
              </rb-form-field>
              <u-separator />
              <rb-form-field name="bio" row narrow-label :label="t('pages.profile.bio')" icon="material-symbols:notes-rounded" :dirty="userState.bio !== (user?.bio ?? '')" :reset="() => (userState.bio = user?.bio ?? '')">
                <u-textarea v-model="userState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="4" :maxrows="4" :maxlength="200" :disabled="userSubmitLoading" />
              </rb-form-field>
              <div class="flex justify-end">
                <u-button type="submit" :loading="userSubmitLoading" class="min-w-36 justify-center cursor-pointer" :disabled="!userDirty">{{ t('pages.profile.updateUserInfo') }}</u-button>
              </div>
            </u-form>
          </section>

          <section>
            <u-collapsible v-model:open="passwordOpen" :unmount-on-hide="false">
              <button type="button" class="group flex w-full cursor-pointer items-center justify-between gap-3 text-start">
                <h2 class="text-xl font-semibold text-highlighted">{{ t('pages.profile.changePassword') }}</h2>
                <u-icon name="material-symbols:expand-more-rounded" class="size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>

              <template #content>
                <u-form :schema="passwordSchema" :state="passwordState" class="mt-4 space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default" @submit="passwordSubmit">
                  <rb-form-field name="current_password" row narrow-label :label="t('pages.profile.currentPassword')" icon="material-symbols:password-rounded">
                    <u-input v-model="passwordState.current_password" class="w-full" :type="showPasswords ? 'text' : 'password'" :disabled="passwordLoading" autocomplete="current-password" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field name="new_password" row narrow-label :label="t('pages.profile.newPassword')" icon="material-symbols:password-rounded">
                    <u-input v-model="passwordState.new_password" class="w-full" :type="showPasswords ? 'text' : 'password'" :disabled="passwordLoading" autocomplete="new-password" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field name="confirm_password" row narrow-label :label="t('pages.profile.confirmPassword')" icon="material-symbols:password-rounded">
                    <u-input v-model="passwordState.confirm_password" class="w-full" :type="showPasswords ? 'text' : 'password'" :disabled="passwordLoading" autocomplete="new-password" />
                  </rb-form-field>
                  <div class="flex items-center justify-between gap-3">
                    <u-button
                      type="button"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :icon="showPasswords ? 'material-symbols:visibility-off-outline-rounded' : 'material-symbols:visibility-outline-rounded'"
                      :label="showPasswords ? t('auth.hidePassword') : t('auth.showPassword')"
                      @click="showPasswords = !showPasswords"
                    />
                    <u-button type="submit" :loading="passwordLoading" class="min-w-28 justify-center" :disabled="!passwordReady">{{ t('pages.profile.changePassword') }}</u-button>
                  </div>
                </u-form>
              </template>
            </u-collapsible>
          </section>
        </div>

        <u-separator class="xl:hidden" />
        <u-separator orientation="vertical" class="hidden h-full xl:block" />

        <div class="flex min-w-0 flex-col gap-8">
          <template v-if="teamData">
            <section class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 class="text-xl font-semibold text-highlighted">{{ t('pages.profile.teamInfo') }}</h2>
                  <u-badge v-if="teamData.is_locked" class="mt-0.5" color="warning" variant="soft" icon="material-symbols:lock-outline">{{ t('pages.profile.teamLocked') }}</u-badge>
                </div>
              </div>

              <u-alert v-if="teamRestrictionDescription" color="error" variant="subtle" icon="material-symbols:gpp-bad-outline-rounded" :title="t('pages.profile.teamRestriction')">
                <template #description>
                  {{ teamRestrictionDescription }}
                  <i18n-t keypath="pages.profile.restrictionDetails" tag="span" class="whitespace-nowrap">
                    <template #activity><u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" :label="t('nav.teamActivity')" class="p-0 align-middle mb-0.5" /></template>
                  </i18n-t>
                </template>
              </u-alert>

              <u-form :schema="editSchema" :state="editState" class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default" @submit="editSubmit">
                <rb-form-field row narrow-label :label="t('pages.profile.teamId')" icon="material-symbols:cards-stack-rounded">
                  <u-input v-model="editState.id" class="w-full sm:w-96" disabled type="number" />
                </rb-form-field>
                <u-separator />
                <rb-form-field name="name" row narrow-label :label="t('pages.profile.teamName')" icon="material-symbols:group-outline-rounded" :dirty="editState.name !== team?.ref.value?.name" :reset="() => (editState.name = team?.ref.value?.name ?? '')">
                  <u-input v-model="editState.name" class="w-full sm:w-96" :maxlength="40" :disabled="!isCaptain">
                    <template #trailing>
                      <div class="text-xs text-muted tabular-nums" role="status">{{ editState.name.length }}/40</div>
                    </template>
                  </u-input>
                </rb-form-field>
                <u-separator />
                <rb-form-field name="pass" row narrow-label :label="t('pages.profile.teamPass')" icon="material-symbols:password-rounded" :dirty="editState.pass !== team?.ref.value?.pass" :reset="() => (editState.pass = team?.ref.value?.pass ?? '')">
                  <u-input v-model="editState.pass" class="w-full sm:w-96" :disabled="!isCaptain">
                    <template v-if="isCaptain" #trailing>
                      <u-button class="-me-2 cursor-pointer" color="neutral" variant="link" icon="material-symbols:casino-outline" @click="editRandomPass" />
                    </template>
                  </u-input>
                </rb-form-field>
                <u-separator />
                <rb-form-field name="bio" row narrow-label :label="t('pages.profile.teamBio')" icon="material-symbols:notes-rounded" :dirty="editState.bio !== team?.ref.value?.bio" :reset="() => (editState.bio = team?.ref.value?.bio ?? '')">
                  <u-textarea v-model="editState.bio" class="w-full sm:w-96" :ui="{ base: 'resize-none' }" :rows="4" :maxrows="4" :disabled="!isCaptain" />
                </rb-form-field>
                <div class="flex flex-wrap justify-end gap-3">
                  <u-button type="submit" :loading="submitLoading" class="min-w-36 justify-center cursor-pointer" :disabled="!isCaptain">
                    {{ isCaptain ? t('pages.profile.saveTeamInfo') : t('pages.profile.saveTeamInfoBlocked') }}
                  </u-button>
                  <u-tooltip v-if="teamData.is_locked" :text="member?.is_captain ? t('pages.profile.teamLockedHintDisband') : t('pages.profile.teamLockedHintLeave')">
                    <span class="inline-flex">
                      <u-button disabled class="min-w-32 justify-center" variant="outline" color="error">
                        {{ member?.is_captain ? t('pages.profile.disbandTeam') : t('pages.profile.leaveTeam') }}
                      </u-button>
                    </span>
                  </u-tooltip>
                  <u-popover v-else arrow>
                    <u-button :loading="submitLoading" class="min-w-32 justify-center cursor-pointer" variant="outline" color="error">
                      {{ member?.is_captain ? t('pages.profile.disbandTeam') : t('pages.profile.leaveTeam') }}
                    </u-button>
                    <template #content>
                      <div class="flex items-center gap-2 px-4 py-2 text-xs">
                        <u-icon name="material-symbols:warning-outline-rounded" class="align-middle" />
                        <span>{{ t('pages.profile.leaveDanger') }}</span>
                        <u-button :loading="submitLoading" class="cursor-pointer" color="error" variant="soft" size="xs" @click="leaveTeamSubmit">{{ t('common.confirm') }}</u-button>
                      </div>
                    </template>
                  </u-popover>
                </div>
              </u-form>
            </section>

            <section class="space-y-4">
              <div>
                <h2 class="text-xl font-semibold text-highlighted">{{ t('pages.profile.teamMembers') }}</h2>
              </div>
              <rbph-team-member-list :members="teamData.members" :current-user-id="user?.id" :can-manage="Boolean(isCaptain)" :locked="teamLocked" :busy="submitLoading" @promote="promoteSubmit($event.id)" @remove="kickSubmit($event.id)" />
            </section>
          </template>

          <template v-else>
            <div class="flex flex-col gap-6">
              <u-alert variant="subtle" color="info" icon="material-symbols:info-outline-rounded" :title="t('pages.profile.noTeamNotice')" />
              <u-alert v-if="!teamOpen" variant="subtle" color="warning" icon="material-symbols:schedule-outline-rounded" :title="t('pages.profile.teamFormationClosed')" :description="t('pages.profile.teamFormationClosedDesc')" />

              <div v-if="teamOpen" class="hidden team-profile-desktop-grid gap-6 lg:flex" :class="teamProfileGridMode === 'join' ? 'team-profile-desktop-grid-join' : 'team-profile-desktop-grid-create'">
                <div class="team-profile-slot team-profile-slot-left">
                  <transition name="team-profile-morph">
                    <u-card v-if="teamProfileMode === 'join'" key="join-form" variant="subtle" class="team-profile-morph-panel h-full w-full lg:min-h-108">
                      <div class="mb-6 flex items-center gap-3">
                        <u-icon name="material-symbols:login-rounded" class="size-6 text-primary" />
                        <div>
                          <h2 class="text-lg font-semibold text-highlighted">{{ t('pages.profile.joinTeam') }}</h2>
                        </div>
                      </div>
                      <u-form :schema="joinSchema" :state="joinState" class="space-y-4" @submit="joinSubmit">
                        <u-form-field :label="t('pages.profile.teamId')" name="id">
                          <u-input v-model="joinState.id" class="w-full" icon="material-symbols:group-outline-rounded" type="number" />
                        </u-form-field>
                        <u-form-field :label="t('pages.profile.teamPass')" name="pass">
                          <u-input v-model="joinState.pass" class="w-full" icon="material-symbols:password-rounded" />
                        </u-form-field>
                        <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">{{ t('pages.profile.joinTeam') }}</u-button>
                      </u-form>
                    </u-card>

                    <u-button v-else key="join-button" color="neutral" variant="soft" class="team-profile-morph-panel h-full min-h-36 w-full justify-center cursor-pointer" size="lg" @click="morphTeamProfileMode('join')">
                      <span class="flex flex-col items-center gap-2 text-center">
                        <u-icon name="material-symbols:login-rounded" class="size-8" />
                        <span>{{ t('pages.profile.joinTeam') }}</span>
                      </span>
                    </u-button>
                  </transition>
                </div>

                <div class="team-profile-slot team-profile-slot-right">
                  <transition name="team-profile-morph">
                    <u-button
                      v-if="teamProfileMode === 'join'"
                      key="create-button"
                      color="primary"
                      variant="soft"
                      class="team-profile-morph-panel h-full min-h-36 w-full justify-center cursor-pointer"
                      size="lg"
                      @click="morphTeamProfileMode('create')"
                    >
                      <span class="flex flex-col items-center gap-2 text-center">
                        <u-icon name="material-symbols:add-circle-outline-rounded" class="size-8" />
                        <span>{{ t('pages.profile.createTeam') }}</span>
                      </span>
                    </u-button>

                    <u-card v-else key="create-form" variant="subtle" class="team-profile-morph-panel h-full w-full lg:min-h-108">
                      <div class="mb-6 flex items-center gap-3">
                        <u-icon name="material-symbols:add-circle-outline-rounded" class="size-6 text-primary" />
                        <div>
                          <h2 class="text-lg font-semibold text-highlighted">{{ t('pages.profile.createTeam') }}</h2>
                        </div>
                      </div>
                      <u-form :schema="createSchema" :state="createState" class="space-y-4" @submit="createSubmit">
                        <u-form-field :label="t('pages.profile.teamName')" name="name">
                          <u-input v-model="createState.name" class="w-full" :maxlength="40" icon="material-symbols:group-outline-rounded">
                            <template #trailing>
                              <div class="text-xs text-muted tabular-nums" role="status">{{ createState.name.length }}/40</div>
                            </template>
                          </u-input>
                        </u-form-field>
                        <u-form-field :label="t('pages.profile.teamPass')" name="pass">
                          <u-input v-model="createState.pass" class="w-full" icon="material-symbols:password-rounded">
                            <template #trailing>
                              <u-button class="-me-2 cursor-pointer" color="neutral" variant="link" icon="material-symbols:casino-outline" @click="createRandomPass" />
                            </template>
                          </u-input>
                        </u-form-field>
                        <u-form-field :label="t('pages.profile.teamBio')" name="bio">
                          <u-textarea v-model="createState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="5" :maxrows="5" />
                        </u-form-field>
                        <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">{{ t('pages.profile.createTeam') }}</u-button>
                      </u-form>
                    </u-card>
                  </transition>
                </div>
              </div>

              <transition v-if="teamOpen" name="team-profile-switch" mode="out-in">
                <u-card v-if="teamProfileMode === 'join'" key="join-mobile" variant="subtle" class="w-full lg:hidden">
                  <div class="mb-6 flex items-center gap-3">
                    <u-icon name="material-symbols:login-rounded" class="size-6 text-primary" />
                    <div>
                      <h2 class="text-lg font-semibold text-highlighted">{{ t('pages.profile.joinTeam') }}</h2>
                    </div>
                  </div>
                  <u-form :schema="joinSchema" :state="joinState" class="space-y-4" @submit="joinSubmit">
                    <u-form-field :label="t('pages.profile.teamId')" name="id">
                      <u-input v-model="joinState.id" class="w-full" icon="material-symbols:group-outline-rounded" type="number" />
                    </u-form-field>
                    <u-form-field :label="t('pages.profile.teamPass')" name="pass">
                      <u-input v-model="joinState.pass" class="w-full" icon="material-symbols:password-rounded" />
                    </u-form-field>
                    <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">{{ t('pages.profile.joinTeam') }}</u-button>
                    <u-button type="button" color="primary" variant="soft" icon="material-symbols:add-circle-outline-rounded" class="w-full justify-center cursor-pointer" size="lg" @click="setTeamProfileMode('create')"> {{ t('pages.profile.createTeam') }} </u-button>
                  </u-form>
                </u-card>

                <u-card v-else key="create-mobile" variant="subtle" class="w-full lg:hidden">
                  <div class="mb-6 flex items-center gap-3">
                    <u-icon name="material-symbols:add-circle-outline-rounded" class="size-6 text-primary" />
                    <div>
                      <h2 class="text-lg font-semibold text-highlighted">{{ t('pages.profile.createTeam') }}</h2>
                    </div>
                  </div>
                  <u-form :schema="createSchema" :state="createState" class="space-y-4" @submit="createSubmit">
                    <u-form-field :label="t('pages.profile.teamName')" name="name">
                      <u-input v-model="createState.name" class="w-full" :maxlength="40" icon="material-symbols:group-outline-rounded">
                        <template #trailing>
                          <div class="text-xs text-muted tabular-nums" role="status">{{ createState.name.length }}/40</div>
                        </template>
                      </u-input>
                    </u-form-field>
                    <u-form-field :label="t('pages.profile.teamPass')" name="pass">
                      <u-input v-model="createState.pass" class="w-full" icon="material-symbols:password-rounded">
                        <template #trailing>
                          <u-button class="-me-2 cursor-pointer" color="neutral" variant="link" icon="material-symbols:casino-outline" @click="createRandomPass" />
                        </template>
                      </u-input>
                    </u-form-field>
                    <u-form-field :label="t('pages.profile.teamBio')" name="bio">
                      <u-textarea v-model="createState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="5" :maxrows="5" />
                    </u-form-field>
                    <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">{{ t('pages.profile.createTeam') }}</u-button>
                    <u-button type="button" color="neutral" variant="soft" icon="material-symbols:login-rounded" class="w-full justify-center cursor-pointer" size="lg" @click="setTeamProfileMode('join')"> {{ t('pages.profile.joinTeam') }} </u-button>
                  </u-form>
                </u-card>
              </transition>
            </div>
          </template>
        </div>
      </div>
    </div>
  </u-main>
</template>

<style scoped>
.team-profile-desktop-grid {
  align-items: stretch;
  --team-profile-side-width: 10rem;
  --team-profile-gap-width: 1.5rem;
  --team-profile-left-width: calc(100% - var(--team-profile-side-width) - var(--team-profile-gap-width));
  --team-profile-right-width: var(--team-profile-side-width);
}

.team-profile-desktop-grid-join {
  --team-profile-left-width: calc(100% - var(--team-profile-side-width) - var(--team-profile-gap-width));
  --team-profile-right-width: var(--team-profile-side-width);
}

.team-profile-desktop-grid-create {
  --team-profile-left-width: var(--team-profile-side-width);
  --team-profile-right-width: calc(100% - var(--team-profile-side-width) - var(--team-profile-gap-width));
}

.team-profile-slot {
  position: relative;
  min-width: 0;
  flex: none;
  transition: width 260ms ease;
}

.team-profile-slot-left {
  width: var(--team-profile-left-width);
}

.team-profile-slot-right {
  width: var(--team-profile-right-width);
}

.team-profile-morph-panel {
  min-width: 0;
}

.team-profile-morph-enter-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.team-profile-morph-leave-active {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.team-profile-morph-enter-from,
.team-profile-morph-leave-to {
  opacity: 0;
  transform: scale(0.985);
}

.team-profile-switch-enter-active,
.team-profile-switch-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.team-profile-switch-enter-from,
.team-profile-switch-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>
