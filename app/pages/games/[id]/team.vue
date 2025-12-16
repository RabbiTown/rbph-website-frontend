<script setup lang="ts">
import * as v from 'valibot';
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';

definePageMeta({
  layout: 'game',
});

const api = useApi();
const toast = useToast();

const user = await useUser();
const game = useState<RbGame>('game');
const team = useState<RbTeam | undefined>('team');

const member = computed(() => team.value?.members.find(it => it.id === user.value?.id));
const isCaptain = computed(() => member.value?.is_captain);

async function reloadTeamInfo() {
  try {
    const { data } = await api.get<RbTeam>(`/games/${game.value.id}/teams/self`);
    team.value = data;

    updateAllState();
  } catch (error) {
    if (getRbErrorCode(error) != -104) {
      handleError(error, '队伍信息获取失败');
    } else {
      team.value = undefined;
    }
  }
}

const submitLoading = ref(false);

/* has team */
const Icon = resolveComponent('icon');
const UButton = resolveComponent('u-button');
const UTooltip = resolveComponent('u-tooltip');
const UUser = resolveComponent('u-user');
const UBadge = resolveComponent('u-badge');

const memberSorted = computed(() => {
  if (!team.value || !team.value.members) return [];
  return [...team.value.members].sort((a, b) => {
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
    cell: ({ getValue }) => (getValue() ? h(UTooltip, { text: '队长' }, h(Icon, { name: 'material-symbols:flag-outline-rounded', size: 20, class: 'align-sub' })) : ''),
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
    cell: ({ getValue }) => h(UUser, { name: getValue(), avatar: { icon: 'material-symbols:person-2-rounded' } }),
  },
  {
    accessorKey: 'id',
    header: '',
    cell: ({ getValue }) => {
      const id = getValue();
      return [
        member.value?.is_captain && id !== member.value?.id
          ? [
              h(UTooltip, { text: '设为队长' }, h(UButton, { icon: 'material-symbols:award-star-outline-rounded', color: 'neutral', variant: 'link', class: 'cursor-pointer', onClick: () => alert('123') })),
              h(UTooltip, { text: '移除成员' }, h(UButton, { icon: 'material-symbols:person-remove-outline-rounded', color: 'error', variant: 'link', class: 'cursor-pointer', onClick: () => alert('123') })),
            ]
          : '',
        id === member.value?.id ? h(UBadge, {}, '你') : '',
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
    toast.add({
      title: 'todo',
    });
    submitLoading.value = false;
  } else {
    try {
      const { code } = await api.post(
        `/games/${game.value.id}/teams/self/leave`,
        {},
        {
          errorHints: {
            [-1]: '只有队伍中的队员可以离开队伍。',
          },
        }
      );

      if (code == 0) {
        toast.add({
          title: '成功离开队伍！',
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
          [-104]: '队伍 ID 无效。',
          [-4]: '输入密码错误。',
          [-3]: '队伍已满。',
          [-2]: '队伍已锁定，请联系工作人员。',
          [-1]: '你已经有一个队伍了。',
        },
      }
    );

    if (code == 0) {
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
      `/games/${game.value.id}/teams/self`,
      { tname: event.data.name, pass: event.data.pass, bio: event.data.bio },
      {
        errorHints: {
          [-2]: '提交的凭据无效。',
          [-1]: '你已经有一个队伍了。',
        },
      }
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
  if (team.value) {
    editState.id = team.value.id || 0;
    editState.name = team.value.tname || '';
    editState.pass = team.value.pass || '';
    editState.bio = team.value.bio || '';
  }
  joinState.pass = '';
  createState.name = '';
  createState.bio = '';
  createRandomPass();
}

updateAllState();
</script>

<template>
  <div>
    <template v-if="team">
      <u-main class="py-8 flex gap-8 md:flex-nowrap flex-wrap">
        <u-card variant="subtle" class="md:flex-1 w-full">
          <div class="font-bold text-xl mb-8">队伍信息</div>
          <u-form :schema="editSchema" :state="editState" class="space-y-4" @submit="editSubmit">
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
            <div class="w-full flex justify-center mb-4 mt-8">
              <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg" :disabled="!isCaptain">
                {{ isCaptain ? '更新信息' : '只有队长才能更新信息' }}
              </u-button>
            </div>
            <div class="w-full flex justify-center mb-4 mt-4">
              <u-popover arrow>
                <u-button :loading="submitLoading" class="w-full justify-center cursor-pointer" variant="outline" color="error" size="md">
                  {{ member?.is_captain ? '解散队伍' : '退出队伍' }}
                </u-button>
                <template #content>
                  <div class="py-2 px-4 text-xs">
                    <icon name="material-symbols:warning-outline-rounded" class="align-middle" />
                    <span class="text-xs"> 这个操作不可撤销。 </span>
                    <u-button :loading="submitLoading" class="cursor-pointer" color="error" variant="soft" size="xs" @click="leaveTeamSubmit"> 确定 </u-button>
                  </div>
                </template>
              </u-popover>
            </div>
          </u-form>
        </u-card>
        <u-card variant="subtle" class="md:flex-1 w-full">
          <div class="font-bold text-xl mb-8">队伍成员</div>
          <u-table :data="memberSorted" :columns="memberColumns" class="flex-1" />
        </u-card>
      </u-main>
    </template>
    <template v-else>
      <u-main class="py-8 flex gap-8 items-center justify-center flex-wrap">
        <u-card class="md:w-xs w-full md:h-128 h-96 flex items-center justify-center" variant="subtle">
          <div class="-mt-4">
            <div class="w-full flex justify-center mb-4">
              <icon name="material-symbols:login-rounded" size="40px" />
            </div>
            <div class="font-bold text-xl mb-8 text-center">加入队伍</div>
            <u-form :schema="joinSchema" :state="joinState" class="space-y-4" @submit="joinSubmit">
              <u-form-field label="队伍 ID" name="id">
                <u-input v-model="joinState.id" class="w-full" icon="material-symbols:group-outline-rounded" type="number" />
              </u-form-field>
              <u-form-field label="队伍密码" name="pass">
                <u-input v-model="joinState.pass" class="w-full" icon="material-symbols:password-rounded" />
              </u-form-field>
              <div class="w-full flex justify-center mb-4 mt-8">
                <u-button type="submit" :loading="submitLoading" class="w-20 justify-center cursor-pointer" size="md">加入</u-button>
              </div>
            </u-form>
          </div>
        </u-card>
        <u-card class="md:w-xl w-full md:h-128 overflow-y-auto" variant="subtle">
          <div class="font-bold text-xl mb-8">创建队伍</div>
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
            <div class="w-full flex justify-center mb-4 mt-8">
              <u-button type="submit" :loading="submitLoading" class="w-full justify-center cursor-pointer" size="lg">创建</u-button>
            </div>
          </u-form>
        </u-card>
      </u-main>
    </template>
  </div>
</template>
