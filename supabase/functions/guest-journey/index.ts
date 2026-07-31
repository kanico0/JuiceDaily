// ─────────────────────────────────────────────────────────────
// guest-journey — Server-authoritative guest first-use journey.
//
// Actions:
//   GET  ?action=status          → get_guest_journey_status
//   POST  action=reserve         → reserve_guest_journey
//   POST  action=finalize-scan   → finalize_guest_scan
//   POST  action=finalize-log    → finalize_guest_log
//   POST  action=release         → release_guest_journey
//
// All state is keyed to the verified Supabase user UUID, which
// is preserved across anonymous-to-email upgrade.
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json(401, { code: 'missing_authorization', message: 'Missing authorization' })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) {
    return json(401, { code: 'invalid_token', message: 'Invalid token' })
  }

  const userId = userData.user.id

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''

  // ── GET: status ─────────────────────────────────────────────
  if (req.method === 'GET' && action === 'status') {
    const { data, error } = await admin.rpc('get_guest_journey_status', { p_user_id: userId })
    if (error) return json(500, { message: 'Status lookup failed' })
    return json(200, data)
  }

  // ── POST actions ────────────────────────────────────────────
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { message: 'Invalid JSON body' })
  }

  const journeyId = String(body.journeyId ?? '')
  if (!journeyId || journeyId.length > 200) {
    return json(400, { message: 'Invalid journeyId' })
  }

  if (action === 'reserve') {
    const journeyType = String(body.journeyType ?? '')
    if (journeyType !== 'scan' && journeyType !== 'manual') {
      return json(400, { message: 'Invalid journeyType' })
    }
    const { data, error } = await admin.rpc('reserve_guest_journey', {
      p_user_id: userId,
      p_journey_id: journeyId,
      p_journey_type: journeyType,
    })
    if (error) return json(500, { message: 'Reserve failed' })
    return json(200, data)
  }

  if (action === 'finalize-scan') {
    const { data, error } = await admin.rpc('finalize_guest_scan', {
      p_user_id: userId,
      p_journey_id: journeyId,
    })
    if (error) return json(500, { message: 'Finalize scan failed' })
    return json(200, data)
  }

  if (action === 'finalize-log') {
    const logOperationId = body.logOperationId ? String(body.logOperationId) : null
    const { data, error } = await admin.rpc('finalize_guest_log', {
      p_user_id: userId,
      p_journey_id: journeyId,
      p_log_operation_id: logOperationId,
    })
    if (error) return json(500, { message: 'Finalize log failed' })
    return json(200, data)
  }

  if (action === 'release') {
    const { data, error } = await admin.rpc('release_guest_journey', {
      p_user_id: userId,
      p_journey_id: journeyId,
    })
    if (error) return json(500, { message: 'Release failed' })
    return json(200, data)
  }

  return json(400, { message: 'Unknown action' })
})
