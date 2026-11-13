# DiskMate

A Vue 3 + TypeScript SPA frontend for [Floppy](https://github.com/FuzzyGrim/Yamtrack) (formerly Yamtrack), the self-hosted media tracker.

- Home shows the instance's trending rows (`GET /api/v1/discover/`).
- Connect screen: instance URL + API token, verified before saving (stored in `localStorage`).

```sh
npm install
npm run dev
npm run build
```

**Token:** in Floppy go to Settings → Integrations → *App tokens* → *Create an app token* and grant at least `user:read` and `catalog:read` (DiskMate is read-only for now). Don't use the full-access account API token at the top of that page.

**Adding permissions later:** every Floppy permission DiskMate uses is listed in `src/api/scopes.ts` (`FEATURE_SCOPES`). Add the new scope there and pass it to `request()`; connected users then get a banner (also triggered by a 403 from Floppy) asking for a new app token with the full updated list.

**CORS:** a browser calls your Floppy instance directly, so the instance (or a reverse proxy) must allow DiskMate's origin.
