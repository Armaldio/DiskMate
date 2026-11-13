<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtList, fmtNumber, str } from '../../utils/format'
import FactList from './FactList.vue'

// Comic Vine volumes/series: the type-specific part under the shared header.
const props = defineProps<{ detail: MediaDetail }>()

const d = computed(() => props.detail.details)

const lastIssue = computed(() => {
  const number = str(d.value.last_issue_number) ?? (typeof d.value.last_issue_number === 'number' ? String(d.value.last_issue_number) : null)
  const name = str(d.value.last_issue_name)
  if (number && name) return `#${number} · ${name}`
  return name ?? (number ? `#${number}` : null)
})

const facts = computed(() => [
  { label: 'Publisher', value: str(d.value.publisher) },
  { label: 'Started', value: fmtDate(d.value.start_date) },
  { label: 'Issues', value: fmtNumber(d.value.issues_count) },
  { label: 'Last issue', value: lastIssue.value },
  { label: 'Creators', value: fmtList(d.value.people) },
  { label: 'Updated', value: fmtDate(d.value.last_updated) },
])
</script>

<template>
  <FactList :facts="facts" />
</template>
