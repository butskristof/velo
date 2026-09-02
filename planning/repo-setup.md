# Repo setup — walkthrough and checks

Purpose: get the workspace, tooling, and agent context right once, before any real
implementation starts, so technicalities stop being a decision every time.

Status: phases 1, 2, 3 and 5 done. Phase 4 done apart from 4.5 (impeccable-style),
which was always its own pass.

Open, as of 2026-09-02:

- **4.5**, and phase 4 check 7 with it. Note `.agents/skills/impeccable/` already
  exists in the working tree as *empty directories only* — `agents/`, `reference/`,
  `scripts/`, zero files. Git reports a clean tree because git does not track empty
  directories, so this is a half-finished attempt rather than committed work. Clear
  it before starting, or the install lands on top of it.
- **Phase 4 check 4**: confirm `spike/CLAUDE.md` loads on demand. Needs a session
  that did not write it, so it could not be self-checked. Ask for something touching
  `spike/app/app.vue` and watch whether the file enters context.
- **Phase 5 check 6** (WebStorm TS service on the AppHost). An IDE setting, so it is
  yours to click through; see the note under the phase 5 checks for what was done to
  make it resolvable at all.

One thing 4.5 no longer has to establish from scratch: its note wondered whether
Claude Code resolves a skill *through a symlink*. At the repo root it does — phase
5.6 installed three Aspire skills as `.agents/skills/<name>` plus a
`.claude/skills/<name>` symlink, and all three appeared in a live session's skill
listing. That leaves 4.5 testing only the *package-level* half.

## The shape we are building toward

The repo root is the workspace. It holds shared tooling and is what you open in
WebStorm and where agent sessions start. Each package below it owns only the config
that genuinely cannot be hoisted.

```
velo/
├─ .editorconfig            root = true, cascades to everything
├─ .node-version            24.20.0
├─ package.json             private workspaces root, type: module
├─ package-lock.json        the only npm lockfile
├─ skills-lock.json         skills.sh; content hash per vendored skill
├─ eslint.base.js           antfu preset + our overrides, imported by both configs
├─ eslint.config.js         base + ignores; the fallback config, see 2.3
├─ CLAUDE.md                repo map, how to run things
├─ .agents/
│  └─ skills/
│     └─ playwright-cli/    vendored via skills.sh, committed; the real files
├─ .claude/
│  ├─ settings.json         committed allowlist, once rules have earned it
│  ├─ settings.local.json   gitignored, where a rule starts life
│  └─ skills/
│     └─ playwright-cli ->  ../../.agents/skills/playwright-cli
├─ .playwright/
│  └─ cli.config.json       Playwright's pinned Chromium; personal overrides
│                           live in ~/.playwright/cli.config.json
├─ aspire.config.json       appHost.path, sdk version, packages, dashboard profiles
├─ aspire-apphost/          Aspire TS AppHost, the scaffolder's own directory name
│  ├─ apphost.mts           the app model; `spike` -> ../spike
│  ├─ eslint.config.mjs     base({ typescript: { tsconfigPath } }) + one rule, see 5.3
│  ├─ tsconfig.apphost.json the real settings; Aspire and tsx reference this name
│  ├─ tsconfig.json         extends the above, for tooling that only looks for this
│  └─ .aspire/modules/      generated SDK, gitignored, never hand-edited
├─ spike/                   throwaway Nuxt app
│  ├─ eslint.config.mjs     withNuxt().prepend(base({ vue: true }))
│  ├─ .claude/skills/       impeccable-style, scoped as spike:<name> — 4.5, pending
│  ├─ CLAUDE.md             Nuxt and Vue conventions, loads on demand
│  └─ nuxt.config.ts        eslint.config.standalone = false
└─ planning/
```

`.playwright-cli/` is not in that tree on purpose: it is where the CLI writes page
snapshots at runtime, and it is gitignored.

### Decisions already made

| Question | Answer | Why |
| --- | --- | --- |
| WebStorm project root | Repo root | IDE features resolve per-package, not per-project-root. Opening the root keeps VCS coherent and makes agent changes visible in the diff view. |
| Config placement | Per-package where forced, root otherwise | Makes the WebStorm choice reversible. Nothing depends on which folder is the project root. |
| Package manager | npm workspaces | One install, one lockfile, unambiguous resolution for the shared ESLint preset. |
| AppHost location | `aspire-apphost/`, not the root | Its tsconfig needs to be node-flavoured and point at the generated `.aspire/` SDK. At the root it would implicitly claim the whole tree and fight the Nuxt TS service. The name is the scaffolder's, not ours: `aspire init` never offered the root, and any subdirectory satisfies the actual requirement. Renaming was available and declined — see 5.2. |
| Nuxt resource type | `addViteApp` | Aspire's own documented resource for Nuxt, and it registers the http endpoint with `PORT` for free, which Nuxt honours. The plan's "not the Vite one, Nuxt manages its own HMR" was reasoning about something Aspire does not do: `ViteAppResource` adds exactly one member over `JavaScriptAppResource`, `withViteConfig`. See 5.4. |
| Aspire MCP server | No | Same argument as Playwright MCP one row down: 15 tool schemas in context whether or not an AppHost is running. `aspire describe` / `logs` / `ps` over Bash is what the phase 5 checks use and it is enough. Aspire's own docs agree that skills come first. |
| Aspire skills source | skills.sh from `microsoft/aspire-skills`, not `aspire agent init` | Consistent with 4.3. The installer gives no lockfile entry, and it additionally wants to write a `.mcp.json` and re-add the user-level telemetry hook. Going through skills.sh avoids both and makes a forgotten refresh a visible diff. |
| ESLint formatting | antfu `@stylistic` rules, no Prettier | Two formatters on save is the classic tarpit. |
| impeccable-style skill | `spike/.claude/skills/` | Trials the directory-scoped mechanism. The spike is throwaway, so re-installing into `app/` later is expected, not a cost. |
| Browser tooling | `playwright-cli` plus its skill, not Playwright MCP | Playwright's own guidance for coding agents. MCP fronts ~26 tool schemas that sit in context whether or not a browser is ever opened; the skill body loads only when invoked. MCP is for long-running loops that need persistent introspection, which is not this. |
| Playwright CLI install | Root devDependency | The skill ships *inside* the npm package, so its version is pinned to the CLI's. A global install plus a committed skill copy drift apart silently, and `npm i -g` lands under whichever Node fnm happened to have active. |
| Playwright skill source | skills.sh from `microsoft/playwright-cli`, not `aspire agent init` and not `playwright-cli install --skills` | All three deliver byte-identical files, verified by diff, so the only difference is what tracks the version. skills.sh is the one that gives the skill a lockfile entry and an `update` command, which turns a forgotten refresh into a visible diff. |
| Vendored skill layout | `.agents/skills/` holds the files; `.claude/skills/` symlinks in | skills.sh's own layout, and the only one that survives `skills update`. `add -a claude-code` writes real files straight into `.claude/skills/` with no `.agents/`, which is tidier, but any later `update` reverts it. Keeping the tool's layout means the bump stays one command, which is the entire reason 4.3 chose skills.sh. See 4.3. |
| Playwright browser config | `.playwright/cli.config.json` committed; personal overrides in `~/.playwright/cli.config.json` | The CLI reads both and merges them, so the repo can carry a portable config while a machine-specific browser choice stays out of git. See 4.3 for the precedence, which is not what you would guess. |
| Lint on agent edit | No | A `PostToolUse` hook would reformat between the small sequential edits agents make to one file, so the first lint rewrites under the next edit's feet and the diff turns to noise. Style goes in `CLAUDE.md`; `npm run lint:fix` runs once when the work is done. |

