<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import TokenHelp from '../components/TokenHelp.vue'
import { testConnection } from '../api/floppy'
import { normalizeUrl, useConnection } from '../stores/connection'

const router = useRouter()
const { connection, save } = useConnection()
const baseUrl = ref(connection.value?.baseUrl ?? '')
const token = ref(connection.value?.token ?? '')
// Normalized instance URL once it looks real enough to link to.
const instanceUrl = computed(() => {
  const raw = baseUrl.value.trim()
  if (!raw) return ''
  try {
    const u = new URL(normalizeUrl(raw))
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return ''
    return normalizeUrl(raw)
  } catch {
    return ''
  }
})
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  const conn = { baseUrl: normalizeUrl(baseUrl.value), token: token.value.trim() }
  try {
    await testConnection(conn)
    save(conn)
    router.push({ name: 'home' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <h1>Connect to Floppy</h1>
    <p class="muted">
      Enter your instance address and an API token (an app token, created in Floppy's settings).
      Both are stored only in this browser.
    </p>
    <label>
      Instance URL
      <input v-model="baseUrl" placeholder="https://floppy.example.com" required autofocus />
    </label>
    <label>
      API token
      <input v-model="token" type="password" autocomplete="off" required />
    </label>
    <TokenHelp v-if="instanceUrl" :base-url="instanceUrl" />
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="busy">{{ busy ? 'Testing…' : 'Connect' }}</button>
  </form>
</template>
