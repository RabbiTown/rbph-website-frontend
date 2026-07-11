<script setup lang="ts">const { t } = useI18n();


interface AnnouncementState {
  id: number;
  title: string;
  content: string;
  content_type: RbContentType;
  is_pinned: boolean;
  is_shown: boolean;
  puzzle_ids: number[];
  deleting?: boolean;
  open?: boolean;
}

const props = defineProps<{ gameId?: number }>();
const api = useApi();
const toast = useToast();
const dirtyToast = useDirtyToast();
const loading = ref(false);
const saving = ref(false);
const announcements = ref<AdminAnnouncementData[]>([]);
const state = ref<AnnouncementState[]>([]);
const puzzles = ref<UnlockPuzzleOptionData[]>([]);
let nextDraftId = -1;

const isGlobal = computed(() => props.gameId === undefined);
function toState(announcement: AdminAnnouncementData, open = false): AnnouncementState {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    content_type: announcement.content_type,
    is_pinned: announcement.is_pinned,
    is_shown: announcement.is_shown,
    puzzle_ids: announcement.puzzles.map(puzzle => puzzle.id),
    open,
  };
}

function snapshot(announcement: AnnouncementState) {
  return {
    title: announcement.title.trim(),
    content: announcement.content,
    content_type: announcement.content_type,
    is_pinned: announcement.is_pinned,
    is_shown: announcement.is_shown,
    game_id: props.gameId ?? null,
    puzzle_ids: isGlobal.value ? [] : [...announcement.puzzle_ids].sort((a, b) => a - b),
  };
}

function originalSnapshot(id: number) {
  const announcement = announcements.value.find(item => item.id === id);
  return announcement ? snapshot(toState(announcement)) : undefined;
}

function isDirty(announcement: AnnouncementState) {
  if (announcement.deleting || announcement.id < 0) return true;
  return JSON.stringify(snapshot(announcement)) !== JSON.stringify(originalSnapshot(announcement.id));
}

const dirty = computed(() => state.value.some(isDirty));

function expandedIds() {
  return new Set(state.value.filter(item => item.open && item.id > 0).map(item => item.id));
}

function reset(openIds = expandedIds()) {
  state.value = announcements.value.map(item => toState(item, openIds.has(item.id)));
  dirtyToast.clear();
}

