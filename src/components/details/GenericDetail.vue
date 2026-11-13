<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { fmtDate, fmtList, str } from '../../utils/format'
import FactList from './FactList.vue'

// Fallback for any media type without its own *Detail.vue: shows every simple value in `details`.
const props = defineProps<{ detail: MediaDetail }>()

const facts = computed(() =>
  Object.entries(props.detail.details).flatMap(([k, v]) => {
    const value = Array.isArray(v) ? fmtList(v) : /date|air/.test(k) ? fmtDate(v) : str(v) ?? (typeof v === 'number' ? String(v) : null)
    return value ? [{ label: k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), value }] : []
  }),
)
</script>

<template>
  <FactList :facts="facts" />
</template>
