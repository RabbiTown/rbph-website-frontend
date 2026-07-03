<script setup lang="ts">
import * as v from 'valibot';
import type { FormSubmitEvent } from '@nuxt/ui';

definePageMeta({
  layout: 'game',
});

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
  titleTemplate: computed(() => buildTitleParts([{ text: '个人资料' }, { text: game.value?.title, sep: ' - ' }])),
});

const member = computed(() => teamData.value?.members.find(it => it.id === user.value?.id));
const isCaptain = computed(() => member.value?.is_captain);
const teamLocked = computed(() => Boolean(teamData.value?.is_locked));
const disabledTeamFeatures = computed(() => {
  const labels: Record<RbTeamFeature, string> = {
    direct_message: '封禁站内信',
    puzzle_ticket: '封禁人工提示',
    leaderboard: '封禁排行榜',
  };
  return (teamData.value?.features ?? []).filter(feature => !feature.enabled).map(feature => labels[feature.feature]);
});
const teamRestrictionDescription = computed(() => {
  const banned = Boolean(teamData.value?.is_banned);
  const penalties = disabledTeamFeatures.value;
  if (!banned && penalties.length === 0) return '';

  if (banned && penalties.length > 0) return `队伍已封禁，并受到以下处罚：${penalties.join('、')}。`;
  if (banned) return '队伍已封禁。';
  return `队伍受到以下处罚：${penalties.join('、')}。`;
});

async function reloadTeamInfo() {
  team.updateData().catch(error => handleError(error, '队伍信息获取失败'));
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
  nickname: v.pipe(v.string(), v.minLength(1, '不能为空'), v.maxLength(60, '最多可用 60 个字符')),
  bio: v.pipe(v.string(), v.maxLength(200, '最多可用 200 个字符')),
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
          [-2]: '用户信息不合法。',
        },
      },
    );

    user.value = data;
    syncUserState();
    toast.add({
      title: '成功修改用户信息',
      icon: 'material-symbols:check-rounded',
      color: 'success',
    });
  } catch (error) {
    handleError(error, '修改用户信息失败', true);
  } finally {
    userSubmitLoading.value = false;
  }
}

const passwordSchema = v.object({
  current_password: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(64, '最多可用 64 个字符'), v.regex(/^[!-~]{8,64}$/, '存在无效字符')),
  new_password: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(64, '最多可用 64 个字符'), v.regex(/^[!-~]{8,64}$/, '存在无效字符')),
  confirm_password: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(64, '最多可用 64 个字符'), v.regex(/^[!-~]{8,64}$/, '存在无效字符')),
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
    toast.add({ title: '两次输入的新密码不一致', icon: 'material-symbols:error-outline-rounded', color: 'error' });
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
          [-3]: '密码格式不合法。',
          [-2]: '新密码不能与当前密码相同。',
          [-1]: '当前密码错误。',
        },
      },
    );
    passwordState.current_password = '';
    passwordState.new_password = '';
    passwordState.confirm_password = '';
    showPasswords.value = false;
    passwordOpen.value = false;
    toast.add({ title: '密码已修改', icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    handleError(error, '修改密码失败', true);
  } finally {
    passwordLoading.value = false;
  }
}

