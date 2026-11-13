<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  fetchSeasonEpisodes,
  markEpisodeWatched,
  markMovieWatched,
  type MediaItem,
  type NextEpisode,
  type SeasonEpisode,
} from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'

// Either a TV/anime episode (with its season's episodes) or a movie.
const props = defineProps<{ ep?: NextEpisode; movie?: MediaItem }>()
const isMovie = computed(() => !!props.movie)
const emit = defineEmits<{ close: []; done: [] }>()

const { connection, reportMissingScopes } = useConnection()

const show = ref(true)
type Mode = 'now' | 'release' | 'custom'
const releaseOf = computed(() => (props.movie ? props.movie.releaseDate : null))
const modes = computed<{ id: Mode; label: string }[]>(() => [
  { id: 'now', label: 'Now' },
  ...(isMovie.value && !releaseOf.value
    ? []
    : [{ id: 'release' as Mode, label: isMovie.value ? 'Release date' : 'Release date of the episodes' }]),
  { id: 'custom', label: 'Custom date' },
])

const pad = (n: number) => String(n).padStart(2, '0')
const nowParts = () => {
  const d = new Date()
  return {
    date: [String(d.getFullYear()), pad(d.getMonth() + 1), pad(d.getDate())],
    time: [pad(d.getHours()), pad(d.getMinutes())],
  }
}

const mode = ref<Mode>('now')
const date = ref(nowParts().date)
const time = ref(nowParts().time)
const maxDate = new Date()
const pickerOpen = ref(false)

const episodes = ref<SeasonEpisode[]>([])
const loadingEps = ref(true)
const upTo = ref(props.ep?.episodeNumber ?? 0)

const busy = ref(false)
const error = ref('')
const marked = ref(0)

const title = computed(() => props.ep?.showTitle ?? props.movie?.title ?? '')
const poster = computed(() => props.ep?.poster ?? props.movie?.image ?? null)
const label = computed(() => `${title.value} ${props.ep?.episodeCode ?? ''}`.trim())

// Rating in stars (halves allowed) = a 0-10 score; notes are free text.
const stars = ref(0)
const notes = ref('')
const extras = computed(() => ({
  ...(stars.value > 0 ? { score: stars.value * 2 } : {}),
  ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
}))
const marksCount = computed(() => episodes.value.filter((e) => e.number <= upTo.value).length)
const code = (n: number) => `S${pad(props.ep?.seasonNumber ?? 0)}E${pad(n)}`

const asDate = computed(() => new Date(`${date.value.join('-')}T${time.value.join(':')}:00`))
const dateText = computed(() => asDate.value.toLocaleDateString(undefined, { dateStyle: 'long' }))
const timeText = computed(() =>
  asDate.value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
)

onMounted(async () => {
  if (!props.ep) {
    loadingEps.value = false
    syncPickerToMode()
    return
  }
  try {
    if (connection.value) episodes.value = await fetchSeasonEpisodes(connection.value, props.ep)
  } catch (e) {
    if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
  } finally {
    loadingEps.value = false
  }
  if (!episodes.value.length && props.ep.episodeNumber != null) {
    episodes.value = [
      {
        number: props.ep.episodeNumber,
        title: props.ep.episodeTitle,
        image: props.ep.image,
        airDate: props.ep.airDate,
      },
    ]
  }
  syncPickerToMode()
})

/** Air date of an episode; the list may omit it, but we always know the next episode's. */
function airOf(e: SeasonEpisode): string | null {
  return e.airDate ?? (e.number === props.ep?.episodeNumber ? props.ep.airDate : null)
}

/** The date/time pickers always show what the chosen mode would record. */
function syncPickerToMode() {
  if (mode.value === 'now') {
    const n = nowParts()
    date.value = n.date
    time.value = n.time
  } else if (mode.value === 'release') {
    const first = episodes.value.find((e) => e.number === props.ep?.episodeNumber) ?? episodes.value[0]
    const air = (props.movie ? props.movie.releaseDate : first ? airOf(first) : props.ep?.airDate)?.slice(0, 10)
    if (air) {
      date.value = air.split('-')
      time.value = ['12', '00']
    }
  }
}

function pickMode(m: Mode) {
  mode.value = m
  syncPickerToMode()
  if (m === 'custom') pickerOpen.value = true
}

function openPicker() {
  pickerOpen.value = true
}

function confirmPicker() {
  mode.value = 'custom' // editing the picker means a custom moment
  pickerOpen.value = false
}

/** Local wall-clock time → UTC ISO (Floppy reads a zone-less time as the *server's* timezone). */
const toUtc = (local: string) => new Date(local).toISOString().slice(0, 19) + 'Z'

function whenFor(e?: SeasonEpisode): string | undefined {
  if (mode.value === 'now') return undefined
  if (mode.value === 'release') {
    const air = e ? airOf(e) : props.movie?.releaseDate
    return air ? toUtc(`${air.slice(0, 10)}T12:00:00`) : undefined
  }
  return toUtc(`${date.value.join('-')}T${time.value.join(':')}:00`)
}

