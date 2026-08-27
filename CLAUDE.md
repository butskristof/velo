# velo

A mobile-first station finder for Velo Antwerpen, built on the city's GBFS feed.
Product context and constraints: `planning/velo-app-handoff.md`. Tooling decisions
and their reasoning: `planning/repo-setup.md`. Read the relevant one before
proposing a change to either.

Pre-implementation. `spike/` is the only app package today.

## Layout

The repo root is the npm workspaces root and holds the only lockfile. Shared
tooling lives here; a package below carries only config that cannot be hoisted.

| Path | What it is |
| --- | --- |
| `eslint.base.js` | The only place house style is defined. Both configs import it. |
| `eslint.config.js` | Fallback config: any file with no nearer `eslint.config.*`. |
| `spike/` | Throwaway Nuxt app. Gets deleted, not promoted to `app/`. |
| `.agents/skills/` | Vendored third-party skills. `.claude/skills/` symlinks here. |
| `.playwright/` | Committed browser config for `playwright-cli`. |
| `planning/` | Docs. ESLint ignores it. |

`apphost/` arrives with the Aspire AppHost in phase 5 of `planning/repo-setup.md`.

## Commands

Run everything from the repo root.

```bash
npm run lint             # eslint .  — covers every package, nested configs and all
npm run lint:fix         # the enforcement mechanism for style; run once when done
npm -w spike run dev     # Nitro on http://localhost:3000
```

Never `npm install` inside a package. One install at the root, one lockfile.
Adding a dependency to the spike is `npm i -w spike <pkg>`.

There is no root `dev` script and there should not be one. The root is a workspace,
not an app; a dev server belongs to a package, and from phase 5 to Aspire.

## Node version

`.node-version` pins 24.20.0 and `engines.node` matches it. fnm resolves this in an
interactive shell, but a non-interactive shell (an agent's Bash tool included) does
not source `.zshrc`, so it silently gets whatever the fnm `default` alias points at.
Check `node -v` before trusting an install or a lockfile write, and `fnm use 24.20.0`
if it disagrees. A lockfile written by the wrong npm is the failure this prevents.

## Driving a browser

The `playwright-cli` skill owns this. Ask for the URL rather than assuming one:
today `spike` is the only server and it is on port 3000, but once Aspire owns the
environment the port is its to assign, and `aspire describe <resource> --format Json`
is where it comes from. Hardcoding `localhost:3000` is the thing that breaks.

`.playwright-cli/` is where the CLI writes page snapshots at runtime. It is
gitignored. `.playwright/`, without the suffix, is the committed config. Different
directories, one confusable letter apart.

Write every file you ask the CLI for into `.playwright-cli/`, explicitly:

```bash
npx playwright-cli state-save .playwright-cli/auth.json    # not `state-save auth.json`
```

Snapshots and traces go there on their own, but `state-save` resolves a bare
filename against the working directory, so it lands in the repo root instead. That
file holds live cookies and auth tokens. Passing the directory keeps it inside the
one path that is already gitignored, which is cheaper than a rule per filename.

Run the CLI from the repo root. Browser config is read from
`<cwd>/.playwright/cli.config.json`, so a shell sitting in `spike/` finds nothing and
falls back to `channel: "chrome"`, i.e. the real Google Chrome, which is not
installed here and fails outright. Use `--config` if you genuinely cannot be at the
root. The binary itself resolves from anywhere; only the config is cwd-sensitive.

## Code style

ESLint owns formatting, and `npm run lint:fix` is how it gets applied. There is no
Prettier anywhere in the tree and adding it is a decision, not a convenience. Do not
add a formatter config, and do not reformat a file you were not asked to touch.

No lint-on-edit hook, deliberately: it would rewrite between the small sequential
edits made to one file and turn the diff to noise. Lint at the end instead.

What ESLint cannot tell you:

- Comments explain why, not what. A comment restating the line below it is noise.
  The non-obvious constraint, the reason for an unusual choice, the trap: those earn
  their space.
- A new package imports `eslint.base.js` rather than restating rules. Vue packages
  opt in with `base({ vue: true })`; autodetection is wrong here, because workspace
  hoisting makes `vue` resolvable from every package.
- Never hand-edit anything under `.agents/skills/`. It is vendored and pinned by
  `skills-lock.json`; the installers overwrite unconditionally, so a local edit is
  lost, not merged.
- Build output is ignored by the package that produces it, not by the root
  `.gitignore`. A package shipping without its own ignore file is a bug in that
  package.
- `typescript` is pinned to `^6` on purpose. 6 is the last of the JS-based compiler
  line and 7 is the native port, already `latest` on npm, so a bare
  `npm i typescript` moves us off the pin. Don't.
