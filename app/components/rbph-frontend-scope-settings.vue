<script setup lang="ts">
type FrontendPackage = {
  id: number;
  name: string;
  delete_pending: boolean;
  manifest: RbThemeManifest;
};
type FrontendRevision = { id: number; revision: number; status: 'draft' | 'published' };
type FrontendBinding = {
  revision_id: number;
  surface: RbFrontendSurface;
  scope_kind: 'game' | 'round' | 'puzzle';
  scope_id: number;
  package_id?: number | null;
  renderer_id?: string | null;
};
type FrontendState = { packages: FrontendPackage[]; revisions: FrontendRevision[]; draft: FrontendRevision; bindings: FrontendBinding[] };
type EditorDefinition = { surface: RbFrontendSurface; label: string; icon: string };
type ExposedSettings = { apply: () => Promise<boolean>; reset: () => void };

const props = defineProps<{
  gameId: number;
  scopeKind: 'round' | 'puzzle';
  scopeId: number;
  editors: EditorDefinition[];
  previewPath?: string;
  disabled?: boolean;
}>();

const dirty = defineModel<boolean>('dirty', { default: false });
const api = useApi();
const { t } = useI18n();
const toast = useToast();
const state = ref<FrontendState>();
const loading = ref(false);
const saving = ref(false);
const selections = reactive<Partial<Record<RbFrontendSurface, string>>>({});
const bindingErrorHints = () => localizeRbErrorHints(rbFrontendBindingErrorKeys, key => t(key));

function explicitBinding(surface: RbFrontendSurface) {
  return state.value?.bindings.find(binding => binding.surface === surface && binding.scope_kind === props.scopeKind && binding.scope_id === props.scopeId);
}

function rendererItems(surface: RbFrontendSurface) {
  return [
    { label: t('admin.frontend.common.inheritParent'), value: 'inherit', icon: 'material-symbols:account-tree-outline-rounded' },
    { label: t('admin.frontend.common.builtinPage'), value: 'builtin', icon: 'material-symbols:web-asset' },
    ...(state.value?.packages ?? []).flatMap(item => Object.entries(item.manifest.features?.renderers ?? {})
      .filter(([, renderer]) => renderer.surface === surface)
      .map(([rendererId]) => ({
        label: t('admin.frontend.common.rendererFromPackage', { renderer: rendererId, package: item.name }),
        value: `${item.id}:${rendererId}`,
        icon: 'material-symbols:deployed-code-outline',
        disabled: item.delete_pending,
      }))),
  ];
}

function rendererSelection(key?: string) {
  if (!key) return {};
  const separator = key.indexOf(':');
  if (separator < 1) return {};
  return { packageId: Number(key.slice(0, separator)), rendererId: key.slice(separator + 1) };
}

function bindingSelection(surface: RbFrontendSurface) {
  const binding = explicitBinding(surface);
  if (!binding) return 'inherit';
  return binding.package_id && binding.renderer_id ? `${binding.package_id}:${binding.renderer_id}` : 'builtin';
}

function syncSelections() {
  for (const editor of props.editors) selections[editor.surface] = bindingSelection(editor.surface);
}

const dirtyEditors = computed(() => !state.value || loading.value ? [] : props.editors.filter(editor => selections[editor.surface] !== bindingSelection(editor.surface)));
const invalid = computed(() => dirtyEditors.value.some(editor => !selections[editor.surface]));

function reset() {
  syncSelections();
}

async function refresh() {
  loading.value = true;
  try {
    state.value = (await api.get<FrontendState>(`/admin/games/${props.gameId}/frontend`)).data;
    syncSelections();
  } catch (error) {
    state.value = undefined;
    handleError(error, t('admin.frontend.errorTitles.loadSettings'));
  } finally {
    loading.value = false;
  }
}

async function apply(): Promise<boolean> {
  if (!state.value || !dirtyEditors.value.length || saving.value || invalid.value) return !invalid.value;
  saving.value = true;
  try {
    for (const editor of dirtyEditors.value) {
      const selection = selections[editor.surface];
      if (selection === 'inherit') {
        await api.del(`/admin/games/${props.gameId}/frontend/bindings`, {
          query: { revisionId: state.value.draft.id, surface: editor.surface, scopeKind: props.scopeKind, scopeId: props.scopeId },
          errorHints: bindingErrorHints(),
        });
      } else {
        const renderer = selection === 'builtin' ? {} : rendererSelection(selection);
        await api.put(`/admin/games/${props.gameId}/frontend/bindings`, {
          revisionId: state.value.draft.id,
          surface: editor.surface,
          scopeKind: props.scopeKind,
          scopeId: props.scopeId,
          packageId: renderer.packageId ?? null,
          rendererId: renderer.rendererId ?? null,
        }, { errorHints: bindingErrorHints() });
      }
    }
    toast.add({ title: t('admin.frontend.scope.saved'), icon: 'material-symbols:check-rounded', color: 'success' });
    await refresh();
    return true;
  } catch (error) {
    handleError(error, t('admin.frontend.errorTitles.saveBinding'), true);
    return false;
  } finally {
    saving.value = false;
  }
}

function preview() {
  if (!state.value || !props.previewPath) return;
  window.open(`${props.previewPath}?preview=${state.value.draft.id}`, '_blank', 'noopener');
}

watch(dirtyEditors, value => {
  dirty.value = value.length > 0;
}, { immediate: true });
watch(() => [props.gameId, props.scopeKind, props.scopeId], refresh, { immediate: true });

defineExpose<ExposedSettings>({ apply, reset });
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-xl font-semibold text-highlighted">{{ t('admin.frontend.title') }}</h2>
      <u-button v-if="previewPath" color="neutral" variant="soft" icon="material-symbols:open-in-new-rounded" :disabled="disabled || saving || loading" @click="preview">{{ t('admin.frontend.common.previewDraft') }}</u-button>
    </div>

    <div v-if="loading && !state" class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
      <u-skeleton v-for="editor in editors" :key="editor.surface" class="h-10 w-full" />
    </div>

    <div v-else-if="state" class="space-y-3 rounded-lg bg-elevated/60 p-4 ring ring-default">
      <template v-for="(editor, index) in editors" :key="editor.surface">
        <u-separator v-if="index" />
        <rb-form-field row :label="editor.label" :icon="editor.icon" :dirty="selections[editor.surface] !== bindingSelection(editor.surface)" :reset="() => selections[editor.surface] = bindingSelection(editor.surface)">
          <u-select v-model="selections[editor.surface]" :items="rendererItems(editor.surface)" class="w-full sm:w-96" :disabled="disabled || saving" />
        </rb-form-field>
      </template>
    </div>
  </section>
</template>
