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

    // Committed, but not ours to author: `playwright-cli install` generates the
    // config and skills.sh vendors the skill. Linting them is a fight we cannot win,
    // because the fix is overwritten by the next install or `skills update` — the
    // same argument as `jsonc/sort-keys` on Nuxt's tsconfig in phase 2.2. Concretely
    // today, cli.config.json ships without a trailing newline and trips
    // `style/eol-last`. The skill files happen to pass, which is luck rather than
    // design and not worth depending on.
    '.playwright/**',
    '.agents/skills/**',
    '.claude/skills/**',
  ],
})
