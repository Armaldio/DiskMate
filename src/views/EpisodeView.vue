<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  fetchEpisodeDetail,
  fetchMediaDetail,
  type MediaDetail,
  type NextEpisode,
  type Person,
} from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'
import { useRefreshStatus } from '../stores/refresh'
import { cacheKey, detailName, dropCached, swr } from '../utils/swr'
import { fmtDate, num, str } from '../utils/format'
import FactList from '../components/details/FactList.vue'
import PersonRow from '../components/details/PersonRow.vue'
import MarkWatchedSheet from '../components/MarkWatchedSheet.vue'
import MediaIcon from '../components/MediaIcon.vue'

const route = useRoute()
const { connection, reportMissingScopes } = useConnection()

const episode = ref<MediaDetail | null>(null)
const show = ref<MediaDetail | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const staleNote = ref(false)
const error = ref('')
const sheetOpen = ref(false)
useRefreshStatus(refreshing, staleNote)
let run = 0

const p = computed(() => route.params as Record<string, string>)
const code = computed(() => `S${String(p.value.season).padStart(2, '0')}E${String(p.value.episode).padStart(2, '0')}`)

async function load() {
  const conn = connection.value
  if (!conn) return
  const me = ++run
  const { mediaType, source, mediaId, season, episode: ep } = p.value
  loading.value = true
  refreshing.value = true
  staleNote.value = false
  error.value = ''
  episode.value = null
  show.value = null
  const keep = <T>(target: { value: T | null }) => (d: T) => {
    if (me === run && JSON.stringify(target.value) !== JSON.stringify(d)) target.value = d
  }
  await Promise.all([
    swr<MediaDetail>(
      cacheKey(conn, `episode:${mediaType}/${source}/${mediaId}/${season}/${ep}`),
      () => fetchEpisodeDetail(conn, mediaType, source, mediaId, season, ep),
      {
        onData: (d) => {
          keep(episode)(d)
          if (me === run) loading.value = false
        },
        onError: (e, hadCache) => {
          if (me !== run) return
          if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
          else if (hadCache) staleNote.value = true
          else error.value = e instanceof Error ? e.message : String(e)
        },
      },
    ),
    // The show gives the episode its context (title, poster); the same cache as the show's own page.
    swr<MediaDetail>(cacheKey(conn, detailName(mediaType, source, mediaId)), () => fetchMediaDetail(conn, mediaType, source, mediaId), {
      onData: (d) => keep(show)(d),
    }),
  ])
  if (me === run) {
    refreshing.value = false
    loading.value = false
  }
}
watch(() => route.fullPath, load, { immediate: true })

/** After marking watched: forget the saved copy (it says "not watched") and reload. */
function afterMarked() {
  const { mediaType, source, mediaId, season, episode: ep } = p.value
  if (connection.value) dropCached(cacheKey(connection.value, `episode:${mediaType}/${source}/${mediaId}/${season}/${ep}`))
  load()
}

const d = computed(() => episode.value?.details ?? {})
const watched = computed(() => episode.value?.entry?.status === 3)
const watchedOn = computed(() => fmtDate(episode.value?.entry?.endDate))

const facts = computed(() => [
  { label: 'Aired', value: fmtDate(d.value.air_date) },
  { label: 'Runtime', value: num(d.value.runtime) ? `${d.value.runtime} min` : str(d.value.runtime) },
  { label: 'Type', value: str(d.value.episode_type)?.replace(/^\w/, (c) => c.toUpperCase()) },
  { label: 'Community score', value: episode.value?.score != null ? `${episode.value.score.toFixed(1)} / 10` : null },
])

// guest_stars / crew come inside `details` as plain arrays of people.
const people = (v: unknown): Person[] =>
  (Array.isArray(v) ? (v as Record<string, unknown>[]) : []).flatMap((x): Person[] => {
    const name = str(x.name)
    return name ? [{ id: String(x.person_id ?? x.credit_id ?? name), name, image: str(x.image) ?? str(x.profile_path), role: str(x.character) ?? str(x.job) }] : []
  })

// The sheet works on the same episode shape the home cards use.
const asNextEpisode = computed<NextEpisode | null>(() => {
  const e = episode.value
  if (!e) return null
  return {
    mediaId: p.value.mediaId,
    source: p.value.source,
    seasonNumber: Number(p.value.season),
    episodeNumber: Number(p.value.episode),
    showTitle: show.value?.title ?? '',
    mediaType: p.value.mediaType,
    episodeCode: code.value,
    episodeTitle: e.title,
    airDate: str(d.value.air_date),
    episodesLeft: null,
    watchedRatio: null,
    image: e.image,
    poster: show.value?.image ?? null,
    seasonImage: null,
    lastWatched: null,
  }
})
</script>

<template>
  <p v-if="loading" class="muted">Loading…</p>
  <p v-else-if="error" class="error">{{ error }}</p>
  <article v-else-if="episode" class="detail">
    <header class="hero" :style="episode.backdrop ? { backgroundImage: `url(${episode.backdrop})` } : undefined">
      <div class="hero-fade" />
      <div class="hero-row">
        <img v-if="episode.image" class="still" :src="episode.image" :alt="episode.title" />
        <div class="hero-text">
          <p class="kind"><MediaIcon type="tv" :size="16" /> {{ code }}</p>
          <h1>{{ episode.title }}</h1>
          <RouterLink
            v-if="show"
            class="show-link"
            :to="{ name: 'details', params: { mediaType: p.mediaType, source: p.source, mediaId: p.mediaId } }"
          >
            {{ show.title }} ›
          </RouterLink>
        </div>
      </div>
    </header>

    <div class="detail-body">
      <div class="actions-row">
        <button class="primary-action" @click="sheetOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
          {{ watched ? 'Watch again' : 'Mark as watched' }}
        </button>
        <a v-if="episode.sourceUrl" class="link-action" :href="episode.sourceUrl" target="_blank" rel="noopener noreferrer">
          {{ episode.source }} ↗
        </a>
      </div>

      <p v-if="watched" class="watched-line">✓ Watched<template v-if="watchedOn"> on {{ watchedOn }}</template></p>

      <p v-if="episode.synopsis" class="synopsis">{{ episode.synopsis }}</p>

      <FactList :facts="facts" />
      <PersonRow title="Guest stars" :people="people(d.guest_stars)" />
      <PersonRow title="Crew" :people="people(d.crew)" :max="12" />
    </div>

    <MarkWatchedSheet v-if="sheetOpen && asNextEpisode" :ep="asNextEpisode" @close="sheetOpen = false" @done="afterMarked" />
  </article>
</template>
