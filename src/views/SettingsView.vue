<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { REQUIRED_SCOPES } from '../api/scopes'
import { testConnection } from '../api/floppy'
import { normalizeUrl, useConnection } from '../stores/connection'

const router = useRouter()
const { connection, clear, saveLocalMode } = useConnection()
const localBaseUrl = ref(connection.value?.localBaseUrl ?? '')
const localOnly = ref(connection.value?.localOnly ?? false)
const busy = ref(false)
const error = ref('')

const host = computed(() => {
  try {
    if (!connection.value) return ''
    return new URL(connection.value.localOnly && connection.value.localBaseUrl
      ? connection.value.localBaseUrl
      : connection.value.baseUrl).host
  } catch {
    return connection.value?.baseUrl ?? ''
  }
})

function disconnect() {
  clear()
  router.push({ name: 'connect' })
}

async function saveLocalSettings() {
  if (!connection.value) return
  const originalConnection = connection.value
  const selectedLocalUrl = localBaseUrl.value.trim()
  const selectedLocalOnly = localOnly.value
  const selectedConnection = {
    ...originalConnection,
    localBaseUrl: selectedLocalUrl ? normalizeUrl(selectedLocalUrl) : undefined,
    localOnly: selectedLocalOnly,
  }
  busy.value = true
  error.value = ''
  try {
    if (selectedLocalOnly) {
      if (!selectedLocalUrl) throw new Error('Enter your local Floppy address first.')
    } else if (!originalConnection.baseUrl.trim()) {
      throw new Error('Add a main instance address on the Connect screen before turning off local-only mode.')
    }
    await testConnection(selectedConnection)
    if (connection.value !== originalConnection) return
    saveLocalMode(selectedLocalUrl, selectedLocalOnly)
    if (selectedLocalOnly) router.push({ name: 'library' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h1>Settings</h1>

  <p class="group-title muted">Connection</p>
  <van-cell-group inset>
    <van-cell title="Instance" :value="host" :label="connection?.localOnly ? connection.localBaseUrl : connection?.baseUrl" />
    <van-cell title="Change instance or token" is-link :to="{ name: 'connect' }" />
  </van-cell-group>

  <form class="panel network-settings" @submit.prevent="saveLocalSettings">
    <h2>Local network access</h2>
    <p class="muted">Use the LAN address of your running Floppy server. Local-only mode sends all reads and changes to this address and never falls back to the main address.</p>
    <label>
      Local Floppy address
      <input v-model="localBaseUrl" placeholder="http://192.168.1.25:8000" :disabled="busy" />
    </label>
    <label class="check-row">
      <input v-model="localOnly" type="checkbox" :disabled="busy" />
      Use the local address only
    </label>
    <p class="muted">Your Floppy server must be running and reachable over your home network. Keep DiskMate on HTTPS, allow the browser's local-network prompt, and allow DiskMate's origin in Floppy's CORS settings. This keeps the app shell available offline, but does not store library data or queue changes.</p>
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="busy">{{ busy ? 'Checking…' : 'Save local access' }}</button>
  </form>

  <p class="group-title muted">Permissions</p>
  <van-cell-group inset>
    <van-cell title="Token needs" :label="REQUIRED_SCOPES.join(', ')" />
  </van-cell-group>

  <div class="danger-zone">
    <van-button block round plain type="danger" @click="disconnect">Disconnect</van-button>
  </div>
</template>
