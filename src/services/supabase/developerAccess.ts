// ─────────────────────────────────────────────────────────────
// developerAccess.ts — Server-managed developer authorization.
//
// Calls the check_developer_access() RPC which uses auth.uid()
// internally. The client cannot supply another user's UUID.
// Returns only the caller's authorization state.
// ─────────────────────────────────────────────────────────────

import { getSupabase } from './supabaseClient'

export interface DeveloperAuthResult {
  authorized: boolean
  role: string | null
  expiresAt: string | null
}

const UNAUTHORIZED: DeveloperAuthResult = {
  authorized: false,
  role: null,
  expiresAt: null,
}

export async function checkDeveloperAccess (): Promise<DeveloperAuthResult> {
  const supabase = getSupabase()
  if (!supabase) return UNAUTHORIZED

  try {
    const { data, error } = await supabase
      .rpc('check_developer_access')

    if (error || !data || data.length === 0) {
      return UNAUTHORIZED
    }

    const row = data[0]
    return {
      authorized: row.authorized === true,
      role: row.role ?? null,
      expiresAt: row.expires_at ?? null,
    }
  } catch {
    return UNAUTHORIZED
  }
}

export function isDevBypassAvailable (): boolean {
  return __DEV__
}
