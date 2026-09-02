# spike

Throwaway Nuxt app. It exists to exercise the workspace tooling against a real
Nuxt install: the shared ESLint preset, directory-scoped agent skills, and the
Aspire resource wiring. The real app is scaffolded fresh and inherits all of it on
day one rather than being promoted from here; this package stays alongside it until
it has nothing left to prove.

## Running it

Aspire owns the local environment. From the repo root:

```bash
aspire start
```

This package comes up as the resource `spike`, with its configuration injected, on a
port Aspire assigns at startup. `aspire describe spike --format Json` gives the URL.

If needed (should be exceptional), just the Nuxt app can be started directly as well.
Provide configuration through .env or environment variables.
```bash
npm run dev             # local
npm -w spike run dev    # from repo root
```

There is no install step in this directory. Dependencies are installed once from
the repo root, which is the npm workspaces root and holds the only lockfile.
`npm install` here is wrong, and so are pnpm, yarn, and bun.
