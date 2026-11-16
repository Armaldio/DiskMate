import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Page-level refresh status that must never take space in the page flow (that caused layout shift):
 * a thin bar on the header while any page is refreshing, and a floating pill when a refresh failed
 * and saved data is shown instead. Rendered once, in App.vue.
 *
 * Both are counters, not flags: during a navigation the old page unmounts after the new one has
 * started, so a plain flag would let the old page wipe what the new page just reported.
 */
const refreshingCount = ref(0)
const staleCount = ref(0)
const dismissed = ref(false)

export const isRefreshing = computed(() => refreshingCount.value > 0)
export const staleMessage = computed(() =>
  staleCount.value > 0 && !dismissed.value ? "Showing saved data — couldn't refresh." : '',
)
export const dismissStale = () => {
  dismissed.value = true
}

function counter(count: Ref<number>, onRise?: () => void) {
  let counted = false
  const sync = (on: boolean) => {
    if (on && !counted) {
      count.value++
      counted = true
      onRise?.()
    } else if (!on && counted) {
      count.value--
      counted = false
    }
  }
  return sync
}

export function useRefreshStatus(refreshing: Ref<boolean>, stale: Ref<boolean>) {
  const syncRefreshing = counter(refreshingCount)
  const syncStale = counter(staleCount, () => (dismissed.value = false)) // a new failure shows again
  watch(refreshing, syncRefreshing, { immediate: true })
  watch(stale, syncStale, { immediate: true })
  onBeforeUnmount(() => {
    syncRefreshing(false)
    syncStale(false)
  })
}
