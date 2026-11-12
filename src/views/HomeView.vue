<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchDiscover, type Rail } from '../api/floppy'
import { useConnection } from '../stores/connection'
import MediaCard from '../components/MediaCard.vue'

const { connection } = useConnection()
const rails = ref<Rail[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  if (!connection.value) return
  try {
    rails.value = await fetchDiscover(connection.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
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
