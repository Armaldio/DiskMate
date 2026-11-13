<script setup lang="ts">
import { computed } from 'vue'
import { mediaColor } from '../utils/mediaTypes'

// A coloured line icon on a soft tinted tile, one per media type (24x24 viewBox, stroke = currentColor).
const props = withDefaults(defineProps<{ type: string; size?: number; tile?: boolean }>(), { size: 20, tile: true })

const dot = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="1" fill="currentColor" stroke="none"/>`
const ICONS: Record<string, string> = {
  every: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  movie: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9l2.5-5h4L7 9M10.5 9 13 4h4l-2.5 5M18 9l2.5-5H21"/>',
  tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M12 18v3M9 2.5 12 6l3-3.5"/>',
  anime: '<path d="M11 3l1.9 5.6L18.5 10.5 12.9 12.4 11 18l-1.9-5.6L3.5 10.5l5.6-1.9L11 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  manga: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M12 3v9M12 12v9"/>',
  game: `<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7 10.5v5M4.5 13h5"/>${dot(16, 12)}${dot(18.5, 14.5)}`,
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5z"/><path d="M19 18v3H6a2 2 0 0 1-2-2"/>',
  comic: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.7A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 10h7M8.5 13.5h4"/>',
  boardgame: `<rect x="4" y="4" width="16" height="16" rx="3.5"/>${dot(8.5, 8.5)}${dot(15.5, 8.5)}${dot(12, 12)}${dot(8.5, 15.5)}${dot(15.5, 15.5)}`,
  podcast: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
  music: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  video: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>',
}
const ALIAS: Record<string, string> = { season: 'tv', episode: 'tv', comicissue: 'comic' }

const body = computed(() => ICONS[props.type] ?? ICONS[ALIAS[props.type]] ?? ICONS.video)
const color = computed(() => mediaColor(props.type))
const box = computed(() => `${Math.round(props.size * (props.tile ? 1.6 : 1))}px`)
</script>

<template>
  <span
    class="media-icon"
    :class="{ tile }"
    :style="{ color, width: box, height: box }"
    aria-hidden="true"
  >
    <svg :width="size" :height="size" viewBox="0 0 24 24" v-html="body" />
  </span>
</template>

<style scoped>
.media-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; }
.media-icon.tile { border-radius: 30%; background: color-mix(in srgb, currentColor 16%, transparent); }
svg { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
</style>
