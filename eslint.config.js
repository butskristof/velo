// @ts-check
import base from './eslint.base.js';

// fallback config: every file that has no nearer eslint.config.* above it
// such as root-level scripts and planning, and the Aspire AppHost.
// app packages are not listed here: they own a config file because @nuxt/eslint
// generates one inside the package.
//
// No ignores for build output: antfu's `gitignore: true` reads the root .gitignore,
// which already covers node_modules/, dist/, .aspire/, ...
export default base({
  ignores: [
    // not source code to lint, prose and captured sample data or examples
    'planning/**',

    // Committed, but not ours to author: eg `playwright-cli install` generates config
    // and skills are markdown and code as well but should not be linted by us
    '.playwright/**',
    '.agents/skills/**',
    '.claude/skills/**',
  ],
});
