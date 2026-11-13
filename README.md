# DiskMate

A Vue 3 + TypeScript SPA frontend for [Floppy](https://github.com/FuzzyGrim/Yamtrack) (formerly Yamtrack), the self-hosted media tracker.

- Home shows the instance's trending rows (`GET /api/v1/discover/`).
- Connect screen: instance URL + API token, verified before saving (stored in `localStorage`).

```sh
npm install
npm run dev
npm run build
```

**Token:** in Floppy go to Settings → Integrations → *App tokens* → *Create an app token* and grant the scopes DiskMate lists on Connect. Library browsing and watched/watchlist changes use `watchlist:read` and `watchlist:write`. Don't use the full-access account API token at the top of that page.

**Adding permissions later:** every Floppy permission DiskMate uses is listed in `src/api/scopes.ts` (`FEATURE_SCOPES`). Add the new scope there and pass it to `request()`; connected users get a banner, shown when Floppy answers 403 for that scope (Floppy doesn't expose a token's scopes, so there's no up-front check), asking for a new app token with the full updated list.

**CORS:** a browser calls your Floppy instance directly, so the instance (or a reverse proxy) must allow DiskMate's origin.

**Install and offline use:** on a supported browser, use its install/add-to-home-screen action. DiskMate caches its app shell so it can open offline, but media data and Floppy API requests still require a connection to your Floppy instance. Your saved connection remains in this browser's local storage.

**Local network access:** on Connect, enter your Floppy server's LAN address (for example, `http://192.168.1.25:8000`) and choose **Use the local address only**. You can also add it later in Settings. DiskMate verifies the address with your app token, then uses that address for library reads and changes without falling back to the main address. The app must be opened from a secure HTTPS origin for browser access to a local network server. Chrome may ask for Local Network Access; allow it. Other browsers may require the Floppy server itself to use HTTPS. Floppy's CORS settings must allow DiskMate's origin and the `Authorization` and `X-API-Key` headers. Your Floppy server must be running and reachable on the same network; this lets you keep using the library when the internet is unavailable, but does not make the library available when the Floppy server is off. Provider search is disabled in local-only mode, and images hosted outside your local server are hidden.
