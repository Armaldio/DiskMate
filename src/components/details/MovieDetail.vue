<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtList, str } from '../../utils/format'
import FactList from './FactList.vue'

const props = defineProps<{ detail: MediaDetail }>()

const d = computed(() => props.detail.details ?? {})

const facts = computed(() => [
  { label: 'Released', value: fmtDate(d.value.release_date) },
  { label: 'Status', value: str(d.value.status) },
  { label: 'Runtime', value: str(d.value.runtime) },
  { label: 'Certification', value: str(d.value.certification) },
  { label: 'Studios', value: fmtList(d.value.studios) },
  { label: 'Country', value: str(d.value.country) },
  { label: 'Languages', value: fmtList(d.value.languages) },
  { label: 'Budget', value: str(d.value.budget) },
  { label: 'Revenue', value: str(d.value.revenue) },
])
</script>

<template>
  <FactList :facts="facts" />
</template>
