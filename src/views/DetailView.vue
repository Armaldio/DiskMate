<script setup lang="ts">
import { defineAsyncComponent, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { fetchMediaDetail, type MediaDetail } from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'
import { useRefreshStatus } from '../stores/refresh'
import { cacheKey, detailName, swr } from '../utils/swr'
import DetailLayout from '../components/DetailLayout.vue'
import PersonRow from '../components/details/PersonRow.vue'
import GenericDetail from '../components/details/GenericDetail.vue'

// One component per media type: src/components/details/<Type>Detail.vue (e.g. TvDetail.vue).
// A type without its own file falls back to GenericDetail.
const modules = import.meta.glob('../components/details/*Detail.vue')
const typeComponent = (mediaType: string): Component => {
  const name = mediaType.charAt(0).toUpperCase() + mediaType.slice(1)
  const loader = modules[`../components/details/${name}Detail.vue`]
  return loader ? defineAsyncComponent(loader as () => Promise<Component>) : GenericDetail
}

const route = useRoute()
const { connection, reportMissingScopes } = useConnection()
const detail = ref<MediaDetail | null>(null)
// "Loading…" only when nothing is saved for this item; otherwise the saved copy shows at once
// and is replaced if the refresh found something different.
const loading = ref(true)
const refreshing = ref(false)
const staleNote = ref(false)
const error = ref('')
useRefreshStatus(refreshing, staleNote) // header bar / floating pill: nothing in the page flow
// Bumped when fresh data differs from what is shown: remounts the page so local state
// (e.g. the tracking panel's fields, initialised once) restarts from the new values.
const version = ref(0)
let run = 0

async function load() {
  const conn = connection.value
  if (!conn) return
  const me = ++run
  const { mediaType, source, mediaId } = route.params as Record<string, string>
  loading.value = true
  refreshing.value = true
  staleNote.value = false
  error.value = ''
  detail.value = null
  await swr<MediaDetail>(
    cacheKey(conn, detailName(mediaType, source, mediaId)),
    () => fetchMediaDetail(conn, mediaType, source, mediaId),
    {
      onData: (d) => {
        if (me !== run) return // the user already navigated elsewhere
        if (JSON.stringify(detail.value) !== JSON.stringify(d)) {
          if (detail.value) version.value++
          detail.value = d
        }
        loading.value = false
      },
      onError: (e, hadCache) => {
        if (me !== run) return
        if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
        else if (hadCache) staleNote.value = true
        else error.value = e instanceof Error ? e.message : String(e)
      },
    },
  )
  if (me === run) {
    refreshing.value = false
    loading.value = false
  }
}

watch(() => route.fullPath, load, { immediate: true })
</script>

<template>
  <p v-if="loading" class="muted">Loading…</p>
  <p v-else-if="error" class="error">{{ error }}</p>
  <DetailLayout v-else-if="detail" :key="`${detail.mediaType}/${detail.source}/${detail.mediaId}:${version}`" :detail="detail">
    <component :is="typeComponent(detail.mediaType)" :detail="detail" />
    <PersonRow title="Cast" :people="detail.cast" />
    <PersonRow title="Crew" :people="detail.crew" :max="12" />
  </DetailLayout>
</template>
