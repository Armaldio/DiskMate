<script setup lang="ts">
import { useRouter } from 'vue-router'
import ScopeBanner from './components/ScopeBanner.vue'
import { useConnection } from './stores/connection'

const router = useRouter()
const { connection, isConnected, clear } = useConnection()

function disconnect() {
  clear()
  router.push({ name: 'connect' })
}
</script>

<template>
  <header class="bar">
    <RouterLink to="/" class="brand">💾 DiskMate</RouterLink>
    <div v-if="isConnected" class="conn">
      <span class="muted">{{ connection?.baseUrl }}</span>
      <button class="ghost" @click="disconnect">Disconnect</button>
    </div>
  </header>
  <ScopeBanner />
  <main><RouterView /></main>
</template>
