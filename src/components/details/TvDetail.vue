<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtDuration, fmtList, fmtNumber, num, str } from '../../utils/format'
import FactList from './FactList.vue'

// Type-specific part of a TV show page (the shared header is rendered by DetailView).
const props = defineProps<{ detail: MediaDetail }>()

const facts = computed(() => {
  const d = props.detail.details
  // Runtime may be a string ("45 min") or a number of minutes (assumed; fmtDuration takes seconds).
  const runtime = typeof d.runtime === 'number' ? fmtDuration(num(d.runtime)! * 60) : str(d.runtime)
  return [
    { label: 'Status', value: str(d.status) },
    { label: 'First aired', value: fmtDate(d.first_air_date) },
    { label: 'Last aired', value: fmtDate(d.last_air_date) },
    { label: 'Seasons', value: fmtNumber(d.seasons) },
    { label: 'Episodes', value: fmtNumber(d.episodes) },
    { label: 'Runtime', value: runtime },
    { label: 'Studios', value: fmtList(d.studios) },
    { label: 'Country', value: str(d.country) },
    { label: 'Languages', value: fmtList(d.languages) },
  ]
})

interface SeasonCard {
  key: string
  title: string
  image: string | null
}

const seasons = computed<SeasonCard[]>(() => {
  const list = props.detail.related.seasons
  if (!Array.isArray(list)) return []
  return list.flatMap((entry, i): SeasonCard[] => {
    if (!entry || typeof entry !== 'object') return []
    const e = entry as Record<string, unknown>
    const item = (e.item && typeof e.item === 'object' ? e.item : {}) as Record<string, unknown>
    const n = num(item.season_number) ?? i + 1
    return [{ key: `${i}-${String(e.id ?? e.consumption_id ?? '')}`, title: str(item.title) ?? `Season ${n}`, image: str(item.image) }]
  })
})
</script>

<template>
  <FactList :facts="facts" />

  <section v-if="seasons.length" class="rail">
    <h2>Seasons</h2>
    <div class="row">
      <figure v-for="s in seasons" :key="s.key" class="card">
        <img v-if="s.image" :src="s.image" :alt="s.title" loading="lazy" />
        <div v-else class="placeholder">{{ s.title.slice(0, 1) }}</div>
        <figcaption>{{ s.title }}</figcaption>
      </figure>
    </div>
  </section>
</template>
