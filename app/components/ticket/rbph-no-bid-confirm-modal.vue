<script setup lang="ts">
const props = defineProps<{
  gameId: number;
  currencies: RbTeamCurrency[];
  busy?: boolean;
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [offer: MessageUnlockOffer] }>();
const { t } = useI18n();
const dontRemind = ref(false);
const unlockAfterSeconds = ref(0);
const costId = ref<number | null>(null);
const costAmount = ref(0);

watch(open, value => {
  if (!value) return;
  dontRemind.value = false;
  unlockAfterSeconds.value = 0;
  costId.value = null;
  costAmount.value = 0;
});

function confirm() {
  if (dontRemind.value) disableNoBidWarning(props.gameId);
  emit(
    'confirm',
    dontRemind.value
      ? { unlockAfterSeconds: 0, costId: null, costAmount: 0 }
      : {
          unlockAfterSeconds: unlockAfterSeconds.value,
          costId: costId.value,
          costAmount: costAmount.value,
        },
  );
}
</script>

<template>
  <rb-confirm-modal
    v-model:open="open"
    :title="t('ticket.noBidWarningTitle')"
    :description="t('ticket.noBidWarningDescription')"
    :confirm-label="t('ticket.sendWithoutBid')"
    confirm-color="warning"
    confirm-icon="material-symbols:send-outline-rounded"
    :busy="busy"
    @confirm="confirm"
  >
    <template #body>
      <div class="space-y-4">
        <rbph-message-unlock-editor
          v-model:unlock-after-seconds="unlockAfterSeconds"
          v-model:cost-id="costId"
          v-model:cost-amount="costAmount"
          :game-id="gameId"
          :currencies="currencies"
          :disabled="busy || dontRemind"
          :hide-add="dontRemind"
        />
        <u-checkbox v-model="dontRemind" :label="t('ticket.dontRemindForGame')" />
      </div>
    </template>
  </rb-confirm-modal>
</template>
