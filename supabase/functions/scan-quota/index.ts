// ─────────────────────────────────────────────────────────────
// scan-quota — Returns the caller's current scan quota snapshot.
// Lazily advances expired windows via resolve_quota (server clock).
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json (status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json(405, { message: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json(401, { message: 'Missing authorization' })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) return json(401, { message: 'Invalid token' })

  // ── Anonymous users: query actual quota from database ───────
  // Previously returned hardcoded used:0/remaining:1 for all anonymous
  // users, which caused stale quota display after a successful guest
  // scan. Now we query resolve_quota (read-only for existing rows)
  // to get the real usage. If the user has no quota rows yet (never
  // scanned), resolve_quota creates them with the default free-plan
  // allowance — which is the correct behavior.
  if (userData.user.is_anonymous === true) {
    try {
      const { data: anonData, error: anonError } = await admin.rpc('resolve_quota', {
        p_user_id: userData.user.id,
      })
      if (anonError) {
        console.error('[scan-quota] anonymous resolve failed:', anonError.message)
        // Fall back to static free-plan values on error
        return json(200, {
          quota: {
            plan: 'free',
            limit: 1,
            used: 0,
            remaining: 1,
            periodStart: '',
            periodEnd: '',
            dailyLimit: null,
            dailyUsed: null,
          },
        })
      }
      const aq = anonData as Record<string, unknown>
      const aLimit = Number(aq.scan_limit ?? 0)
      const aUsed = Number(aq.used ?? 0)
      const aReserved = Number(aq.reserved ?? 0)
      return json(200, {
        quota: {
          plan: 'free',
          limit: aLimit || 1,
          used: aUsed,
          remaining: Math.max(0, (aLimit || 1) - aUsed - aReserved),
          periodStart: aq.period_start ?? '',
          periodEnd: aq.period_end ?? '',
          dailyLimit: null,
          dailyUsed: null,
        },
      })
    } catch (e) {
      console.error('[scan-quota] anonymous exception:', (e as Error)?.message)
      return json(200, {
        quota: {
          plan: 'free',
          limit: 1,
          used: 0,
          remaining: 1,
          periodStart: '',
          periodEnd: '',
          dailyLimit: null,
          dailyUsed: null,
        },
      })
    }
  }

  const { data, error } = await admin.rpc('resolve_quota', { p_user_id: userData.user.id })
  if (error) {
    console.error('[scan-quota] resolve failed:', error.message)
    return json(500, { message: 'Quota lookup failed' })
  }

  const q = data as Record<string, unknown>
  const limit = Number(q.scan_limit ?? 0)
  const used = Number(q.used ?? 0)
  const reserved = Number(q.reserved ?? 0)

  return json(200, {
    quota: {
      plan: q.plan === 'pro' ? 'pro' : 'free',
      limit,
      used,
      remaining: Math.max(0, limit - used - reserved),
      periodStart: q.period_start ?? '',
      periodEnd: q.period_end ?? '',
      dailyLimit: q.plan === 'pro' ? 10 : null,
      dailyUsed: q.plan === 'pro' ? Number(q.daily_used ?? 0) : null,
    },
  })
})
