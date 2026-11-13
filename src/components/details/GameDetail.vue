<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtDuration, fmtList, num, str } from '../../utils/format'
import FactList from './FactList.vue'

// Type-specific part of a game detail page (source: IGDB). The shared header lives in DetailView.
const props = defineProps<{ detail: MediaDetail }>()

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null)

const details = computed<Obj>(() => obj(props.detail.details) ?? {})

const facts = computed(() => [
  { label: 'Type', value: str(details.value.format) },
  { label: 'Released', value: fmtDate(details.value.release_date) },
  { label: 'Platforms', value: fmtList(details.value.platforms) },
  { label: 'Themes', value: fmtList(details.value.themes) },
  { label: 'Companies', value: fmtList(details.value.companies) },
])

// Time to beat: provider_game_lengths[active_source].summary, falling back to the first object with a summary.
const summary = computed<Obj | null>(() => {
  const pgl = obj(details.value.provider_game_lengths)
  if (!pgl) return null
  const src = str(pgl.active_source)
  const active = src ? obj(pgl[src]) : null
  if (active?.summary) return obj(active.summary)
  const first = Object.values(pgl)
    .map(obj)
    .find((o) => o?.summary)
  return obj(first?.summary)
})

const timeFacts = computed(() => {
  const s = summary.value
  if (!s) return []
  const count = num(s.count)
  return [
    { label: 'Hastily', value: fmtDuration(s.hastily_seconds) },
    { label: 'Normally', value: fmtDuration(s.normally_seconds) },
    { label: 'Completely', value: fmtDuration(s.completely_seconds) },
    { label: 'Based on', value: count ? `${count} ${count === 1 ? 'report' : 'reports'}` : null },
  ]
})

// Related games: each key is an array of entries, either the item itself or { item: {...} }.
const RELATED = [
  { key: 'parent_game', label: 'Parent game' },
  { key: 'remasters', label: 'Remasters' },
  { key: 'remakes', label: 'Remakes' },
  { key: 'expansions', label: 'Expansions' },
  { key: 'dlcs', label: 'DLCs' },
  { key: 'standalone_expansions', label: 'Standalone expansions' },
  { key: 'expanded_games', label: 'Expanded games' },
]

interface RelatedCard {
  key: string
  title: string
  image: string | null
  to: { name: 'details'; params: { mediaType: string; source: string; mediaId: string } } | null
}

function toCard(raw: unknown, index: number): RelatedCard[] {
  const wrapper = obj(raw)
  if (!wrapper) return []
  const item = obj(wrapper.item) ?? wrapper
  const pick = (k: string) => item[k] ?? wrapper[k]
  const title = str(item.title) ?? str(item.name)
  if (!title) return []
  const source = str(pick('source'))
  const rawId = pick('media_id')
  const mediaId = typeof rawId === 'number' ? String(rawId) : str(rawId)
  return [
    {
      key: `${index}-${title}`,
      title,
      image: str(item.image) ?? str(item.cover),
      to: source && mediaId ? { name: 'details', params: { mediaType: 'game', source, mediaId } } : null,
    },
  ]
}

const groups = computed(() => {
  const related = obj(props.detail.related) ?? {}
  return RELATED.flatMap(({ key, label }) => {
    const v = related[key]
    const list = Array.isArray(v) ? v : v ? [v] : []
    const cards = list.flatMap((raw, i) => toCard(raw, i))
    return cards.length ? [{ key, label, cards }] : []
  })
})
</script>

<template>
  <FactList :facts="facts" />

  <section v-if="timeFacts.length" class="time-to-beat">
    <h2>Time to beat</h2>
    <FactList :facts="timeFacts" />
  </section>

  <section v-for="g in groups" :key="g.key" class="rail">
    <h2>{{ g.label }}</h2>
    <div class="row">
      <figure v-for="c in g.cards" :key="c.key" class="card">
        <RouterLink v-if="c.to" class="card-hit" :to="c.to">
          <img v-if="c.image" :src="c.image" :alt="c.title" loading="lazy" />
          <div v-else class="placeholder">{{ c.title.slice(0, 1) }}</div>
        </RouterLink>
        <template v-else>
          <img v-if="c.image" :src="c.image" :alt="c.title" loading="lazy" />
          <div v-else class="placeholder">{{ c.title.slice(0, 1) }}</div>
        </template>
        <figcaption>{{ c.title }}</figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.time-to-beat { margin-top: 1rem; }
.time-to-beat h2 { font-size: 1rem; margin: 0 0 .5rem; }
</style>
