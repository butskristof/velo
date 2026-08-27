// @ts-check
import antfu from '@antfu/eslint-config'

/**
 * Rules we want back that antfu switches off. Only appended when Vue is enabled —
 * referencing vue/* rules without the plugin registered is a config error waiting to
 * happen in a non-Vue package.
 *
 * @type {import('eslint').Linter.Config}
 */
const vueHouseRules = {
  name: 'velo/vue/rules',
  files: ['**/*.vue'],
  rules: {
    // vue3-essential, and antfu turns it off. Single-word names can collide with
    // existing and future HTML elements. Nuxt's own `nuxt/disables/routes` layer
    // switches this back off for the route-driven directories, where the filename
    // is a routing contract rather than a tag you write.
    'vue/multi-word-component-names': 'error',
  },
}

/**
 * @type {import('eslint').Linter.Config}
 */
const tsconfigRules = {
  name: 'velo/tsconfig/rules',
  files: ['**/tsconfig.json', '**/tsconfig.*.json'],
  rules: {
    // antfu's `antfu/sort/tsconfig-json` enforces a canonical key order. Nuxt
    // scaffolds tsconfig.json in a different order and attaches a doc comment to
    // the first key, so the autofix orphans the comment — and a fresh scaffold
    // produces the original order again. Not a fight worth having on a generated
    // file. package.json sorting stays on; nothing regenerates that.
    'jsonc/sort-keys': 'off',
  },
}

/**
 * House style for the whole workspace. This is the only place it is defined.
 *
 * A factory rather than a config value, for two reasons: each config file gets its
 * own composer instead of two files sharing one mutable instance, and each package
 * can declare its own flavour without restating the style rules.
 *
 * @param {import('@antfu/eslint-config').OptionsConfig} [options] merged over the defaults below
 * @param {...import('eslint').Linter.Config} configs appended after the preset
 */
export default function base(options = {}, ...configs) {
  const resolved = {
    // Both of these are pinned rather than left to antfu's autodetection, which
    // asks "is this package resolvable?" — and npm workspaces hoist the spike's
    // `vue` into the root node_modules, so that question answers "yes" even from
    // the apphost. Left on autodetect, a non-Vue package silently gets the Vue
    // plugin and, worse, `antfu/vue/setup` declares `ref`, `computed`, `watch`
    // and friends as globals with no `files` scope, i.e. repo-wide.
    // So: off by default, and a Vue package opts in with `base({ vue: true })`.
    typescript: true,
    vue: false,

    // The Prettier bridge for css/html/markdown/svg. Off, so a .vue `<style>`
    // block gets no formatting. Turn on as `{ css: true }` if that starts to
    // hurt — it cannot reach ts or vue script. See planning/repo-setup.md.
    formatters: false,

    // Mirrors .editorconfig. antfu's other stylistic defaults stand.
    stylistic: {
      indent: 2,
      quotes: 'single',
    },

    ...options,
  }

  return antfu(
    resolved,
    tsconfigRules,
    ...resolved.vue ? [vueHouseRules] : [],
    ...configs,
  )
}
