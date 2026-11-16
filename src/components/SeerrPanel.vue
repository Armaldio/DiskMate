<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchSeerr, requestInSeerr, type MediaDetail, type SeerrState } from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'

const props = defineProps<{ detail: MediaDetail }>()
const { connection, reportMissingScopes } = useConnection()

// Seerr's own statuses, in plain words.
const STATUS: Record<string, { label: string; color: string }> = {
  unknown: { label: 'Not requested', color: '#8b8d9c' },
  pending: { label: 'Pending approval', color: '#ffa94d' },
  processing: { label: 'Processing', color: '#4dabf7' },
  partially_available: { label: 'Partially available', color: '#3bc9db' },
  available: { label: 'Available', color: '#51cf66' },
}
const info = (s: string) => STATUS[s] ?? { label: s.replace(/_/g, ' '), color: '#8b8d9c' }

const state = ref<SeerrState | null>(null)
const picked = ref<number[]>([])
const confirming = ref(false)
const pending = ref<{ seasons?: number[]; text: string } | null>(null)
const busy = ref(false)
const error = ref('')
const done = ref(false)

// Seerr requests exist for movies and shows (anime goes through TV in Seerr; if it isn't found, the panel stays hidden).
const supported = computed(() => ['movie', 'tv', 'anime'].includes(props.detail.mediaType))
const requestableSeasons = computed(() => state.value?.seasons.filter((s) => s.requestable) ?? [])
const isShow = computed(() => (state.value?.seasons.length ?? 0) > 0)

async function load() {
  if (!connection.value || !supported.value) return
  try {
    state.value = await fetchSeerr(connection.value, props.detail)
  } catch (e) {
    if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
  }
}
onMounted(load)

function ask(seasons?: number[]) {
  const n = seasons?.length
  pending.value = {
    seasons,
    text: n ? `Request ${n} season${n > 1 ? 's' : ''} of “${props.detail.title}” in Seerr?` : `Request “${props.detail.title}” in Seerr?`,
  }
  confirming.value = true
}

async function send() {
  if (!connection.value || !pending.value) return
  busy.value = true
  error.value = ''
  try {
    await requestInSeerr(connection.value, props.detail, pending.value.seasons)
    done.value = true
    picked.value = []
    await load()
  } catch (e) {
    if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes) // needs catalog:write
    else error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="state" class="seerr" aria-label="Seerr">
    <header class="seerr-head">
      <h2>Seerr</h2>
      <span class="status" :style="{ '--c': info(state.status).color }">{{ info(state.status).label }}</span>
    </header>

    <div v-if="isShow" class="info-card seasons">
      <van-checkbox-group v-model="picked">
        <div v-for="s in state.seasons" :key="s.number" class="panel-row">
          <span class="season-name">
            <van-checkbox v-if="s.requestable" :name="s.number" class="season-check" />
            <span v-else class="season-check placeholder" />
            {{ s.name }}
          </span>
          <span class="status small" :style="{ '--c': info(s.status).color }">{{ info(s.status).label }}</span>
        </div>
      </van-checkbox-group>
    </div>

    <div class="seerr-actions">
      <template v-if="isShow">
        <button :disabled="!picked.length || busy" @click="ask(picked)">{{ picked.length ? `Request ${picked.length} selected` : 'Request selected' }}</button>
        <button class="ghost" :disabled="!requestableSeasons.length || busy" @click="ask(requestableSeasons.map((s) => s.number))">
          Request all missing
        </button>
      </template>
      <button v-else-if="state.requestable" :disabled="busy" @click="ask()">Request in Seerr</button>
      <a v-if="state.url" class="link-action" :href="state.url" target="_blank" rel="noopener noreferrer">Open in Seerr ↗</a>
    </div>

    <p v-if="done && !error" class="ok">Requested ✓</p>
    <p v-if="error" class="error">{{ error }}</p>

    <van-dialog
      v-model:show="confirming"
      title="Send request"
      :message="pending?.text"
      show-cancel-button
      confirm-button-text="Request"
      @confirm="send"
    />
  </section>
</template>

<style scoped>
.seerr-head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .75rem; }
.seerr-head h2 { margin: 0; }
.status { padding: .2rem .65rem; border-radius: 999px; background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); font-size: .8rem; font-weight: 600; white-space: nowrap; }
.status.small { font-size: .72rem; padding: .1rem .5rem; }
.seasons { margin: 0 0 .75rem; }
.season-name { display: inline-flex; align-items: center; gap: .75rem; min-width: 0; }
.season-check { width: 22px; height: 22px; flex: none; }
.seerr-actions { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }
.seerr-actions button { min-height: 44px; padding: 0 1.1rem; border-radius: 12px; }
.ok { margin: .6rem 0 0; color: #51cf66; font-size: .9rem; }
</style>
