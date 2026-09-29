<script setup lang="ts">
const props = defineProps<{
  gameId: number;
  currencies: RbTeamCurrency[];
  disabled?: boolean;
  hideAdd?: boolean;
}>();

const unlockAfterSeconds = defineModel<number>('unlockAfterSeconds', { default: 0 });
const costId = defineModel<number | null>('costId', { default: null });
const costAmount = defineModel<number>('costAmount', { default: 0 });
const { t } = useI18n();

type RequirementType = 'cooldown' | `currency:${number}`;
const maxUnlockAfterSeconds = 2_147_483_647;
const popoverOpen = ref(false);
const pendingType = ref<RequirementType>();
const pendingValue = ref(0);
const pendingCurrencyInputValue = ref<number | null>(0);
const pendingCooldownSeconds = ref(0);
const pendingCurrencyId = computed(() => {
  const match = pendingType.value?.match(/^currency:(\d+)$/);
  return match ? Number(match[1]) : null;
});
const pendingCurrency = computed(() => props.currencies.find(currency => currency.id === pendingCurrencyId.value));
const hasCurrencyRequirement = computed(() => costId.value !== null && costAmount.value > 0);
const selectedCurrency = computed(() => props.currencies.find(currency => currency.id === costId.value));
const availableRequirementItems = computed(() => [
  ...(unlockAfterSeconds.value > 0
    ? []
    : [{ label: t('ticket.cooldownRequirement'), value: 'cooldown' as RequirementType, icon: 'material-symbols:timer-outline-rounded' }]),
  ...(hasCurrencyRequirement.value
    ? []
    : props.currencies.map(currency => ({
        label: currency.name,
        value: `currency:${currency.id}` as RequirementType,
        icon: 'material-symbols:emoji-objects-outline-rounded',
      }))),
]);
const recentBids = computed(() => {
  if (!pendingType.value) return [];
  const values = getRecentMessageUnlockBids(props.gameId, pendingCurrencyId.value ?? 'cooldown');
  if (pendingType.value === 'cooldown') return values;
  const currency = pendingCurrency.value;
  return currency ? values.filter(value => value > 0 && value <= currency.max_amount) : [];
});
const effectivePendingCurrencyValue = computed(() => pendingCurrencyInputValue.value ?? 0);
const canAdd = computed(() => {
  if (pendingType.value === 'cooldown') return pendingCooldownSeconds.value > 0;
  return Boolean(
    pendingType.value &&
      pendingCurrency.value &&
      Number.isSafeInteger(effectivePendingCurrencyValue.value) &&
      effectivePendingCurrencyValue.value > 0 &&
      effectivePendingCurrencyValue.value <= pendingCurrency.value.max_amount,
  );
});

watch(
  () => props.currencies,
  currencies => {
    if (costId.value !== null && !currencies.some(currency => currency.id === costId.value)) {
      costId.value = null;
      costAmount.value = 0;
    }
    if (pendingCurrencyId.value !== null && !currencies.some(currency => currency.id === pendingCurrencyId.value)) {
      pendingType.value = undefined;
      pendingValue.value = 0;
    }
  },
);

watch(
  () => props.hideAdd,
  hidden => {
    if (hidden) setPopoverOpen(false);
  },
);

function resetPendingValue() {
  pendingValue.value = 0;
  pendingCurrencyInputValue.value = 0;
  pendingCooldownSeconds.value = 0;
}

function setPopoverOpen(open: boolean) {
  popoverOpen.value = open;
  if (open) {
    const firstCurrency = availableRequirementItems.value.find(item => item.value.startsWith('currency:'));
    pendingType.value = firstCurrency?.value ?? availableRequirementItems.value[0]?.value;
    resetPendingValue();
  } else {
    pendingType.value = undefined;
    resetPendingValue();
  }
}

function selectRequirement(value: unknown) {
  pendingType.value = value as RequirementType | undefined;
  resetPendingValue();
}

function useRecent(value: number) {
  if (!pendingType.value) return;
  if (pendingType.value === 'cooldown') {
    unlockAfterSeconds.value = value;
  } else if (pendingCurrencyId.value !== null) {
    costId.value = pendingCurrencyId.value;
    costAmount.value = value;
  }
  setPopoverOpen(false);
}