async function fetchData(openIds = expandedIds()) {
  loading.value = true;
  try {
    const query = props.gameId === undefined ? undefined : { game_id: props.gameId };
    const requests: Promise<unknown>[] = [
      api.get<{ announcements: AdminAnnouncementData[] }>('/admin/announcements', { query }).then(({ data }) => {
        announcements.value = data.announcements;
      }),
    ];
    if (props.gameId !== undefined) {
      requests.push(
        api.get<{ puzzles: UnlockPuzzleOptionData[] }>('/admin/puzzles', { query: { game_id: props.gameId } }).then(({ data }) => {
          puzzles.value = data.puzzles;
        }),
      );
    }
    await Promise.all(requests);
    reset(openIds);
  } catch (error) {
    handleError(error, t('components.rbphAnnouncementManager.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function addAnnouncement() {
  state.value.push({
    id: nextDraftId--,
    title: '',
    content: '',
    content_type: RbContentType.Markdown,
    is_pinned: false,
    is_shown: false,
    puzzle_ids: [],
    open: true,
  });
}

function removeAnnouncement(announcement: AnnouncementState) {
  if (announcement.id > 0) announcement.deleting = true;
  else state.value = state.value.filter(item => item !== announcement);
}

function restoreAnnouncement(announcement: AnnouncementState) {
  announcement.deleting = false;
}

function targetLabel(announcement: AnnouncementState) {
  if (isGlobal.value) return t('admin.common.globalAnnouncements');
  if (announcement.puzzle_ids.length === 0) return t('admin.common.gameAnnouncements');
  if (announcement.puzzle_ids.length > 1) return t('components.rbphAnnouncementManager.puzzleCount', { count: announcement.puzzle_ids.length });
  const puzzleId = announcement.puzzle_ids[0];
  return puzzles.value.find(item => item.id === puzzleId)?.title ?? t('components.rbphAnnouncementManager.puzzleId', { id: puzzleId });
}

async function save() {
  if (!dirty.value || saving.value) return;
  const invalid = state.value.find(item => !item.deleting && !item.title.trim());
  if (invalid) {
    invalid.open = true;
    toast.add({ title: t('components.rbphAnnouncementManager.titleRequired'), icon: 'material-symbols:error-outline-rounded', color: 'error' });
    return;
  }

  saving.value = true;
  const openIds = expandedIds();
  try {
    for (const announcement of state.value) {
      if (announcement.deleting && announcement.id > 0) {
        await api.del(`/admin/announcements/${announcement.id}`, { errorHints: { [-1]: t('components.rbphAnnouncementManager.announcementNotFound') } });
      }
    }
    for (const announcement of state.value.filter(item => !item.deleting && isDirty(item))) {
      if (announcement.id > 0) {
        await api.patch(`/admin/announcements/${announcement.id}`, snapshot(announcement), {
          errorHints: { [-2]: t('components.rbphAnnouncementManager.invalidConfiguration'), [-1]: t('components.rbphAnnouncementManager.announcementNotFound') },
        });
      } else {
        const { data } = await api.post<{ announcement: AdminAnnouncementData }>('/admin/announcements', snapshot(announcement), {
          errorHints: { [-2]: t('components.rbphAnnouncementManager.invalidConfiguration') },
        });
        if (announcement.open) openIds.add(data.announcement.id);
      }
    }
    await fetchData(openIds);
    dirtyToast.clear();
    toast.add({ title: t('components.rbphAnnouncementManager.saved'), icon: 'material-symbols:check-rounded', color: 'success' });
  } catch (error) {
    handleError(error, t('components.rbphAnnouncementManager.saveFailed'), true);
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.gameId,
  () => fetchData(new Set()),
  { immediate: true },
);

watch(dirty, value => {
  if (value) dirtyToast.show({ description: t('components.rbphAnnouncementManager.unsavedChanges'), guardOnLeave: true, apply: save, reset });
  else dirtyToast.clear();
});

onBeforeUnmount(() => dirtyToast.clear());
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]">
    <aside class="hidden xl:block" />

    <u-form :state="{ announcements: state }" class="flex min-w-0 flex-col gap-4" @submit.prevent="save">
      <div>
        <h2 class="text-xl font-semibold text-highlighted">{{ isGlobal ? t('admin.common.globalAnnouncements') : t('admin.common.gameAnnouncements') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ isGlobal ? t('components.rbphAnnouncementManager.globalDescription') : t('components.rbphAnnouncementManager.gameDescription') }}</p>
      </div>

      <u-empty v-if="!loading && state.length === 0" icon="material-symbols:campaign-outline-rounded" :title="t('components.rbphAnnouncementManager.emptyTitle')" :description="t('components.rbphAnnouncementManager.emptyDescription')">
        <template #actions>
          <u-button icon="material-symbols:add-rounded" :label="t('components.rbphAnnouncementManager.createAnnouncement')" :disabled="loading || saving" @click="addAnnouncement" />
        </template>
      </u-empty>

      <template v-else>
        <div
          v-for="announcement in state"
          :key="announcement.id"
          class="relative transition-opacity"
          :class="[
            announcement.deleting ? 'opacity-50' : '',
            isDirty(announcement) ? `before:content-[''] before:pointer-events-none before:absolute before:-start-4 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-warning` : '',
          ]"
        >
          <u-collapsible v-model:open="announcement.open" :unmount-on-hide="false">
            <div class="group flex cursor-pointer items-center gap-3 rounded-lg bg-elevated/60 px-4 py-2 ring ring-default">
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <u-icon name="material-symbols:campaign-outline-rounded" class="shrink-0 text-primary" />
                <u-input v-if="announcement.open" v-model="announcement.title" class="-mx-2.5 -my-1.5 w-full font-medium" :placeholder="t('components.rbphAnnouncementManager.title')" variant="ghost" :maxlength="120" :disabled="saving || announcement.deleting" @click.stop />
                <div v-else class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ announcement.title || t('components.rbphAnnouncementManager.untitledAnnouncement') }}</div>
              </div>
              <div class="flex min-w-0 flex-none flex-wrap justify-end gap-1" @click.stop>
                <u-badge :color="announcement.is_shown ? 'success' : 'neutral'" variant="soft" :icon="announcement.is_shown ? 'material-symbols:visibility-outline-rounded' : 'material-symbols:visibility-off-outline-rounded'">
                  {{ announcement.is_shown ? t('admin.common.published') : t('components.rbphAnnouncementManager.draft') }}
                </u-badge>
                <u-badge v-if="announcement.is_pinned" color="warning" variant="soft" icon="material-symbols:keep-outline-rounded">{{ t('components.rbphAnnouncementManager.pinned') }}</u-badge>
                <u-badge color="neutral" variant="soft" :icon="announcement.puzzle_ids.length ? 'material-symbols:extension-outline-rounded' : 'material-symbols:sports-esports-outline-rounded'">{{ targetLabel(announcement) }}</u-badge>
              </div>
              <div class="flex items-center gap-1" @click.stop>
                <u-button v-if="announcement.deleting" icon="material-symbols:undo-rounded" color="neutral" variant="ghost" size="sm" :disabled="saving" @click="restoreAnnouncement(announcement)" />
                <u-button v-else icon="material-symbols:delete-outline-rounded" color="error" variant="ghost" size="sm" :disabled="saving" @click="removeAnnouncement(announcement)" />
              </div>
              <u-icon name="material-symbols:expand-more-rounded" class="size-5 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>

            <template #content>
              <div class="border-t border-default bg-elevated/40 px-4 pt-4 pb-4">
                <div class="flex flex-col gap-4">
                  <div class="grid grid-cols-2 gap-4">
                    <rb-form-field v-if="!isGlobal" row narrow-label :label="t('components.rbphAnnouncementManager.relatedPuzzle')" class="col-span-2">
                      <rbph-admin-puzzle-select
                        v-model="announcement.puzzle_ids"
                        :puzzles="puzzles"
                        multiple
                        :placeholder="t('components.rbphAnnouncementManager.noRelatedPuzzle')"
                        :loading="loading"
                        :disabled="saving || announcement.deleting"
                      />
                    </rb-form-field>
                    <rb-form-field row narrow-label :label="t('components.rbphAnnouncementManager.publishedState')">
                      <u-switch v-model="announcement.is_shown" class="mt-1.5" :label="t('components.rbphAnnouncementManager.publish')" :disabled="saving || announcement.deleting" />
                    </rb-form-field>
                    <rb-form-field row narrow-label :label="t('components.rbphAnnouncementManager.pinnedDisplay')">
                      <u-switch v-model="announcement.is_pinned" class="mt-1.5" :label="t('components.rbphAnnouncementManager.pinAnnouncement')" :disabled="saving || announcement.deleting" />
                    </rb-form-field>
                  </div>
                  <rbph-content-editor v-model="announcement.content" framed :placeholder="t('components.rbphAnnouncementManager.content')" :disabled="saving || announcement.deleting" @save="save" />
                </div>
              </div>
            </template>
          </u-collapsible>
        </div>

        <div class="sticky bottom-4 z-20 flex justify-end">
          <u-button icon="material-symbols:add-rounded" :label="t('components.rbphAnnouncementManager.createAnnouncement')" size="lg" class="shadow-lg shadow-primary/20" :disabled="loading || saving" @click="addAnnouncement" />
        </div>
      </template>
    </u-form>

    <aside class="hidden xl:block" />
  </div>
</template>
