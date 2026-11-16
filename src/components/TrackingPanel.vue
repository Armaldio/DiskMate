<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { updateTracking, type MediaDetail, type TrackingPatch } from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'
import { cacheKey, detailName, dropCached } from '../utils/swr'
import { trackingWords } from '../utils/statusLabels'

const props = defineProps<{ detail: MediaDetail; tracked: boolean }>()
const emit = defineEmits<{ saved: [status: number] }>()

const { connection, reportMissingScopes } = useConnection()

const STATUS_COLORS = ['#8b8d9c', '#4dabf7', '#ffa94d', '#51cf66', '#ff6b6b']
// Labels follow the media (a game is "Playing", a book "Reading"…).
const STATUSES = computed(() => trackingWords(props.detail.mediaType).statuses.map((label, id) => ({ id, label, color: STATUS_COLORS[id] })))

// Progress only means something we can edit for these (tv/anime/podcast progress follows watched episodes).
const PROGRESS_UNIT: Record<string, string> = { book: 'Pages', manga: 'Chapters', comic: 'Issues' }
const unit = computed(() => PROGRESS_UNIT[props.detail.mediaType] ?? null)

const entry = props.detail.entry
const status = ref<number | null>(entry?.status ?? null)
const stars = ref((entry?.score ?? 0) / 2) // 0-10 score = half-star rating
const progress = ref(entry?.progress ?? 0)
const notes = ref(entry?.notes ?? '')
const isTracked = ref(props.tracked)
watch(() => props.tracked, (t) => (isTracked.value = t))

// ISO date-time <-> the day shown in a native <input type="date"> (local day).
const pad = (n: number) => String(n).padStart(2, '0')
const toDay = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// Noon UTC keeps the same calendar day in every timezone within ±12h.
const fromDay = (day: string) => (day ? `${day}T12:00:00Z` : null)
const start = ref(toDay(entry?.startDate))
const end = ref(toDay(entry?.endDate))
const today = toDay(new Date().toISOString())

const saving = ref(false)
const savedAt = ref(0)
const error = ref('')
let queue: Promise<void> = Promise.resolve()

/** Saves one change; changes are applied in order so a quick second edit can't overtake the first. */
function save(patch: TrackingPatch) {
  queue = queue.then(async () => {
    if (!connection.value) return
    saving.value = true
    error.value = ''
    try {
      await updateTracking(connection.value, props.detail, patch, isTracked.value)
      isTracked.value = true
      dropCached(cacheKey(connection.value, detailName(props.detail.mediaType, props.detail.source, props.detail.mediaId)))
      if (status.value == null) status.value = patch.status ?? 0
      savedAt.value = Date.now()
      emit('saved', status.value)
    } catch (e) {
      if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes)
      else error.value = e instanceof Error ? e.message : String(e)
    } finally {
      saving.value = false
    }
  })
}

function setStatus(id: number) {
  if (status.value === id && isTracked.value) return
  status.value = id
  save({ status: id })
}
let rateTimer: ReturnType<typeof setTimeout> | undefined
function onRate(v: number) {
  clearTimeout(rateTimer)
  // Debounced: the user may tap through a few stars before settling.
  rateTimer = setTimeout(() => save({ score: v > 0 ? v * 2 : null }), 400)
}
let progTimer: ReturnType<typeof setTimeout> | undefined
function onProgress(v: number) {
  clearTimeout(progTimer)
  progTimer = setTimeout(() => save({ progress: Number(v) || 0 }), 500)
}
function onDate(which: 'start' | 'end') {
  save(which === 'start' ? { start_date: fromDay(start.value) } : { end_date: fromDay(end.value) })
}
function clearDate(which: 'start' | 'end') {
  if (which === 'start') start.value = ''
  else end.value = ''
  onDate(which)
}
let lastNotes = notes.value
function onNotesBlur() {
  if (notes.value === lastNotes) return
  lastNotes = notes.value
  save({ notes: notes.value })
}

