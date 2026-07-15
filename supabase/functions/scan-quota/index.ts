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

  // ── Anonymous users: display-only snapshot ──────────────────
  // resolve_quota creates/advances allowance rows, so anonymous
  // callers must never reach it. They get the static free-plan
  // display values with zero database writes and no allocation.
  if (userData.user.is_anonymous === true) {
    return json(200, {
      quota: {
        plan: 'free',
        limit: 5,
        used: 0,
        remaining: 5,
        periodStart: '',
        periodEnd: '',
        dailyLimit: null,
        dailyUsed: null,
      },
    })
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
