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

export function normalizeUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`
  return u
}

export function useConnection() {
  return {
    connection,
    isConnected: computed(() => connection.value !== null),
    save(c: Connection) {
      connection.value = { baseUrl: normalizeUrl(c.baseUrl), token: c.token.trim() }
      localStorage.setItem(KEY, JSON.stringify(connection.value))
    },
    clear() {
      connection.value = null
      localStorage.removeItem(KEY)
    },
  }
}
