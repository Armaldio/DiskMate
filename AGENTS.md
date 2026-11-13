# AGENTS.md

DiskMate is a Vue 3 + TypeScript SPA frontend for [Floppy](https://github.com/FuzzyGrim/Yamtrack) (formerly Yamtrack), a self-hosted media tracker. It talks to a user's Floppy instance directly from the browser.

## Rules

- **Mobile first, always.** Every UI change is designed for a phone screen first (touch targets, one column, no hover-only interactions), then enhanced for wider screens with `min-width` media queries. Never the other way around.
- Keep changes small and focused; don't refactor unrelated code.
- Match the existing style (plain CSS in `src/style.css`, `<script setup lang="ts">` components).
- Always run `npm run build` (type-check + build) before saying something works.
- Don't commit or push unless asked. Pushing to `main` redeploys the public site.
- Don't add dependencies without a good reason.

## Stack

- **Vue 3** (Composition API, `<script setup>`), **TypeScript** (strict), **Vite** for dev/build, **vue-router 4** for routing, **vue-tsc** for type-checking.
- No UI framework and no state library: shared state is small module-level `ref`s in `src/stores/` (e.g. the connection is persisted in `localStorage`).
- No backend. The browser calls the Floppy instance directly, so the instance (or its reverse proxy) must allow CORS from DiskMate's origin, including the `Authorization` and `X-API-Key` headers.

## Layout

```
src/
  api/floppy.ts     Floppy API client (fetch wrappers + response mapping)
  api/scopes.ts     Floppy permissions DiskMate needs, per feature
  stores/           connection store (URL, token, granted scopes)
  views/            route pages (Home, Connect)
  components/       reusable components (cards, token help, scope banner)
  router/           routes + guard (redirects to /connect when not connected)
```

## Floppy API

- Auth: app token (`flp_…`) sent as `Authorization: Bearer` and `X-API-Key`. Create it in Floppy → Settings → Integrations → *App tokens*, never the full-access account token.
- The instance publishes its OpenAPI schema at `<instance>/api/schema/` (YAML). Each endpoint lists its `x-required-scope`. Use it as the source of truth.
- Used so far: `GET /api/v1/user/preferences/` (connection check), `GET /api/v1/discover/` (trending), `GET /api/v1/media/` (Next up: in-progress shows with `next_episode`).

## Adding a feature that needs a new permission

1. Add the scope to `FEATURE_SCOPES` in `src/api/scopes.ts`.
2. Pass it to `request()` in `src/api/floppy.ts`.
3. Users whose token lacks it get a banner (on a 403 from Floppy; token scopes can't be read up front) asking for a new token with the updated scopes (the Connect screen and README list update themselves).

## Commands

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
```

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds on every push to `main` and publishes to GitHub Pages at `https://armaldio.github.io/DiskMate/`. The build uses `--base /DiskMate/`; the router uses `import.meta.env.BASE_URL`, and `404.html` is a copy of `index.html` for deep links.
