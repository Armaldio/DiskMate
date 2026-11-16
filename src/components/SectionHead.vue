<script setup lang="ts">
import MediaIcon from './MediaIcon.vue'

// A section heading: coloured icon tile, title, optional count, optional one-line subtitle.
defineProps<{ title: string; icon: string; count?: number; subtitle?: string | null; small?: boolean }>()
</script>

<template>
  <header class="section-head" :class="{ small }">
    <MediaIcon :type="icon" :size="small ? 16 : 20" />
    <h2>{{ title }}</h2>
    <span v-if="count" class="count">{{ count }}</span>
  </header>
  <p v-if="subtitle" class="muted section-sub">{{ subtitle }}</p>
</template>
