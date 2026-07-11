<script setup lang="ts">const { t } = useI18n();


useHead({ titleTemplate: t('admin.pages.announcements.pageTitle') });
</script>

<template>
  <u-dashboard-panel id="admin-announcements">
    <template #header>
      <u-dashboard-navbar :title="t('admin.common.globalAnnouncements')">
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
