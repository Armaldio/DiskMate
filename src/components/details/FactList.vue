<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ facts: { label: string; value: string | number | null | undefined }[] }>()
const shown = computed(() => props.facts.filter((f) => f.value != null && f.value !== ''))
</script>

<template>
  <dl v-if="shown.length" class="facts">
    <div v-for="f in shown" :key="f.label" class="fact">
      <dt>{{ f.label }}</dt>
      <dd>{{ f.value }}</dd>
    </div>
  </dl>
</template>
