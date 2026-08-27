// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint'],
  eslint: {
    config: {
      // Contribute only the Nuxt-specific rules. The JS, TS and Vue plugin setup
      // comes from @antfu/eslint-config via ../eslint.base.js.
      standalone: false,
    },
  },
})
