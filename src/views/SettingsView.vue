<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { REQUIRED_SCOPES } from '../api/scopes'
import { useConnection } from '../stores/connection'

const router = useRouter()
const { connection, clear } = useConnection()

const host = computed(() => {
  try {
    return connection.value ? new URL(connection.value.baseUrl).host : ''
  } catch {
    return connection.value?.baseUrl ?? ''
  }
})

function disconnect() {
  clear()
  router.push({ name: 'connect' })
}
</script>

<template>
  <h1>Settings</h1>

  <p class="group-title muted">Connection</p>
  <van-cell-group inset>
    <van-cell title="Instance" :value="host" :label="connection?.baseUrl" />
    <van-cell title="Change instance or token" is-link :to="{ name: 'connect' }" />
  </van-cell-group>

  <p class="group-title muted">Permissions</p>
  <van-cell-group inset>
    <van-cell title="Token needs" :label="REQUIRED_SCOPES.join(', ')" />
  </van-cell-group>

  <div class="danger-zone">
    <van-button block round plain type="danger" @click="disconnect">Disconnect</van-button>
  </div>
</template>
