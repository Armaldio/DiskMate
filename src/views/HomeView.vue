<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { InsufficientScopeError } from '../api/scopes'
import { fetchDiscover, fetchNextUp, type NextEpisode, type Rail } from '../api/floppy'
import { useConnection } from '../stores/connection'
import NextEpisodeCard from '../components/NextEpisodeCard.vue'
import MediaCard from '../components/MediaCard.vue'

const { connection, reportMissingScopes } = useConnection()
const nextUp = ref<NextEpisode[]>([])
const rails = ref<Rail[]>([])
const loading = ref(true)
const error = ref('')

function handle(e: unknown) {
  if (e instanceof InsufficientScopeError) {
    reportMissingScopes(e.scopes) // the banner explains how to fix it
    return
  }
  error.value = e instanceof Error ? e.message : String(e)
}

async function reloadNextUp() {
  if (!connection.value) return
  try {
    nextUp.value = await fetchNextUp(connection.value)
  } catch (e) {
    handle(e)
  }
}

onMounted(async () => {
  if (!connection.value || connection.value.localOnly) return
  try {
    // Independent sections: one failing (e.g. missing scope) must not hide the other.
    const [next, discover] = await Promise.allSettled([
      fetchNextUp(connection.value),
      fetchDiscover(connection.value),
    ])
    if (next.status === 'fulfilled') nextUp.value = next.value
    else handle(next.reason)
    if (discover.status === 'fulfilled') rails.value = discover.value
    else handle(discover.reason)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <van-search
    shape="round"
    readonly
    placeholder="Search for movies, shows, games…"
    background="transparent"
    class="searchbar"
    @click-input="$router.push({ name: 'search' })"
  />
  <section v-if="nextUp.length" class="rail">
    <h2>Next episodes</h2>
    <div class="next-list">
      <NextEpisodeCard
        v-for="ep in nextUp"
        :key="`${ep.mediaId}-${ep.episodeCode}`"
        :ep="ep"
        @seen="reloadNextUp"
      />
    </div>
  </section>
  <h1>Trending</h1>
  <p v-if="loading" class="muted">Loading…</p>
  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else-if="!rails.length" class="muted">Nothing to show yet.</p>
  <section v-for="rail in rails" :key="rail.key" class="rail">
    <h2>{{ rail.title }}</h2>
    <p v-if="rail.summary" class="muted">{{ rail.summary }}</p>
    <div class="row">
      <MediaCard v-for="it in rail.items" :key="`${it.mediaType}${it.mediaId}`" :item="it" />
    </div>
  </section>
</template>