async function submit() {
  if (!connection.value) return
  busy.value = true
  error.value = ''
  const todo = episodes.value.filter((e) => e.number <= upTo.value)
  try {
    if (props.movie) {
      await markMovieWatched(connection.value, props.movie, whenFor(), extras.value)
      marked.value++
    } else if (props.ep) {
      // One watch per episode, in order, stopping at the first failure.
      // Rating and notes belong to the last episode only.
      for (const [i, e] of todo.entries()) {
        const last = i === todo.length - 1
        await markEpisodeWatched(connection.value, props.ep, e.number, whenFor(e), last ? extras.value : {})
        marked.value++
      }
    }
    show.value = false
  } catch (e) {
    if (e instanceof InsufficientScopeError) {
      reportMissingScopes(e.scopes)
      show.value = false
    } else {
      error.value =
        (e instanceof Error ? e.message : String(e)) +
        (marked.value && !props.movie ? ` (${marked.value} of ${todo.length} marked)` : '')
    }
  } finally {
    busy.value = false
  }
}

function onClosed() {
  if (marked.value) emit('done')
  emit('close')
}
</script>

<template>
  <van-popup
    v-model:show="show"
    position="bottom"
    round
    closeable
    close-icon-position="top-left"
    teleport="body"
    safe-area-inset-bottom
    class="sheet"
    @closed="onClosed"
  >
    <div class="sheet-body">
      <h3 class="sheet-title">Mark as watched</h3>
      <p class="chip">
        <img v-if="poster" :src="poster" alt="" />
        {{ title }}
      </p>

      <van-cell-group inset class="when">
        <van-cell
          :title="dateText"
          is-link
          :arrow-direction="'down'"
          @click="openPicker"
        >
          <template #value>{{ timeText }}</template>
        </van-cell>
      </van-cell-group>

      <van-radio-group :model-value="mode">
        <van-cell-group inset>
          <van-cell v-for="m in modes" :key="m.id" :title="m.label" clickable @click="pickMode(m.id)">
            <template #right-icon><van-radio :name="m.id" @click.stop="pickMode(m.id)" /></template>
          </van-cell>
        </van-cell-group>
      </van-radio-group>

      <h4 v-if="!isMovie" class="sheet-sub">Watched up to …</h4>
      <van-loading v-if="loadingEps && !isMovie" class="loading" />
      <van-radio-group v-if="!isMovie" v-model="upTo">
        <van-cell-group inset>
          <van-cell v-for="e in episodes" :key="e.number" clickable center @click="upTo = e.number">
            <template #icon>
              <img v-if="e.image" class="thumb" :src="e.image" alt="" loading="lazy" />
              <span v-else class="thumb" />
            </template>
            <template #title>{{ e.title ?? code(e.number) }}</template>
            <template #label>{{ code(e.number) }}</template>
            <template #right-icon><van-radio :name="e.number" /></template>
          </van-cell>
        </van-cell-group>
      </van-radio-group>

      <h4 class="sheet-sub">Rating &amp; notes</h4>
      <van-cell-group inset>
        <van-cell title="Rating" center>
          <template #value>
            <van-rate v-model="stars" allow-half clearable :size="26" void-icon="star" void-color="#3a3c4e" />
          </template>
        </van-cell>
        <van-field v-model="notes" type="textarea" rows="2" autosize maxlength="500" placeholder="Notes (optional)" />
      </van-cell-group>
      <p v-if="!isMovie && marksCount > 1" class="hint muted">
        Several episodes: the rating and notes are saved on the last one.
      </p>
    </div>

    <div class="sheet-foot">
      <p v-if="error" class="error">{{ error }}</p>
      <van-button block round type="primary" size="large" :loading="busy" :aria-label="`Mark ${label} as watched`" @click="submit">
        Mark as watched
      </van-button>
    </div>

    <van-popup v-model:show="pickerOpen" position="bottom" round teleport="body" safe-area-inset-bottom>
      <van-picker-group title="Watched on" :tabs="['Date', 'Time']" @confirm="confirmPicker" @cancel="pickerOpen = false">
        <van-date-picker v-model="date" :max-date="maxDate" />
        <van-time-picker v-model="time" />
      </van-picker-group>
    </van-popup>
  </van-popup>
</template>

<style scoped>
.sheet { max-height: calc(100dvh - 3rem); display: flex; flex-direction: column; }
.sheet-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 1rem 0 .5rem; }
.sheet-title { margin: 0; text-align: center; font-size: 1.15rem; line-height: 44px; }
.chip { display: flex; align-items: center; gap: .5rem; width: fit-content; margin: .5rem auto 1rem; padding: .25rem .75rem .25rem .3rem; border: 1px solid #3a3c4e; border-radius: 10px; }
.chip img { width: 24px; height: 36px; object-fit: cover; border-radius: 4px; }
.when { margin-bottom: .6rem; }
.sheet-sub { margin: 1.25rem 0 .75rem; text-align: center; font-size: 1.15rem; font-weight: 500; }
.loading { display: block; text-align: center; }
.hint { margin: .5rem 1rem 0; font-size: .8rem; }
.thumb { flex: none; width: 5.5rem; height: 3.2rem; margin-right: .75rem; object-fit: cover; border-radius: 6px; background: #2a2c38; }
.sheet-foot { flex: none; padding: .75rem 1rem; }
</style>