const savedVisible = computed(() => savedAt.value > 0 && !saving.value && !error.value)
</script>

<template>
  <section class="tracking" aria-label="Your tracking">
    <header class="tracking-head">
      <h2>Your tracking</h2>
      <span v-if="saving" class="muted state">Saving…</span>
      <span v-else-if="savedVisible" class="state ok">Saved ✓</span>
    </header>
    <p v-if="!isTracked" class="muted hint-line">Set anything below to start tracking this.</p>

    <div class="status-row" role="radiogroup" aria-label="Status">
      <button
        v-for="s in STATUSES"
        :key="s.id"
        role="radio"
        :aria-checked="status === s.id"
        class="status-chip"
        :class="{ on: status === s.id }"
        :style="{ '--c': s.color }"
        @click="setStatus(s.id)"
      >
        {{ s.label }}
      </button>
    </div>

    <div class="info-card">
      <div class="panel-row">
        <span class="label">Rating</span>
        <div class="rating">
          <van-rate v-model="stars" allow-half clearable :size="22" :gutter="3" void-icon="star" void-color="#3a3c4e" color="#f2c94c" @change="onRate" />
          <span class="muted score-text">{{ stars > 0 ? (stars * 2).toFixed(1) : '—' }}</span>
        </div>
      </div>

      <div v-if="unit" class="panel-row">
        <span class="label">{{ unit }}</span>
        <van-stepper
          v-model="progress"
          :min="0"
          :max="detail.maxProgress && detail.maxProgress > 0 ? detail.maxProgress : undefined"
          integer
          @change="onProgress"
        />
      </div>

      <div class="panel-row">
        <span class="label">Started</span>
        <span class="date-field">
          <input v-model="start" type="date" :max="today" aria-label="Start date" @change="onDate('start')" />
          <button v-if="start" class="x-btn" aria-label="Clear start date" @click="clearDate('start')">×</button>
        </span>
      </div>

      <div class="panel-row">
        <span class="label">Finished</span>
        <span class="date-field">
          <input v-model="end" type="date" :max="today" aria-label="End date" @change="onDate('end')" />
          <button v-if="end" class="x-btn" aria-label="Clear end date" @click="clearDate('end')">×</button>
        </span>
      </div>

      <div class="panel-row stack">
        <label class="label" for="tracking-notes">Notes</label>
        <textarea id="tracking-notes" v-model="notes" rows="3" maxlength="2000" placeholder="Your notes…" @blur="onNotesBlur" />
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.tracking-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: .75rem; }
.tracking-head h2 { margin: 0; }
.state { font-size: .8rem; }
.ok { color: #51cf66; }
.hint-line { margin: -.25rem 0 .75rem; font-size: .85rem; }
.status-row { display: flex; gap: .5rem; overflow-x: auto; padding: 0 0 .75rem; }
.status-chip { flex: none; height: 34px; padding: 0 .8rem; border: 1px solid #333649; border-radius: 999px; background: transparent; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 1; }
.status-chip.on { background: color-mix(in srgb, var(--c) 22%, transparent); border-color: var(--c); color: var(--c); }
.rating { display: flex; flex-wrap: nowrap; align-items: center; gap: .6rem; }
.score-text { min-width: 1.8rem; text-align: right; font-size: .9rem; font-weight: 600; }
.date-field { display: inline-flex; align-items: center; gap: .35rem; }
.date-field input { height: 36px; padding: 0 .6rem; border-radius: 10px; border: 1px solid #333649; background: #202129; color: inherit; font: inherit; font-size: .9rem; }
.x-btn { width: 32px; height: 32px; padding: 0; border-radius: 50%; background: transparent; color: var(--muted); font-size: 1.2rem; line-height: 1; }
textarea { width: 100%; padding: .6rem .75rem; border-radius: 10px; border: 1px solid #333649; background: #202129; color: inherit; font: inherit; font-size: .95rem; resize: vertical; }
</style>
