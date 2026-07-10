<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

useUser().required();

const { t } = useI18n();
const game = useGame().ref;
const team = useTeam().ref;

useHead({
  titleTemplate: computed(() => buildTitleParts([{ text: t('message.title') }, { text: game.value?.title, sep: ' - ' }])),
});

const api = useApi();
const toast = useToast();

const pageData = ref<TicketThread>();
const canSend = computed(() => canSendTicket(pageData.value?.perm));
const messages = computed(() => [...(pageData.value?.messages.filter(isTicketMessage) ?? [])].reverse());
const historyLoading = ref(false);
const draftContentType = ref(RbContentType.UnsafeMarkdown);

async function updateData(newId: number | undefined = undefined): Promise<boolean> {
  const gameId = newId || game.value?.id;
  if (gameId) {
    try {
      const { data } = await api.get<TicketThread>(`/games/${gameId}/tickets/self`);
      pageData.value = data;
      return true;
    } catch (error) {
      handleError(error, t('message.loadFailed'));
    }
  }
  return false;
}

async function loadOlder() {
  const gameId = game.value?.id;
  const before = pageData.value?.history.before;
  if (!gameId || !before || historyLoading.value) return;
  historyLoading.value = true;
  try {
    const { data } = await api.get<TicketThread>(`/games/${gameId}/tickets/self`, { query: { before } });
    if (pageData.value) {
      pageData.value = {
        ...pageData.value,
        messages: mergeTicketThreadItems(data.messages, pageData.value.messages),
        history: { ...data.history, newer: pageData.value.history.newer },
      };
    }
  } catch (error) {
    handleError(error, t('message.loadEarlierFailed'));
  } finally {
    historyLoading.value = false;
  }
}

async function loadNewer() {
  const gameId = game.value?.id;
  const newer = pageData.value?.history.newer;
  if (!gameId || !newer) return updateData();
  try {
    const { data } = await api.get<TicketThread>(`/games/${gameId}/tickets/self`, { query: { after: newer } });
    if (pageData.value) {
      pageData.value = {
        ...pageData.value,
        ticket: data.ticket,
        perm: data.perm,
        messages: mergeTicketThreadItems(pageData.value.messages, data.messages),
        history: { ...pageData.value.history, newer: data.history.newer ?? pageData.value.history.newer },
      };
    }
  } catch (error) {
    handleError(error, t('message.updateFailed'));
  }
}

watch(
  game,
  async newGame => {
    pageData.value = undefined;
    updateData(newGame?.id);
  },
  { immediate: true },
);

useSync().listen(SyncMessageType.TicketUpdated, ({ data }) => {
  if (data.game_id === game.value?.id && data.team_id === useTeam(false).ref.value?.id) loadNewer();
});

onMounted(() => {
  useInfiniteScroll(window, loadOlder, {
    distance: 80,
    canLoadMore: () => Boolean(pageData.value?.history.before) && !historyLoading.value,
  });
});

const submitLoading = ref(false);

const draftMessage = ref('');
async function submitMessage() {
  if (!canSend.value) return;

  submitLoading.value = true;

  const gameId = game.value?.id;
  if (gameId) {
    try {
      const { code, data } = await api.post<TicketSendResponse>(`/games/${gameId}/tickets/self/send`, { content: draftMessage.value, content_type: draftContentType.value } satisfies TicketSendRequest, {
        errorHints: {
          [-1]: t('message.sendBlockTeam'),
          [-2]: t('message.sendBlockPending'),
          [-3]: t('message.sendBlockType'),
          [-4]: t('message.sendBlockLength'),
          [-5]: t('message.sendBlockCost'),
          [-8]: t('message.sendBlockUnavailable'),
          [-9]: t('message.sendBlockBanned'),
          [-10]: t('message.sendBlockExistingOnly'),
        },
      });
      draftMessage.value = '';

      if (code === 0) {
        toast.add({
          title: t('message.sentSuccess'),
          description: t('message.sentSuccessDesc'),
          icon: 'material-symbols:check-rounded',
          color: 'success',
        });
        const perm = data.perm ?? pageData.value?.perm ?? { send_block: RbTicketSendBlock.Ok, can_host: false, can_view_locked: false, content_type: [RbContentType.UnsafeMarkdown], currency: [] };
        pageData.value = {
          ticket: data.ticket ?? pageData.value?.ticket,
          messages: mergeTicketThreadItems(pageData.value?.messages ?? [], [data.msg]),
          history: pageData.value?.history ?? { has_more: false },
          perm,
        };
        draftContentType.value = getDefaultTicketContentType(perm);
      }
    } catch (error) {
      handleError(error, t('message.sendFailed'));
    }
  }

  submitLoading.value = false;
}

const sendBlock = computed(() => {
  const block = pageData.value?.perm.send_block;
  return block ? sendBlockConsts[block] : undefined;
});

interface SendBlockConst {
  icon: string;
  color: 'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral' | undefined;
  title: string;
  teamRestriction?: boolean;
}