### Already done

- [x] `FNM_VERSION_FILE_STRATEGY=recursive` in `.zshrc`, so `.node-version` at the
      root applies in every subdirectory terminal. Verify with phase 1 check 3.

- [x] `fnm default 24.20.0`, so the `default` alias matches `.node-version`.
      Added in phase 4. The alias is the fallback for everything that cannot read
      `.node-version` — GUI launches, non-interactive shells, `npm i -g` — and it was
      24.16.0, which is the single shared cause of phase 3.2's WebStorm symptom and
      the stray global `@playwright/cli` in phase 4 check 1. This does not replace
      `.node-version`; it makes the fallback harmless when the strategy above does not
      apply. Verify with `readlink ~/.local/share/fnm/aliases/default`.

- [x] `ASPIRE_CLI_TELEMETRY_OPTOUT=true` in the `env` block of
      `~/.claude/settings.json`, and in `.zshrc` for `aspire` run from a terminal.

      Aspire CLI 13.5 changed behaviour here: `aspire agent init` now writes a
      `PostToolUse` hook with `matcher: "*"` into the *user-level*
      `~/.claude/settings.json`, pointing at `~/.aspire/hooks/track-telemetry.sh`.
      13.4.6 did not, and no Aspire doc mentions it. It is installed regardless of
      which skills you select, verified with `--skills playwright-cli` alone.

      What the script does, since a global hook on every tool call deserves reading
      rather than trusting: the opt-out check is line 75 and `rawInput=$(cat)` is
      line 127, so when the variable is set it exits before reading the payload at
      all. Unset, it sees every `PostToolUse` payload including `tool_input`, but
      only forwards events matching an allowlist of the six Aspire skill names or an
      `aspire-*` / `mcp__aspire__*` tool prefix, and for reference files forwards
      only the path after `skills/<skill>/`. It is defensively written.

      **The `.zshrc` export alone is not sufficient**, which is the phase 1 check 3
      trap wearing different clothes. The hook's command is `bash <script>` with no
      `-l` and no `-i`, so it never sources `.zshrc`; the variable reaches it only by
      inheritance from the Claude Code process. That holds for `claude` launched from
      an interactive shell and fails for a WebStorm run configuration, a GUI
      launcher, or a scheduled agent. The `env` block in `~/.claude/settings.json` is
      what makes it launch-method-proof, and it sits next to the hook it disarms.

      Disarming rather than deleting is deliberate: phase 5's `aspire agent init`
      re-adds the hook, and there is no winning a fight with an installer.

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

By phase 4 the same warning lists three: `esbuild@0.28.2`, `fsevents@2.3.3` and
`unrs-resolver@1.12.2`. The list grows because npm reports every uncovered install
script in the tree on each install, not just the new ones, and `unrs-resolver`
arrived with `@antfu/eslint-config` in phase 2. Same reasoning, still harmless: all
three ship their native binary as an optional platform dependency, and ESLint and
Vite both work.

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

      Phase 4 added three more ignores, on one principle: committed, but not ours to
      author. `.playwright/**` is generated by `playwright-cli install`, and
      `.agents/skills/**` plus the `.claude/skills/**` symlink into it are vendored by
      skills.sh. Linting them cannot be won, because the fix is overwritten by the
      next install or `skills update`. That is the `jsonc/sort-keys` argument from 2.2
      applied to a whole directory instead of a rule.

      The concrete trigger was `style/eol-last` on `.playwright/cli.config.json`,
      which the CLI writes without a trailing newline. `lint:fix` would have silenced
      it in one character and re-broken on the next machine. The skill's markdown
      passed on its own, which is luck rather than design: a future upstream revision
      could introduce a violation in files the doc forbids editing, and this closes
      that off before it happens. Both `CLAUDE.md` files are deliberately *not*
      ignored, since those are ours, and they lint clean.

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
them cascade or get committed: the root `.gitignore` carries `.idea/*`, so nothing
under `.idea/` is tracked. That is the point of writing them down. This section is
the checklist to redo on a new machine, and it is the only record that these values
were ever chosen deliberately.

Run against WebStorm 2026.2.1 (build 262.9437.145). Two of the four steps turned out
to be already correct, one was actively wrong, and one had moved.

- [x] **3.1 Open the repo root** as the project. Already true, and there was nothing
      to close: `spike/.idea` does not exist, so the spike was never opened as its
      own project.

- [x] **3.2 Node interpreter**: point at
      `~/.local/share/fnm/node-versions/v24.20.0/installation/bin/node`.
      Not the path `fnm env` prints, which lives under
      `.local/state/fnm_multishells/` and is per-shell and ephemeral. WebStorm never
      reads `.node-version`; this setting is the only thing that governs the editor,
      inspections, and run configurations.

      **The settings page has moved.** It is `Languages & Frameworks | JavaScript
      Runtime`, not `Languages & Frameworks | Node.js`. JetBrains folded the Node.js
      page into a runtime page that also carries Bun, and their current help gives
      the new path throughout with no mention of the old one. The field is
      `Node runtime`.

      This step fixes an observed symptom rather than being hygiene. Before it,
      `workspace.xml` held no `nodejs_interpreter_path` at all, so WebStorm
      autodetected node off `PATH` and landed on fnm's `default` alias, which points
      at v24.16.0:

      ```
      ~/.local/share/fnm/aliases/default -> .../node-versions/v24.16.0/installation
      ```

      That is the version the `spike > dev` run configuration reported before this
      change, and the same reason `javascript.nodejs.core.library.configured.version`
      was pinned at `24.16.0`. It is also why an agent's Bash tool reports v24.16.0:
      same PATH fallback, same alias. `.node-version` was never the thing that was
      wrong.

      Setting `Node runtime` also repointed `Package manager` from a bare
      PATH-resolved `npm` to v24.20.0's npm 11.19.0, so the IDE and an interactive
      shell now agree on the install-script gating behaviour recorded in phase 1.

