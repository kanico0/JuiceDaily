// ─────────────────────────────────────────────────────────────
// supabaseClient.ts — Lazily-initialized Supabase client.
//
// Uses the public anon key (safe to ship) with AsyncStorage-backed
// session persistence and auto token refresh tied to app state.
// Returns null when Supabase is not configured so callers can fall
// back gracefully (rollback-safe).
// ─────────────────────────────────────────────────────────────

import 'react-native-url-polyfill/auto'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../subscriptions/subscriptionConfig'

let client: SupabaseClient | null = null
let appStateHooked = false

export function createSupabaseFetch(): typeof globalThis.fetch {
  const anonKey = SUPABASE_ANON_KEY!
  const supabaseOrigin = SUPABASE_URL!.replace(/\/$/, '')

  return async function supabaseFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let resolvedInput: RequestInfo =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input

    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url

      if (url && (url === supabaseOrigin || url.startsWith(supabaseOrigin + '/'))) {
        const headers = new Headers(init?.headers)
        if (!headers.has('apikey') || !headers.get('apikey')) {
          headers.set('apikey', anonKey)
        }
        init = { ...init, headers }
      }
    } catch {
      // If URL parsing fails, proceed with original request
    }
    return globalThis.fetch.call(globalThis, resolvedInput, init)
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: createSupabaseFetch(),
    },
  })

  // Keep token auto-refresh in sync with app foreground/background.
  if (!appStateHooked) {
    appStateHooked = true
    AppState.addEventListener('change', (state) => {
      if (!client) return
      if (state === 'active') {
        client.auth.startAutoRefresh()
      } else {
        client.auth.stopAutoRefresh()
      }
    })
  }

  return client
}
