<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  addToList,
  createTag,
  fetchItemLists,
  fetchItemTags,
  fetchLists,
  fetchTags,
  removeFromList,
  setItemTags,
  updateTracking,
  type MediaDetail,
  type Tag,
  type UserList,
} from '../api/floppy'
import { InsufficientScopeError } from '../api/scopes'
import { useConnection } from '../stores/connection'
import { cacheKey, detailName, dropCached } from '../utils/swr'
import { trackingWords } from '../utils/statusLabels'

const props = defineProps<{ detail: MediaDetail; tracked: boolean }>()
const emit = defineEmits<{ tracked: [] }>()

const { connection, reportMissingScopes } = useConnection()

const lists = ref<UserList[]>([])
const tags = ref<Tag[]>([])
const inLists = ref<Set<number>>(new Set())
const withTags = ref<Set<number>>(new Set())
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const newTag = ref('')
const isTracked = ref(props.tracked)

function fail(e: unknown) {
  if (e instanceof InsufficientScopeError) reportMissingScopes(e.scopes) // the banner explains it
  else error.value = e instanceof Error ? e.message : String(e)
}

onMounted(async () => {
  const conn = connection.value
  if (!conn) return
  // Independent: a missing permission for lists must not hide tags (and vice versa).
  const [l, il, t, it] = await Promise.allSettled([
    fetchLists(conn),
    fetchItemLists(conn, props.detail),
    fetchTags(conn),
    fetchItemTags(conn, props.detail),
  ])
  if (l.status === 'fulfilled') lists.value = l.value
  else fail(l.reason)
  if (il.status === 'fulfilled') inLists.value = new Set(il.value)
  if (t.status === 'fulfilled') tags.value = t.value
  else fail(t.reason)
  if (it.status === 'fulfilled') withTags.value = new Set(it.value)
  loading.value = false
})

/** Tags can only be set on a tracked item: start tracking (Planning) first if needed. */
async function ensureTracked() {
  if (isTracked.value || !connection.value) return
  await updateTracking(connection.value, props.detail, {}, false)
  isTracked.value = true
  dropCached(cacheKey(connection.value, detailName(props.detail.mediaType, props.detail.source, props.detail.mediaId)))
  emit('tracked')
}

async function toggleList(l: UserList) {
  if (l.locked || busy.value || !connection.value) return
  const next = new Set(inLists.value)
  const adding = !next.has(l.id)
  if (adding) next.add(l.id)
  else next.delete(l.id)
  const prev = inLists.value
  inLists.value = next // optimistic
  busy.value = true
  error.value = ''
  try {
    if (adding) await addToList(connection.value, props.detail, l.id)
    else await removeFromList(connection.value, props.detail, l.id)
  } catch (e) {
    inLists.value = prev
    fail(e)
  } finally {
    busy.value = false
  }
}

async function applyTags(next: Set<number>) {
  if (!connection.value) return
  const prev = withTags.value
  withTags.value = next // optimistic
  busy.value = true
  error.value = ''
  try {
    await ensureTracked()
    await setItemTags(connection.value, props.detail, [...next])
  } catch (e) {
    withTags.value = prev
    fail(e)
  } finally {
    busy.value = false
  }
}

function toggleTag(t: Tag) {
  if (busy.value) return
  const next = new Set(withTags.value)
  if (next.has(t.id)) next.delete(t.id)
  else next.add(t.id)
  applyTags(next)
}

async function addTag() {
  const name = newTag.value.trim()
  if (!name || busy.value || !connection.value) return
  // Names are unique per user, case-insensitively: reuse an existing tag instead of failing.
  const existing = tags.value.find((t) => t.name.toLowerCase() === name.toLowerCase())
  try {
    const tag = existing ?? (await createTag(connection.value, name))
    if (!existing) tags.value = [...tags.value, tag]
    newTag.value = ''
    await applyTags(new Set([...withTags.value, tag.id]))
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <section class="organize" aria-label="Lists and tags">
    <h2>Lists &amp; tags</h2>
    <van-loading v-if="loading" size="20" class="loading" />

    <div v-else class="info-card">
      <div v-if="lists.length" class="panel-row stack">
        <span class="label">Lists</span>
        <div class="chip-wrap" role="group" aria-label="Lists">
          <button
            v-for="l in lists"
            :key="l.id"
            class="pick-chip"
            :class="{ on: inLists.has(l.id) }"
            :disabled="l.locked"
            :aria-pressed="inLists.has(l.id)"
            :title="l.locked ? 'Filled automatically: can\'t be edited by hand' : undefined"
            @click="toggleList(l)"
          >
            {{ inLists.has(l.id) ? '✓ ' : '' }}{{ l.name }}
          </button>
        </div>
      </div>

      <div class="panel-row stack">
        <span class="label">Tags</span>
        <div class="chip-wrap" role="group" aria-label="Tags">
          <button
            v-for="t in tags"
            :key="t.id"
            class="pick-chip"
            :class="{ on: withTags.has(t.id) }"
            :aria-pressed="withTags.has(t.id)"
            @click="toggleTag(t)"
          >
            {{ withTags.has(t.id) ? '✓ ' : '' }}{{ t.name }}
          </button>
          <span v-if="!tags.length" class="muted none">No tags yet.</span>
        </div>
        <form class="new-tag" @submit.prevent="addTag">
          <input v-model="newTag" type="text" maxlength="60" placeholder="New tag…" aria-label="New tag name" />
          <button :disabled="!newTag.trim() || busy">Add</button>
        </form>
        <p v-if="!isTracked" class="muted hint">Tagging adds this to your {{ trackingWords(detail.mediaType).list }}.</p>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.organize h2 { margin: 0 0 .75rem; }
.none { align-self: center; font-size: .85rem; }
.new-tag { display: flex; gap: .5rem; }
.new-tag input { flex: 1; min-width: 0; height: 36px; padding: 0 .75rem; border-radius: 10px; border: 1px solid #333649; background: #202129; color: inherit; font: inherit; font-size: .9rem; }
.new-tag button { height: 36px; padding: 0 1rem; border-radius: 10px; }
.hint { margin: 0; font-size: .8rem; }
.loading { display: block; margin: .75rem 0; }
</style>
