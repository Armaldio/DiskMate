<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchLibrary, fetchNextUp, type MediaItem, type NextEpisode } from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import MediaCard from '../components/MediaCard.vue'
import NextEpisodeCard from '../components/NextEpisodeCard.vue'
import { useConnection } from '../stores/connection'

const { connection, reportMissingScopes } = useConnection()
const items = ref<MediaItem[]>([])
const nextUp = ref<NextEpisode[]>([])
const query = ref('')
const loading = ref(true)
const error = ref('')

const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return term ? items.value.filter((item) => item.title.toLocaleLowerCase().includes(term)) : items.value
})

onMounted(async () => {
  if (!connection.value) return
  const [library, next] = await Promise.allSettled([
    fetchLibrary(connection.value),
    fetchNextUp(connection.value),
  ])
  if (library.status === 'fulfilled') items.value = library.value
  else if (library.reason instanceof InsufficientScopeError) reportMissingScopes(library.reason.scopes)
  else error.value = library.reason instanceof Error ? library.reason.message : String(library.reason)
  if (next.status === 'fulfilled') nextUp.value = next.value
  else if (next.reason instanceof InsufficientScopeError) reportMissingScopes(next.reason.scopes)
  loading.value = false
})

async function reloadNextUp() {
  if (!connection.value) return
  try {
    nextUp.value = await fetchNextUp(connection.value)
  } catch (e) {
    if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
  }
}
</script>

<template>
  <h1>Your library</h1>
  <p v-if="connection?.localOnly" class="muted">Local-only mode uses your LAN address.</p>
  <section v-if="nextUp.length" class="rail">
    <h2>Next episodes</h2>
    <div class="next-list">
      <NextEpisodeCard v-for="ep in nextUp" :key="`${ep.mediaId}-${ep.episodeCode}`" :ep="ep" @seen="reloadNextUp" />
    </div>
  </section>
  <van-search v-model="query" shape="round" placeholder="Filter your library" background="transparent" />
  <p v-if="loading" class="muted">Loading your library…</p>
  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else-if="!filtered.length" class="muted">{{ items.length ? 'No titles match.' : 'Your library is empty.' }}</p>
  <div v-else class="results">
    <MediaCard v-for="item in filtered" :key="`${item.mediaType}:${item.source}:${item.mediaId}`" :item="item" />
  </div>
</template>
