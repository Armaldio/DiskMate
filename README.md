# DiskMate

A Vue 3 + TypeScript SPA frontend for [Floppy](https://github.com/FuzzyGrim/Yamtrack) (formerly Yamtrack), the self-hosted media tracker.

- Home shows the instance's trending rows (`GET /api/v1/discover/`).
- Connect screen: instance URL + API token, verified before saving (stored in `localStorage`).

```sh
npm install
npm run dev
npm run build
```

**CORS:** a browser calls your Floppy instance directly, so the instance (or a reverse proxy) must allow DiskMate's origin.
