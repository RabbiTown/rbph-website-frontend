<script setup lang="ts">
import { CalendarDate, Time } from '@internationalized/date';

withDefaults(
  defineProps<{
    icon?: string;
  }>(),
  {
    icon: undefined,
  },
);

type DateRange = { start: Date; end: Date };
const model = defineModel<DateRange>({
  default: () => {
    return {
      start: new Date(),
      end: new Date(),
    };
  },
});

const dateModel = shallowRef({ start: new CalendarDate(1999, 1, 1), end: new CalendarDate(1999, 1, 1) });

function dateToCalendarDate(date: Date) {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

const timeModel1 = shallowRef(new Time());
const timeModel2 = shallowRef(new Time());

function dateToTime(date: Date) {
  return new Time(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

function buildDate(cdate: CalendarDate, time: Time) {
  return new Date(cdate.year, cdate.month - 1, cdate.day, time.hour, time.minute, time.second, time.millisecond);
}

const rangeValid = computed(() => {
  if (!dateModel.value.end) return false;
  const dateCmpr = dateModel.value.start.compare(dateModel.value.end);
  return dateCmpr < 0 || (dateCmpr === 0 && timeModel1.value.compare(timeModel2.value) < 0);
});

function updateInnerDateTime() {
  dateModel.value = {
    start: dateToCalendarDate(model.value.start),
    end: dateToCalendarDate(model.value.end),
  };
  timeModel1.value = dateToTime(model.value.start);
  timeModel2.value = dateToTime(model.value.end);
}

function updateModelDateTime() {
  if (rangeValid.value) {
    model.value = {
      start: buildDate(dateModel.value.start, timeModel1.value),
      end: buildDate(dateModel.value.end, timeModel2.value),
    };
  }
}

const utcOffset = computed(() => {
  const offset = -new Date().getTimezoneOffset();

  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);

  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
});

const popoverOpen = ref(false);
watch(popoverOpen, val => {
  if (val) updateInnerDateTime();
  else updateModelDateTime();
});
</script>

<template>
  <u-popover v-model:open="popoverOpen">
    <u-button variant="subtle" color="neutral" :icon="icon" class="cursor-pointer"> {{ `${model.start.toLocaleString()} - ${model.end.toLocaleString()} (${utcOffset})` }} </u-button>
    <template #content>
      <div class="p-2">
        <u-calendar v-model="dateModel" range />
        <u-separator />
        <div class="mt-2 flex justify-center w-full gap-1">
          <div class="flex flex-col gap-0.5 items-center">
            <u-badge size="sm" variant="soft" color="neutral" class="mx-1">{{ dateModel.start.toString() }}</u-badge>
            <u-input-time v-model="timeModel1" granularity="second" variant="soft" :hour-cycle="24" class="px-1.5 py-1" :ui="{ segment: 'not-data-[segment=literal]:w-6' }" />
          </div>
          <div class="flex flex-col gap-0.5 items-center justify-between">
            <u-badge size="sm" variant="soft" class="mx-1">{{ utcOffset }}</u-badge>
            <u-icon name="material-symbols:arrow-forward-rounded" class="mb-1.5" />
          </div>
          <div class="flex flex-col gap-0.5 items-center">
            <u-badge size="sm" variant="soft" :color="rangeValid ? 'neutral' : 'error'" class="mx-1">{{ dateModel.end?.toString() ?? '????-??-??' }}</u-badge>
            <u-input-time v-model="timeModel2" granularity="second" variant="soft" color="error" :highlight="!rangeValid" :hour-cycle="24" class="px-1.5 py-1" :ui="{ segment: 'not-data-[segment=literal]:w-6' }" />
          </div>
        </div>
      </div>
    </template>
  </u-popover>
</template>
