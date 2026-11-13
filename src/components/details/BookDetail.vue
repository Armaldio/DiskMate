<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtList, fmtNumber, str } from '../../utils/format'
import FactList from './FactList.vue'

// Open Library facts for books. Everything in `details` is untyped, so each value is checked on read.
const props = defineProps<{ detail: MediaDetail }>()

const isbns = computed(() => {
  const v = props.detail.details.isbn
  if (!Array.isArray(v)) return null
  const list = v.map(str).filter((x): x is string => !!x).slice(0, 2)
  return list.length ? list.join(', ') : null
})

const facts = computed(() => {
  const d = props.detail.details
  return [
    { label: 'Author(s)', value: fmtList(d.author) },
    { label: 'Format', value: str(d.physical_format) },
    { label: 'Pages', value: fmtNumber(d.number_of_pages) },
    { label: 'Published', value: fmtDate(d.publish_date) },
    { label: 'Publisher(s)', value: fmtList(d.publishers) },
    { label: 'ISBN', value: isbns.value },
  ]
})
</script>

<template>
  <FactList :facts="facts" />
</template>
