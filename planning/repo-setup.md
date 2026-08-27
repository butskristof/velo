# Repo setup — walkthrough and checks

Purpose: get the workspace, tooling, and agent context right once, before any real
implementation starts, so technicalities stop being a decision every time.

Status: phases 1 and 2 done. Work through the rest in order. Phase 5 (Aspire) can be
its own session.

## The shape we are building toward

The repo root is the workspace. It holds shared tooling and is what you open in
WebStorm and where agent sessions start. Each package below it owns only the config
that genuinely cannot be hoisted.

```
velo/
├─ .editorconfig            root = true, cascades to everything
├─ .node-version            24.20.0
├─ package.json             private workspaces root, type: module
├─ package-lock.json        the only lockfile
├─ eslint.base.js           antfu preset + our overrides, imported by both configs
├─ eslint.config.js         base + ignores for the app packages
├─ CLAUDE.md                repo map, how to run things
├─ apphost/                 Aspire TS AppHost (phase 5)
├─ spike/                   throwaway Nuxt app
│  ├─ eslint.config.mjs     withNuxt().prepend(base({ vue: true }))
│  ├─ .claude/skills/       impeccable-style, scoped as spike:<name>
│  └─ nuxt.config.ts        eslint.config.standalone = false
└─ planning/
```

### Decisions already made

| Question | Answer | Why |
| --- | --- | --- |
| WebStorm project root | Repo root | IDE features resolve per-package, not per-project-root. Opening the root keeps VCS coherent and makes agent changes visible in the diff view. |
| Config placement | Per-package where forced, root otherwise | Makes the WebStorm choice reversible. Nothing depends on which folder is the project root. |
| Package manager | npm workspaces | One install, one lockfile, unambiguous resolution for the shared ESLint preset. |
| AppHost location | `apphost/`, not the root | Its tsconfig needs to be node-flavoured and point at the generated `.aspire/` SDK. At the root it would implicitly claim the whole tree and fight the Nuxt TS service. |
| ESLint formatting | antfu `@stylistic` rules, no Prettier | Two formatters on save is the classic tarpit. |
| impeccable-style skill | `spike/.claude/skills/` | Trials the directory-scoped mechanism. The spike is throwaway, so re-installing into `app/` later is expected, not a cost. |

### Already done

- [x] `FNM_VERSION_FILE_STRATEGY=recursive` in `.zshrc`, so `.node-version` at the
      root applies in every subdirectory terminal. Verify with phase 1 check 3.

---

## Phase 1 — Workspace root

- [x] **1.1 `.editorconfig` at the repo root**, with `root = true`. Covers ts, vue,
      js, json, md, yml. Keep it small: charset, indent, final newline, trim
      trailing whitespace. Resist the urge to encode style rules here that ESLint
      already owns.

- [x] **1.2 `.node-version` at the repo root**: `24.20.0`, the current LTS.

- [x] **1.3 Root `package.json`.** Private, no version, `type: module`.
      Workspaces: `["spike"]` only. npm errors on a listed workspace that is not on
      disk, so `"apphost"` gets added in phase 5.2 and `"app"` whenever it is
      scaffolded.
      Include `engines.node` matching `.node-version` (fnm has
      `FNM_RESOLVE_ENGINES=true`, so this is a working fallback, not decoration).

- [x] **1.4 Adopt the spike into the workspace.** Order matters:
      1. `rm -rf spike/node_modules spike/package-lock.json`
      2. `npm install` from the repo root

      This produces one hoisted `node_modules` and one lockfile at the root. The
      root `.gitignore` already covers `node_modules/`, so nothing to change there.

- [x] **1.5 Tidy the root `.gitignore`.** Dropped the stale
      `# (expand when Nuxt app is scaffolded: .nuxt, .output, ...)` comment and
      nothing more. Each workspace covers its own build output:
      `spike/.gitignore` already handles the Nuxt directories and will travel with
      `app/` when that gets scaffolded. Do not re-add root-level `.nuxt/` style
      patterns as a safety net; a package that ships without its own ignore file is
      a bug to fix in that package.

**Checks** — all pass, run 2026-08-27.

