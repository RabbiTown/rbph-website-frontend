<script setup lang="ts">
import * as v from 'valibot';
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';

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

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: '个人资料' }, { text: game.value?.title, sep: ' - ' }])),
});

const member = computed(() => teamData.value?.members.find(it => it.id === user.value?.id));
const isCaptain = computed(() => member.value?.is_captain);

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
});

const userDirty = computed(() => Boolean(user.value && (userState.nickname !== user.value.nickname || userState.bio !== (user.value.bio ?? ''))));

function syncUserState() {
  userState.id = user.value?.id ?? 0;
  userState.email = user.value?.email ?? '';
  userState.nickname = user.value?.nickname ?? '';
  userState.bio = user.value?.bio ?? '';
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

/* has team */
const Icon = resolveComponent('icon');
const UButton = resolveComponent('u-button');
const UTooltip = resolveComponent('u-tooltip');
const UPopover = resolveComponent('u-popover');
const RBUser = resolveComponent('rb-user');
const UBadge = resolveComponent('u-badge');

const memberSorted = computed(() => {
  const data = teamData.value;
  if (!data || !data.members) return [];
  return [...data.members].sort((a, b) => {
    if (a.is_captain !== b.is_captain) {
      return a.is_captain ? -1 : 1;
    }
    return new Date(a.ctime_at) < new Date(b.ctime_at) ? -1 : 1;
  });
});

const memberColumns: TableColumn<RbTeamMember>[] = [
  {
    accessorKey: 'is_captain',
    header: '',
    cell: ({ getValue }) => (getValue() ? h(UTooltip, { text: '队长' }, () => h(Icon, { name: 'material-symbols:flag-outline-rounded', size: 20, class: 'align-sub' })) : ''),
    meta: {
      class: {
        td: 'w-0 text-center',
        th: 'w-0 text-center',
      },
    },
  },
  {
    accessorKey: 'nickname',
    header: '用户',
    cell: ({ getValue }) => h(RBUser, { name: getValue(), email: user.value?.email, avatar: { icon: 'material-symbols:person-2-rounded' } }),
  },
  {
    accessorKey: 'id',
    header: '',
    cell: ({ getValue }) => {
      const id = getValue<number>();
      const warn = (handler: () => void) =>
        h('div', { class: 'py-2 px-4 text-xs' }, [
          h(Icon, { name: 'material-symbols:warning-outline-rounded', class: 'align-middle' }),
          h('span', { class: 'text-xs' }, '这个操作不可撤销。'),
          h(UButton, { loading: submitLoading.value, class: 'cursor-pointer', color: 'error', variant: 'soft', size: 'xs', onClick: handler }, () => '确定'),
        ]);
      return [
        member.value?.is_captain && id !== member.value?.id
          ? [
              h(
                UPopover,
                { arrow: true },
                {
                  default: () => h(UTooltip, { text: '设为队长' }, h(UButton, { icon: 'material-symbols:award-star-outline-rounded', color: 'neutral', variant: 'link', class: 'cursor-pointer', disabled: submitLoading.value })),
                  content: () => warn(() => promoteSubmit(id)),
                },
              ),
              h(
                UPopover,
                { arrow: true },
                {
                  default: () => h(UTooltip, { text: '移除成员' }, h(UButton, { icon: 'material-symbols:person-remove-outline-rounded', color: 'error', variant: 'link', class: 'cursor-pointer', disabled: submitLoading.value })),
                  content: () => warn(() => kickSubmit(id)),
                },
              ),
            ]
          : [],
        id === member.value?.id ? h(UBadge, {}, () => '你') : '',
      ];
    },
    meta: {
      class: {
        td: 'w-0 text-center',
        th: 'w-0 text-center',
      },
    },
  },
];

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
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">个人资料</h1>
      </div>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <u-card variant="subtle" class="w-full">
          <div class="mb-6 flex items-center gap-3">
            <u-icon name="material-symbols:person-2-outline-rounded" class="size-6 text-primary" />
            <div>
              <h2 class="text-lg font-semibold text-highlighted">用户信息</h2>
            </div>
          </div>

          <u-form :schema="userProfileSchema" :state="userState" class="space-y-4" @submit="userSubmit">
            <u-form-field label="UID" name="id">
              <u-input v-model="userState.id" class="w-full" icon="material-symbols:tag-rounded" disabled type="number" />
            </u-form-field>
            <u-form-field label="邮箱" name="email">
              <u-input v-model="userState.email" class="w-full" icon="material-symbols:alternate-email-rounded" disabled />
            </u-form-field>
            <u-form-field label="用户名" name="nickname">
              <u-input v-model="userState.nickname" class="w-full" :maxlength="60" icon="material-symbols:badge-outline-rounded" :disabled="userSubmitLoading">
                <template #trailing>
                  <div class="text-xs text-muted tabular-nums" role="status">{{ userState.nickname.length }}/60</div>
                </template>
              </u-input>
            </u-form-field>
            <u-form-field label="个人简介" name="bio">
              <u-textarea v-model="userState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="5" :maxrows="5" :maxlength="200" :disabled="userSubmitLoading" />
            </u-form-field>
            <u-button type="submit" :loading="userSubmitLoading" class="w-full justify-center cursor-pointer" size="lg" :disabled="!userDirty"> 更新用户信息 </u-button>
          </u-form>
        </u-card>

        <div class="flex min-w-0 flex-col gap-6">
          <template v-if="teamData">
            <u-card variant="subtle" class="w-full">
              <div class="mb-6 flex items-center gap-3">
                <u-icon name="material-symbols:groups-2-outline-rounded" class="size-6 text-primary" />
                <div>
                  <h2 class="text-lg font-semibold text-highlighted">队伍信息</h2>
                </div>
              </div>

              <u-form :schema="editSchema" :state="editState" class="space-y-4" @submit="editSubmit">
                <div class="grid gap-4 md:grid-cols-2">
                  <u-form-field label="队伍 ID" name="id">
                    <u-input v-model="editState.id" class="w-full" :maxlength="40" icon="material-symbols:cards-stack-rounded" disabled type="number" />
                  </u-form-field>
                  <u-form-field label="队伍名称" name="name">
                    <u-input v-model="editState.name" class="w-full" :maxlength="40" icon="material-symbols:group-outline-rounded" :disabled="!isCaptain">
                      <template #trailing>
                        <div class="text-xs text-muted tabular-nums" role="status">{{ editState.name.length }}/40</div>
                      </template>
                    </u-input>
                  </u-form-field>
                </div>
                <u-form-field label="队伍密码" name="pass">
                  <u-input v-model="editState.pass" class="w-full" icon="material-symbols:password-rounded" :disabled="!isCaptain">
                    <template v-if="isCaptain" #trailing>
                      <u-button class="-me-2 cursor-pointer" color="neutral" variant="link" icon="material-symbols:casino-outline" @click="editRandomPass" />
                    </template>
                  </u-input>
                </u-form-field>
                <u-form-field label="队伍简介" name="bio">
                  <u-textarea v-model="editState.bio" class="w-full" :ui="{ base: 'resize-none' }" :rows="5" :maxrows="5" :disabled="!isCaptain" />
                </u-form-field>
                <div class="flex flex-wrap gap-3">
                  <u-button type="submit" :loading="submitLoading" class="min-w-40 justify-center cursor-pointer" size="lg" :disabled="!isCaptain">
                    {{ isCaptain ? '更新队伍信息' : '只有队长才能更新信息' }}
                  </u-button>
                  <u-popover arrow>
                    <u-button :loading="submitLoading" class="min-w-32 justify-center cursor-pointer" variant="outline" color="error" size="lg">
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
            </u-card>

            <u-card variant="subtle" class="w-full">
              <div class="mb-6 flex items-center gap-3">
                <u-icon name="material-symbols:group-outline-rounded" class="size-6 text-primary" />
                <div>
                  <h2 class="text-lg font-semibold text-highlighted">队伍成员</h2>
                </div>
              </div>
              <u-table :data="memberSorted" :columns="memberColumns" class="flex-1" />
            </u-card>
          </template>

          <template v-else>
            <div class="flex flex-col gap-6">
              <u-alert variant="subtle" color="info" icon="material-symbols:info-outline-rounded" title="参与比赛前需要加入或创建队伍，个人参赛也要创建队伍。" />

              <div class="hidden team-profile-desktop-grid gap-6 lg:flex" :class="teamProfileGridMode === 'join' ? 'team-profile-desktop-grid-join' : 'team-profile-desktop-grid-create'">
                <div class="team-profile-slot team-profile-slot-left">
                  <transition name="team-profile-morph">
                    <u-card v-if="teamProfileMode === 'join'" key="join-form" variant="subtle" class="team-profile-morph-panel h-full w-full lg:min-h-104">
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

                    <u-card v-else key="create-form" variant="subtle" class="team-profile-morph-panel h-full w-full lg:min-h-104">
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

              <transition name="team-profile-switch" mode="out-in">
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
