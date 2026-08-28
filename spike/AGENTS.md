# velo — spike

Throwaway Nuxt 4 app: it tests the repo setup and the technical feasibility of the
Velo app before we commit to assumptions and a roadmap. It gets deleted and the real
app is built fresh, not promoted from here.

The root `AGENTS.md` applies in full.

## Nuxt 4 folder layout

`srcDir` is `app/`, not the package root. Nuxt 3 tutorials and muscle memory put
these one level up; that is the most common thing to get wrong here.

```
spike/
├─ app/          components/ composables/ layouts/ middleware/ pages/
│                plugins/ utils/ assets/ app.vue error.vue
├─ server/       api/ routes/ middleware/   ← package root, not app/
├─ shared/       types and utils used by both the Vue app and Nitro
├─ public/       served as-is
└─ nuxt.config.ts
```

If an auto-import is not resolving, check this first.

`.nuxt/` is generated output, including the ESLint config this package composes
with. Never edit anything in it.

## BFF

External data is fetched in Nitro, never from the browser: a `server/api/` route per
concern. That keeps upstream URLs out of the client and sidesteps
CORS.

Cache and aggregate in the BFF server routes to serve the data in the format the client requires. Strip unnecessary data, don't just pass everything on to the client. 

## Commands

Run lint and the dev server from the repo root, never from this package. See the root
`AGENTS.md`.