<script setup lang="ts">const { t } = useI18n();


type RbphVueAppManifest = {
  type: 'rbph-vue-app';
  version: 1;
  entry: string;
  styles?: string[];
};

type RbphVueAppContext = {
  version: 1;
  props: unknown;
  api: {
    request<T = unknown>(options: { path: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; query?: Record<string, unknown>; body?: unknown }): Promise<{ code: number; data: T }>;
    get<T = unknown>(path: string, query?: Record<string, unknown>): Promise<{ code: number; data: T }>;
    post<T = unknown>(path: string, body?: unknown): Promise<{ code: number; data: T }>;
  };
  backend: {
    call<T = unknown>(name: string, body?: unknown): Promise<{ code: number; data: T }>;
    get<T = unknown>(name: string, query?: Record<string, unknown>): Promise<{ code: number; data: T }>;
    post<T = unknown>(name: string, body?: unknown): Promise<{ code: number; data: T }>;
    on<T = unknown>(event: string, callback: (message: RbphBackendEvent<T>) => void): () => void;
  };
  route: {
    gameId?: number;
    puzzleId?: number;
  };
  state: {
    getGame(): unknown;
    getTeam(): unknown;
    getPuzzle(): unknown;
  };
  actions: {
    refreshPuzzle(): Promise<void>;
    refreshTeam(): Promise<void>;
    navigate(path: string): Promise<void>;
    toast(options: { title?: string; description?: string; color?: string }): void;
  };
  assets: {
    baseUrl: string;
    resolve(path: string): string;
  };
};

type RbphBackendEvent<T = unknown> = {
  data: T;
  actor: { id: number; nickname: string };
  source: { type: 'api' | 'judge' | 'hint_purchase'; function: string };
};

type BackendEventListener = (message: RbphBackendEvent) => void;

type RbphVueAppModule = {
  mount?: (el: Element, context: RbphVueAppContext) => unknown;
  unmount?: () => void;
  default?: ((el: Element, context: RbphVueAppContext) => unknown) | {
    mount?: (el: Element, context: RbphVueAppContext) => unknown;
    unmount?: () => void;
  };
};

const props = withDefaults(
  defineProps<{
    src?: string;
    props?: string;
  }>(),
  {
    src: '',
    props: '',
  },
);

const host = ref<HTMLElement>();
const loading = ref(false);
const error = ref('');
const api = useApi();
const toast = useToast();
const route = useRoute();
const game = useGame().ref;
const team = useTeam(false).ref;
const puzzleState = usePuzzle().ref;
const backendEventListeners = new Map<string, Set<BackendEventListener>>();

useSync().listen(SyncMessageType.PuzzleBackendEvent, ({ data }) => {
  const puzzleId = puzzleState.value?.data.id ?? currentNumericRouteParam('puzzle');
  if (data.puzzle_id !== puzzleId) return;

  const message: RbphBackendEvent = {
    data: data.payload,
    actor: data.actor,
    source: data.source,
  };
  for (const listener of [...(backendEventListeners.get(data.event) ?? [])]) {
    try {
      listener(message);
    } catch (err) {
      console.error(`Puzzle backend event listener failed for ${data.event}`, err);
    }
  }
});

let shadow: ShadowRoot | undefined;
let mountedCleanup: (() => void) | undefined;
let renderSeq = 0;

