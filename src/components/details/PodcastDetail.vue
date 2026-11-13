<script setup lang="ts">
import { computed } from 'vue'
import type { MediaDetail } from '../../api/floppy'
import { str } from '../../utils/format'
import FactList from './FactList.vue'

// Type-specific part of a podcast page. The shared header already shows the synopsis, so `description` is skipped.
const props = defineProps<{ detail: MediaDetail }>()

const languageName = (code: string | null): string | null => {
  if (!code) return null
  try {
    return new Intl.DisplayNames(undefined, { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

const isHttp = (v: string | null): v is string => !!v && v.startsWith('http')

const facts = computed(() => [
  { label: 'Author', value: str(props.detail.details.author) },
  { label: 'Language', value: languageName(str(props.detail.details.language)) },
])

const website = computed(() => {
  const candidates = [str(props.detail.details.website_url), str(props.detail.details.show_website_url)]
  return candidates.find(isHttp) ?? null
})

const rssFeed = computed(() => {
  const url = str(props.detail.details.rss_feed_url)
  return isHttp(url) ? url : null
})
</script>

<template>
  <FactList :facts="facts" />
  <div v-if="website || rssFeed" class="actions-row">
    <a v-if="website" class="link-action" :href="website" target="_blank" rel="noopener noreferrer">Website ↗</a>
    <a v-if="rssFeed" class="link-action" :href="rssFeed" target="_blank" rel="noopener noreferrer">RSS feed ↗</a>
  </div>
</template>
