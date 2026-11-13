<script setup lang="ts">
import { ref } from 'vue'
import { testConnection } from '../api/floppy'
import { REQUIRED_SCOPES } from '../api/scopes'
import { useConnection } from '../stores/connection'
import TokenHelp from './TokenHelp.vue'

const { connection, missingScopes, save } = useConnection()
const token = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  if (!connection.value) return
  busy.value = true
  error.value = ''
  const conn = { baseUrl: connection.value.baseUrl, token: token.value.trim() }
  try {
    await testConnection(conn)
    save(conn)
    token.value = ''
    // Views loaded with the old token re-fetch on the next navigation / reload.
    location.reload()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <aside v-if="connection && missingScopes.length" class="banner" role="alert">
    <strong>DiskMate needs more permissions</strong>
    <p>
      Your current token is missing:
      <code v-for="s in missingScopes" :key="s">{{ s }}</code>.
      Create a <em>new</em> app token with all {{ REQUIRED_SCOPES.length }} permissions below and paste it here
      (you can revoke the old one afterwards).
    </p>
    <TokenHelp :base-url="connection.baseUrl" :highlight="missingScopes" />
    <form @submit.prevent="submit">
      <input v-model="token" type="password" autocomplete="off" placeholder="New API token" required />
      <button :disabled="busy">{{ busy ? 'Testing…' : 'Update token' }}</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
  </aside>
</template>
