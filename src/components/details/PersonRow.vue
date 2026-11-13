<script setup lang="ts">
import type { Person } from '../../api/floppy'

defineProps<{ title: string; people: Person[]; max?: number }>()
</script>

<template>
  <section v-if="people.length" class="rail">
    <h2>{{ title }}</h2>
    <div class="row">
      <figure v-for="p in people.slice(0, max ?? 20)" :key="p.id + (p.role ?? '')" class="person">
        <img v-if="p.image" :src="p.image" :alt="p.name" loading="lazy" />
        <div v-else class="avatar">{{ p.name.slice(0, 1) }}</div>
        <figcaption>
          {{ p.name }}
          <small v-if="p.role">{{ p.role }}</small>
        </figcaption>
      </figure>
    </div>
  </section>
</template>
