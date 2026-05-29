<script setup lang="ts">
import { CalendarDate, Time } from '@internationalized/date';

withDefaults(
  defineProps<{
    icon?: string;
    placeholder?: string;
    optional?: boolean;
  }>(),
  {
    icon: undefined,
    placeholder: '未设定时间',
    optional: false,
  },
);

const model = defineModel<Date>();

const dateModel = computed({
  get() {
    const d = model.value ?? new Date();
    return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  },
  set(val) {
    const d = model.value ?? new Date();
    model.value = new Date(val.year, val.month - 1, val.day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  },
});

const timeModel = computed({
  get() {
    const d = model.value ?? new Date();
    return new Time(d.getHours(), d.getMinutes(), d.getSeconds());
  },
  set(val) {
    const d = model.value ?? new Date();
    model.value = new Date(d.getFullYear(), d.getMonth(), d.getDate(), val.hour, val.minute, val.second, d.getMilliseconds());
  },
});

const utcOffset = computed(() => {
  const offset = -new Date().getTimezoneOffset();

  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);

  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
});
</script>

<template>
  <u-popover>
    <u-button variant="subtle" color="neutral" :icon="icon" class="cursor-pointer"> {{ model ? `${model.toLocaleString()} (${utcOffset})` : placeholder }} </u-button>
    <template #content>
      <div class="p-2">
        <u-calendar v-model="dateModel" />
        <u-separator />
        <div class="mt-2 flex justify-center w-full gap-1">
          <div>
            <u-input-time v-model="timeModel" granularity="second" variant="soft" color="primary" :hour-cycle="24" class="px-1.5 py-1" :ui="{ segment: 'not-data-[segment=literal]:w-6' }" />
            <u-badge size="sm" variant="soft" class="mx-1">{{ utcOffset }}</u-badge>
          </div>
          <div v-if="optional" class="ms-auto">
            <u-button color="error" variant="soft" class="cursor-pointer" size="sm" @click="model = undefined">清除</u-button>
          </div>
        </div>
      </div>
    </template>
  </u-popover>
</template>
