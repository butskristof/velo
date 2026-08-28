# velo

Mobile-first station finder for Velo, Antwerp's bike sharing platform, built on the
open GBFS feed. Aims at quality-of-life improvements over the official website and
apps. Users arrive with one specific question ("what's the station nearest to my
destination") and want to be out again: prioritise visual clarity on the map and the
shortest path to the answer.

Product context and constraints: `planning/velo-app-handoff.md`.
Tooling decisions and their reasoning: `planning/repo-setup.md`.
Read the relevant one before proposing a change to either.

Pre-implementation. `spike/` is the only app package.

## Layout

| Path | What it is |
| --- | --- |
| `eslint.base.js` | House style, single source. Every package config imports it. |
| `spike/` | Throwaway Nuxt 4 app. Gets deleted, not promoted. |
| `planning/` | Docs. ||

`apphost/` arrives with the Aspire AppHost in phase 5 of `planning/repo-setup.md`.

## Commands

Run everything from the repo root: npm workspaces and, later, the Aspire AppHost are
defined there.

```bash
npm -w spike run dev     # Nitro on http://localhost:3000
npm run lint             # covers every package
npm run lint:fix         # run once, at the end
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

Not set up yet; phase 5. Aspire will own the local development environment: starting
the AppHost (TypeScript) brings up dependencies and the app with its configuration
injected (connection strings, environment variables). Aspire does not manage
deployment.

It assigns ports dynamically, so once it lands, get URLs from
`aspire describe <resource> --format Json` rather than assuming one.

## Workflow

Build features end-to-end. Cover behaviour with automated tests where that is
feasible and useful. Verify UI in a real browser with the Playwright CLI.

Commits and PRs belong to the user. Do not commit, do not open PRs, do not offer to.

## Linting

ESLint owns linting and formatting, based on antfu's config. No Prettier: formatting
is the `@stylistic` rules. Do not add a formatter.

- Run it from the repo root, never from a package.
- A new package starts its ESLint config from `eslint.base.js`. Vue packages opt in
  with `base({ vue: true })`.
- Lint only code we own. Committed files that are not ours to author (vendored
  skills, generated tool config) are ignored on purpose. Leave them ignored.
- Finish every edit to a file first, lint at the end. Linting between edits rewrites
  the file under you and invalidates the next edit.
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
