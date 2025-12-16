<script setup lang="ts">
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui';

const props = defineProps<{
  data?: RbPuzzleShowData;
}>();

const puzzleId = computed(() => props.data?.data.id);

const navItems = computed<NavigationMenuItem[]>(() =>
  puzzleId.value
    ? [
        {
          label: '题目',
          icon: 'material-symbols:extension-outline-rounded',
          to: `/puzzles/${puzzleId.value}`,
          exact: true,
        },
        {
          label: '提示',
          icon: 'material-symbols:lightbulb-outline-rounded',
          to: `/puzzles/${puzzleId.value}/hints`,
        },
        {
          label: '提交记录',
          icon: 'material-symbols:history-rounded',
          to: `/puzzles/${puzzleId.value}/submissions`,
        },
        {
          label: '人工提示',
          icon: 'material-symbols:near-me-outline-rounded',
          to: `/puzzles/${puzzleId.value}/help`,
        },
      ]
    : []
);

const breadItems = computed<BreadcrumbItem[]>(() => [
  {
    label: props.data?.data.round.title,
    to: `/rounds/${props.data?.data.round.id}`,
    icon: 'material-symbols:grid-view-outline-rounded',
  },
  {
    label: props.data?.data.title,
    to: `/puzzles/${puzzleId.value}`,
    icon: 'material-symbols:extension-outline-rounded',
  },
]);
</script>

<template>
  <div class="py-6">
    <u-breadcrumb class="mb-6" :items="breadItems" />
    <div class="flex items-baseline justify-between md:flex-row flex-col">
      <div class="text-3xl font-bold">
        {{ data?.data.title }}
      </div>
      <div class="mt-2 text-secondary ms-0.5 text-xs">
        <icon name="material-symbols:schedule-outline-rounded" class="align-middle mb-0.5" />
        解锁于 {{ formatDate(data?.state.utime_at) }}
      </div>
    </div>

    <u-navigation-menu :items="navItems" class="w-full py-2" :ui="{ linkLeadingIcon: 'xs:inline-block hidden' }" />

    <NuxtPage />
  </div>
</template>
