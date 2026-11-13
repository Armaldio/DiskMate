<script setup lang="ts">
import { ref } from 'vue'
import type { MediaItem } from '../api/floppy'
import MarkWatchedSheet from './MarkWatchedSheet.vue'
import MediaIcon from './MediaIcon.vue'

const props = defineProps<{ item: MediaItem }>()
// The card opens the detail page; movies also get a quick "mark as watched" eye badge.
const markable = props.item.mediaType === 'movie'
const open = ref(false)
</script>

<template>
  <figure class="card">
    <RouterLink
      class="card-hit"
      :to="{ name: 'details', params: { mediaType: item.mediaType, source: item.source, mediaId: item.mediaId } }"
    >
      <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
      <div v-else class="placeholder">{{ item.title.slice(0, 1) }}</div>
    </RouterLink>
    <button v-if="markable" class="badge" :aria-label="`Mark ${item.title} as watched`" @click="open = true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
    <figcaption>
      {{ item.title }}
      <small class="kind-line"><MediaIcon :type="item.mediaType" :size="13" :tile="false" /> {{ item.subtitle ?? item.mediaType }}</small>
    </figcaption>
    <MarkWatchedSheet v-if="open" :movie="item" @close="open = false" />
  </figure>
</template>
