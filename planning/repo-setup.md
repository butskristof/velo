# Repo setup — walkthrough and checks

Purpose: get the workspace, tooling, and agent context right once, before any real
implementation starts, so technicalities stop being a decision every time.

Status: not started. Work through the phases in order. Phase 5 (Aspire) can be its
own session.

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
│  ├─ eslint.config.mjs     withNuxt(base)
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

- [ ] **2.1 Install at the root**: `eslint` and `@antfu/eslint-config` as root
      devDependencies. Check the resolved ESLint major immediately, it changes 2.5.

- [ ] **2.2 `eslint.base.js` at the root.** Exports the antfu preset plus our
      overrides. This is the only place house style is defined. Not an ESLint config
      file by itself, just a module both real configs import.
      Turn off antfu's formatters we do not want and set `vue: true`.

- [ ] **2.3 Root `eslint.config.js`.** Imports the base, adds
      `ignores: ['spike/**', 'app/**', 'apphost/.aspire/**']`. This config governs
      the apphost and any root-level scripts.

- [ ] **2.4 Add the Nuxt ESLint module to the spike**: `npx nuxi module add eslint`
      run inside `spike/`. Then set `eslint: { config: { standalone: false } }` in
      `spike/nuxt.config.ts`, so the module contributes only its Nuxt-specific rules
      instead of duplicating the JS, TS, and Vue plugin setup antfu already brings.

- [ ] **2.5 `spike/eslint.config.mjs`**:

      ```js
      // @ts-check
      import base from '../eslint.base.js'
      import withNuxt from './.nuxt/eslint.config.mjs'

      export default withNuxt(base)
      ```

      The relative import across the package boundary resolves fine under plain
      Node semantics. `@antfu/eslint-config` is resolved from `eslint.base.js`'s
      own directory, so it correctly finds the root `node_modules`.

- [ ] **2.6 Lint scripts.** Root: `"lint": "eslint ."` and
      `"lint:fix": "eslint . --fix"`. Whether one root invocation is enough depends
      on 2.1:

      | ESLint major | Behaviour | What to do |
      | --- | --- | --- |
      | 10.x | Config lookup starts at each linted file and searches up. Nested configs are the default. | `eslint .` from the root is sufficient. |
      | 9.x | Lookup is cwd-based; a root run will not find `spike/eslint.config.mjs`. | Either `--flag v10_config_lookup_from_file`, or per-workspace `lint` scripts plus `npm run lint --workspaces --if-present`. |

      Also confirm antfu's peer range accepts the ESLint major you ended up on.

**Checks**

1. `npx eslint spike/app/app.vue --no-fix` reports rules from both sources. Prove it
   by introducing one violation of each: a Vue-specific one such as a multi-word
   component name for the `vue/*` layer, and a stylistic one such as double quotes
   for antfu's layer.
2. `npx eslint --print-config spike/app/app.vue` lists both `nuxt/*` and antfu's
   `@stylistic/*` rules, and does not list the same plugin twice. Double-listing
   means `standalone: false` did not take.
3. `npm run lint` from the root covers both the root-level files and the spike, with
   the right rules for each. Confirm by planting a violation in a root-level `.ts`
   file and one in a `.vue` file, then running once.
4. `npm run lint` on a clean tree exits 0 and reports no parser errors from
   `planning/` or generated directories.

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
  scope it so it can never touch ts or vue.
- Making the Nuxt app runnable without Aspire. The full local environment is the
  point of Aspire, and the provider abstraction gives us the standalone path for free
  later if container startup ever hurts in tight agent loops.
- Renaming `spike/` to `app/`. The spike gets deleted, not promoted. `app/` is
  scaffolded fresh and inherits all of the above on day one.