const editSchema = v.object({
  id: v.pipe(v.number()),
  name: v.pipe(v.string(), v.minLength(1, '不能为空'), v.maxLength(40, '最多可用 40 个字符')),
  pass: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(32, '最多可用 32 个字符'), v.regex(/^[!-~]{8,32}$/, '存在无效字符')),
  bio: v.pipe(v.string(), v.maxLength(200, '最多可用 200 个字符')),
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
          [-1]: '没有权限修改队伍信息。',
          [RbErrorCode.Forbidden]: '没有权限修改队伍信息。',
        },
      },
    );

    if (code == 0) {
      toast.add({
        title: '成功修改队伍信息',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, '修改队伍信息失败', true);
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
            [-1]: '目前不能解散队伍。',
            [RbErrorCode.Forbidden]: '没有权限解散队伍。',
          },
        },
      );

      if (code == 0) {
        toast.add({
          title: '已解散队伍',
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        reloadTeamInfo();
      }
    } catch (error) {
      handleError(error, '解散队伍失败', true);
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
            [-1]: '只有队伍中的队员可以离开队伍。',
          },
        },
      );

      if (code == 0) {
        toast.add({
          title: '已离开队伍',
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        reloadTeamInfo();
      }
    } catch (error) {
      handleError(error, '离开队伍失败', true);
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
          [-2]: '你已经是队长了！',
          [-1]: '队员已离开队伍。',
          [RbErrorCode.Forbidden]: '没有权限设置队长。',
        },
      },
    );

    if (code == 0) {
      const memberName = teamData.value?.members.find(x => x.id === target)?.nickname;
      toast.add({
        title: memberName ? `已将 ${memberName} 设置为队长` : '已将该队员设置为队长',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, '设置队长失败', true);
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
          [-2]: '不能将自己移出队伍！',
          [-1]: '队员已离开队伍。',
          [RbErrorCode.Forbidden]: '没有权限移除队员。',
        },
      },
    );

    if (code == 0) {
      const memberName = teamData.value?.members.find(x => x.id === target)?.nickname;
      toast.add({
        title: memberName ? `已将 ${memberName} 移出队伍` : '已将该队员移出队伍',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, '移出队伍失败', true);
  } finally {
    submitLoading.value = false;
  }
}

/* no team - join */
const joinSchema = v.object({
  id: v.pipe(v.number()),
  pass: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(32, '最多可用 32 个字符'), v.regex(/^[!-~]{8,32}$/, '存在无效字符')),
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
          [RbErrorCode.NotFound]: '队伍 ID 无效。',
          [-4]: '输入密码错误。',
          [-5]: '当前尚未开放组队。',
          [-3]: '队伍已满。',
          [-2]: '队伍已锁定，请联系工作人员。',
          [-1]: '你已经有一个队伍了。',
        },
      },
    );

    if (code === 0) {
      toast.add({
        title: '成功加入队伍！',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });

      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, '加入队伍失败', true);
  } finally {
    submitLoading.value = false;
  }
}

