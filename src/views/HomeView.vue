<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { InsufficientScopeError } from '../api/scopes'
import { fetchDiscover, fetchNextUp, type NextEpisode, type Rail } from '../api/floppy'
import { useConnection } from '../stores/connection'
import { useRefreshStatus } from '../stores/refresh'
import { cacheKey, swr, writeCache } from '../utils/swr'
import SectionHead from '../components/SectionHead.vue'
import NextEpisodeCard from '../components/NextEpisodeCard.vue'
import MediaCard from '../components/MediaCard.vue'

const { connection, reportMissingScopes } = useConnection()
const nextUp = ref<NextEpisode[]>([])
const rails = ref<Rail[]>([])
// Stale-while-revalidate: saved data shows at once; `loading` is only true when there is none.
const loading = ref(true)
const refreshing = ref(false)
const staleNote = ref(false)
const error = ref('')
useRefreshStatus(refreshing, staleNote) // shown in the header / a floating pill: no layout shift

// "TV Shows: Trending Right Now" → "TV Shows" (the section already says Trending); icon from the items' type.
const railLabel = (title: string) => (title.includes(':') ? title.split(':')[0].trim() : title)
const railIcon = (r: Rail) => r.items[0]?.mediaType ?? 'every'

const NEXT_KEY = computed(() => (connection.value ? cacheKey(connection.value, 'home:nextUp') : ''))

function handle(e: unknown, hadCache: boolean) {
  if (e instanceof InsufficientScopeError) {
    reportMissingScopes(e.scopes) // the banner explains how to fix it
    return
  }
  // A failed refresh must not wipe what's on screen: keep it and say it's not fresh.
  if (hadCache) staleNote.value = true
  else error.value = e instanceof Error ? e.message : String(e)
}

/** Replace a list only when it really changed, so a refresh that finds nothing new doesn't re-render. */
function assign<T>(target: { value: T }, data: T) {
  if (JSON.stringify(target.value) !== JSON.stringify(data)) target.value = data
}

async function reloadNextUp() {
  if (!connection.value) return
  try {
    const fresh = await fetchNextUp(connection.value)
    assign(nextUp, fresh)
    writeCache(NEXT_KEY.value, fresh)
  } catch (e) {
    handle(e, true)
  }
}

onMounted(async () => {
  const conn = connection.value
  if (!conn || conn.localOnly) return
  refreshing.value = true
  // Independent sections: one failing (e.g. missing scope) must not hide the other.
  await Promise.all([
    swr<NextEpisode[]>(NEXT_KEY.value, () => fetchNextUp(conn), {
      onData: (d) => assign(nextUp, d),
      onError: handle,
    }),
    swr<Rail[]>(cacheKey(conn, 'home:discover'), () => fetchDiscover(conn), {
      onData: (d) => {
        assign(rails, d)
        loading.value = false // saved data is enough to stop showing "Loading…"
      },
      onError: handle,
    }),
  ])
  refreshing.value = false
  loading.value = false
})
</script>

<template>
  <van-search
    shape="round"
    readonly
    placeholder="Search for movies, shows, games…"
    background="transparent"
    class="searchbar home-search"
    @click-input="$router.push({ name: 'search' })"
  />

  <section v-if="nextUp.length" class="home-section">
    <SectionHead title="Next episodes" icon="next" :count="nextUp.length" />
    <div class="next-list">
      <NextEpisodeCard
        v-for="ep in nextUp"
        :key="`${ep.mediaId}-${ep.episodeCode}`"
        :ep="ep"
        @seen="reloadNextUp"
      />
    </div>
  </section>

  <section class="home-section">
    <SectionHead title="Trending" icon="trending" />
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!rails.length" class="muted">Nothing to show yet.</p>
    <div v-for="rail in rails" :key="rail.key" class="trend-rail">
      <SectionHead :title="railLabel(rail.title)" :icon="railIcon(rail)" :subtitle="rail.summary" small />
      <div class="row">
        <MediaCard v-for="it in rail.items" :key="`${it.mediaType}${it.mediaId}`" :item="it" />
      </div>
    </div>
  </section>
</template>