function addRequirement() {
  if (!canAdd.value || !pendingType.value) return;
  if (pendingType.value === 'cooldown') {
    unlockAfterSeconds.value = pendingCooldownSeconds.value;
  } else if (pendingCurrencyId.value !== null) {
    costId.value = pendingCurrencyId.value;
    costAmount.value = Math.trunc(effectivePendingCurrencyValue.value);
  }
  setPopoverOpen(false);
}

function removeCooldown() {
  unlockAfterSeconds.value = 0;
}

function removeCurrency() {
  costId.value = null;
  costAmount.value = 0;
}

</script>

<template>
  <div class="flex min-w-0 flex-wrap gap-2">
    <u-button
      v-if="unlockAfterSeconds > 0"
      type="button"
      size="sm"
      color="warning"
      variant="soft"
      icon="material-symbols:timer-outline-rounded"
      trailing-icon="material-symbols:close-rounded"
      :label="`${t('ticket.cooldownRequirement')}：${formatTime(unlockAfterSeconds * 1000)}`"
      :disabled="disabled"
      @click="removeCooldown"
    />
    <u-button
      v-if="hasCurrencyRequirement && selectedCurrency"
      type="button"
      size="sm"
      color="warning"
      variant="soft"
      icon="material-symbols:emoji-objects-outline-rounded"
      trailing-icon="material-symbols:close-rounded"
      :label="`${selectedCurrency.name}：${intPrecString(costAmount, selectedCurrency.prec)}`"
      :disabled="disabled"
      @click="removeCurrency"
    />

    <u-popover v-if="!hideAdd" :open="popoverOpen" arrow :content="{ side: 'top', align: 'start', sideOffset: 8 }" @update:open="setPopoverOpen">
      <u-button
        type="button"
        size="sm"
        color="neutral"
        variant="soft"
        icon="material-symbols:add-rounded"
        :label="t('ticket.unlockRequirements')"
        :disabled="disabled || availableRequirementItems.length === 0"
      />
      <template #content>
        <div
          class="w-72 max-w-[calc(100vw-2rem)] space-y-3 p-3"
          @keydown.enter.prevent.stop="addRequirement"
        >
          <u-field-group class="flex max-w-full overflow-x-auto">
            <u-button
              v-for="item in availableRequirementItems"
              :key="item.value"
              type="button"
              size="sm"
              color="neutral"
              variant="soft"
              active-color="primary"
              class="shrink-0"
              :icon="item.icon"
              :label="item.label"
              :active="pendingType === item.value"
              :aria-pressed="pendingType === item.value"
              @click="selectRequirement(item.value)"
            />
          </u-field-group>

          <rb-input-duration
            v-if="pendingType === 'cooldown'"
            v-model="pendingCooldownSeconds"
            :max-seconds="maxUnlockAfterSeconds"
            icon="material-symbols:timer-outline-rounded"
            :aria-label="t('ticket.cooldownRequirement')"
          />
          <rb-currency-input
            v-else-if="pendingCurrency"
            v-model="pendingValue"
            v-model:input-value="pendingCurrencyInputValue"
            :currency="pendingCurrency"
            :min="0"
            orientation="vertical"
            class="w-full"
            variant="soft"
            :step="1"
          />

          <div class="flex flex-wrap items-center gap-1.5">
            <u-button
              v-for="value in recentBids"
              :key="value"
              size="xs"
              color="neutral"
              variant="soft"
              :label="pendingType === 'cooldown' ? formatTime(value * 1000) : intPrecString(value, pendingCurrency?.prec ?? 0)"
              @click="useRecent(value)"
            />
            <u-button
              type="button"
              size="sm"
              class="ms-auto"
              icon="material-symbols:add-rounded"
              :label="t('ticket.addUnlockRequirement')"
              variant="soft"
              :disabled="!canAdd"
              @click="addRequirement"
            />
          </div>
        </div>
      </template>
    </u-popover>
  </div>
</template>
