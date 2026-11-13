<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import TokenHelp from '../components/TokenHelp.vue'
import { testConnection } from '../api/floppy'
import { normalizeUrl, useConnection } from '../stores/connection'

const router = useRouter()
const { connection, save } = useConnection()
const baseUrl = ref(connection.value?.baseUrl ?? '')
const localBaseUrl = ref(connection.value?.localBaseUrl ?? '')
const localOnly = ref(connection.value?.localOnly ?? false)
const token = ref(connection.value?.token ?? '')
// Normalized instance URL once it looks real enough to link to.
const instanceUrl = computed(() => {
  const raw = (localOnly.value ? localBaseUrl.value : baseUrl.value).trim()
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
  const conn = {
    baseUrl: baseUrl.value.trim() ? normalizeUrl(baseUrl.value) : '',
    localBaseUrl: localBaseUrl.value.trim() ? normalizeUrl(localBaseUrl.value) : undefined,
    localOnly: localOnly.value,
    token: token.value.trim(),
  }
  const previous = connection.value
  if (
    !conn.localOnly && previous?.localBaseUrl &&
    normalizeUrl(previous.baseUrl) !== conn.baseUrl &&
    normalizeUrl(previous.localBaseUrl) === conn.localBaseUrl
  ) {
    conn.localBaseUrl = undefined
  }
  if (localOnly.value && !conn.localBaseUrl) {
    error.value = 'Enter your local Floppy address first.'
    busy.value = false
    return
  }
  if (!localOnly.value && !conn.baseUrl) {
    error.value = 'Enter your Floppy address.'
    busy.value = false
    return
  }
  try {
    await testConnection(conn)
    save(conn)
    router.push({ name: localOnly.value ? 'library' : 'home' })
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
      Enter a Floppy address and an API token (an app token, created in Floppy's settings).
      Both are stored only in this browser.
    </p>
    <label>
      Main instance address
      <input v-model="baseUrl" placeholder="https://floppy.example.com" :required="!localOnly" :disabled="busy" autofocus />
    </label>
    <label>
      Local network address
      <input v-model="localBaseUrl" placeholder="http://192.168.1.25:8000" :required="localOnly" :disabled="busy" />
    </label>
    <label class="check-row">
      <input v-model="localOnly" type="checkbox" :disabled="busy" />
      Use the local address only
    </label>
    <p class="muted">Local-only mode requires your Floppy server to be running on your home network. It does not cache or queue library changes.</p>
    <p class="muted">Use DiskMate over HTTPS and allow any browser local-network prompt. Floppy's CORS settings must allow this site's origin and the app-token headers.</p>
    <label>
      API token
      <input v-model="token" type="password" autocomplete="off" required />
    </label>
    <TokenHelp v-if="instanceUrl" :base-url="instanceUrl" />
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="busy">{{ busy ? 'Testing…' : 'Connect' }}</button>
  </form>
</template>