const sendBlockConsts: Partial<Record<RbTicketSendBlock, SendBlockConst>> = {
  [RbTicketSendBlock.NoAccess]: { icon: 'material-symbols:error-med-outline-rounded', color: 'error', title: t('message.noAccess') },
  [RbTicketSendBlock.Closed]: { icon: 'material-symbols:check-rounded', color: 'success', title: t('message.closed') },
  [RbTicketSendBlock.Pending]: { icon: 'material-symbols:more-horiz', color: 'warning', title: t('message.pending') },
  [RbTicketSendBlock.FeatureClosed]: { icon: 'material-symbols:lock-outline', color: 'warning', title: t('message.featureClosed') },
  [RbTicketSendBlock.FeatureExistingOnly]: { icon: 'material-symbols:history-rounded', color: 'warning', title: t('message.featureExistingOnly') },
  [RbTicketSendBlock.TeamFeatureBanned]: { icon: 'material-symbols:block-outline', color: 'error', title: t('message.teamFeatureBanned'), teamRestriction: true },
};
</script>

<template>
  <div>
    <div class="pt-6">
      <div class="flex items-baseline justify-between md:flex-row flex-col">
        <div class="text-3xl font-bold">{{ t('message.title') }}</div>
      </div>
    </div>
    <u-alert v-if="team?.is_banned && canSend" class="mt-6" variant="subtle" :title="t('message.teamBannedWarning')" icon="material-symbols:warning-outline-rounded" color="warning">
      <template #description>
        <i18n-t keypath="message.restrictionDetails" tag="span" class="whitespace-nowrap">
          <template #activity><u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" :label="t('nav.teamActivity')" class="p-0 align-middle mb-0.5" /></template>
        </i18n-t>
      </template>
    </u-alert>
    <u-alert v-if="sendBlock" class="my-6" variant="subtle" :title="sendBlock.title" :icon="sendBlock.icon" :color="sendBlock.color">
      <template v-if="sendBlock.teamRestriction" #description>
        <i18n-t keypath="message.restrictionDetails" tag="span" class="whitespace-nowrap">
          <template #activity><u-button :to="`/games/${game?.id}/activity`" size="xs" variant="link" icon="material-symbols:history-rounded" :label="t('nav.teamActivity')" class="p-0 align-middle mb-0.5" /></template>
        </i18n-t>
      </template>
    </u-alert>
    <rbph-message-edit
      v-else
      v-model:draft="draftMessage"
      v-model:content-type="draftContentType"
      class="my-6"
      :placeholder="t('message.replyPlaceholder')"
      :content-types="pageData?.perm.content_type"
      :disabled="!canSend || submitLoading"
      :loading="!pageData || submitLoading"
      @submit="submitMessage"
    />
    <div v-if="pageData && messages.length > 0" class="flex flex-wrap gap-4">
      <u-card v-for="msg in messages" :key="msg.id" class="w-full" variant="subtle" :ui="{ body: 'sm:p-0 p-0' }">
        <u-collapsible :default-open="true" :unmount-on-hide="false">
          <div class="px-5 py-3 flex items-center group dark:bg-slate-800 bg-slate-100 cursor-pointer">
            <u-icon class="align-middle me-2 text-primary" name="material-symbols:chat-outline-rounded" />
            <div class="text-sm flex-1 flex flex-wrap justify-between">
              <div>
                <u-badge v-if="msg.sender_type === RbTicketSenderType.Host" variant="soft" color="warning" class="me-1">{{ t('message.staffMember') }}</u-badge>
                <u-badge v-if="msg.sender_type === RbTicketSenderType.Team" variant="soft" class="me-1">{{ t('message.teamMember') }}</u-badge>
                {{ msg.sender.nickname }}
              </div>
              <div v-if="msg.ctime_at" class="text-secondary text-xs flex items-center ms-1">
                <u-icon name="material-symbols:schedule-outline-rounded" class="align-middle me-0.5" />
                {{ t('message.sentAt', { time: formatDate(msg.ctime_at) }) }}
              </div>
            </div>
            <u-icon name="material-symbols:expand-more-rounded" class="-me-1 size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
          </div>
          <template v-if="msg.content && msg.content_type !== undefined" #content>
            <div class="px-4 py-4 border-t dark:border-t-slate-700 border-t-slate-200 text-sm">
              <rbph-content :content="msg as RbContent" />
            </div>
          </template>
        </u-collapsible>
      </u-card>
      <div v-if="historyLoading" class="flex w-full justify-center py-3"><u-icon name="material-symbols:progress-activity" class="size-5 animate-spin text-muted" /></div>
    </div>
    <u-empty v-else-if="pageData" icon="material-symbols:chat-info-outline-rounded" :title="t('message.needHelp')" :description="t('message.contact')" />
    <div v-else class="h-full">
      <u-skeleton class="w-full h-full min-h-24" />
    </div>
  </div>
</template>