function parseJsonProps(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

function resolveUrl(path: string, baseUrl: string) {
  return new URL(path, baseUrl).href;
}

function manifestBaseUrl(manifestUrl: string) {
  return new URL('.', manifestUrl).href;
}

async function loadManifest(src: string) {
  const response = await fetch(src, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const manifest = (await response.json()) as RbphVueAppManifest;
  if (manifest.type !== 'rbph-vue-app' || manifest.version !== 1 || typeof manifest.entry !== 'string' || !manifest.entry) {
    throw new Error('Invalid manifest');
  }
  return manifest;
}

function cleanup() {
  mountedCleanup?.();
  mountedCleanup = undefined;
  backendEventListeners.clear();
  if (shadow) shadow.replaceChildren();
}

function subscribeBackendEvent<T>(event: string, callback: (message: RbphBackendEvent<T>) => void) {
  const listener: BackendEventListener = message => callback(message as RbphBackendEvent<T>);
  let listeners = backendEventListeners.get(event);
  if (!listeners) {
    listeners = new Set();
    backendEventListeners.set(event, listeners);
  }
  listeners.add(listener);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const current = backendEventListeners.get(event);
    current?.delete(listener);
    if (!current?.size) backendEventListeners.delete(event);
  };
}

function normalizeUnmount(value: unknown, mod: RbphVueAppModule) {
  if (typeof value === 'function') return value as () => void;
  if (value && typeof value === 'object' && 'unmount' in value && typeof (value as { unmount?: unknown }).unmount === 'function') {
    return (value as { unmount: () => void }).unmount;
  }
  if (typeof mod.unmount === 'function') return mod.unmount;
  if (mod.default && typeof mod.default === 'object' && typeof mod.default.unmount === 'function') return mod.default.unmount;
  return undefined;
}

function mountModule(mod: RbphVueAppModule, el: Element, context: RbphVueAppContext) {
  if (typeof mod.mount === 'function') return mod.mount(el, context);
  if (typeof mod.default === 'function') return mod.default(el, context);
  if (mod.default && typeof mod.default === 'object' && typeof mod.default.mount === 'function') return mod.default.mount(el, context);
  throw new Error('Missing mount export');
}

function currentNumericRouteParam(name: string) {
  const raw = route.params[name];
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(value) ? value : undefined;
}

function backendPath(puzzleId: number | undefined, name: string) {
  if (!puzzleId) throw new Error('Missing puzzle id');
  return `/puzzles/${puzzleId}/backend/${encodeURIComponent(name)}`;
}

function createContext(manifestUrl: string): RbphVueAppContext {
  const baseUrl = manifestBaseUrl(manifestUrl);
  const parsedProps = parseJsonProps(props.props);
  const puzzleId = puzzleState.value?.data.id ?? currentNumericRouteParam('puzzle');

  return {
    version: 1,
    props: parsedProps,
    api: {
      request: options => api.request({ path: options.path, method: options.method, query: options.query, body: options.body }),
      get: (path, query) => api.get(path, { query }),
      post: (path, body) => api.post(path, body),
    },
    backend: {
      call: (name, body) => api.post(backendPath(puzzleId, name), body),
      get: (name, query) => api.get(backendPath(puzzleId, name), { query }),
      post: (name, body) => api.post(backendPath(puzzleId, name), body),
      on: subscribeBackendEvent,
    },
    route: {
      gameId: game.value?.id ?? currentNumericRouteParam('id'),
      puzzleId,
    },
    state: {
      getGame: () => game.value,
      getTeam: () => team.value,
      getPuzzle: () => puzzleState.value,
    },
    actions: {
      async refreshPuzzle() {
        const puzzleId = puzzleState.value?.data.id;
        if (puzzleId) await usePuzzle().updateState(String(puzzleId));
      },
      async refreshTeam() {
        await useTeam().updateData();
      },
      async navigate(path: string) {
        await navigateTo(path);
      },
      toast(options) {
        toast.add({
          title: options.title,
          description: options.description,
          color: options.color as Parameters<typeof toast.add>[0]['color'],
        });
      },
    },
    assets: {
      baseUrl,
      resolve: path => resolveUrl(path, baseUrl),
    },
  };
}

async function render() {
  const container = host.value;
  if (!container || !import.meta.client) return;

  const src = props.src.trim();
  cleanup();
  error.value = '';

  if (!src) return;

  const seq = ++renderSeq;
  loading.value = true;

  try {
    const manifestUrl = resolveUrl(src, window.location.href);
    const manifest = await loadManifest(manifestUrl);
    if (seq !== renderSeq) return;

    shadow = shadow ?? container.shadowRoot ?? container.attachShadow({ mode: 'open' });
    const mountEl = document.createElement('div');

    for (const stylePath of manifest.styles ?? []) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = resolveUrl(stylePath, manifestUrl);
      shadow.append(link);
    }
    shadow.append(mountEl);

    const entryUrl = resolveUrl(manifest.entry, manifestUrl);
    const mod = (await import(/* @vite-ignore */ entryUrl)) as RbphVueAppModule;
    if (seq !== renderSeq) return;

    const mountResult = mountModule(mod, mountEl, createContext(manifestUrl));
    mountedCleanup = normalizeUnmount(mountResult, mod);
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('components.rbphVueAppRenderer.loadFailed');
    cleanup();
  } finally {
    if (seq === renderSeq) loading.value = false;
  }
}

watch(() => [props.src, props.props] as const, render, { immediate: true });
onMounted(render);
onBeforeUnmount(cleanup);
</script>

<template>
  <div>
    <u-alert v-if="error" color="error" variant="soft" icon="material-symbols:error-outline-rounded" :title="t('components.rbphVueAppRenderer.loadFailedError')" :description="error" />
    <u-skeleton v-else-if="loading" class="h-24 w-full" />
    <div ref="host" />
  </div>
</template>
