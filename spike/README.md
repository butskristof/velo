# spike

Throwaway Nuxt app. It exists to exercise the workspace tooling against a real
Nuxt install: the shared ESLint preset, directory-scoped agent skills, and later
the Aspire resource wiring. It gets deleted rather than promoted. `app/` will be
scaffolded fresh and inherit all of it on day one.

## Running it

There is no install step in this directory. Dependencies are installed once from
the repo root, which is the npm workspaces root and holds the only lockfile.
`npm install` here is wrong, and so are pnpm, yarn, and bun.

```bash
npm -w spike run dev     # from the repo root
npm run dev              # from here
```

Nitro serves on http://localhost:3000. The remaining scripts (`build`,
`preview`, `generate`) are stock Nuxt and unmodified.

Aspire is meant to own the local environment from phase 5 of
`planning/repo-setup.md` onward, at which point the app is addressed through it
(`aspire describe <resource>` for the URL, rather than assuming the port). Until
that lands these commands are how you run it; afterwards they stay valid for
running this package alone, which is the exception rather than the way in.
