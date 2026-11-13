<script setup lang="ts">
import { computed, ref } from 'vue'
import { addToWatchlist, removeFromWatchlist, type MediaDetail, type MediaItem } from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'
import MarkWatchedSheet from './MarkWatchedSheet.vue'
import MediaIcon from './MediaIcon.vue'
import { mediaColor } from '../utils/mediaTypes'

const props = defineProps<{ detail: MediaDetail }>()
const { connection, reportMissingScopes } = useConnection()
const expanded = ref(false)

// Watchlist = a tracked entry with status Planning (0).
const labels = ['On your watchlist', 'In progress', 'Paused', 'Completed', 'Dropped']
const tracked = ref(props.detail.tracked)
const status = ref<number | null>(props.detail.status)
const busy = ref(false)
const confirming = ref(false)
const wlError = ref('')
// Only a pure watchlist entry can be removed here: removing deletes the history too.
const removable = computed(() => tracked.value && status.value === 0)
const wlLabel = computed(() => (tracked.value ? labels[status.value ?? 0] ?? 'Tracked' : 'Add to watchlist'))

async function addWl() {
  if (!connection.value) return
  busy.value = true
  wlError.value = ''
  try {
    status.value = await addToWatchlist(connection.value, props.detail)
    tracked.value = true
  } catch (e) {
    if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
    else wlError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removeWl() {
  if (!connection.value) return
  busy.value = true
  wlError.value = ''
  try {
    await removeFromWatchlist(connection.value, props.detail)
    tracked.value = false
    status.value = null
  } catch (e) {
    if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
    else wlError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function onWlClick() {
  if (!tracked.value) addWl()
  else if (removable.value) confirming.value = true
}
const sheetOpen = ref(false)

// Only movies can be marked from here for now (episodes are marked from the home page).
const movie = computed<MediaItem | null>(() =>
  props.detail.mediaType === 'movie'
    ? {
        mediaType: 'movie',
        source: props.detail.source,
        mediaId: props.detail.mediaId,
        title: props.detail.title,
        image: props.detail.image,
        releaseDate: typeof props.detail.details.release_date === 'string' ? props.detail.details.release_date : null,
      }
    : null,
)
</script>

<template>
  <article class="detail">
    <header class="hero" :style="detail.backdrop ? { backgroundImage: `url(${detail.backdrop})` } : undefined">
      <div class="hero-fade" />
      <div class="hero-row">
        <img v-if="detail.image" class="poster" :src="detail.image" :alt="detail.title" />
        <div v-else class="poster placeholder">{{ detail.title.slice(0, 1) }}</div>
        <div class="hero-text">
          <p class="kind" :style="{ color: mediaColor(detail.mediaType) }">
            <MediaIcon :type="detail.mediaType" :size="16" /> {{ detail.mediaType }}
          </p>
          <h1>{{ detail.title }}</h1>
          <p v-if="detail.score != null" class="score">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/></svg>
            {{ detail.score.toFixed(1) }}<span v-if="detail.scoreCount" class="muted"> · {{ detail.scoreCount.toLocaleString() }}</span>
          </p>
        </div>
      </div>
    </header>

    <div class="detail-body">
      <div v-if="detail.genres.length" class="chips">
        <span v-for="g in detail.genres" :key="g" class="chip-tag">{{ g }}</span>
      </div>

      <div class="actions-row">
        <button v-if="movie" class="primary-action" @click="sheetOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
          Mark as watched
        </button>
        <button
          class="wl-btn"
          :class="{ on: tracked }"
          :disabled="busy || (tracked && !removable)"
          :aria-pressed="tracked"
          @click="onWlClick"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" :fill="tracked ? 'currentColor' : 'none'"/></svg>
          {{ busy ? '…' : wlLabel }}
        </button>
        <a v-if="detail.sourceUrl" class="link-action" :href="detail.sourceUrl" target="_blank" rel="noopener noreferrer">
          {{ detail.source }} ↗
        </a>
      </div>

      <p v-if="wlError" class="error">{{ wlError }}</p>

      <p v-if="detail.synopsis" class="synopsis" :class="{ clamp: !expanded }" @click="expanded = !expanded">
        {{ detail.synopsis }}
      </p>

      <slot />
    </div>

    <van-dialog
      v-model:show="confirming"
      title="Remove from watchlist?"
      message="It will no longer be tracked."
      show-cancel-button
      confirm-button-text="Remove"
      confirm-button-color="#ee0a24"
      @confirm="removeWl"
    />

    <MarkWatchedSheet v-if="sheetOpen && movie" :movie="movie" @close="sheetOpen = false" />
  </article>
</template>