- [x] **3.3 ESLint**: Automatic configuration. It resolves the nearest config and
      the nearest `eslint` binary per file, which is exactly the nested layout we
      built. Enable "Run eslint --fix on save".

      Both were already set before the phase started; `.idea/jsLinters/eslint.xml`
      had `fix-on-save = true`. Worth noting that the mode is not written to that
      file when it is Automatic, so the radio cannot be read off disk and has to be
      eyeballed.

- [x] **3.4 Prettier**: **`Disable Prettier`**, not the checkboxes.

      The plan said to confirm it was not running. It was: `.idea/prettier.xml` had
      `myRunOnSave = true`, plus `Run on paste`. Armed rather than firing, because
      Prettier is not installed anywhere in the tree. Nothing in `node_modules`, and
      `require.resolve('prettier')` throws, so Automatic mode had nothing to activate
      on. It becomes live the moment any dependency drags Prettier into the hoisted
      `node_modules`, silently.

      Disabling outright is one radio and closes it permanently. It also disposes of
      `Prefer Prettier configuration to IDE code style`, which is the sneakier of the
      three: it does not run Prettier, it makes the IDE's own formatter read a
      `.prettierrc` for indent and quotes, so it could override `.editorconfig`
      without any formatting on save. We lose the manual "Reformat with Prettier"
      action, which we do not want.

- [x] **3.5 EditorConfig support** (not in the original plan). `Editor | Code Style`,
      `Enable EditorConfig support`. It is the prerequisite for check 2 and the plan
      simply assumed it. `Detect and use existing file indents for editing` stays on:
      it is why a file with rogue indentation keeps it while being edited, and
      `eslint --fix` is the thing that corrects it on save.

**Checks** — all pass, run 2026-08-27.

1. Pass. `spike/app/app.vue`: an unimported `ref` resolves, and so do
   `<NuxtRouteAnnouncer>` and `<NuxtWelcome>`. No `app/components/` to test against
   yet, so the Nuxt-provided components are the available probe.
2. Pass, two-space indent in both `spike/` and a root-level file.
3. Pass. `class='foo'` in a template, saved, came back as `class="foo"` via
   `vue/html-quotes`, and no second differing reformat followed.
4. Pass. One changeset holding `spike/app/app.vue` and `eslint.base.js`.
5. Pass, and this closes phase 1 check 3 in the environment that can actually run it.
   WebStorm's built-in terminal reports `v24.20.0` at the root and still `v24.20.0`
   after `cd spike`.
6. Pass. The `spike > dev` npm run configuration reports Nuxt 4.5.2 on Node v24.20.0
   and serves on `http://localhost:3000/`. Its `Node runtime` and `Package manager`
   are both set to `Project`, so they inherit 3.2, and `Store as project file` is
   unchecked, so the configuration lives in `workspace.xml` and stays out of git.
   That inheritance is the thing to check first if a run configuration ever reports
   an unexpected Node version.

`spike/README.md` was rewritten as part of this. The scaffolded Nuxt starter README
told you to `npm install` in the package and offered pnpm, yarn, and bun, all of
which phase 1.4 deliberately undid. It now carries the two dev commands and points
at Aspire as the intended entry point.

---

## Phase 4 — Agent context

Two kinds of thing live here, and they behave differently. `CLAUDE.md` files are
ours, hand-written, and cheap: the root one loads every session, a nested one loads
only when an agent touches that subtree. Skills are vendored third-party files whose
*descriptions* are always in context (tens of tokens) but whose bodies only load on
invocation (1,500 to 3,000 tokens each, measured across the Aspire and Playwright
bundles). So the marginal cost of an installed-but-unused skill is near zero, and the
real cost is mis-triggering. That is the filter: not "is this cheap" but "will this
fire when I do not want it, and does it beat a paragraph in `CLAUDE.md`".

By that filter most of what is available loses to `CLAUDE.md`, which is why this
phase installs exactly one skill.

- [x] **4.1 Root `CLAUDE.md`.** The minimum that stops an agent guessing:
      where app code lives, that Aspire owns the environment, `aspire describe` for
      URLs rather than assuming a port, the lint commands, and an explicit "do not
      run `npm run dev` from the repo root". Keep it short. It loads in every
      session.

      Add one sentence on the browser handoff, which is the whole reason the two
      tools sit next to each other: ask Aspire for the frontend URL, then drive
      `playwright-cli` at it. Never assume `localhost:3000`.

      House code style goes here too, since 4.4 rules out enforcing it per edit. Keep
      it to what ESLint cannot express or an agent will not infer from neighbouring
      files, and remember `npm run lint:fix` is the enforcement mechanism.

      **Written against today's repo, not phase 5's.** Aspire does not exist yet, so
      telling an agent to run `aspire describe` would send it at a binary this repo
      has no AppHost for. The file says the port is 3000 today *because* `spike` is
      the only server, and names `aspire describe <resource> --format Json` as where
      the URL comes from once Aspire owns the environment. Revisit in 5.4, when the
      resource has a name worth writing down.

      Two things landed here that were discovered rather than planned, both from the
      4.3 checks: run the CLI from the repo root because config lookup is
      cwd-sensitive, and write `state-save` output into `.playwright-cli/`
      explicitly. Reasoning for both is in 4.3.

      The Node version trap from phase 1 check 3 is also written down here, because
      an agent hits it and cannot read `.zshrc` to find out why. See the note under
      the checks below.

- [x] **4.2 `spike/CLAUDE.md`.** Nuxt and Vue conventions only. Loads on demand when
      an agent touches files under `spike/`, so it costs nothing when working on the
      apphost. This is deliberately not a skill: a file scoped to a directory already
      triggers on exactly the right condition, with no description competing for
      attention and nothing to keep in sync with upstream.

      Contents, checked against the Nuxt 4.x docs rather than written from memory,
      since this is exactly where a stale Nuxt 3 habit does damage: `srcDir` is
      `app/` while `server/`, `shared/` and `public/` stay at the package root; the
      component-naming rule and the precise list of paths Nuxt exempts from it;
      `useFetch`/`useAsyncData` in setup versus `$fetch` in handlers, and why a bare
      `$fetch` in setup double-fetches; and the `standalone: false` plus `prepend`
      pairing, flagged as not-a-knob because both look like plausible things to
      change while chasing a lint error.