1. Pass. `npm ls --workspaces --depth 0` lists `spike@ -> ./spike` with nuxt, vue and
   vue-router. It also labels root-level `cac` and `commander` as extraneous. They
   are legitimate transitive dependencies of `@bomb.sh/tab` via `@nuxt/cli`, they are
   in the lockfile, and npm simply mislabels packages hoisted out of a workspace.
   Ignore it rather than pruning.
2. Pass, with one correction to the check itself. `spike/package-lock.json` is gone,
   there is one lockfile at the root, and `nuxt` resolves to
   `<root>/node_modules/nuxt`. `spike/node_modules` does still exist, but it holds
   only `.cache`, which is Nuxt's own cache directory rather than an npm install
   root. Its presence is not a failure.
3. Pass, in an interactive shell: `v24.20.0` at the repo root and still `v24.20.0`
   after `cd spike`, so `FNM_VERSION_FILE_STRATEGY=recursive` is doing its job.
   Note this check cannot be run through an agent's Bash tool, which reports the fnm
   default instead: non-interactive zsh does not source `.zshrc`, so the
   `--use-on-cd` hook is never loaded. Re-verify in WebStorm's built-in terminal
   during phase 3.
4. Pass. `npm -w spike run dev` from the repo root serves HTTP 200 at
   `http://localhost:3000/`, reporting Nuxt 4.5.2 with Nitro 2.13.4 and Vite 8.2.2.
5. Pass, verified by timestamp rather than existence, since a `.nuxt/` left over from
   the original scaffolding would look identical. `tsconfig.json`, `imports.d.ts` and
   `components.d.ts` were all rewritten at install time, so the spike's `postinstall`
   does run during a root workspace install. `nuxt.json` keeps its older mtime
   because `nuxt prepare` skips writes when the content has not changed.

**One npm 11.19 behaviour to know about.** The install printed
`npm warn install-scripts esbuild@0.28.2 (postinstall: node install.js)`. npm's
install-script gating skipped it. Harmless here, because `@esbuild/darwin-arm64`
ships the native binary as an optional dependency and `require('esbuild')` loads
fine. If a future dependency genuinely needs its postinstall, approve that one
package with `npm install-scripts approve <pkg>` rather than disabling the gate.

---

## Phase 2 — ESLint

The shape: one shared preset, two thin configs. `@nuxt/eslint` generates
`.nuxt/eslint.config.mjs` inside the Nuxt package and you consume it through a
relative import, which is what forces a config file to live in the app package.
Everything else hoists.

- [x] **2.1 Install at the root**: `eslint` and `@antfu/eslint-config` as root
      devDependencies. Resolved to `eslint@10.9.1` and `@antfu/eslint-config@9.3.0`,
      so 2.6 takes the 10.x row. Both peer ranges accept the major:
      `@antfu/eslint-config` wants `^9.10.0 || ^10.0.0`, `@nuxt/eslint` wants
      `^9.0.0 || ^10.0.0`.

      Also declared `typescript@^6.0.3` at the root. It was already in the tree, but
      only as a transitive dependency of `@typescript-eslint`, which typescript-eslint's
      own parser then resolves by luck of hoisting.

      The 6 versus 7 pin, since it will look arbitrary later. TypeScript 6 is the last
      of the JS-based compiler line; 7 is the native Go port, and it is already
      `dist-tags.latest` (7.0.2), so a fresh `npm i typescript` gets 7. `^6.0.3` is a
      deliberate choice to stay on the JS line rather than to follow the default.
      `vue-tsc@3.3.11` declares `typescript: ">=5.0.0"`, which admits both, so that
      range is not evidence either way about 7 readiness in Vite, Vue or Nuxt.
      Parked on purpose, not our fight. Revisit whenever `app/` wants
      `nuxt typecheck`.

