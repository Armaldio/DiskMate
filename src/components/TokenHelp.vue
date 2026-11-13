<script setup lang="ts">
import { computed } from 'vue'
import { REQUIRED_SCOPES } from '../api/scopes'

const props = defineProps<{ baseUrl: string; highlight?: string[] }>()
const tokenUrl = computed(() => `${props.baseUrl}/settings/integrations`)
</script>

<template>
  <div class="muted help">
    <p>
      <a :href="tokenUrl" target="_blank" rel="noopener noreferrer">Open your Floppy integrations settings</a>,
      then:
    </p>
    <ol>
      <li>Under <strong>App tokens</strong>, expand <strong>Create an app token</strong>, name it "DiskMate" and create it.</li>
      <li>
        Grant these permissions:
        <code v-for="s in REQUIRED_SCOPES" :key="s" :class="{ new: highlight?.includes(s) }">{{ s }}</code>
      </li>
      <li>Copy the <code>flp_…</code> token (shown once) and paste it here.</li>
    </ol>
    <p>
      Don't use the top-level <strong>Jeton d'API / API token</strong>: it's the full-access webhook token for your account.
    </p>
  </div>
</template>
