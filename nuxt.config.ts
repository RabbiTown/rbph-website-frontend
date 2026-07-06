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

  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxtjs/mdc', '@vueuse/nuxt'],
  css: ['katex/dist/katex.min.css', '~/assets/css/main.css'],
  ssr: false,
  image: {
    provider: 'none',
  },
  icon: {
    customCollections: [
      {
        prefix: 'tabler',
        dir: './app/assets/icons/tabler',
      },
    ],
  },
  mdc: {
    components: {
      prose: true,
    },
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
        '@codemirror/state',
        '@codemirror/view',
        '@internationalized/date',
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
});
