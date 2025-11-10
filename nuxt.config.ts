import { env } from 'process';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

if (env.https_proxy) {
  const dispatcher = new ProxyAgent({ uri: new URL(env.https_proxy).toString() });
  setGlobalDispatcher(dispatcher);
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui'],
  ssr: false,
});
