<script setup lang="ts">
import { en, ja, zh_cn, zh_tw } from '@nuxt/ui/locale';
import * as VueRuntime from 'vue';
import { render, Suspense, type App, type AppContext, type InjectionKey, type VNode } from 'vue';
import { RbphContentBlocks } from '#components';
import { RBT_COMPONENT_REGISTRY } from '~/utils/rbt-component-registry';
import { RBT_VUE_RUNTIME_KEY } from '~/utils/rbt';

type ThemeModule = {
  mount?: (element: Element, context: Record<string, unknown>) => unknown;
  unmount?: () => void;
  default?: ((element: Element, context: Record<string, unknown>) => unknown) | { mount?: (element: Element, context: Record<string, unknown>) => unknown; unmount?: () => void };
};

const props = defineProps<{
  renderer: RbFrontendRenderer;
  pageKey: string | number;
  page: unknown;
  actions: Record<string, unknown>;
  routes: Record<string, unknown>;
  contentBlocks?: RbContentBlock[];
  currencies?: RbtCurrency[];
}>();
const emit = defineEmits<{ failed: [error: Error] }>();
const colorMode = useColorMode();
const hostI18n = useI18n();
const api = useApi();
const publicJudgeActionConsts = readonly(useJudgeActionConsts());
const publicLocale = readonly(computed(() => hostI18n.locale.value));
const themeUiLocale = computed(() => {
  if (publicLocale.value === 'zh-CN') return zh_cn;
  if (publicLocale.value === 'zh-TW') return zh_tw;
  if (publicLocale.value === 'ja') return ja;
  return en;
});
const host = ref<HTMLElement>();
const instance = getCurrentInstance();
const sync = useSync();
const sidStore = useSid();
const syncTime = useSyncTime();
const currentSyncTime = readonly(useCurrentTimeSec());
const syncSubscriptions = new Set<() => void>();
const syncMessageTypes = new Set(Object.values(SyncMessageType).filter((value): value is SyncMessageType => typeof value === 'number'));
let colorModeRoots: HTMLElement[] = [];
let shadow: ShadowRoot | undefined;
let cleanupModule: (() => void) | undefined;
let renderId = 0;

function resolveUrl(path: string, base: string) { return new URL(path, base).href; }
const publicPage = readonly(computed(() => props.page));
const publicCurrencies = readonly(computed(() => JSON.parse(JSON.stringify(props.currencies ?? [])) as RbtCurrency[]));
function cleanup() {
  try {
    cleanupModule?.();
  } finally {
    cleanupModule = undefined;
    for (const stop of [...syncSubscriptions]) stop();
    syncSubscriptions.clear();
    colorModeRoots = [];
    shadow?.replaceChildren();
  }
}

function syncColorMode() {
  const dark = colorMode.value === 'dark';
  for (const element of colorModeRoots) {
    element.classList.toggle('dark', dark);
    element.classList.toggle('light', !dark);
    element.style.colorScheme = dark ? 'dark' : 'light';
  }
}

function syncLocale() {
  const className = publicLocale.value === 'zh-CN'
    ? 'lang-zh-cn'
    : publicLocale.value === 'zh-TW'
      ? 'lang-zh-tw'
      : publicLocale.value === 'ja'
        ? 'lang-ja'
        : 'lang-en';
  for (const element of colorModeRoots) {
    for (const name of [...element.classList]) {
      if (name.startsWith('lang-')) element.classList.remove(name);
    }
    element.classList.add(className);
    element.lang = publicLocale.value;
    element.dir = themeUiLocale.value.dir;
  }
}

function normalizeCleanup(value: unknown, mod: ThemeModule) {
  if (typeof value === 'function') return value as () => void;
  if (value && typeof value === 'object' && 'unmount' in value && typeof (value as { unmount?: unknown }).unmount === 'function') return () => (value as { unmount: () => void }).unmount();
  if (typeof mod.unmount === 'function') return mod.unmount;
  if (mod.default && typeof mod.default === 'object' && typeof mod.default.unmount === 'function') return mod.default.unmount;
}

