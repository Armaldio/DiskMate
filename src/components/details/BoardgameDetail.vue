<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtList, num, str } from '../../utils/format'
import FactList from './FactList.vue'

// Board games (BoardGameGeek): the type-specific facts below the shared header.
const props = defineProps<{ detail: MediaDetail }>()

const d = computed<Record<string, unknown>>(() => props.detail.details ?? {})

// ["2"] → "2 players"; ["1", "2", "3", "4"] → "1–4 players".
const players = computed(() => {
  const raw = d.value.players
  const items = Array.isArray(raw) ? raw : [raw]
  const counts = items
    .map((x) => (typeof x === 'number' ? x : Number(str(x))))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!counts.length) return null
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  return `${min === max ? min : `${min}–${max}`} players`
})

const facts = computed(() => {
  const year = num(d.value.year)
  const playtime = num(d.value.playtime)
  const minAge = num(d.value.min_age)
  return [
    { label: 'Year', value: year != null ? String(year) : null },
    { label: 'Players', value: players.value },
    { label: 'Playtime', value: playtime != null && playtime > 0 ? `${playtime} min` : null },
    { label: 'Age', value: minAge != null && minAge > 0 ? `${minAge}+` : null },
    { label: 'Designers', value: fmtList(d.value.designers) },
    { label: 'Publishers', value: fmtList(d.value.publishers) },
  ]
})
</script>

<template>
  <FactList :facts="facts" />
</template>
