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

export function isSupabaseConfigured (): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getSupabase (): SupabaseClient | null {
  if (client) return client
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
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
