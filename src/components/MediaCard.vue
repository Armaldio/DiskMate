<script setup lang="ts">
import type { MediaItem } from '../api/floppy'
defineProps<{ item: MediaItem }>()
</script>

<template>
  <figure class="card">
    <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
    <div v-else class="placeholder">{{ item.title.slice(0, 1) }}</div>
    <figcaption>
      {{ item.title }}
      <small>{{ item.mediaType }}</small>
    </figcaption>
  </figure>
</template>