function mountModule(mod: ThemeModule, element: Element, context: Record<string, unknown>) {
  if (typeof mod.mount === 'function') return mod.mount(element, context);
  if (typeof mod.default === 'function') return mod.default(element, context);
  if (mod.default && typeof mod.default === 'object' && typeof mod.default.mount === 'function') return mod.default.mount(element, context);
  throw new Error('Theme module does not export mount()');
}

function installHostStyles(root: ShadowRoot) {
  if (root.querySelector('[data-rbph-host-styles]')) return;
  const marker = document.createElement('meta');
  marker.dataset.rbphHostStyles = '';
  root.append(marker);
  for (const source of document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')) {
    root.append(source.cloneNode(true));
  }
}

function mountContent(element: Element, blocks?: RbtContentBlock[]) {
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) installHostStyles(root);
  const contentBlocks = blocks?.map(rbtContentBlockValue) ?? props.contentBlocks ?? [];
  const appContext = instance?.appContext as AppContext;
  const vnode = h(Suspense, null, {
    default: () => {
      const content = h(RbphContentBlocks, { blocks: contentBlocks }) as VNode;
      content.appContext = appContext;
      return content;
    },
    fallback: () => h('div'),
  }) as VNode;
  vnode.appContext = appContext;
  render(vnode, element);
  return () => render(null, element);
}

function publicContentBlocks() {
  return (props.contentBlocks ?? []).map(rbtContentBlock);
}

function installThemeUi(app: App) {
  for (const [name, component] of Object.entries(RBT_COMPONENT_REGISTRY)) app.component(name, component);
  const hostContext = instance?.appContext;
  if (!hostContext) return;
  for (const key of Reflect.ownKeys(hostContext.provides)) {
    app.provide(key as InjectionKey<unknown>, hostContext.provides[key as keyof typeof hostContext.provides]);
  }
  Object.assign(app.config.globalProperties, hostContext.config.globalProperties);
  for (const [name, directive] of Object.entries(hostContext.directives)) app.directive(name, directive);
}

function createContext(manifestUrl: string, overlayRoot: HTMLElement, manifest: RbThemeManifest) {
  const baseUrl = new URL('.', manifestUrl).href;
  const callT = hostI18n.t as unknown as (key: string, values?: Record<string, unknown> | unknown[], plural?: number) => string;
  const callTe = hostI18n.te as unknown as (key: string, locale?: string) => boolean;
  return {
    apiVersion: 1,
    surface: props.renderer.surface,
    rendererId: props.renderer.rendererId,
    judgeActionConsts: publicJudgeActionConsts,
    api,
    sync: {
      time: {
        currentTime: currentSyncTime,
        calcCurrentTime: () => syncTime.calcCurrentTime(),
      },
      isSelfEcho: (sid?: string) => sidStore.consume(sid),
      on(type: SyncMessageType, callback: (message: unknown) => void) {
        if (!syncMessageTypes.has(type)) throw new TypeError(`Unknown sync message type: ${type}`);
        if (typeof callback !== 'function') throw new TypeError('Sync listener must be a function');
        const permission = manifest.permissions?.sync;
        if (permission !== 'all' && !permission?.includes(type)) throw new Error(`Theme did not request sync permission ${type}`);
        const rawStop = sync.subscribe(type, message => {
          try {
            callback(JSON.parse(JSON.stringify(message)) as unknown);
          } catch (error) {
            console.error(`[RBPH theme sync] Listener failed for message ${type}`, error);
          }
        });
        let active = true;
        const stop = () => {
          if (!active) return;
          active = false;
          syncSubscriptions.delete(stop);
          rawStop();
        };
        syncSubscriptions.add(stop);
        return stop;
      },
    },
    utils: {
      formatDate,
      formatTime,
      intPrecString,
      formatCurrencyPenaltySuffix,
    },
    i18n: {
      locale: publicLocale,
      availableLocales: readonly(computed(() => [...hostI18n.availableLocales])),
      t: (key: string, values?: Record<string, unknown> | unknown[], plural?: number) => callT(key, values, plural),
      te: (key: string, locale?: string) => callTe(key, locale),
      n: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(publicLocale.value, options).format(value),
      d: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(publicLocale.value, options).format(value instanceof Date ? value : new Date(value)),
    } satisfies RbtThemeI18n,
    state: {
      ...(props.renderer.surface === 'round-page' ? { round: publicPage } : { puzzle: publicPage }),
      currencies: publicCurrencies,
      getCurrencies: () => JSON.parse(JSON.stringify(props.currencies ?? [])) as RbtCurrency[],
    },
    actions: props.actions,
    routes: props.routes,
    content: {
      get blocks() { return publicContentBlocks(); },
      mount: mountContent,
    },
    assets: { baseUrl, resolve: (path: string) => resolveUrl(path, manifestUrl) },
    ui: {
      apiVersion: 1,
      overlayRoot,
      locale: themeUiLocale,
      install(app: App) {
        installThemeUi(app);
        app.provide(Symbol.for('nuxt-ui.locale-context') as InjectionKey<unknown>, themeUiLocale);
      },
    },
  };
}

