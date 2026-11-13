<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { NextEpisode } from '../api/floppy'
import MarkWatchedSheet from './MarkWatchedSheet.vue'

const props = defineProps<{ ep: NextEpisode }>()
const emit = defineEmits<{ seen: [] }>()

const sheetOpen = ref(false)

const aired = computed(() =>
  props.ep.airDate ? new Date(props.ep.airDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : null,
)
const to = computed(() =>
  props.ep.mediaId && props.ep.source
    ? { name: 'details', params: { mediaType: props.ep.mediaType, source: props.ep.source, mediaId: props.ep.mediaId } }
    : undefined,
)
const label = computed(() => `${props.ep.showTitle} ${props.ep.episodeCode ?? 'next episode'}`)
</script>

<template>
  <article class="ep">
    <component :is="to ? RouterLink : 'div'" class="ep-main" :to="to">
    <img v-if="ep.image" :src="ep.image" :alt="ep.showTitle" loading="lazy" />
    <div v-else class="placeholder">{{ ep.showTitle.slice(0, 1) }}</div>
    <div class="body">
      <p class="muted date">{{ aired ?? 'Next episode' }}</p>
      <h3>{{ ep.showTitle }}</h3>
      <p class="code">
        {{ ep.episodeCode ?? '' }}<template v-if="ep.episodeTitle"> · {{ ep.episodeTitle }}</template>
      </p>
      <div v-if="ep.watchedRatio != null" class="bar-track" role="presentation">
        <div class="bar-fill" :style="{ width: `${Math.round(ep.watchedRatio * 100)}%` }" />
      </div>
    </div>
    </component>
    <button class="eye" :aria-label="`Mark ${label} as watched`" title="Mark as watched" @click="sheetOpen = true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>

    <MarkWatchedSheet v-if="sheetOpen" :ep="ep" @close="sheetOpen = false" @done="emit('seen')" />
  </article>
</template>
