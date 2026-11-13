<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { testConnection } from '../api/floppy'
import { normalizeUrl, useConnection } from '../stores/connection'

const router = useRouter()
const { connection, save } = useConnection()
const baseUrl = ref(connection.value?.baseUrl ?? '')
const token = ref(connection.value?.token ?? '')
// Deep link to the page in Floppy where the API token lives.
const tokenUrl = computed(() => {
  const raw = baseUrl.value.trim()
  if (!raw) return ''
  try {
    const u = new URL(normalizeUrl(raw))
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return ''
    return `${normalizeUrl(raw)}/settings/integrations`
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
    <div v-if="tokenUrl" class="muted help">
      <p>
        <a :href="tokenUrl" target="_blank" rel="noopener noreferrer">Open your Floppy integrations settings</a>,
        then:
      </p>
      <ol>
        <li>Under <strong>App tokens</strong>, expand <strong>Create an app token</strong>, name it "DiskMate" and create it.</li>
        <li>
          Grant at least <code>user:read</code> and <code>catalog:read</code>. DiskMate only reads
          (trending and connection check) so far; add <code>watchlist:*</code> / <code>progress:*</code> later when tracking is added.
        </li>
        <li>Copy the <code>flp_…</code> token (shown once) and paste it above.</li>
      </ol>
      <p>
        Don't use the top-level <strong>Jeton d'API / API token</strong>: it's the full-access webhook token for your account.
      </p>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="busy">{{ busy ? 'Testing…' : 'Connect' }}</button>
  </form>
</template>