async function mount() {
  if (!import.meta.client || !host.value || props.renderer.mode !== 'package' || !props.renderer.manifestUrl) return;
  const id = ++renderId;
  cleanup();
  try {
    const manifestUrl = resolveUrl(props.renderer.manifestUrl, window.location.href);
    const manifest = await fetchThemeManifest(manifestUrl);
    const definition = manifest.type === 'rbph-theme' && manifest.apiVersion === 1 && props.renderer.rendererId
      ? manifest.features?.renderers?.[props.renderer.rendererId]
      : undefined;
    if (!definition || definition.surface !== props.renderer.surface) throw new Error(`Theme renderer is unavailable: ${props.renderer.rendererId ?? props.renderer.surface}`);
    const styles = await Promise.all((definition.styles ?? []).map(async path => {
      const url = resolveUrl(path, manifestUrl);
      return { url, css: await fetchThemeCss(url) };
    }));
    if (id !== renderId) return;
    (globalThis as Record<string, unknown>)[RBT_VUE_RUNTIME_KEY] = VueRuntime;
    shadow = host.value.shadowRoot ?? host.value.attachShadow({ mode: 'open' });
    installHostStyles(shadow);
    for (const { url, css } of styles) {
      const style = document.createElement('style');
      style.dataset.rbtThemeStyle = url;
      style.textContent = css;
      shadow.append(style);
    }
    const root = document.createElement('div');
    const overlayRoot = document.createElement('div');
    overlayRoot.dataset.rbtOverlayRoot = '';
    colorModeRoots = [root, overlayRoot];
    syncColorMode();
    syncLocale();
    shadow.append(root, overlayRoot);
    const mod = await import(/* @vite-ignore */ resolveUrl(definition.entry, manifestUrl)) as ThemeModule;
    if (id !== renderId) return;
    cleanupModule = normalizeCleanup(mountModule(mod, root, createContext(manifestUrl, overlayRoot, manifest)), mod);
  } catch (error) {
    cleanup();
    emit('failed', error instanceof Error ? error : new Error(String(error)));
  }
}

watch(() => colorMode.value, syncColorMode);
watch(publicLocale, syncLocale);
watch(() => [props.pageKey, props.renderer.mode, props.renderer.manifestUrl, props.renderer.rendererId, props.renderer.surface], mount);
onMounted(mount);
onBeforeUnmount(() => { renderId++; cleanup(); });
</script>

<template><div ref="host" /></template>
