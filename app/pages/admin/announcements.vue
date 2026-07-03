<script setup lang="ts">
useHead({ titleTemplate: '全局公告 - RBPH 管理后台' });
</script>

<template>
  <u-dashboard-panel id="admin-announcements">
    <template #header>
      <u-dashboard-navbar title="全局公告">
        <template #leading>
          <u-dashboard-sidebar-collapse />
        </template>
      </u-dashboard-navbar>
    </template>
    <template #body>
      <rbph-announcement-manager />
    </template>
  </u-dashboard-panel>
</template>