- [x] **4.3 Playwright CLI and its skill.** Three commands at the repo root, and
      deliberately two different tools:

      ```bash
      npm i -D @playwright/cli
      npx playwright-cli install
      npx skills@latest add https://github.com/microsoft/playwright-cli --skill playwright-cli
      ```

      `skills@latest` rather than a bare `npx skills`, so the floating version is
      explicit rather than whatever npx last cached. The skill manager itself is not
      worth pinning as a devDependency: it runs twice, at install and at bump, and
      `skills-lock.json` already pins the thing that matters.

      `playwright-cli install` writes `.playwright/cli.config.json` and nothing else.
      It downloaded no browser: `~/Library/Caches/ms-playwright/` already carried
      several Chromium builds, so expect a first run on a clean machine to be slower
      than the instant one seen here.

      `skills add` writes `SKILL.md` plus nine reference files and a
      `skills-lock.json` entry carrying a content hash. **Where** it writes them is
      not what the sketch above assumed, and the difference is worth the ink because
      it decided the committed layout:

      - The default puts the real files in `.agents/skills/playwright-cli/` and makes
        `.claude/skills/playwright-cli` a relative symlink to them. One copy, not
        two, and git stores the link as mode `120000` holding
        `../../.agents/skills/playwright-cli`. Portable on macOS and Linux; a Windows
        clone needs `core.symlinks`.
      - `add -a claude-code` instead copies the files directly into
        `.claude/skills/playwright-cli/` and creates no `.agents/` at all, which is
        what the tree diagram originally showed. Verified byte-identical to the
        default layout's files, same lockfile hash, so the choice is layout only.
      - **`skills update` does not preserve the second layout.** It rewrote
        `.agents/` and restored the symlink, and `update -a claude-code` does not
        help: it reads `claude-code` as another skill name and reports
        "Universal, Claude Code". So the copy-only layout is reachable on `add` and
        reverted by the first bump.

      Hence the decisions-table row: take the tool's own layout. Keeping it means the
      bump stays `npx skills@latest update playwright-cli`, one command, which is the
      whole reason this went through skills.sh instead of the bundled installer. The
      alternative traded that for a tidier root and would have needed a
      remove-then-add ritual documented somewhere nobody reads.

      Two smaller things the installer does, neither harmful, both surprising once:
      it stages what it writes into the git index, so `git status` shows `A` rather
      than `??` for files nothing was `git add`ed; and it prints a third-party risk
      assessment table, where Snyk rated this skill "High Risk" while Socket reported
      zero alerts. For a Microsoft-published skill whose entire job is driving a
      browser, treat that as a category judgement rather than a finding, but read
      `SKILL.md` yourself rather than taking either rating on faith.

      Speaking of which: `SKILL.md` declares
      `allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)`. The last two
      are broad enough to cover any npm or npx command while the skill is active,
      which is more than driving a browser needs. Since vendored files are never
      hand-edited, a `deny` rule is the only lever if that ever matters.

      **Why two tools rather than `playwright-cli install --skills`, which does
      both.** The skill arrives through a dependency, so without a skill manager it
      has no version of its own: refreshing it after a bump means re-running the
      installer and reading the diff, with nothing to detect a refresh that was
      forgotten. Routing it through skills.sh gives it a lockfile entry and makes
      `npx skills@latest update playwright-cli` a step in the bump routine alongside
      the npm bump. That is the same argument as one lockfile at the root in phase 1: the
      point is not the file, it is that drift becomes visible instead of silent.

      This works because `microsoft/playwright-cli` is the CLI's live repo and
      publishes the skill at `skills/playwright-cli/SKILL.md`. Two adjacent guesses
      are both wrong and cost a detour: `microsoft/playwright` exposes four skills to
      skills.sh, all contributor-facing (`playwright-dev`, `playwright-devops`,
      `playwright-test-results`, `playwright-triage`) and none of them this one, and
      `microsoft/playwright-mcp` exposes none at all.

      The residual trade-off, stated so it is not a surprise later: skills.sh pins to
      the repo's default branch while npm pins to a released version, so the two can
      in principle diverge. Today they do not — the repo tip is byte-identical to
      what `@playwright/cli@0.1.18` ships, and both are identical to the copy Aspire
      installs, all verified by diff. The lockfile hash is what makes a future
      divergence show up rather than pass unnoticed.

      Commit the skill directory and `skills-lock.json`. Never hand-edit the skill.
      `playwright-cli install --skills` was verified to overwrite unconditionally, by
      appending a marker line, re-running, and watching the marker and the file hash
      both change; `skills update` was not tested against a dirty file, so treat a
      local edit as lost either way rather than finding out.

      One thing that needs no flag: neither command installs
      `playwright-component-testing` or `playwright-trace`. Those come from
      `npx playwright init-skills`, a different package and a different command, and
      the reasons for skipping them are in "Deliberately not doing".

      **The config split, which is the part worth writing down.** The CLI reads two
      files and merges them, precedence low to high:

      1. built-in defaults
      2. `~/.playwright/cli.config.json`
      3. `<cwd>/.playwright/cli.config.json`
      4. environment overrides
      5. command-line flags

      `launchOptions` merges shallowly per key, so keys from different layers
      coexist. Commit the generated project file as-is and keep machine-specific
      browser choices in the home-directory file.

      Two things about this are counterintuitive enough to be worth the ink. First,
      the merge order says the project file wins, but a global `executablePath` still
      beats a project `channel`. Verified rather than reasoned: with `channel:
      "chromium"` in the project file and an `executablePath` in the global one, the
      launched browser reported `HeadlessChrome/150.0.0.0`, matching the local
      Chromium 150.0.7871.46 and not Playwright's bundled Chrome for Testing
      152.0.7977.8. So the home-directory file is a working override for the browser
      binary despite sitting lower in the order.

      Second, deleting the project file gives *worse* isolation, not neutral. The
      generated `channel: "chromium"` selects Playwright's own pinned build under
      `~/Library/Caches/ms-playwright/`, which is reproducible for anyone cloning and
      unaffected by browsing in a personal browser. With no `browserName` at all the
      fallback is `channel: "chrome"`, meaning the actual installed Chrome. The
      generated file is actively choosing the isolated build, so keep it.

      Third, and this is the one that actually bit during the checks: the project
      file is found at `<cwd>/.playwright/cli.config.json`, so the lookup is
      cwd-relative and does not search upward. A shell sitting in `spike/` finds no
      config and takes the `channel: "chrome"` fallback from the paragraph above,
      which on this machine fails outright:

      ```
      Chromium distribution 'chrome' is not found at
      /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
      ```

      That is the "worse isolation" fallback arriving through a second door, and the
      failure is at least loud rather than silently using the wrong browser. Run the
      CLI from the repo root, or pass `--config`. Note the asymmetry with check 1:
      the *binary* resolves fine from `spike/` because npm hoists it, so the two
      halves of "does this work from anywhere" have different answers. Root
      `CLAUDE.md` carries the rule.

      Add `.playwright-cli/` to the root `.gitignore`. That is where page snapshots
      land at runtime, and it is a different directory from `.playwright/`.

      The personal half is not a repo file, so it belongs on the new-machine
      checklist rather than in git. `~/.playwright/cli.config.json`, only if the
      default is not wanted:

      ```json
      {
        "browser": {
          "launchOptions": {
            "executablePath": "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "headless": false
          }
        }
      }
      ```

      Dropping `executablePath` and keeping `"headless": false` is the middle option:
      headed, but Playwright's own pinned build rather than the browser you have open
      for your own reasons.

      **That middle option is what is installed.** `~/.playwright/cli.config.json`
      holds `headless: false` and nothing else, which is worth stating as a working
      example of the shallow per-key merge: the launched browser reported
      `Chrome/152.0.0.0` where the default had reported `HeadlessChrome/152.0.0.0`.
      Same 152 build, so `channel` came from the project file and `headless` from the
      home file in one `launchOptions` object.

      A related thing that reads as a browser choice and is not. `channel: "chromium"`
      resolves to Playwright's pinned build, whose macOS app bundle is named "Google
      Chrome for Testing", so a headed run looks like it opened Chrome. It did not;
      there is no Google Chrome on this machine. And **switching the binary is not how
      you get a logged-in session.** Playwright launches a throwaway profile whatever
      the binary, and this CLI defaults to in-memory, so cookies and extensions in a
      personal Chromium are invisible to it. Persistence is the lever: `open
      --persistent` / `--profile <dir>`, or `state-save` then `state-load`.

      `state-save` is the one file-writing command that does not land in
      `.playwright-cli/`. Snapshots, console logs and traces go there on their own,
      but a bare `state-save auth.json` resolves against the working directory and
      writes the repo root, and that file holds live cookies and tokens. Two
      resolvers exist in `playwright-core` — one relative to `outputDir()`, one
      relative to cwd — and this command uses the cwd one; confirmed by running it
      and finding `./probe-auth.json`. Passing `.playwright-cli/auth.json` explicitly
      puts it back inside the already-ignored directory, which beats carrying a
      gitignore pattern per plausible filename at the root. Root `CLAUDE.md` carries
      that too. There is a top-level `outputDir` config key if a future need makes
      relocating the whole directory worthwhile.

