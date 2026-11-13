<script setup lang="ts">
import { defineAsyncComponent, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { fetchMediaDetail, type MediaDetail } from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'
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
const loading = ref(true)
const error = ref('')

async function load() {
  if (!connection.value) return
  loading.value = true
  error.value = ''
  detail.value = null
  const { mediaType, source, mediaId } = route.params as Record<string, string>
  try {
    detail.value = await fetchMediaDetail(connection.value, mediaType, source, mediaId)
  } catch (e) {
    if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
    else error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

watch(() => route.fullPath, load, { immediate: true })
</script>

<template>
  <p v-if="loading" class="muted">Loading…</p>
  <p v-else-if="error" class="error">{{ error }}</p>
  <DetailLayout v-else-if="detail" :detail="detail">
    <component :is="typeComponent(detail.mediaType)" :detail="detail" />
    <PersonRow title="Cast" :people="detail.cast" />
    <PersonRow title="Crew" :people="detail.crew" :max="12" />
  </DetailLayout>
</template>
