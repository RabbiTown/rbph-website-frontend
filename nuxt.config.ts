import { env } from 'process';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

if (env.HTTPS_PROXY) {
  const dispatcher = new ProxyAgent({ uri: new URL(env.HTTPS_PROXY).toString() });
  setGlobalDispatcher(dispatcher);
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxtjs/i18n', '@nuxtjs/mdc', '@vueuse/nuxt'],
  css: ['katex/dist/katex.min.css', '~/assets/css/main.css'],
  ssr: false,
  image: {
    provider: 'none',
  },
  mdc: {
    components: {
      prose: true,
    },
  },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'zh-CN',
    langDir: 'locales',
    locales: [
      { code: 'zh-CN', language: 'zh-CN', name: '简体中文', file: 'zh-CN.ts' },
      { code: 'zh-TW', language: 'zh-TW', name: '繁體中文', file: 'zh-TW.ts' },
      { code: 'en', language: 'en', name: 'English', file: 'en.ts' },
      { code: 'ja', language: 'ja', name: '日本語', file: 'ja.ts' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'rbph_locale',
      redirectOn: 'root',
    },
    vueI18n: './i18n.config.ts',
  },
  components: {
    global: true,
    dirs: ['./components', './components/prose'],
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? '/api',
    },
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:9999',
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },
    optimizeDeps: {
      include: [
        '@codemirror/lang-html',
        '@codemirror/lang-javascript',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
        '@internationalized/date',
        '@lezer/highlight',
        '@tiptap/extension-color',
        '@tiptap/extension-table',
        '@tiptap/extension-table-cell',
        '@tiptap/extension-table-header',
        '@tiptap/extension-table-row',
        '@tiptap/extension-text-align',
        '@tiptap/extension-text-style',
        '@tiptap/extension-underline',
        'katex',
        'valibot',
      ],
    },
  },
  icon: {
    clientBundle: {
      scan: true,
      icons: [
        // nuxt ui defaults
        'lucide:arrow-down',
        'lucide:arrow-left',
        'lucide:arrow-right',
        'lucide:arrow-up',
        'lucide:circle-alert',
        'lucide:check',
        'lucide:chevrons-left',
        'lucide:chevrons-right',
        'lucide:chevron-down',
        'lucide:chevron-left',
        'lucide:chevron-right',
        'lucide:chevron-up',
        'lucide:x',
        'lucide:copy',
        'lucide:copy-check',
        'lucide:moon',
        'lucide:grip-vertical',
        'lucide:ellipsis',
        'lucide:circle-x',
        'lucide:arrow-up-right',
        'lucide:eye',
        'lucide:eye-off',
        'lucide:file',
        'lucide:folder',
        'lucide:folder-open',
        'lucide:hash',
        'lucide:info',
        'lucide:sun',
        'lucide:loader-circle',
        'lucide:menu',
        'lucide:minus',
        'lucide:panel-left-close',
        'lucide:panel-left-open',
        'lucide:plus',
        'lucide:rotate-ccw',
        'lucide:search',
        'lucide:square',
        'lucide:star',
        'lucide:circle-check',
        'lucide:monitor',
        'lucide:lightbulb',
        'lucide:upload',
        'lucide:triangle-alert',
      ],
    },
  },
});