- [x] **4.4 Permissions.** Start in `.claude/settings.local.json`, which the root
      `.gitignore` already covers via `**/.claude/*.local.*`. Manual mode stays the
      default and rules get added as specific actions earn trust: `playwright-cli`,
      the lint scripts, the read-only `aspire` verbs.

      Promote a rule to a committed `.claude/settings.json` once it has proven
      itself and is not machine-specific. Nothing about this repo's permissions is
      recorded today, so the committed file is the goal rather than the starting
      point.

      No lint-on-edit hook. See the decisions table for why.

      **This step has no deliverable, which is the point.** It was briefly treated as
      "write the rules we expect to need", and that is the opposite of what the
      paragraph above says: a rule earns its place when a real action asks for it, and
      a pre-seeded allowlist is a guess wearing the costume of a decision. It also
      cannot rot into the repo, since `settings.local.json` is gitignored and belongs
      to one machine. So: policy recorded, file left to grow on its own, and 4.4 is
      done in the only sense available to it.

      Two things were worth confirming rather than assuming, because the whole
      approach rests on them. `**/.claude/*.local.*` does cover both
      `.claude/settings.local.json` and a future package-level
      `spike/.claude/settings.local.json`, checked with `git check-ignore -v`. And
      the one rule that already exists, `Bash(npx ctx7@latest *)`, arrived this way
      rather than by planning, which is the mechanism working as intended.

- [ ] **4.5 impeccable-style into `spike/.claude/skills/`.** Deferred to its own
      pass, after the rest of the phase lands. Check first how it is distributed. If
      it is a plugin it installs user-level and cwd is irrelevant, in which case
      there is no directory-scoping to trial and this step collapses to installing it
      normally. If it is a skill directory, copy it in and it should surface as
      `spike:<name>`.

      If it does arrive through skills.sh, expect the 4.3 layout rather than the path
      in this heading: files in `spike/.agents/skills/` and a `spike/.claude/skills/`
      symlink. That is fine and consistent, but it means the directory-scoping trial
      is really testing whether Claude Code resolves a package-level skill *through a
      symlink*, which is one more moving part than the plan assumed. If the skill does
      not surface as `spike:<name>`, test a plain copied directory before concluding
      that directory scoping does not work.

**Checks** — 1, 2, 5 and 6 pass, run 2026-08-27. 3 partly. 4 and 7 are session
behaviour and stay open; see below.

1. Pass, and the stray global is gone. `npm ls @playwright/cli` resolves
   `@playwright/cli@0.1.18` as a root devDependency, `npx playwright-cli --version`
   reports `0.1.18` from both the repo root and `spike/`, and
   `require.resolve('@playwright/cli/package.json')` lands under the repo's
   `node_modules` from both. `npm ls -g --depth 0` under 24.16.0 and 24.20.0 shows no
   playwright, after `npm rm -g @playwright/cli` run under 24.16.0 as the check
   predicted it would have to be.

   The "check it in WebStorm's terminal, not an agent's Bash tool" instruction turned
   out to be avoidable rather than wrong, and the reason is worth keeping. An agent's
   Bash tool inherits a PATH pointing at a *mutable* fnm multishell symlink
   (`~/.local/state/fnm_multishells/<pid>_<ts>/bin`), so `fnm use 24.20.0` repoints it
   and holds for every later call in that session. Both halves of this check ran under
   24.20.0 with npm 11.19.0 for that reason, which also kept the lockfile write off
   npm 11.13.0. Two caveats: the multishell is shared with the shell that launched
   Claude Code, so this moves that shell's node too, and it is per-session, so it is
   not a substitute for `fnm default`.

   This check is also what prompted setting `fnm default 24.20.0`, now done and
   recorded under "Already done". The alias had been 24.16.0, and it is the fallback
   for every context that cannot read `.node-version`, so it was the shared cause of
   phase 3.2's WebStorm symptom and this check's stray global.
