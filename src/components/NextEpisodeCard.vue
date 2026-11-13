<script setup lang="ts">
import type { NextEpisode } from '../api/floppy'
defineProps<{ ep: NextEpisode }>()
</script>

<template>
  <figure class="card">
    <img v-if="ep.image" :src="ep.image" :alt="ep.showTitle" loading="lazy" />
    <div v-else class="placeholder">{{ ep.showTitle.slice(0, 1) }}</div>
    <figcaption>
      {{ ep.showTitle }}
      <small>{{ ep.episodeCode ?? 'Next episode' }}<template v-if="ep.episodeTitle"> · {{ ep.episodeTitle }}</template></small>
      <small v-if="ep.episodesLeft">{{ ep.episodesLeft }} left</small>
    </figcaption>
  </figure>
</template>
