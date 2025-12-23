import { env } from 'process';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

if (env.https_proxy) {
  const dispatcher = new ProxyAgent({ uri: new URL(env.https_proxy).toString() });
  setGlobalDispatcher(dispatcher);
}

const isDev = process.env.NODE_ENV !== 'production';
const devProxyConfig = isDev
  ? {
      '/api': {
        target: 'http://127.0.0.1:9999',
        changeOrigin: true,
      },
    }
  : undefined;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxtjs/mdc', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  ssr: false,
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
  nitro: devProxyConfig ? { devProxy: devProxyConfig } : undefined,
  vite: devProxyConfig
    ? {
        server: {
          proxy: devProxyConfig,
        },
      }
    : undefined,
});