2. Pass, with one correction to the check's wording. `skills ls` lists
   `playwright-cli` as a project skill at `.claude/skills/playwright-cli` sourced from
   `microsoft/playwright-cli`, and `skills-lock.json` carries
   `computedHash: f602822b…`. But `update` is **not** a no-op in the sense the check
   implies: it prints "Updated 1 skill(s)" and rewrites the files, unchanged, hash
   identical. What it also does is restore the `.agents/` + symlink layout, which is
   how that behaviour was found at all. Judge a no-op by the hash and the diff, not by
   what the command says it did.
3. Partly. `playwright-cli` does appear unprefixed in a root session's skill listing,
   confirmed live: the harness picked it up mid-session, both while it was a symlink
   and as real files. The impeccable-style half is 4.5 and untested.
4. Open. Cannot be self-checked honestly from the session that wrote
   `spike/CLAUDE.md`, since the file is already in context and a hit proves nothing.
   Needs a fresh root session asking for something that touches `spike/app/app.vue`.
5. Pass, end to end from a root cwd with no `cd`: `open`, `goto
   http://localhost:3000/` returning "Welcome to Nuxt!", `eval` for the user agent,
   `close`. `.playwright-cli/` appeared holding two page snapshots and a console log,
   and `git check-ignore -v` attributes it to the new `.gitignore` line. The spike was
   served by `npm -w spike run dev` for this, since Aspire does not exist yet.

   This is the check that produced the cwd finding in 4.3. The first attempt failed
   with the `chrome`-not-found error because the shell's cwd had persisted into
   `spike/` from check 1 — a Bash-tool detail, but it reproduced a real trap the
   config split had only reasoned about.
6. Pass. `git status` shows the ten skill files, the `.claude/skills/playwright-cli`
   symlink, `.playwright/cli.config.json`, `skills-lock.json`, both `CLAUDE.md` files,
   and the `.gitignore` / `package.json` / `package-lock.json` modifications. Nothing
   else: no `.playwright-cli/`, no `.claude/settings.local.json`, no `.agents/` stray
   from the layout experiments. Note the skill files are staged rather than untracked,
   which the installer did, not us.
7. Open, with 4.5.

---

## Phase 5 — Aspire AppHost

Done 2026-09-02, against Aspire CLI 13.5.3. Deferred deliberately so the scaffolder
ran before anything was decided, which was the right call: three of the six steps
below were written against assumptions the real output contradicted.

- [x] **5.1 `aspire init --language typescript --suppress-agent-init`** at the repo
      root. The extra flag is not decoration: without it `init` chains straight into
      agent setup with `aspireify` pre-selected, which mixes scaffolding with the skill
      and MCP decisions that 5.6 owns. `--non-interactive` on top, since the language
      is already given.

      **It does not land at the root**, so the "move it if it did" half of 5.2 never
      applies. With a root `package.json` present, `init` creates a nested package and
      leaves pointers at the root:

      | Path | What |
      | --- | --- |
      | `aspire-apphost/` | `apphost.mts`, `package.json`, `tsconfig.apphost.json`, `eslint.config.mjs`, `.gitignore`, `.aspire/modules/` |
      | `aspire.config.json` | root. `appHost.path`, `sdk.version`, `packages`, dashboard `profiles` |
      | `package.json` | root, gains `aspire:start` / `aspire:build` / `aspire:dev` delegates |

      Three things worth knowing about that output:

      `Aspire.Hosting.JavaScript` is already in `aspire.config.json`'s `packages`, so
      there is no `aspire add javascript` step. The generated SDK is 3.5 MB of
      `.aspire/modules/aspire.mts`, already covered by the root `.gitignore`'s
      `.aspire/` (which matches at any depth, so it catches both this and the
      root-level `.aspire/integrations/` the CLI creates at run time).

      The delegate scripts did **not** clobber the root `lint` / `lint:fix`. Docs say
      only `aspire:`-prefixed scripts are written and existing ones are preserved with
      a warning; confirmed from the diff rather than trusted.

      It also ran its own `npm install` inside the new package, leaving
      `aspire-apphost/node_modules` and a second `aspire-apphost/package-lock.json`.
      That is phase 1.4 again and 5.2 undoes it.

- [x] **5.2 Adopt into the workspace.** Kept the scaffolder's directory name. Renaming
      to `apphost/` was available — `aspire init` is a one-shot that never re-runs, so
      unlike skills.sh in 4.3 nothing would revert it — and it needs `appHost.path`
      plus the three delegate scripts repointed. Declined anyway: the reason the plan
      wanted a subdirectory was tsconfig scoping, and any subdirectory satisfies that,
      so the rename buys a shorter name and nothing else.

      Same order as 1.4, and it matters:

      1. `rm -rf aspire-apphost/node_modules aspire-apphost/package-lock.json`
      2. `"aspire-apphost"` into the root `workspaces` array
      3. `npm install` from the root

      Result: one lockfile, and `npm ls --workspaces --depth 0` lists the package.
      Everything hoists after the dependency pass below.

      **Dependency hygiene, which is 2.4 repeated.** The scaffolded `package.json`
      declared six devDependencies. Four were wrong for this repo:

      | Dropped | Why |
      | --- | --- |
      | `eslint` | Root devDependency already, hoisted, and it satisfies the peer range. One declaration per tool. |
      | `typescript-eslint` | Only the scaffolded ESLint config imported it directly. 5.3 removes that import. |
      | `typescript@^5.9.3` | A second TypeScript, and against 2.1's deliberate `^6.0.3`. It was the *only* package npm had to nest. Verified removable rather than assumed: `tsc -p tsconfig.apphost.json` compiles the generated SDK clean under 6.0.3. That also answers 2.1's parked question for this package. |
      | `nodemon` | Referenced by nothing — not a script, not a config. |

      `@types/node` bumped `^22` → `^24` to match `.node-version`. `tsx` **stays, and
      is load-bearing**: the CLI runs the AppHost with
      `npm exec tsx --tsconfig tsconfig.apphost.json apphost.mts`, visible in the
      process tree. `vscode-jsonrpc` stays; it is the transport the generated SDK uses.

      Scripts were pruned to the three `aspire:*` the root delegates target.
      The scaffold also shipped `lint` (running `eslint apphost.mts` from inside the
      package, which the root `CLAUDE.md` explicitly forbids) plus `predev` / `prebuild`
      hooks firing it automatically, and `dev` / `build` / `watch` aliases that invite
      running from the package. All removed. Change one thing at a time here: the
      pruning was done *after* a first green `aspire start`, so a breakage would have
      had one candidate cause.

