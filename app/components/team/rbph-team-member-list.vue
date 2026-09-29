<script setup lang="ts">
const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    members: RbTeamMember[];
    currentUserId?: number;
    canManage?: boolean;
    locked?: boolean;
    allowLockedManagement?: boolean;
    busy?: boolean;
  }>(),
  {
    currentUserId: undefined,
    canManage: false,
    locked: false,
    allowLockedManagement: false,
    busy: false,
  },
);

const emit = defineEmits<{
  promote: [member: RbTeamMember];
  remove: [member: RbTeamMember];
}>();

const sortedMembers = computed(() =>
  [...props.members].sort((a, b) => {
    if (a.is_captain !== b.is_captain) return a.is_captain ? -1 : 1;
    return new Date(a.ctime_at).getTime() - new Date(b.ctime_at).getTime();
  }),
);

function removeDisabled() {
  return props.busy || props.members.length <= 1 || (props.locked && !props.allowLockedManagement);
}

function removeHint() {
  if (props.locked && !props.allowLockedManagement) return t('components.teamMemberList.lockedRemoveHint');
  if (props.members.length <= 1) return t('components.teamMemberList.lastMemberRemoveHint');
  return t('components.teamMemberList.remove');
}
</script>

<template>
  <div class="divide-y divide-default rounded-lg bg-elevated/60 px-4 ring ring-default">
    <div v-for="member in sortedMembers" :key="member.id" class="flex items-center justify-between gap-3 py-3">
      <rb-user :name="member.nickname" :description="t('components.teamMemberList.joinedAt', { time: formatDate(member.ctime_at) })" :avatar="{ src: member.avatar, text: member.nickname, icon: 'material-symbols:person-2-rounded' }" class="min-w-0">
        <template #name>
          <div class="flex min-w-0 items-center gap-2">
            <span class="truncate font-medium text-highlighted">{{ member.nickname }}</span>
            <u-badge v-if="member.is_captain" color="primary" variant="soft">{{ t('components.teamMemberList.captain') }}</u-badge>
            <u-badge v-if="member.id === currentUserId" color="neutral" variant="soft">{{ t('components.teamMemberList.you') }}</u-badge>
          </div>
        </template>
      </rb-user>

      <div v-if="canManage && !member.is_captain" class="flex shrink-0 gap-1">
        <u-popover arrow>
          <rb-tooltip :text="t('components.teamMemberList.setCaptain')">
            <u-button icon="material-symbols:workspace-premium-outline-rounded" color="neutral" variant="ghost" :disabled="busy" />
          </rb-tooltip>
          <template #content>
            <div class="w-56 p-3 text-sm">
              <div class="font-medium text-highlighted">{{ t('components.teamMemberList.confirmSetCaptain', { name: member.nickname }) }}</div>
              <div class="mt-3 flex justify-end">
                <u-button size="xs" color="primary" variant="soft" icon="material-symbols:workspace-premium-outline-rounded" :loading="busy" :label="t('components.teamMemberList.confirm')" @click="emit('promote', member)" />
              </div>
            </div>
          </template>
        </u-popover>

        <rb-tooltip :text="removeHint()">
          <span v-if="removeDisabled()" class="inline-flex">
            <u-button icon="material-symbols:person-remove-outline-rounded" color="error" variant="ghost" disabled />
          </span>
          <u-popover v-else arrow>
            <u-button icon="material-symbols:person-remove-outline-rounded" color="error" variant="ghost" />
            <template #content>
              <div class="w-56 p-3 text-sm">
                <div class="font-medium text-highlighted">{{ t('components.teamMemberList.confirmRemove', { name: member.nickname }) }}</div>
                <div class="mt-1 text-xs text-muted">{{ t('components.teamMemberList.confirmRemoveDesc') }}</div>
                <div class="mt-3 flex justify-end">
                  <u-button size="xs" color="error" variant="soft" icon="material-symbols:person-remove-outline-rounded" :loading="busy" :label="t('components.teamMemberList.confirmRemoveButton')" @click="emit('remove', member)" />
                </div>
              </div>
            </template>
          </u-popover>
        </rb-tooltip>
      </div>
    </div>
  </div>
</template>
