<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchMedia, type MediaItem } from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'
import MediaCard from '../components/MediaCard.vue'
import MediaIcon from '../components/MediaIcon.vue'

// "all" = movies and shows together (like the reference app); the rest are one provider each.
const kindLabels: Record<string, string> = {
  movie: 'Movies', tv: 'Shows', anime: 'Anime', manga: 'Manga', game: 'Games',
  book: 'Books', comic: 'Comics', boardgame: 'Board games', podcast: 'Podcasts',
}
const types = [
  // Everything first (the default): every category at once, one row per type, fewer results each.
  { id: 'every', label: 'Everything', kinds: ['movie', 'tv', 'anime', 'manga', 'game', 'book', 'comic', 'boardgame', 'podcast'], grouped: true },
  { id: 'movie', label: 'Movies', kinds: ['movie'], grouped: false },
  { id: 'tv', label: 'Shows', kinds: ['tv'], grouped: false },
  { id: 'anime', label: 'Anime', kinds: ['anime'], grouped: false },
  { id: 'manga', label: 'Manga', kinds: ['manga'], grouped: false },
  { id: 'game', label: 'Games', kinds: ['game'], grouped: false },
  { id: 'book', label: 'Books', kinds: ['book'], grouped: false },
  { id: 'comic', label: 'Comics', kinds: ['comic'], grouped: false },
  { id: 'boardgame', label: 'Board games', kinds: ['boardgame'], grouped: false },
  { id: 'podcast', label: 'Podcasts', kinds: ['podcast'], grouped: false },
]

const route = useRoute()
const router = useRouter()
const { connection, reportMissingScopes } = useConnection()

const query = ref(String(route.query.q ?? ''))
const type = ref(String(route.query.type ?? 'every'))
const results = ref<MediaItem[]>([])
const groups = ref<{ kind: string; label: string; items: MediaItem[] }[]>([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)
/** Categories whose provider failed (e.g. the instance's book provider is down). */
const failedKinds = ref<string[]>([])

let timer: ReturnType<typeof setTimeout> | undefined
let run = 0
let controller: AbortController | undefined

/** Runs `fn` over `items` with at most `limit` in flight (providers are slow; don't flood the instance). */
async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        await fn(items[i], i)
      }
    }),
  )
}

async function search() {
  const q = query.value.trim()
  const me = ++run
  controller?.abort() // cancel the previous search so it stops loading the server
  controller = new AbortController()
  const { signal } = controller
  if (!q || !connection.value || connection.value.localOnly) {
    results.value = []
    groups.value = []
    failedKinds.value = []
    searched.value = false
    loading.value = false
    if (connection.value?.localOnly) error.value = 'Provider search is unavailable in local-only mode. Browse your library instead.'
    return
  }
  loading.value = true
  error.value = ''
  const mode = types.find((t) => t.id === type.value) ?? types[0]
  const lists: MediaItem[][] = mode.kinds.map(() => [])
  const errors: unknown[] = []
  failedKinds.value = []
  let anyDone = false

  // Rebuilds what's on screen from the lists received so far (progressive for grouped mode).
  const render = () => {
    if (mode.grouped) {
      groups.value = lists
        .map((items, i) => ({ kind: mode.kinds[i], label: kindLabels[mode.kinds[i]] ?? mode.kinds[i], items }))
        .filter((g) => g.items.length)
      results.value = groups.value.flatMap((g) => g.items)
    } else {
      groups.value = []
      // Interleave so movies and shows both show up near the top.
      const merged: MediaItem[] = []
      for (let i = 0; merged.length < lists.reduce((n, l) => n + l.length, 0); i++)
        for (const l of lists) if (l[i]) merged.push(l[i])
      results.value = merged
    }
    searched.value = anyDone
  }

  await pool(mode.kinds, mode.grouped ? 3 : 2, async (kind, i) => {
    try {
      lists[i] = await searchMedia(connection.value!, kind, q, mode.grouped ? 10 : 20, signal)
      anyDone = true
      if (me === run) {
        render()
        if (mode.grouped && results.value.length) loading.value = false // show groups as they arrive
      }
    } catch (e) {
      if (!signal.aborted) {
        errors.push(e)
        if (mode.kinds.length > 1) failedKinds.value = [...failedKinds.value, kindLabels[kind] ?? kind]
      }
    }
  })
  if (me !== run) return // superseded: the newer search owns the screen
  const scope = errors.find((e) => e instanceof InsufficientScopeError) as InsufficientScopeError | undefined
  if (scope) reportMissingScopes(scope.scopes)
  else if (errors.length === mode.kinds.length) {
    error.value = errors[0] instanceof Error ? errors[0].message : String(errors[0])
  }
  searched.value = anyDone
  loading.value = false
}

// Debounced live search; the URL mirrors the state so a search can be shared / reloaded.
watch([query, type], () => {
  clearTimeout(timer)
  router.replace({ query: { ...(query.value.trim() ? { q: query.value.trim() } : {}), ...(type.value !== 'every' ? { type: type.value } : {}) } })
  timer = setTimeout(search, 350)
})
// Back/forward or a pushed URL: follow it (same values as the state = no-op, so no loop).
watch(
  () => route.query,
  (qs) => {
    const q = String(qs.q ?? '')
    const t = String(qs.type ?? 'every')
    if (q !== query.value.trim()) query.value = q
    if (t !== type.value) type.value = t
  },
)
onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})

if (query.value) search()
</script>

<template>
  <van-search
    v-model="query"
    shape="round"
    placeholder="Search for movies, shows, games…"
    autofocus
    clearable
    background="transparent"
    class="searchbar"
    @search="search"
  />
  <div class="type-chips" role="tablist" aria-label="Search in">
    <button
      v-for="t in types"
      :key="t.id"
      role="tab"
      :aria-selected="type === t.id"
      class="type-chip"
      :class="{ on: type === t.id }"
      @click="type = t.id"
    >
      <MediaIcon :type="t.id" :size="14" :tile="false" />
      {{ t.label }}
    </button>
  </div>

  <p v-if="failedKinds.length" class="muted note">Couldn't search: {{ failedKinds.join(', ') }}.</p>
  <van-loading v-if="loading" class="loading" />
  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else-if="searched && !results.length" class="muted">No results for “{{ query.trim() }}”.</p>
  <template v-else-if="groups.length">
    <section v-for="g in groups" :key="g.kind" class="rail">
      <h2 class="with-icon"><MediaIcon :type="g.kind" :size="18" /> {{ g.label }}</h2>
      <div class="row">
        <MediaCard v-for="it in g.items" :key="`${it.mediaType}${it.source}${it.mediaId}`" :item="it" />
      </div>
    </section>
  </template>
  <div v-else-if="results.length" class="results">
    <MediaCard v-for="it in results" :key="`${it.mediaType}${it.source}${it.mediaId}`" :item="it" />
  </div>
  <p v-else class="muted hint">Type to search. Pick a category to narrow it down.</p>
</template>
