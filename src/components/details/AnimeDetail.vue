<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtList, num, str } from '../../utils/format'
import FactList from './FactList.vue'

// Anime-specific facts (MyAnimeList). Every value is read defensively; missing ones are skipped.
const props = defineProps<{ detail: MediaDetail }>()

const facts = computed(() => {
  const d = props.detail.details
  return [
    { label: 'Format', value: str(d.format) },
    { label: 'Status', value: str(d.status) },
    { label: 'Season', value: str(d.season) },
    { label: 'Started', value: fmtDate(d.start_date) },
    { label: 'Ended', value: fmtDate(d.end_date) },
    { label: 'Episodes', value: num(d.episodes) },
    { label: 'Runtime', value: str(d.runtime) },
    { label: 'Studios', value: fmtList(d.studios) },
    // Broadcast is sometimes an object; only plain strings are shown.
    { label: 'Broadcast', value: str(d.broadcast) },
    { label: 'Based on', value: str(d.source) },
  ]
})
</script>

<template>
  <FactList :facts="facts" />
</template>