- [x] **5.3 tsconfig, and the ESLint config the plan did not know about.** The
      scaffolder writes `tsconfig.apphost.json` itself, node-flavoured, `include`
      already narrowed to `apphost.mts` plus the three SDK files. So there was nothing
      to author — only to leave alone. That name is referenced by `aspire:build`,
      `aspire:dev` and the CLI's own `tsx` invocation, so it cannot be renamed.

      **Added `aspire-apphost/tsconfig.json`, extending it and holding nothing else.**
      Both consumers that matter resolve a conventional `tsconfig.json` and are blind
      to the `.apphost.` name:

      - typescript-eslint's project service walks up from each file looking for
        `tsconfig.json`. Without this, `apphost.mts` belongs to no project and every
        type-aware rule is a parsing error, not a passing lint.
      - WebStorm's TypeScript service resolves `tsconfig.json` too, which is check 6.

      **The scaffolded `eslint.config.mjs` was the one actively dangerous thing in the
      output.** It is a standalone config — typescript-eslint's `base` preset plus one
      rule — and under ESLint 10's nearest-config-wins lookup it shadows the root
      config completely. The root `eslint.config.js` comment says it covers "the Aspire
      AppHost"; that would have quietly stopped being true, with no error to notice.

      Rewritten to compose from `eslint.base.js`, same shape as `spike/`. Two details:

      `base({ typescript: { tsconfigPath } })` is how antfu's type-aware layer turns on
      (`isTypeAware = !!tsconfigPath`). The path must be **absolute** —
      `path.join(import.meta.dirname, 'tsconfig.json')`. antfu passes it straight to
      typescript-eslint as `projectService.defaultProject` and exposes no
      `tsconfigRootDir`, so a relative path resolves against the process cwd, and we
      always lint from the repo root.

      `antfu/no-top-level-await` is switched off for `apphost.mts`. Not a style
      preference: `createBuilder`, every `add*`/`with*`, and `build().run()` are async,
      and Aspire's own scaffold and every documented example are top-level await.

      `ts/no-floating-promises` is kept, which is the rule the scaffolded config existed
      for and it earns its place — a dropped `await` omits the resource from the app
      model without failing, so the AppHost starts and is quietly missing something.
      Verified firing rather than assumed present: dropping the `await` in front of
      `builder.addViteApp(...)` reports, and the rule is type-aware, so this also proves
      the `tsconfigPath` wiring above actually resolved.

- [x] **5.4 The Nuxt resource.** One resource per package, named after its directory:
      `spike`.

      **Amended 2026-09-02; it was `web` first.** The original reasoning was that the
      resource name is a stable address — `aspire describe`, root `CLAUDE.md` and
      agents all use it — so it should survive `spike/` being replaced by `app/`. That
      rests on the replacement being a swap. It is not: the spike and the real app are
      expected to run side by side for a while, which leaves `web` standing for
      whichever of two live resources is "the app". A name tied to its package cannot
      drift that way, and a second app package is a second `addViteApp` call under its
      own name.

      Steps and checks below still quote `web`. Those are transcripts of runs made
      before the rename and are left as they were observed; only the name changed,
      not the command shape or anything either one proved.

      **`addViteApp`, against what this step originally said.** The plan's reasoning was
      that Nuxt runs its own dev server through Nitro and manages HMR itself, so the
      Vite resource would interfere. It does not do anything that could: in the
      generated SDK `ViteAppResource` adds exactly one member over
      `JavaScriptAppResource`, `withViteConfig(configPath)`, which we never call. The
      only functional difference is that `addViteApp` registers the http endpoint with
      the `PORT` environment variable for you, and Aspire's own docs use it for Nuxt.

      Nuxt honours `PORT`, verified before committing to it: `PORT=4321 npm -w spike run
      dev` serves on 4321. In practice Aspire belts and braces this — it passes both
      `PORT` in the environment *and* `npm run dev -- --port <n>`.

      Do not add `.withHttpEndpoint()` on top; the docs are explicit that a second
      endpoint is a duplicate-endpoint error at runtime.

- [x] **5.5 The npm install interaction, closed by construction rather than by
      verification.** JavaScript resources auto-install in the resource's own working
      directory by default, which would run npm inside `spike/`. The plan intended to
      confirm that modern npm handles that gracefully. Better: don't let it happen.
      `withNpm({ install: false })` — per the SDK's own doc comment, "only sets the
      package manager annotation without creating an installer resource".

      Confirmed after a run: still one lockfile, no `spike/package-lock.json`, and
      `aspire logs web` shows the resource starting with `npm run dev`, no install step.

      **The prose docs and the API reference disagree on the shape of these calls** —
      the reference gives positional `withNpm(install?, installCommand?, installArgs?)`,
      the prose gives an options object. The generated SDK is the authority and it is
      the object: `withNpm(options?: WithNpmOptions)`,
      `addViteApp(name, appDirectory, options?)`. Read `.aspire/modules/aspire.mts`
      before trusting either doc.

