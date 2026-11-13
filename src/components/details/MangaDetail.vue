<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtList, fmtNumber, num, str } from '../../utils/format'
import FactList from './FactList.vue'

// Type-specific part of a manga page (MyAnimeList data via Floppy). The shared header lives in DetailView.
const props = defineProps<{ detail: MediaDetail }>()

// Keys already shown in the fixed list below; anything else plain is appended.
const KNOWN = new Set(['format', 'status', 'start_date', 'end_date', 'number_of_chapters', 'number_of_volumes', 'authors'])

// Counts of 0 mean "unknown" on MyAnimeList, so they are hidden.
const count = (v: unknown) => {
  const n = num(v)
  return n != null && n > 0 ? fmtNumber(n) : null
}

const label = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const facts = computed<{ label: string; value: string }[]>(() => {
  const d = props.detail.details ?? {}

  const fixed: { label: string; value: string | null }[] = [
    { label: 'Format', value: str(d['format']) },
    { label: 'Status', value: str(d['status']) },
    { label: 'Started', value: fmtDate(d['start_date']) },
    { label: 'Ended', value: fmtDate(d['end_date']) },
    { label: 'Chapters', value: count(d['number_of_chapters']) },
    { label: 'Volumes', value: count(d['number_of_volumes']) },
    { label: 'Authors', value: fmtList(d['authors']) },
  ]

  const extra = Object.entries(d).flatMap(([k, v]) => {
    if (KNOWN.has(k)) return []
    const value = Array.isArray(v)
      ? v.every((x) => typeof x === 'string') ? fmtList(v) : null
      : /date/.test(k) ? fmtDate(v) : str(v) ?? (num(v) != null ? String(num(v)) : null)
    return value ? [{ label: label(k), value }] : []
  })

  return [...fixed, ...extra].filter((f): f is { label: string; value: string } => !!f.value)
})
</script>

<template>
  <FactList :facts="facts" />
</template>