- [x] **2.2 `eslint.base.js` at the root.** The only place house style is defined.
      Not a config file itself, just a module both real configs import.

      Two deviations from the sketch, both load-bearing:

      **It exports a factory, `base(options, ...configs)`, not a config value.** Two
      config files importing one module get the same object back from Node's module
      cache, and a composer is mutable. A factory also lets each package declare its
      own flavour without restating the style rules.

      **`vue` defaults to `false`, not `true`.** antfu autodetects Vue by asking
      whether the package resolves, and npm workspaces hoist the spike's `vue` into
      the root `node_modules`, so that question answers yes from the apphost too.
      Autodetect is therefore wrong here, in a way that is invisible until you look:
      the `antfu/vue/rules` config is scoped to `**/*.vue` and harmless, but
      `antfu/vue/setup` carries no `files` key and declares `ref`, `computed`,
      `watch` and friends as readonly globals repo-wide. So Vue is opt-in:
      `base({ vue: true })`. `typescript: true` is pinned for the same reason, even
      though autodetect happens to be right.

      `formatters` needs no turning off, it already defaults to `false`. Worth
      knowing what that costs, because the option is narrower than the name suggests:
      it is only the Prettier/dprint bridge, and it only ever emits configs globbed
      to `**/*.css`, `**/*.scss`, `**/*.html`, `**/*.xml`, `**/*.svg`, `**/*.md`.
      Markdown, YAML, JSONC and TOML *linting* are separate options and all still on.
      Inside a `.vue` file, `<template>` is covered by eslint-plugin-vue's own
      stylistic rules (`vue/html-indent` wired to our `indent`, `vue/html-quotes`),
      but `<style>` is not: antfu wires `eslint-processor-vue-blocks` with
      `blocks: { styles: true }`, so the block is extracted as a virtual `.css` file
      with no rule to catch it. `formatters: { css: true }` is the one-line fix if
      that starts to hurt, and it stays css-globbed, so it cannot reach ts or vue
      script.

      Two rules added back on top of the preset:

      | Rule | Files | Why |
      | --- | --- | --- |
      | `vue/multi-word-component-names: error` | `**/*.vue` | `vue3-essential`, and antfu switches it off. Single-word names collide with existing and future HTML elements. |
      | `jsonc/sort-keys: off` | `**/tsconfig.json`, `**/tsconfig.*.json` | antfu's `antfu/sort/tsconfig-json` reorders Nuxt's scaffolded tsconfig and drags its doc comment away from the key it documents. A fresh scaffold produces the original order again, so the rule never stops fighting. `package.json` sorting stays on; nothing regenerates that. |

- [x] **2.3 Root `eslint.config.js`.** `base({ ignores: ['planning/**'] })`.

      No `spike/**` or `app/**` ignore. Under ESLint 10 the root config is not
      consulted for a file that has a nearer config, so the app packages exclude
      themselves. Describing this as the apphost's config was also wrong: it is the
      fallback for anything with no nearer `eslint.config.*`, which is root scripts
      today and `apphost/` from phase 5.

      No `apphost/.aspire/**` ignore either. `gitignore: true` is on by default and
      reads the root `.gitignore`, which already covers `.aspire/`, `node_modules/`
      and `dist/`.

      `planning/**` is ignored because antfu lints fenced code blocks inside markdown
      and every key of a `.json` file. On planning docs and a vendored GBFS feed that
      produced 70-odd reports about illustrative snippets and escaped slashes.

- [x] **2.4 Add the Nuxt ESLint module to the spike.** `npx nuxi module add eslint`
      run inside `spike/`, then `eslint: { config: { standalone: false } }` in
      `spike/nuxt.config.ts`.

      Check what nuxi wrote. It put both `@nuxt/eslint` **and** a second `eslint` in
      spike's `dependencies`. Moved `@nuxt/eslint` to `devDependencies` and dropped
      the `eslint` entry: it is a root devDependency, hoisted, and
      `require.resolve('eslint')` from `spike/` lands on
      `<root>/node_modules/eslint`, which also satisfies `@nuxt/eslint`'s peer
      requirement. `@nuxt/eslint` stays declared in spike, since a Nuxt module belongs
      to its package rather than the workspace. One declaration per tool, one place to
      bump.

