import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import type { Plugin } from 'vite'

function offlineAppShell(): Plugin {
  let base = '/'

  return {
    name: 'diskmate-offline-app-shell',
    configResolved(config) {
      base = config.base
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const precacheFiles = Object.keys(bundle).filter((fileName) =>
          fileName !== 'index.html' && /\.(?:js|css|png|svg)$/.test(fileName),
        )
        const precache = [`${base}index.html`, ...precacheFiles.map((file) => `${base}${file}`), `${base}manifest.webmanifest`]
        const indexHtml = bundle['index.html']
        if (!indexHtml || indexHtml.type !== 'asset') throw new Error('Vite did not emit index.html before the service worker')
        const iconFile = (prefix: string) => {
          const fileName = Object.keys(bundle).find((file) => file.startsWith(`assets/${prefix}-`) && file.endsWith('.png'))
          if (!fileName) throw new Error(`Vite did not emit ${prefix} icon`)
          return `${base}${fileName}`
        }
        const manifest = {
          name: 'DiskMate',
          short_name: 'DiskMate',
          description: 'Track your media with Floppy.',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#1c1e29',
          theme_color: '#1c1e29',
          icons: [
            { src: iconFile('icon-192'), sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: iconFile('icon-512'), sizes: '512x512', type: 'image/png', purpose: 'any' },
          ],
        }
        const manifestSource = JSON.stringify(manifest, null, 2)
        let hash = 2166136261
        const versionInput = `${precache.join('|')}|${indexHtml.source.toString()}|${manifestSource}`
        for (const character of versionInput) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
        const version = (hash >>> 0).toString(36)

        this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifestSource })
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: `const BASE = ${JSON.stringify(base)};
const CACHE_PREFIX = 'diskmate-shell:' + new URL(BASE, self.location.origin).pathname + ':';
const CACHE = CACHE_PREFIX + '${version}';
const SHELL = ${JSON.stringify(precache)};
const SHELL_PATHS = new Set(SHELL.map((asset) => new URL(asset, self.location.origin).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(BASE + 'index.html')).then((cached) => cached || fetch(request)));
    return;
  }

  if (!SHELL_PATHS.has(url.pathname)) return;

  event.respondWith(caches.open(CACHE).then((cache) => cache.match(request)).then((cached) => cached || fetch(request)));
});\n`,
        })
      },
    },
  }
}

// Set via `vite build --base /DiskMate/` in CI; defaults to '/' locally.
// Vant (mobile UI kit) components are auto-imported on use, with their styles.
export default defineConfig({
  build: { assetsInlineLimit: 0 },
  plugins: [vue(), Components({ resolvers: [VantResolver()], dts: 'src/components.d.ts' }), offlineAppShell()],
})