- [x] **5.6 Aspire skills via skills.sh, no MCP, no `aspire agent init`.** The command
      this step used to recommend is gone. Reasons, in order of weight:

      `aspire agent init` gives its skills no lockfile entry, which is the whole
      argument 4.3 made for routing `playwright-cli` through skills.sh. It also wants to
      write a `.mcp.json` and to re-add the user-level telemetry hook. skills.sh avoids
      all three.

      ```bash
      npx skills@latest add https://github.com/microsoft/aspire-skills \
        --skill aspire --skill aspire-orchestration --skill aspire-monitoring -y
      ```

      Note the **repeated `--skill` flag**. Comma-separated values are silently rejected
      with "No matching skills found for: aspire,aspire-orchestration,aspire-monitoring".
      `--list` enumerates a repo without installing, which is how the six-skill bundle
      was confirmed reachable this way at all.

      Layout is 4.3's: real files in `.agents/skills/<name>`, `.claude/skills/<name>`
      symlinks, four entries in `skills-lock.json`. All three surfaced in a live
      session's skill listing immediately.

      Three of the six, chosen rather than defaulted. `aspire` routes and carries the
      safety guardrails, `aspire-orchestration` owns the AppHost lifecycle,
      `aspire-monitoring` reads logs, traces and metrics — that is the daily loop.
      `aspire-deployment` is AWS, Azure, Kubernetes and CI for a spike that deploys
      nowhere. `aspireify` wires an existing codebase into an AppHost, which was 5.4's
      job and better done by hand the first time. `aspire-init` is a one-shot 5.1
      covered. (The repo also exposes an unrelated `pr-review` skill.)

      **The question this step left open is answered, and `claudecode` would have been
      the right choice.** `--skill-locations standard` writes files only; it does not
      create the `.claude/` symlinks Claude Code needs. Evidence was already on this
      machine: a user-level Aspire install on 17 Aug left `aspire`,
      `aspire-monitoring` and `aspire-orchestration` in `~/.agents/skills/` with no
      corresponding `~/.claude/skills/` symlinks, which is exactly why no Aspire skill
      appeared in sessions before today. Worth knowing that `standard` also writes
      user-level `~/.agents/skills/`, not just the workspace.

- [x] **5.7 Root `CLAUDE.md`** (`AGENTS.md`; `CLAUDE.md` is a symlink to it). This is
      the item phase 4.1 deferred here. `aspire start` is now the documented entry
      point, `npm -w spike run dev` demoted to an isolated check, the port-3000 claim
      gone, and the `web` resource name plus the `describe` → URL → Playwright handoff
      written down. Also the AppHost editing rules from 5.3 to 5.5, since each one is a
      trap an agent would otherwise walk into.

      Fixed a pre-existing lint error while in the file: the `planning/` row of the
      layout table ended `| Docs. ||`, which `markdown/table-column-count` reports
      twice, once per name the symlink is reached by.

**Checks** — 1 to 5 pass, run 2026-09-02. 6 is an IDE setting and stays open.

1. Pass. `aspire ls` searched 11 directories and found the one AppHost at
   `aspire-apphost/apphost.mts`, `typescript/nodejs`, status `buildable`.
2. Pass. `aspire start` detaches and returns cleanly; `aspire ps --format Json` reports
   `"status": "running"` with the AppHost pid and dashboard URL.
3. Pass, and this is the contract worth stating precisely. `aspire describe web
   --format Json` returns `state: "Running"`, `healthStatus: "Healthy"`, and a URL that
   answers 200 with "Welcome to Nuxt!".

   Two details that will otherwise cost someone an hour. The resource's real name is
   suffixed — `web-xprtfnwg` — with `displayName: "web"`; `describe web` resolves it, so
   address it by the short name. And **`describe` reports two ports**: `urls[]` holds
   Aspire's proxy (the one to use) while `environment.PORT` is the app's own listener
   behind it. They differed by one (53717 vs 53718), which is close enough to look like
   a typo and is not.

   The URL is genuinely dynamic: 53717 on one run, 59240 after a restart. Nothing may
   cache it.
4. Pass. `aspire logs web -n 20` returns Nitro output — the Nuxt 4.5.2 banner, Vite
   client and server builds, and the `npm run dev -- --port <n>` invocation.

   Incidental finding: the logged npm path is
   `~/.local/state/fnm_multishells/<pid>_<ts>/bin/npm`, so Aspire spawns npm from the
   PATH of whatever shell launched it. Same fnm trap as phase 1 check 3 and phase 4
   check 1, one door further along — launch `aspire` from a shell on the wrong Node and
   the app runs on that Node.
5. Pass. `npm run lint` from the root exits 0 and does reach `aspire-apphost/`,
   confirmed by watching it report there before the fixes in 5.3. Type-aware rules
   resolve, `ts/no-floating-promises` fires on a probe, and no Vue rules leak in —
   2.2's `vue: false` default doing its job now that there is a second non-Vue package
   to prove it on.
6. Open. Yours to click through: open `aspire-apphost/apphost.mts` in WebStorm and
   confirm the TS service uses `aspire-apphost/tsconfig.json` and not the spike's. 5.3
   added that file partly so this can succeed at all — WebStorm does not recognise
   `tsconfig.apphost.json`.

**Not part of phase 5, but noticed while running it.** `aspire doctor` reports Docker
installed but not running. Irrelevant to a Nuxt-only AppHost and it did not block
anything here, but Valhalla and Photon are containers, so it becomes a prerequisite the
first time one of those enters the app model.

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

- Playwright MCP. See the decisions table. The short version is that its tool schemas
  are in context whether or not a browser is ever opened, and the skill's are not.

- The Aspire MCP server, which `aspire agent init` offers to wire into `.mcp.json` as
  `aspire agent mcp` over stdio. Same argument as Playwright MCP: 15 tool schemas
  (`list_resources`, `list_console_logs`, `list_traces`, `execute_resource_command`,
  the docs verbs, …) sit in context whether or not an AppHost is running. Everything
  phase 5's checks need is `aspire describe` / `logs` / `ps` over Bash, and Aspire's own
  docs put skills first and reach for the MCP server only when an agent needs live
  runtime data. Revisit if reading telemetry through the CLI starts to hurt — most
  likely once Valhalla and Photon are containers in the graph and there is genuinely
  more to read. Nothing was installed, so there is no `.mcp.json` to remove.

- The `playwright-component-testing` skill. Its happy path branches on *"app runs on
  Vite (has `vite.config.*`)"* to serve a story gallery from the existing dev server
  at `/playwright/gallery/index.html`. Nuxt is Vite-based but has no `vite.config.*`
  and will not serve an arbitrary `.html` from the project root, so we land in its
  fallback branch: a second Vite server with its own config and the Vue plugin as
  devDependencies, running alongside Nitro. That is a real architectural commitment
  for a spike with no components yet. Revisit if component tests are ever wanted, and
  expect to own the gallery page either way — the skill is explicit that it is yours
  to write, with no template.

- The `playwright-trace` skill. Genuinely useful, and useless until there are
  Playwright tests producing traces. One 8 KB file, so adding it later costs nothing.
  Install it in the same breath as the first test suite.

- A lint-on-edit hook. See the decisions table.

- Anything from skills.sh beyond `playwright-cli`. gcx is for work telemetry and has
  no bearing here; `frontend-design` is subsumed by impeccable-style; Nuxt and Vue
  conventions are `spike/CLAUDE.md`, which triggers on exactly the right files and
  needs no upstream kept in sync.
