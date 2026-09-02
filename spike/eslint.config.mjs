// @ts-check
import base from '../eslint.base.js';
import withNuxt from './.nuxt/eslint.config.mjs';

// `prepend`, not `withNuxt(base(...))`. The latter is `configs.clone().append(...)`,
// which puts our config last and lets it win — including over Nuxt's
// `nuxt/disables/routes` layer, which is the thing that exempts pages, layouts and
// error.vue from vue/multi-word-component-names. House style first, framework
// knowledge last. `withNuxt()` with no arguments still installs the typegen hook.
//
// The relative import crosses the package boundary, which resolves fine under plain
// Node semantics: @antfu/eslint-config is looked up from eslint.base.js's own
// directory, so it finds the root node_modules.
export default withNuxt().prepend(base({ vue: true }));
