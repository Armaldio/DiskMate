import { computed, ref } from 'vue'

const KEY = 'diskmate.connection'

export interface Connection {
  baseUrl: string
  token: string
}

function load(): Connection | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Connection) : null
  } catch {
    return null
  }
}

const connection = ref<Connection | null>(load())
/** Scopes a request reported as missing (403) this session. */
const reportedMissing = ref<string[]>([])

// Floppy doesn't expose a token's scopes, so we can't know them up front. Only trust what
// Floppy itself tells us: a 403 on a call that needs a scope means the token lacks it.
const missingScopes = computed(() => (connection.value ? [...reportedMissing.value].sort() : []))

export function normalizeUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`
  return u
}

export function useConnection() {
  return {
    connection,
    missingScopes,
    reportMissingScopes(scopes: string[]) {
      reportedMissing.value = [...new Set([...reportedMissing.value, ...scopes])]
    },
    isConnected: computed(() => connection.value !== null),
    save(c: Connection) {
      connection.value = {
        baseUrl: normalizeUrl(c.baseUrl),
        token: c.token.trim(),
      }
      reportedMissing.value = []
      localStorage.setItem(KEY, JSON.stringify(connection.value))
    },
    clear() {
      connection.value = null
      localStorage.removeItem(KEY)
    },
  }
}