/* no team - create */
const createSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, '不能为空'), v.maxLength(40, '最多可用 40 个字符')),
  pass: v.pipe(v.string(), v.minLength(8, '至少需要 8 个字符'), v.maxLength(32, '最多可用 32 个字符'), v.regex(/^[!-~]{8,32}$/, '存在无效字符')),
  bio: v.pipe(v.string(), v.maxLength(200, '最多可用 200 个字符')),
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
          [-3]: '当前尚未开放组队。',
          [-2]: '提交的凭据无效。',
          [-1]: '你已经有一个队伍了。',
        },
      },
    );

    if (code == 0) {
      toast.add({
        title: '成功创建队伍！',
        icon: 'material-symbols:check-rounded',
        color: 'success',
      });
      reloadTeamInfo();
    }
  } catch (error) {
    handleError(error, '创建队伍失败', true);
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
              <h2 class="text-xl font-semibold text-highlighted">用户信息</h2>
            </div>

            <u-form :schema="userProfileSchema" :state="userState" class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default" @submit="userSubmit">
              <rb-form-field
                row
                narrow-label
                label="头像"
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
              <rb-form-field row narrow-label label="UID" icon="material-symbols:tag-rounded">
                <u-input v-model="userState.id" class="w-full" disabled type="number" />
              </rb-form-field>
              <u-separator />
              <rb-form-field row narrow-label label="邮箱" icon="material-symbols:alternate-email-rounded">
                <u-input v-model="userState.email" class="w-full" disabled />
              </rb-form-field>
              <u-separator />
              <rb-form-field name="nickname" row narrow-label label="用户名" icon="material-symbols:badge-outline-rounded">
                <u-input v-model="userState.nickname" class="w-full" :maxlength="60" :disabled="userSubmitLoading">
                  <template #trailing>
                    <div class="text-xs text-muted tabular-nums" role="status">{{ userState.nickname.length }}/60</div>
                  </template>
                </u-input>
              </rb-form-field>
              <u-separator />
              <rb-form-field name="bio" row narrow-label label="个人简介" icon="material-symbols:notes-rounded">
                <u-textarea v-model="userState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="4" :maxrows="4" :maxlength="200" :disabled="userSubmitLoading" />
              </rb-form-field>
              <div class="flex justify-end">
                <u-button type="submit" :loading="userSubmitLoading" class="min-w-36 justify-center cursor-pointer" :disabled="!userDirty">更新用户信息</u-button>
              </div>
            </u-form>
          </section>

          <section>
            <u-collapsible v-model:open="passwordOpen" :unmount-on-hide="false">
              <button type="button" class="group flex w-full cursor-pointer items-center justify-between gap-3 text-start">
                <h2 class="text-xl font-semibold text-highlighted">修改密码</h2>
                <u-icon name="material-symbols:expand-more-rounded" class="size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>

              <template #content>
                <u-form :schema="passwordSchema" :state="passwordState" class="mt-4 space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default" @submit="passwordSubmit">
                  <rb-form-field name="current_password" row narrow-label label="当前密码" icon="material-symbols:password-rounded">
                    <u-input v-model="passwordState.current_password" class="w-full" :type="showPasswords ? 'text' : 'password'" :disabled="passwordLoading" autocomplete="current-password" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field name="new_password" row narrow-label label="新密码" icon="material-symbols:password-rounded">
                    <u-input v-model="passwordState.new_password" class="w-full" :type="showPasswords ? 'text' : 'password'" :disabled="passwordLoading" autocomplete="new-password" />
                  </rb-form-field>
                  <u-separator />
                  <rb-form-field name="confirm_password" row narrow-label label="确认密码" icon="material-symbols:password-rounded">
                    <u-input v-model="passwordState.confirm_password" class="w-full" :type="showPasswords ? 'text' : 'password'" :disabled="passwordLoading" autocomplete="new-password" />
                  </rb-form-field>
                  <div class="flex items-center justify-between gap-3">
                    <u-button
                      type="button"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :icon="showPasswords ? 'material-symbols:visibility-off-outline-rounded' : 'material-symbols:visibility-outline-rounded'"
                      :label="showPasswords ? '隐藏密码' : '显示密码'"
                      @click="showPasswords = !showPasswords"
                    />
                    <u-button type="submit" :loading="passwordLoading" class="min-w-28 justify-center" :disabled="!passwordReady">修改密码</u-button>
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
                  <h2 class="text-xl font-semibold text-highlighted">队伍信息</h2>
                  <u-badge v-if="teamData.is_locked" class="mt-0.5" color="warning" variant="soft" icon="material-symbols:lock-outline">已锁定</u-badge>
                </div>
              </div>

              <u-alert v-if="teamRestrictionDescription" color="error" variant="subtle" icon="material-symbols:gpp-bad-outline-rounded" title="队伍状态受限">
                <template #description>
                  {{ teamRestrictionDescription }}
                  <span class="whitespace-nowrap">
                    具体原因可在
                    <u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" label="队伍动态" class="p-0 align-middle mb-0.5" />
                    中查看。
                  </span>
                </template>
              </u-alert>

              <u-form :schema="editSchema" :state="editState" class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default" @submit="editSubmit">
                <rb-form-field row narrow-label label="队伍 ID" icon="material-symbols:cards-stack-rounded">
                  <u-input v-model="editState.id" class="w-full sm:w-96" disabled type="number" />
                </rb-form-field>
                <u-separator />
                <rb-form-field name="name" row narrow-label label="队伍名称" icon="material-symbols:group-outline-rounded">
                  <u-input v-model="editState.name" class="w-full sm:w-96" :maxlength="40" :disabled="!isCaptain">
                    <template #trailing>
                      <div class="text-xs text-muted tabular-nums" role="status">{{ editState.name.length }}/40</div>
                    </template>
                  </u-input>
                </rb-form-field>
                <u-separator />
                <rb-form-field name="pass" row narrow-label label="队伍密码" icon="material-symbols:password-rounded">
                  <u-input v-model="editState.pass" class="w-full sm:w-96" :disabled="!isCaptain">
                    <template v-if="isCaptain" #trailing>
                      <u-button class="-me-2 cursor-pointer" color="neutral" variant="link" icon="material-symbols:casino-outline" @click="editRandomPass" />
                    </template>
                  </u-input>
                </rb-form-field>
                <u-separator />
                <rb-form-field name="bio" row narrow-label label="队伍简介" icon="material-symbols:notes-rounded">
                  <u-textarea v-model="editState.bio" class="w-full sm:w-96" :ui="{ base: 'resize-none' }" :rows="4" :maxrows="4" :disabled="!isCaptain" />
                </rb-form-field>
                <div class="flex flex-wrap justify-end gap-3">
                  <u-button type="submit" :loading="submitLoading" class="min-w-36 justify-center cursor-pointer" :disabled="!isCaptain">
                    {{ isCaptain ? '更新队伍信息' : '只有队长才能更新信息' }}
                  </u-button>
                  <u-tooltip v-if="teamData.is_locked" :text="member?.is_captain ? '队伍已锁定，不能解散队伍' : '队伍已锁定，不能退出队伍'">
                    <span class="inline-flex">
                      <u-button disabled class="min-w-32 justify-center" variant="outline" color="error">
                        {{ member?.is_captain ? '解散队伍' : '退出队伍' }}
                      </u-button>
                    </span>
                  </u-tooltip>
                  <u-popover v-else arrow>
                    <u-button :loading="submitLoading" class="min-w-32 justify-center cursor-pointer" variant="outline" color="error">
                      {{ member?.is_captain ? '解散队伍' : '退出队伍' }}
                    </u-button>
                    <template #content>
                      <div class="flex items-center gap-2 px-4 py-2 text-xs">
                        <u-icon name="material-symbols:warning-outline-rounded" class="align-middle" />
                        <span>这个操作不可撤销。</span>
                        <u-button :loading="submitLoading" class="cursor-pointer" color="error" variant="soft" size="xs" @click="leaveTeamSubmit">确定</u-button>
                      </div>
                    </template>
                  </u-popover>
                </div>
              </u-form>
            </section>

            <section class="space-y-4">
              <div>
                <h2 class="text-xl font-semibold text-highlighted">队伍成员</h2>
              </div>
              <rbph-team-member-list :members="teamData.members" :current-user-id="user?.id" :can-manage="Boolean(isCaptain)" :locked="teamLocked" :busy="submitLoading" @promote="promoteSubmit($event.id)" @remove="kickSubmit($event.id)" />
            </section>
          </template>

          <template v-else>
            <div class="flex flex-col gap-6">
              <u-alert variant="subtle" color="info" icon="material-symbols:info-outline-rounded" title="参与比赛前需要加入或创建队伍，个人参赛也要创建队伍。" />
              <u-alert v-if="!teamOpen" variant="subtle" color="warning" icon="material-symbols:schedule-outline-rounded" title="组队尚未开放" description="请参考赛程安排确认开放时间。" />

              <div v-if="teamOpen" class="hidden team-profile-desktop-grid gap-6 lg:flex" :class="teamProfileGridMode === 'join' ? 'team-profile-desktop-grid-join' : 'team-profile-desktop-grid-create'">
                <div class="team-profile-slot team-profile-slot-left">
                  <transition name="team-profile-morph">
                    <u-card v-if="teamProfileMode === 'join'" key="join-form" variant="subtle" class="team-profile-morph-panel h-full w-full lg:min-h-108">
                      <div class="mb-6 flex items-center gap-3">
                        <u-icon name="material-symbols:login-rounded" class="size-6 text-primary" />
                        <div>
                          <h2 class="text-lg font-semibold text-highlighted">加入队伍</h2>
                        </div>
                      </div>
                      <u-form :schema="joinSchema" :state="joinState" class="space-y-4" @submit="joinSubmit">
                        <u-form-field label="队伍 ID" name="id">
                          <u-input v-model="joinState.id" class="w-full" icon="material-symbols:group-outline-rounded" type="number" />
                        </u-form-field>
                        <u-form-field label="队伍密码" name="pass">
                          <u-input v-model="joinState.pass" class="w-full" icon="material-symbols:password-rounded" />
                        </u-form-field>
                        <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">加入队伍</u-button>
                      </u-form>
                    </u-card>

                    <u-button v-else key="join-button" color="neutral" variant="soft" class="team-profile-morph-panel h-full min-h-36 w-full justify-center cursor-pointer" size="lg" @click="morphTeamProfileMode('join')">
                      <span class="flex flex-col items-center gap-2 text-center">
                        <u-icon name="material-symbols:login-rounded" class="size-8" />
                        <span>加入队伍</span>
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
                        <span>创建队伍</span>
                      </span>
                    </u-button>

                    <u-card v-else key="create-form" variant="subtle" class="team-profile-morph-panel h-full w-full lg:min-h-108">
                      <div class="mb-6 flex items-center gap-3">
                        <u-icon name="material-symbols:add-circle-outline-rounded" class="size-6 text-primary" />
                        <div>
                          <h2 class="text-lg font-semibold text-highlighted">创建队伍</h2>
                        </div>
                      </div>
                      <u-form :schema="createSchema" :state="createState" class="space-y-4" @submit="createSubmit">
                        <u-form-field label="队伍名称" name="name">
                          <u-input v-model="createState.name" class="w-full" :maxlength="40" icon="material-symbols:group-outline-rounded">
                            <template #trailing>
                              <div class="text-xs text-muted tabular-nums" role="status">{{ createState.name.length }}/40</div>
                            </template>
                          </u-input>
                        </u-form-field>
                        <u-form-field label="队伍密码" name="pass">
                          <u-input v-model="createState.pass" class="w-full" icon="material-symbols:password-rounded">
                            <template #trailing>
                              <u-button class="-me-2 cursor-pointer" color="neutral" variant="link" icon="material-symbols:casino-outline" @click="createRandomPass" />
                            </template>
                          </u-input>
                        </u-form-field>
                        <u-form-field label="队伍简介" name="bio">
                          <u-textarea v-model="createState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="5" :maxrows="5" />
                        </u-form-field>
                        <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">创建队伍</u-button>
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
                      <h2 class="text-lg font-semibold text-highlighted">加入队伍</h2>
                    </div>
                  </div>
                  <u-form :schema="joinSchema" :state="joinState" class="space-y-4" @submit="joinSubmit">
                    <u-form-field label="队伍 ID" name="id">
                      <u-input v-model="joinState.id" class="w-full" icon="material-symbols:group-outline-rounded" type="number" />
                    </u-form-field>
                    <u-form-field label="队伍密码" name="pass">
                      <u-input v-model="joinState.pass" class="w-full" icon="material-symbols:password-rounded" />
                    </u-form-field>
                    <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">加入队伍</u-button>
                    <u-button type="button" color="primary" variant="soft" icon="material-symbols:add-circle-outline-rounded" class="w-full justify-center cursor-pointer" size="lg" @click="setTeamProfileMode('create')"> 创建队伍 </u-button>
                  </u-form>
                </u-card>

                <u-card v-else key="create-mobile" variant="subtle" class="w-full lg:hidden">
                  <div class="mb-6 flex items-center gap-3">
                    <u-icon name="material-symbols:add-circle-outline-rounded" class="size-6 text-primary" />
                    <div>
                      <h2 class="text-lg font-semibold text-highlighted">创建队伍</h2>
                    </div>
                  </div>
                  <u-form :schema="createSchema" :state="createState" class="space-y-4" @submit="createSubmit">
                    <u-form-field label="队伍名称" name="name">
                      <u-input v-model="createState.name" class="w-full" :maxlength="40" icon="material-symbols:group-outline-rounded">
                        <template #trailing>
                          <div class="text-xs text-muted tabular-nums" role="status">{{ createState.name.length }}/40</div>
                        </template>
                      </u-input>
                    </u-form-field>
                    <u-form-field label="队伍密码" name="pass">
                      <u-input v-model="createState.pass" class="w-full" icon="material-symbols:password-rounded">
                        <template #trailing>
                          <u-button class="-me-2 cursor-pointer" color="neutral" variant="link" icon="material-symbols:casino-outline" @click="createRandomPass" />
                        </template>
                      </u-input>
                    </u-form-field>
                    <u-form-field label="队伍简介" name="bio">
                      <u-textarea v-model="createState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="5" :maxrows="5" />
                    </u-form-field>
                    <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">创建队伍</u-button>
                    <u-button type="button" color="neutral" variant="soft" icon="material-symbols:login-rounded" class="w-full justify-center cursor-pointer" size="lg" @click="setTeamProfileMode('join')"> 加入队伍 </u-button>
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