- [x] **2.5 `spike/eslint.config.mjs`.** The sketch had `withNuxt(base)`. That
      composes in the wrong order:

      ```js
      export default withNuxt().prepend(base({ vue: true }))
      ```

      `withNuxt(...customs)` is `configs.clone().append(...customs)`, so our config
      lands last and wins. That silently defeats `nuxt/disables/routes`, the layer
      that switches `vue/multi-word-component-names` back off for the route-driven
      directories. Verified rather than assumed: with `append`, `pages/about.vue`,
      `layouts/default.vue`, `error.vue` and a nested
      `components/user/card.vue` all reported. With `prepend`, only
      `components/card.vue` does, which is correct, since that is the one whose tag
      really is `<Card>`.

      Nuxt's scoping is also better than anything worth hand-rolling. Its globs are
      `app/app.*`, `app/error.*`, `app/layouts/**`, `app/pages/**` and
      `app/components/*/**` — subdirectories only, because Nuxt prefixes nested
      components with their directory, so `components/user/card.vue` is already
      `<UserCard>`.

      House style first, framework knowledge last, is the right rule generally: all
      five configs Nuxt contributes are framework-specific
      (`vue/no-multiple-template-root`, `nuxt/prefer-import-meta`,
      `nuxt/no-page-meta-runtime-values`, `nuxt/no-nuxt-config-test-key`, and the
      disable above) and none touches house style. `withNuxt()` with no arguments
      still installs the typegen hook.

- [x] **2.6 Lint scripts.** Root `"lint": "eslint ."` and
      `"lint:fix": "eslint . --fix"`. On ESLint 10 one root invocation is enough;
      the table below was the deciding factor and 2.1 landed on 10.x.

      | ESLint major | Behaviour | What to do |
      | --- | --- | --- |
      | 10.x | Config lookup starts at each linted file and searches up. Nested configs are the default. | `eslint .` from the root is sufficient. |
      | 9.x | Lookup is cwd-based; a root run will not find `spike/eslint.config.mjs`. | Either `--flag v10_config_lookup_from_file`, or per-workspace `lint` scripts plus `npm run lint --workspaces --if-present`. |

**Checks** — all pass, run 2026-08-27.

