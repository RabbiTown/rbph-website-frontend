export interface AdminContentBlock {
  id: number;
  puzzle_id?: number | null;
  round_id?: number | null;
  sort: number;
  name: string;
  content: string;
  content_type: RbContentType;
  cdn_backend?: string | null;
  cdn_object_key?: string | null;
  cdn_relative_path?: string | null;
  cdn_sha256?: string | null;
  cdn_size?: number | null;
  visibility_cond: string;
  ctime_at: string;
  utime_at: string;
}

export function useAdminContentBlocks(owner: 'puzzles' | 'rounds', ownerId: Ref<number | undefined>) {
  const api = useApi();
  const blocks = ref<AdminContentBlock[]>([]);
  const baseline = ref<Record<number, string>>({});
  const selectedId = ref<number>();
  const loading = ref(false);
  const saving = ref(false);
  const cdnAvailable = ref(false);

  const endpoint = computed(() => (ownerId.value ? `/admin/${owner}/${ownerId.value}/content-blocks` : ''));
  const selected = computed(() => blocks.value.find(block => block.id === selectedId.value));
  const snapshot = (block: AdminContentBlock) =>
    JSON.stringify({
      name: block.name,
      content: block.content,
      content_type: block.content_type,
      visibility_cond: block.visibility_cond,
    });
  const dirtyBlocks = computed(() => blocks.value.filter(block => baseline.value[block.id] !== snapshot(block)));
  const dirty = computed(() => dirtyBlocks.value.length > 0);
  const isDirty = (id: number) => {
    const block = blocks.value.find(item => item.id === id);
    return Boolean(block && baseline.value[id] !== snapshot(block));
  };

  function accept(next: AdminContentBlock[]) {
    blocks.value = next.sort((a, b) => a.sort - b.sort || a.id - b.id);
    baseline.value = Object.fromEntries(blocks.value.map(block => [block.id, snapshot(block)]));
    if (!blocks.value.some(block => block.id === selectedId.value)) selectedId.value = blocks.value[0]?.id;
  }

  async function load() {
    if (!endpoint.value) return;
    loading.value = true;
    try {
      const [blocksResponse, cdnResponse] = await Promise.all([
        api.get<{ blocks: AdminContentBlock[] }>(endpoint.value),
        api.get<{ available: boolean }>('/admin/content-blocks/cdn-status').catch(() => undefined),
      ]);
      accept(blocksResponse.data.blocks);
      cdnAvailable.value = cdnResponse?.data.available ?? false;
    } finally {
      loading.value = false;
    }
  }

  async function create() {
    if (!endpoint.value) return;
    const { data } = await api.post<{ block: AdminContentBlock }>(endpoint.value, { name: '新建内容块' });
    blocks.value.push(data.block);
    baseline.value[data.block.id] = snapshot(data.block);
    selectedId.value = data.block.id;
  }

  async function remove(id: number) {
    await api.del(`/admin/content-blocks/${id}`);
    blocks.value = blocks.value.filter(block => block.id !== id);
    Reflect.deleteProperty(baseline.value, id);
    if (selectedId.value === id) selectedId.value = blocks.value[0]?.id;
  }

  async function reorder(ids: number[]) {
    if (!endpoint.value) return;
    await api.put(`${endpoint.value}/order`, { ids });
    const map = new Map(blocks.value.map(block => [block.id, block]));
    blocks.value = ids.flatMap((id, sort) => {
      const block = map.get(id);
      if (!block) return [];
      block.sort = sort;
      return [block];
    });
  }

  async function save() {
    if (!endpoint.value || !dirty.value) return;
    saving.value = true;
    try {
      const { data } = await api.patch<{ blocks: AdminContentBlock[] }>(endpoint.value, {
        blocks: dirtyBlocks.value.map(block => ({
          id: block.id,
          name: block.name.trim(),
          content: block.content,
          content_type: block.content_type,
          visibility_cond: block.visibility_cond,
        })),
      });
      accept(data.blocks);
    } finally {
      saving.value = false;
    }
  }

  async function saveInfo(
    id: number,
    info: Pick<AdminContentBlock, 'name' | 'content_type' | 'visibility_cond'>,
  ) {
    if (!endpoint.value) return;
    const block = blocks.value.find(item => item.id === id);
    const originalValue = baseline.value[id];
    if (!block || !originalValue) return;
    const original = JSON.parse(originalValue) as Pick<AdminContentBlock, 'name' | 'content' | 'content_type' | 'visibility_cond'>;
    const { data } = await api.patch<{ blocks: AdminContentBlock[] }>(endpoint.value, {
      blocks: [{
        id,
        name: info.name.trim(),
        content: original.content,
        content_type: info.content_type,
        visibility_cond: info.visibility_cond,
      }],
    });
    const saved = data.blocks.find(item => item.id === id);
    if (!saved) return;

    block.name = saved.name;
    block.content_type = saved.content_type;
    block.visibility_cond = saved.visibility_cond;
    baseline.value[id] = JSON.stringify({
      name: saved.name,
      content: original.content,
      content_type: saved.content_type,
      visibility_cond: saved.visibility_cond,
    });
  }

  function reset() {
    for (const block of blocks.value) {
      const value = baseline.value[block.id];
      if (value) Object.assign(block, JSON.parse(value));
    }
  }

  async function clearUnlocks(id: number) {
    await api.del(`/admin/content-blocks/${id}/unlocks`);
  }

  async function upload(id: number) {
    if (isDirty(id)) return;
    const block = blocks.value.find(item => item.id === id);
    if (!block) return;
    const { data } = await api.post<{ block: AdminContentBlock }>('/admin/content-blocks/' + id + '/cdn');
    Object.assign(block, data.block);
  }

  async function removeUpload(id: number) {
    const block = blocks.value.find(item => item.id === id);
    if (!block) return;
    const { data } = await api.del<{ block: AdminContentBlock }>('/admin/content-blocks/' + id + '/cdn');
    Object.assign(block, data.block);
  }

  watch(ownerId, load, { immediate: true });

  return { blocks, selected, selectedId, loading, saving, cdnAvailable, dirty, isDirty, load, create, remove, reorder, save, saveInfo, reset, clearUnlocks, upload, removeUpload };
}
