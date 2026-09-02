# velo

Mobile-first station finder for Velo, Antwerp's bike sharing platform, built on the
open GBFS feed. Aims at quality-of-life improvements over the official website and
apps. Users arrive with one specific question ("what's the station nearest to my
destination") and want to be out again: prioritise visual clarity on the map and the
shortest path to the answer.

Product context and constraints: `planning/velo-app-handoff.md`.
Tooling decisions and their reasoning: `planning/repo-setup.md`.
Read the relevant one before proposing a change to either.


## Layout

| Path | What it is |
| --- | --- |
| `eslint.base.js` | House style, single source. Every package config imports it |
| `aspire.config.json` | Points Aspire at the AppHost |
| `aspire-apphost/` | Aspire TypeScript AppHost |
| `spike/` | Nuxt 4 app for testing & validating feasibility |
| `planning/` | Docs |

## Commands

Run everything from the repo root: npm workspaces and the Aspire AppHost are defined
there.

```bash
aspire start             # bring up AppHost, resources and dependencies in the background
aspire stop              # stops running AppHost, resources and dependencies
aspire run               # foreground equivalent of start; blocks, so not for agents
npm run lint             # covers every package
npm run lint:fix
npm run aspire:typecheck
```

Never `npm install` inside a package. One install at the root, one lockfile. Add a
dependency with `npm i -w spike <pkg>`.

## Architecture

Nuxt 4 + Nitro, BFF style: external data is collected, combined and shaped
server-side before it reaches the client. No separate backend service — there is no
owned data and no complex business logic to justify one.

Several external sources: the GBFS feed, plus self-hosted containers (Valhalla,
Photon). Prefer self-hosted over commercial dependencies such as Google Maps.

## Aspire

Aspire owns local development (not deployment): the AppHost brings up dependencies and
the app with its configuration injected.

One resource per package, named after its directory: `spike/` comes up as `spike`.
A new app package is added as its own resource under its own name rather than by
renaming an existing one — the two are expected to run side by side.

Ports are dynamic and change on every restart. Never assume one, never reuse one from
earlier in the session. Ask for it, including before pointing `playwright-cli` at the
app, and check which resource you are asking about when more than one is up:

```bash
aspire describe spike --format Json     # .resources[0].urls[] holds the URL
aspire logs spike -n 20
```

Use `urls[]`, Aspire's proxy. The resource's `environment.PORT` is the app's own
listener behind it.

Editing `apphost.mts`:

- Read the comments in the file first. Every resource choice is justified there;
  do not undo one without reading why it is that way.
- Never hand-edit `.aspire/`. It is a generated, gitignored SDK; `aspire restore`
  regenerates it from `aspire.config.json`.

## Workflow

Build features end-to-end. Cover behaviour with automated tests where that is
feasible and useful. Verify UI in a real browser with the Playwright CLI.

Before you stop, for what you touched:

- `npm run lint:fix`, once, after the last edit is in. Linting between edits rewrites
  the file under you and invalidates the next edit.
- `npm run aspire:typecheck` if `apphost.mts` changed. Aspire strips its types
  without checking them, so an error there runs silently and lint will not see it.

Commits and PRs belong to the user. Do not commit, do not open PRs, do not offer to.

## Linting

ESLint owns linting and formatting, based on antfu's config. No Prettier: formatting
is the `@stylistic` rules. Do not add a formatter.

- A new package starts its ESLint config from `eslint.base.js`. Vue packages opt in
  with `base({ vue: true })`.
- Lint only code we own. Committed files that are not ours to author (vendored
  skills, generated tool config) are ignored on purpose. Leave them ignored.
- Do not reformat a file you were not asked to touch.

## Playwright

Run `npx playwright-cli` from the repo root: browser config is read from
`<cwd>/.playwright/cli.config.json`, and elsewhere it silently falls back to real
Chrome, which is not installed here.

Pass output paths explicitly so they land in `.playwright-cli/`, which is gitignored:

```bash
npx playwright-cli state-save .playwright-cli/auth.json
```

A bare filename resolves against the working directory, so saved browser state —
live cookies and tokens — lands in the repo root instead.

## Skills

- Source third-party skills with `npx skills@latest add|update`, not a tool's own
  installer (`aspire agent init`, `playwright-cli install --skills`). Same files, but
  only this one writes a `skills-lock.json` entry and gives a one-command bump.
- Never hand-edit a skill the lockfile names: the installer overwrites, so the edit
  is lost. Bump it instead.
- Skills not named in the lockfile are owned and can be edited like other source files.

## Documentation & planning

Feature plans and design docs go in `planning/`. Write them efficiently and keep them
accurate, so a later session can pick the work up from them.
