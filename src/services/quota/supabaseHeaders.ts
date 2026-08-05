// ─────────────────────────────────────────────────────────────
// supabaseHeaders.ts — Shared fail-closed header builder for
// Supabase Edge Function requests.
//
// Guarantees:
//   • Throws a sanitized local error BEFORE any fetch when the
//     anon key is missing, blank, or whitespace-only.
//   • Never sends an empty `apikey` header.
//   • Never sends a service-role key (rejects keys starting with
//     `sb_secret_` or containing `service_role`).
//   • Preserves the user JWT in `Authorization`.
//   • Preserves `Content-Type: application/json`.
// ─────────────────────────────────────────────────────────────

import { SUPABASE_ANON_KEY } from '../subscriptions/subscriptionConfig'

export class SupabaseConfigError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'SupabaseConfigError'
  }
}

function assertValidAnonKey (): string {
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim() === '') {
    throw new SupabaseConfigError('Supabase anon key is not configured')
  }
  if (SUPABASE_ANON_KEY.startsWith('sb_secret_') || SUPABASE_ANON_KEY.includes('service_role')) {
    throw new SupabaseConfigError('Invalid Supabase key type for client use')
  }
  return SUPABASE_ANON_KEY
}

export function buildAuthedHeaders (
  token: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const anonKey = assertValidAnonKey()
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    ...extra,
  }
}