1. Pass, with a correction to the check itself. A multi-word component name proves
   nothing while antfu has that rule off, which is what prompted turning it back on
   in 2.2. Three violations in one probe component report from three distinct layers:
   `style/quotes` (antfu's `@stylistic`, renamed to `style/*`), `vue/html-quotes`
   and `vue/prefer-template`. The two `vue/*` rules only fire inside `<template>`,
   which no core rule can reach, so they are the better probe.
2. Pass, but not via `--print-config`, which serialises the `plugins` object
   array-like and loses the names. Resolving the composer directly is the real check:
   52 configs, 20 plugin aliases, each mapping to exactly one plugin object. Order is
   antfu 0-43, `velo/vue/rules` 44, `nuxt/*` 45-51.
3. Pass. One `npm run lint` from the root reported `style/quotes` on a root-level
   `.ts` file and both `vue/multi-word-component-names` and `vue/html-quotes` on a
   spike component, in a single run.
4. Pass, exit 0, after the three fixes in 2.2 and 2.3. `npm run lint:fix` also
   reordered the root `package.json` keys via `antfu/sort/package-json`, which is
   wanted.

---

## Phase 3 — WebStorm

All of these are IDE settings, not files, so they are yours to click through. None of
them cascade or get committed, which is why they are worth writing down.

- [ ] **3.1 Open the repo root** as the project. Close the `spike/` project if it is
      open, to avoid two indexes over the same files.

- [ ] **3.2 Node interpreter**: point at
      `~/.local/share/fnm/node-versions/v24.20.0/installation/bin/node`.
      Not the path `fnm env` prints, which lives under
      `.local/state/fnm_multishells/` and is per-shell and ephemeral. WebStorm never
      reads `.node-version`; this setting is the only thing that governs the editor,
      inspections, and run configurations.

- [ ] **3.3 ESLint**: Automatic configuration. It resolves the nearest config and
      the nearest `eslint` binary per file, which is exactly the nested layout we
      built. Enable "Run eslint --fix on save".

- [ ] **3.4 Prettier**: confirm it is not running on save or on reformat. The
      existing `.idea/prettier.xml` is a setting rather than a dependency, so this
      is a checkbox, not an uninstall.

**Checks**

1. Open a `.vue` file in the spike. Nuxt auto-imports resolve (no red squiggle on an
   unimported `ref` or a component from `app/components/`), and the Vue plugin is
   active.
2. Editorconfig indentation applies in both `spike/` and a root-level file.
3. Break style in a `.vue` file, save, and watch eslint --fix repair it. Then
   confirm nothing reformats it a second time differently, which is the tell that
   Prettier is still live.
4. `git status` in the IDE shows changes across `spike/` and root-level files in one
   changeset.

---

## Phase 4 — Agent context

- [ ] **4.1 Root `CLAUDE.md`.** The minimum that stops an agent guessing:
      where app code lives, that Aspire owns the environment, `aspire describe` for
      URLs rather than assuming a port, the lint commands, and an explicit "do not
      run `npm run dev` from the repo root". Keep it short. It loads in every
      session.

- [ ] **4.2 `spike/CLAUDE.md`.** Nuxt and Vue conventions only. Loads on demand when
      an agent touches files under `spike/`, so it costs nothing when working on the
      apphost.

- [ ] **4.3 impeccable-style into `spike/.claude/skills/`.** Check first how it is
      distributed. If it is a plugin it installs user-level and cwd is irrelevant,
      in which case there is no directory-scoping to trial and this step collapses to
      installing it normally. If it is a skill directory, copy it in and it should
      surface as `spike:<name>`.

**Checks**

1. Start a session at the repo root. The skill listing shows the impeccable-style
   skill with a `spike:` prefix. If it appears unprefixed, it installed user-level
   and the directory-scoping trial did not happen.
2. In that same root session, ask for something that touches `spike/app/app.vue` and
   confirm `spike/CLAUDE.md` gets pulled into context on demand.
3. Invoke the skill on a spike file and confirm it works from a root-cwd session
   without needing `cd`.

---

## Phase 5 — Aspire AppHost

Deferred deliberately. Run the scaffolder before deciding anything, so we are
reacting to real output instead of guessing at it.

- [ ] **5.1 `aspire init --language typescript`** at the repo root. Read what it
      produced before moving anything.

- [ ] **5.2 Move it into `apphost/`** if it landed at the root, then add `"apphost"`
      to the root workspaces array and re-run `npm install`.

- [ ] **5.3 `apphost/tsconfig.json`**, node-flavoured, referencing the generated
      `.aspire/` SDK types. Tight `include` so it cannot reach into the app packages.

- [ ] **5.4 Add the Nuxt resource** using the generic JavaScript app resource, not
      the Vite one. Nuxt runs its own dev server through Nitro and manages HMR
      itself. Give the resource a stable name; agents will address it by that name.

- [ ] **5.5 Verify the npm install interaction.** Aspire's JS app resource typically
      runs an install in the resource's working directory. Modern npm handles being
      invoked inside a workspace by doing a workspace-aware install, so this should
      be fine, but confirm it rather than discovering it later.

- [ ] **5.6 `aspire agent init --workspace-root . --skills playwright-cli`.** This is
      the skill that reads the app URL out of Aspire and drives the browser, so it
      belongs at the root where sessions start.

**Checks**

1. `aspire ls` from the root finds the AppHost.
2. `aspire start`, then `aspire ps --format Json` shows it running.
3. `aspire describe <nuxt-resource> --format Json` returns a usable URL, and the app
   answers on it. This is the contract the Playwright skill depends on.
4. `aspire logs <nuxt-resource> -n 20` returns Nitro output.
5. `npm run lint` from the root now also covers `apphost/`, with the root config's
   rules and no Vue rules leaking in.
6. Open an apphost `.ts` file in WebStorm and confirm the TS service uses
   `apphost/tsconfig.json`, not the spike's.

---

## Deliberately not doing

- A `tooling/eslint` workspace package for the shared preset. A relative import of
  `eslint.base.js` does the same job for two packages. Revisit if a third arrives.
- Prettier for md, yaml, and css. Add it only if the lack becomes annoying, and if so
  scope it so it can never touch ts or vue. antfu's `formatters` option is already
  that escape hatch, see 2.2. The concrete gap today is `<style>` blocks in SFCs.
- Making the Nuxt app runnable without Aspire. The full local environment is the
  point of Aspire, and the provider abstraction gives us the standalone path for free
  later if container startup ever hurts in tight agent loops.
- Renaming `spike/` to `app/`. The spike gets deleted, not promoted. `app/` is
  scaffolded fresh and inherits all of the above on day one.
