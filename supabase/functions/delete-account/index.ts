// ─────────────────────────────────────────────────────────────
// delete-account — Server-authoritative account deletion for
// RawLifeFlow: Juicing Daily.
//
// Security:
//   * Requires a valid Supabase Authorization bearer token.
//   * Resolves the user ONLY from the verified token.
//   * Rejects anonymous or invalid sessions.
//   * Never accepts a client-supplied user ID as deletion authority.
//   * Uses the service-role key only inside this function.
//   * Never returns the service-role key, internal SQL, or user records.
//   * Never logs email addresses, access tokens, or private content.
//
// Idempotency:
//   * An immutable deletion-operation ID is created per user.
//   * Repeated calls for the same user return the same operation.
//   * An already-deleted user is treated as an idempotent success.
//
// Order of operations:
//   1. Verify the JWT and resolve the user.
//   2. Call begin_account_deletion() to delete user-owned data.
//   3. Queue RevenueCat external deletion job.
//   4. Delete the Supabase Auth user via admin API.
//   5. Return sanitized success response.
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { message: 'Server not configured' })
  }

  // ── Extract and verify the bearer token ────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { message: 'Missing authorization' })

  // Create an admin client to verify the user and perform deletion.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the JWT cryptographically.
  const { data: userData, error: verifyError } = await admin.auth.getUser(token)
  if (verifyError || !userData.user) {
    return json(401, { message: 'Invalid token' })
  }

  const user = userData.user

  // Reject anonymous users.
  if (user.is_anonymous === true) {
    return json(403, { message: 'A verified account is required' })
  }

  const userId = user.id

  // ── Step 1: Begin account deletion (deletes user data) ─────
  const { data: delResult, error: delError } = await admin.rpc('begin_account_deletion', {
    p_user_id: userId,
  })

  if (delError) {
    console.error('[delete-account] begin_account_deletion failed:', delError.message)
    return json(500, { message: 'Deletion step failed. Please try again.' })
  }

  const opStatus = delResult?.code ?? 'unknown'
  const operationId = delResult?.operation_id ?? null

  // If data deletion was already completed, this is an idempotent retry.
  if (opStatus === 'already_completed') {
    // The auth user may already be deleted — try to delete anyway
    // (idempotent), but don't fail if already gone.
    const { error: authDelError } = await admin.auth.admin.deleteUser(userId)
    if (authDelError) {
      // User may already be deleted — treat as idempotent success.
      if (
        !authDelError.message.includes('not found') &&
        !authDelError.message.includes('does not exist')
      ) {
        console.error('[delete-account] auth delete failed on retry:', authDelError.message)
      }
    }
    return json(200, { ok: true, operation_id: operationId, status: 'already_completed' })
  }

  if (opStatus === 'partial_failure') {
    console.error('[delete-account] partial failure:', JSON.stringify(delResult?.steps_failed))
    return json(500, { message: 'Some deletion steps failed. Please try again.' })
  }

  // ── Step 2: Delete the Supabase Auth user ──────────────────
  // This must happen AFTER data deletion. The FK cascade will
  // handle any remaining rows, but we already deleted explicitly.
  const { error: authDelError } = await admin.auth.admin.deleteUser(userId)
  if (authDelError) {
    // If the user is already deleted, treat as idempotent success.
    if (
      authDelError.message.includes('not found') || authDelError.message.includes('does not exist')
    ) {
      return json(200, { ok: true, operation_id: operationId, status: 'completed' })
    }
    console.error('[delete-account] auth delete failed:', authDelError.message)
    return json(500, { message: 'Account deletion incomplete. Please try again.' })
  }

  // ── Step 3: RevenueCat deletion is queued ──────────────────
  // The external_deletion_jobs table has a pending row created by
  // begin_account_deletion(). It will be processed when RevenueCat
  // server credentials are configured. We do NOT block on this.

  return json(200, {
    ok: true,
    operation_id: operationId,
    status: 'completed',
  })
})
