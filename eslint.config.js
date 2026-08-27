// @ts-check
import base from './eslint.base.js'

// The fallback config: every file that has no nearer eslint.config.* above it.
// Today that is root-level scripts and planning/; from phase 5 it also covers
// apphost/. The app packages are not listed here — they own a config file,
// because @nuxt/eslint generates one inside the package.
//
// No ignores for build output: antfu's `gitignore: true` reads the root .gitignore,
// which already covers node_modules/, dist/ and .aspire/.
export default base({
  ignores: [
    // Prose and captured sample data, not source. antfu lints fenced code blocks
    // inside markdown and every key of a .json file, which on planning docs and a
    // vendored GBFS feed is pure noise.
    'planning/**',
  ],
})
