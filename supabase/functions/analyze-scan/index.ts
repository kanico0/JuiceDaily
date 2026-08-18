// ─────────────────────────────────────────────────────────────
// analyze-scan — Server-authoritative AI scan.
//
// Flow: authenticate (verified JWT, permanent accounts only) →
// reserve quota (idempotent) → call Anthropic → commit on success /
// release on technical failure → return the raw model text +
// updated quota snapshot.
//
// Account gate: Supabase anonymous users carry the 'authenticated'
// role, so role/uid checks are insufficient. The user record is
// fetched from the Auth server via the verified token and the
// server-trusted is_anonymous flag must be false BEFORE any funded
// work (reservation, scan record, Anthropic call).
//
// Secrets (Supabase function secrets, never in the app):
//   ANTHROPIC_API_KEY  — API key for Anthropic
//   ANTHROPIC_MODEL    — Model identifier (optional, defaults to claude-sonnet-4-6)
//   DEVICE_FREE_POOL_MODE (off|observe|enforce)
//   PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER
//   PLAY_INTEGRITY_PACKAGE_NAME
//   PLAY_INTEGRITY_SERVICE_ACCOUNT (JSON)
//   DEVICE_POOL_IP_HMAC_SECRET
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'
import { evaluateScanUser, extractBearerToken } from '../_shared/authGate.ts'
import { verifyPlayIntegrity } from '../_shared/playIntegrityVerifier.ts'
import {
  effectiveSnapRemaining,
  deviceSnapRemaining,
  isSnapConsumedThisMonth,
  FREE_DEVICE_SNAP_LIMIT,
} from '../_shared/deviceRecallBits.ts'
import { writeDeviceRecall } from '../_shared/deviceRecallWriter.ts'
import { serverIntegrityLog, maskUserId } from '../_shared/integrityServerLog.ts'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6'
const PROVIDER_TIMEOUT_MS = 30_000
const MAX_IMAGE_BASE64_CHARS = 1_500_000 // ~1.1MB binary

// Produce catalog IDs — must match the mobile app's PRODUCE_DATA keys.
// Used in the Anthropic prompt so the model returns valid catalog IDs
// instead of inventing placeholders like "prod_001".
const PRODUCE_CATALOG: Record<string, string> = {
  kale: 'Kale',
  spinach: 'Spinach',
  swiss_chard: 'Swiss Chard',
  collard_greens: 'Collard Greens',
  dandelion_greens: 'Dandelion Greens',
  arugula: 'Arugula',
  romaine: 'Romaine Lettuce',
  bok_choy: 'Bok Choy',
  wheatgrass: 'Wheatgrass',
  parsley: 'Parsley',
  cilantro: 'Cilantro',
  mint: 'Mint',
  basil: 'Basil',
  aloe_vera: 'Aloe Vera',
  watercress: 'Watercress',
  broccoli: 'Broccoli',
  cabbage_green: 'Green Cabbage',
  cabbage_red: 'Red Cabbage',
  cauliflower: 'Cauliflower',
  kohlrabi: 'Kohlrabi',
  carrot: 'Carrot',
  celery: 'Celery',
  beet: 'Beet',
  cucumber: 'Cucumber',
  fennel: 'Fennel',
  sweet_potato: 'Sweet Potato',
  turnip: 'Turnip',
  celeriac: 'Celeriac',
  jicama: 'Jicama',
  zucchini: 'Zucchini',
  asparagus: 'Asparagus',
  radish: 'Radish',
  ginger: 'Ginger',
  turmeric: 'Turmeric',
  garlic: 'Garlic',
  bell_pepper_red: 'Red Bell Pepper',
  bell_pepper_yellow: 'Yellow Bell Pepper',
  bell_pepper_green: 'Green Bell Pepper',
  jalapeño: 'Jalapeño',
  cayenne: 'Cayenne Pepper',
  tomato: 'Tomato',
  apple: 'Green Apple',
  apple_green: 'Green Apple',
  apple_red: 'Red Apple',
  lemon: 'Lemon',
  lime: 'Lime',
  orange: 'Orange',
  grapefruit: 'Grapefruit',
  pineapple: 'Pineapple',
  watermelon: 'Watermelon',
  pomegranate: 'Pomegranate',
  mango: 'Mango',
  papaya: 'Papaya',
  kiwi: 'Kiwi',
  pear: 'Pear',
  grape: 'Red Grape',
  strawberry: 'Strawberry',
  blueberry: 'Blueberry',
  raspberry: 'Raspberry',
  blackberry: 'Blackberry',
  cranberry: 'Cranberry',
  cherry: 'Tart Cherry',
  cantaloupe: 'Cantaloupe',
  honeydew: 'Honeydew Melon',
  coconut_water: 'Coconut Water',
  passion_fruit: 'Passion Fruit',
  peach: 'Peach',
  plum: 'Plum',
  nectarine: 'Nectarine',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function quotaFromRpc(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const limit = Number(q.scan_limit ?? 0)
  const used = Number(q.used ?? 0)
  const reserved = Number(q.reserved ?? 0)
  return {
    plan: q.plan === 'pro' ? 'pro' : 'free',
    limit,
    used,
    remaining: Math.max(0, limit - used - reserved),
    periodStart: q.period_start ?? '',
    periodEnd: q.period_end ?? '',
    dailyLimit: q.plan === 'pro' ? 10 : null,
    dailyUsed: q.plan === 'pro' ? Number(q.daily_used ?? 0) : null,
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.slice(0, 4096))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!anthropicKey) return json(500, { message: 'Server not configured' })

  // ── Authenticate the caller (user JWT) ─────────────────────
  // admin.auth.getUser(jwt) validates the token against the Auth
  // server (signature + expiry) and returns the canonical user
  // record. Identity is never taken from the request body, and a
  // merely Base64-decoded JWT payload is never trusted.
  const jwt = extractBearerToken(req.headers.get('Authorization'))
  if (!jwt) return json(401, { code: 'missing_authorization', message: 'Missing authorization' })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)

  // ── Validate request body first ────────────────────────────
  // (Needed early to extract guestJourneyId for the auth gate.)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { message: 'Invalid JSON body' })
  }

  const guestJourneyId = body.guestJourneyId ? String(body.guestJourneyId) : null

  // ── Durable-account gate (server-authoritative) ────────────
  // Anonymous Supabase users carry the 'authenticated' role, so
  // the gate checks the server-trusted is_anonymous flag on the
  // VERIFIED user record. Runs BEFORE quota reservation,
  // scan-record insertion, and the Anthropic call:
  // an anonymous rejection consumes zero quota and creates no
  // billable activity.
  //
  // Guest scans: if guestJourneyId is provided, the gate allows
  // the anonymous user through. The guest journey reservation
  // (reserve_guest_journey) is then checked atomically.
  const gate = evaluateScanUser(userData?.user ?? null, userError, guestJourneyId)
  if (!gate.ok) return json(gate.status, { code: gate.code, message: gate.message })

  // Canonical user id comes exclusively from the verified token.
  const userId = gate.userId
  const isGuest = gate.isGuest === true

  const requestId = String(body.requestId ?? '')
  serverIntegrityLog('request_accepted', requestId, true)
  serverIntegrityLog('user_classification', requestId, true, undefined, {
    class: isGuest ? 'guest' : 'durable',
    uid: maskUserId(userId),
  })
  const imageBase64 = String(body.imageBase64 ?? '')
  const mediaType = String(body.mediaType ?? 'image/jpeg')
  const depthDataMm = Array.isArray(body.depthDataMm) ? (body.depthDataMm as number[]) : null
  const integrityToken = String(body.integrityToken ?? '')
  const isMockToken = Boolean(body.integrityTokenIsMock ?? false)

  if (!requestId || requestId.length > 100) return json(400, { message: 'Invalid requestId' })
  if (!imageBase64) return json(400, { message: 'Missing image' })
  if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return json(413, { message: 'Image too large' })
  }
  if (!/^image\/(jpeg|png|webp)$/.test(mediaType)) {
    return json(400, { message: 'Unsupported media type' })
  }

  // ── Reserve quota or guest journey ─────────────────────────
  const imageHash = await sha256Hex(imageBase64)

  // Variables shared across the reservation and Anthropic phases
  let quota: Record<string, unknown> | null = null
  let supportBonusRemaining = 0
  const devicePoolMode = Deno.env.get('DEVICE_FREE_POOL_MODE') ?? 'off'
  serverIntegrityLog('pool_mode', requestId, true, undefined, { mode: devicePoolMode })
  let isProUser = false
  let deviceVerification: Awaited<ReturnType<typeof verifyPlayIntegrity>> | null = null
  let deviceRecallStateKey: string | null = null
  let effectiveRemaining: number | null = null

  const integrityFieldStatus = !integrityToken
    ? 'absent'
    : integrityToken.length === 0
      ? 'blank'
      : 'nonblank'
  serverIntegrityLog('integrity_field', requestId, true, undefined, {
    status: integrityFieldStatus,
  })

  if (isGuest) {
    // Guest scan: reserve the guest journey (one per user).
    const { data: guestReserve, error: guestError } = await admin.rpc('reserve_guest_journey', {
      p_user_id: userId,
      p_journey_id: guestJourneyId!,
      p_journey_type: 'scan',
    })
    if (guestError) {
      console.error('[analyze-scan] guest reserve failed:', guestError.message)
      return json(500, { message: 'Guest journey check failed' })
    }
    const gReserve = guestReserve as Record<string, unknown>
    if (!gReserve.ok) {
      const code = String(gReserve.code ?? 'journey_already_used')
      return json(403, { code, message: 'Guest journey already used' })
    }

    // Also reserve from the monthly scan quota so the guest scan
    // counts as 1 of 1 free scans. The quota is keyed to the
    // Supabase UUID, which is preserved across email upgrade.
    const { data: quotaReserve, error: quotaError } = await admin.rpc('reserve_guest_scan', {
      p_user_id: userId,
      p_request_id: requestId,
      p_image_hash: imageHash,
      p_journey_id: guestJourneyId!,
    })
    if (quotaError) {
      console.error('[analyze-scan] guest quota reserve failed:', quotaError.message)
      // Release the journey reservation since we can't reserve quota.
      await admin.rpc('release_guest_journey', {
        p_user_id: userId,
        p_journey_id: guestJourneyId!,
      })
      return json(500, { message: 'Quota check failed' })
    }
    const qReserve = quotaReserve as Record<string, unknown>
    if (!qReserve.ok) {
      const code = String(qReserve.code ?? 'monthly_limit_reached')
      quota = quotaFromRpc(qReserve.quota)
      await admin.rpc('release_guest_journey', {
        p_user_id: userId,
        p_journey_id: guestJourneyId!,
      })
      return json(429, { code, message: 'Scan limit reached', quota })
    }
    quota = quotaFromRpc(qReserve.quota)
    // Guests are always Free users (no Pro guest concept)
    isProUser = false
  } else {
    // Durable user: reserve from the monthly quota.
    const { data: reserveData, error: reserveError } = await admin.rpc('reserve_scan', {
      p_user_id: userId,
      p_request_id: requestId,
      p_image_hash: imageHash,
    })
    if (reserveError) {
      console.error('[analyze-scan] reserve failed:', reserveError.message)
      return json(500, { message: 'Quota check failed' })
    }
    const reserve = reserveData as Record<string, unknown>
    quota = quotaFromRpc(reserve.quota)
    if (reserve.ok) {
      serverIntegrityLog('account_reservation', requestId, true, undefined, { status: 'reserved' })
    }
    if (!reserve.ok) {
      // Account quota exhausted — try support exception bonus scan
      const { data: excData } = await admin.rpc('consume_support_exception', {
        p_user_id: userId,
      })
      const exc = excData as Record<string, unknown> | null
      if (exc?.ok) {
        // Support exception consumed — re-reserve with the bonus
        const { data: retryReserveData, error: retryReserveError } = await admin.rpc(
          'reserve_scan',
          {
            p_user_id: userId,
            p_request_id: requestId,
            p_image_hash: imageHash,
          },
        )
        if (retryReserveError) {
          console.error('[analyze-scan] retry reserve failed:', retryReserveError.message)
          return json(500, { message: 'Quota check failed' })
        }
        const retryReserve = retryReserveData as Record<string, unknown>
        quota = quotaFromRpc(retryReserve.quota)
        if (!retryReserve.ok) {
          serverIntegrityLog('account_reservation', requestId, false, 'rejected')
          return json(429, { code: 'monthly_limit_reached', message: 'Scan limit reached', quota })
        }
        serverIntegrityLog('account_reservation', requestId, true, undefined, {
          status: 'reserved',
        })
        supportBonusRemaining = (exc.bonus_remaining as number) ?? 0
      } else {
        const code = String(reserve.code ?? 'monthly_limit_reached')
        serverIntegrityLog('account_reservation', requestId, false, 'rejected')
        return json(429, { code, message: 'Scan limit reached', quota })
      }
    }

    // Determine Pro status from quota plan
    isProUser = (quota as Record<string, unknown> | null)?.plan === 'pro'
  }

  // ── Device pool verification (applies to BOTH guest and durable Free) ──
  // The device pool applies only to FREE users. Pro users bypass
  // the device pool entirely — their Pro quota is account-based.
  // Guests are always Free and must go through device verification.
  const deviceRecallWriteEnabled = Deno.env.get('DEVICE_RECALL_WRITE_ENABLED') === '1'
  const verificationBlockEntered = devicePoolMode !== 'off' && !isProUser && Boolean(integrityToken)
  serverIntegrityLog('verification_block', requestId, true, undefined, {
    entered: verificationBlockEntered,
  })

  if (devicePoolMode !== 'off' && !isProUser && integrityToken) {
    const expectedRequestHash = [requestId, userId, 'analyze_scan', imageHash].join('|')

    serverIntegrityLog('verify_called', requestId, true)
    deviceVerification = await verifyPlayIntegrity({
      token: integrityToken,
      expectedPackageName: Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME') ?? 'com.rawlifeflow.juicingdaily',
      expectedRequestHash,
      cloudProjectNumber: Deno.env.get('PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER') ?? '',
      serviceAccountJson: Deno.env.get('PLAY_INTEGRITY_SERVICE_ACCOUNT') ?? '',
      isMock: isMockToken,
      enforcementMode: devicePoolMode,
    })

    serverIntegrityLog(
      'verification_result',
      requestId,
      deviceVerification.ok,
      deviceVerification.reasonCode,
      { integrityStatus: deviceVerification.integrityStatus },
    )

    deviceRecallStateKey = deviceVerification.deviceRecallStateKey

    const recallPresent = deviceVerification.deviceBits != null
    serverIntegrityLog('device_recall_present', requestId, recallPresent, undefined, {
      present: recallPresent,
    })
    const recallDecoded = recallPresent && deviceVerification.deviceWriteDates != null
    serverIntegrityLog('device_recall_decoded', requestId, recallDecoded, undefined, {
      decoded: recallDecoded,
    })

    // In enforce mode, block if device pool is exhausted or integrity failed
    // or Device Recall is unavailable (fail-closed for Free AI-cost features).
    const isEnforce = devicePoolMode === 'enforce'
    serverIntegrityLog('enforcement_attempted', requestId, false, undefined, {
      attempted: isEnforce,
    })

    if (isEnforce) {
      // Check for blocking conditions:
      // 1. Integrity verification failed (security or technical)
      // 2. Device Recall unavailable (fail-closed in enforce)
      // 3. Device Snap exhausted for this month
      const integrityFailed = !deviceVerification.ok
      const recallUnavailable = !deviceVerification.deviceRecallAvailable
      const snapExhausted =
        deviceVerification.deviceRecallAvailable && deviceVerification.deviceSnapRemaining === 0

      if (integrityFailed || recallUnavailable || snapExhausted) {
        // If a support exception was consumed, allow the scan to proceed.
        // Support exceptions bypass device pool enforcement but do NOT
        // reset the device pool, modify Device Recall bits, or grant Pro.
        if (supportBonusRemaining > 0) {
          console.log(
            '[analyze-scan] device pool exhausted but support exception active, allowing scan',
          )
        } else {
          // Release the account reservation before returning
          if (isGuest) {
            await admin.rpc('release_guest_scan', {
              p_user_id: userId,
              p_request_id: requestId,
              p_failure_category: `integrity_${deviceVerification.reasonCode}`,
            })
            await admin.rpc('release_guest_journey', {
              p_user_id: userId,
              p_journey_id: guestJourneyId!,
            })
          } else {
            await admin.rpc('release_scan', {
              p_user_id: userId,
              p_request_id: requestId,
              p_failure_category: `integrity_${deviceVerification.reasonCode}`,
            })
          }
          const blockCode = recallUnavailable
            ? 'device_recall_unavailable'
            : 'device_pool_exhausted'
          return json(429, {
            code: blockCode,
            message: recallUnavailable
              ? 'Device verification unavailable. Install from Google Play or upgrade to Pro.'
              : 'Free Juice Snaps used for this month on this device',
            quota: { ...quota, effectiveRemaining: 0 },
            deviceSnapRemaining: deviceVerification.deviceSnapRemaining,
          })
        }
      } else if (deviceRecallStateKey) {
        serverIntegrityLog('device_reservation', requestId, true, undefined, {
          status: 'reserved_enforce',
        })
        const { error: deviceReserveError } = await admin.rpc('reserve_device_scan', {
          p_request_id: requestId,
          p_user_id: userId,
          p_device_recall_state_key: deviceRecallStateKey,
          p_device_used: deviceVerification.deviceSnapRemaining === 0 ? 1 : 0,
          p_enforcement_mode: devicePoolMode,
          p_integrity_status: deviceVerification.integrityStatus,
        })
        if (deviceReserveError) {
          console.error('[analyze-scan] device reserve failed:', deviceReserveError.message)
        }
      }
    } else {
      serverIntegrityLog('device_reservation', requestId, true, undefined, {
        status: 'skipped_observe',
      })
    }

    // Calculate effective remaining for response
    const accountRemaining = ((quota as Record<string, unknown> | null)?.remaining as number) ?? 0
    const devSnapRemaining = deviceVerification.deviceRecallAvailable
      ? deviceVerification.deviceSnapRemaining
      : FREE_DEVICE_SNAP_LIMIT // In observe mode, fall back to full allowance if unavailable
    effectiveRemaining = effectiveSnapRemaining(accountRemaining, devSnapRemaining)
    serverIntegrityLog('effective_remaining', requestId, true, undefined, { calculated: true })
    serverIntegrityLog('observe_decision', requestId, true, undefined, {
      completed: true,
      enforced: false,
    })
  } else {
    serverIntegrityLog('device_reservation', requestId, true, undefined, {
      status: 'skipped_observe',
    })
    if (isProUser) {
      effectiveRemaining = ((quota as Record<string, unknown> | null)?.remaining as number) ?? null
    }
  }

  // ── Call Anthropic ─────────────────────────────────────────
  const KNOWN_IDS = Object.keys(PRODUCE_CATALOG).join(', ')

  const systemPrompt =
    depthDataMm && depthDataMm.length > 0
      ? `You are a produce identification expert for a cold-pressed juicing app. Use the LiDAR depth data (mm) for volumetric weight estimation. Return ONLY a valid JSON array of {"produceId","name","count","estimatedWeightG","confidence"}. Use one of these produceId values: ${KNOWN_IDS}. If you cannot identify the produce with confidence, omit it.`
      : `You are a produce identification expert. Return ONLY a valid JSON array, no markdown. For each produce item: {"produceId":"<id>","name":"<name>","count":<n>,"estimatedWeightG":<g>,"confidence":<0-1>}. Use one of these produceId values: ${KNOWN_IDS}. If you cannot identify the produce with confidence, omit it.`

  const userText =
    depthDataMm && depthDataMm.length > 0
      ? `Identify all produce in this image. LiDAR depth data (mm): [${depthDataMm.join(',')}]`
      : 'Identify all produce items in this image. Estimate count and weight for each.'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              { type: 'text', text: userText },
            ],
          },
        ],
      }),
    })
    clearTimeout(timer)

    if (!anthropicRes.ok) {
      // Diagnostic: log provider error details (sanitized — no key, no image)
      const errBody = await anthropicRes.text().catch(() => '')
      const sanitizedErr = errBody.substring(0, 500).replace(/sk-[A-Za-z0-9_\-.]+/g, 'REDACTED_KEY')
      console.error(
        `[analyze-scan] Anthropic error: status=${anthropicRes.status} body=${sanitizedErr}`,
      )
      serverIntegrityLog('analysis', requestId, false, 'provider_failure')
      // Technical/provider failure → release, no credit spent.
      if (isGuest) {
        await admin.rpc('release_guest_scan', {
          p_user_id: userId,
          p_request_id: requestId,
          p_failure_category: `provider_${anthropicRes.status}`,
        })
        await admin.rpc('release_guest_journey', {
          p_user_id: userId,
          p_journey_id: guestJourneyId!,
        })
        return json(502, { message: 'Vision provider error', quota: null })
      }
      const { data: releaseData } = await admin.rpc('release_scan', {
        p_user_id: userId,
        p_request_id: requestId,
        p_failure_category: `provider_${anthropicRes.status}`,
      })
      // Also release device reservation if one was made
      if (deviceRecallStateKey && devicePoolMode === 'enforce') {
        await Promise.resolve(
          admin.rpc('release_device_scan', {
            p_request_id: requestId,
            p_failure_reason: `provider_${anthropicRes.status}`,
          }),
        ).catch(() => {})
      }
      const releasedQuota = quotaFromRpc((releaseData as Record<string, unknown>)?.quota)
      serverIntegrityLog('account_finalization', requestId, false, 'released')
      serverIntegrityLog('device_finalization', requestId, true, undefined, {
        status:
          deviceRecallStateKey && devicePoolMode === 'enforce'
            ? 'released_enforce'
            : 'skipped_observe',
      })
      return json(502, { message: 'Vision provider error', quota: releasedQuota })
    }

    const data = await anthropicRes.json()
    const rawText: string = data.content?.[0]?.text ?? '[]'

    // Validate that the provider response contains at least one
    // produce item that maps to a known catalog ID. This prevents
    // finalizing a guest scan with unusable placeholder results
    // (e.g. "prod_001") that have no display name or nutrients.
    let hasValidItem = false
    try {
      const cleaned = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        hasValidItem = parsed.some((it: Record<string, unknown>) => {
          const id = String(it.produceId ?? '')
            .toLowerCase()
            .trim()
          return id && id in PRODUCE_CATALOG
        })
      }
    } catch {
      // Non-JSON response — treat as no valid items
    }

    if (!hasValidItem) {
      // No valid produce identified — release, no credit spent.
      serverIntegrityLog('analysis', requestId, false, 'no_valid_result')
      if (isGuest) {
        await admin.rpc('release_guest_scan', {
          p_user_id: userId,
          p_request_id: requestId,
          p_failure_category: 'no_valid_produce',
        })
        await admin.rpc('release_guest_journey', {
          p_user_id: userId,
          p_journey_id: guestJourneyId!,
        })
        return json(200, { rawText, quota: null, isGuest: true })
      }
      const { data: releaseData } = await admin.rpc('release_scan', {
        p_user_id: userId,
        p_request_id: requestId,
        p_failure_category: 'no_valid_produce',
      })
      // Also release device reservation if one was made
      if (deviceRecallStateKey && devicePoolMode === 'enforce') {
        await Promise.resolve(
          admin.rpc('release_device_scan', {
            p_request_id: requestId,
            p_failure_reason: 'no_valid_produce',
          }),
        ).catch(() => {})
      }
      const releasedQuota = quotaFromRpc((releaseData as Record<string, unknown>)?.quota)
      serverIntegrityLog('account_finalization', requestId, false, 'released')
      serverIntegrityLog('device_finalization', requestId, true, undefined, {
        status:
          deviceRecallStateKey && devicePoolMode === 'enforce'
            ? 'released_enforce'
            : 'skipped_observe',
      })
      return json(200, { rawText, quota: releasedQuota })
    }

    // Usable result → commit the reservation.
    // Also commit device reservation if one was made.
    serverIntegrityLog('analysis', requestId, true, undefined, { validResult: true })

    if (deviceRecallStateKey && devicePoolMode === 'enforce') {
      serverIntegrityLog('device_finalization', requestId, true, undefined, {
        status: 'committed_enforce',
      })
      await Promise.resolve(
        admin.rpc('commit_device_scan', {
          p_request_id: requestId,
        }),
      ).catch((e: Error) => {
        console.error('[analyze-scan] device commit failed:', e?.message)
      })
    } else {
      serverIntegrityLog('device_finalization', requestId, true, undefined, {
        status: 'skipped_observe',
      })
    }

    if (isGuest) {
      // Guest scan: commit the scan quota (counts as 1 of 1 free
      // monthly scan) and finalize the guest scan stage.
      serverIntegrityLog('account_finalization', requestId, true, undefined, {
        status: 'committed',
      })
      const { data: commitData } = await admin.rpc('commit_scan', {
        p_user_id: userId,
        p_request_id: requestId,
        p_estimated_cost: null,
      })
      const committedQuota = quotaFromRpc((commitData as Record<string, unknown>)?.quota)
      await admin.rpc('finalize_guest_scan', {
        p_user_id: userId,
        p_journey_id: guestJourneyId!,
      })

      // ── Device Recall write: mark bitFirst=true for this month ──
      // Only write if: Free user, write enabled, device recall available,
      // and we have a verified integrity token.
      if (
        deviceRecallWriteEnabled &&
        !isProUser &&
        deviceVerification?.deviceRecallAvailable &&
        deviceVerification?.ok &&
        integrityToken
      ) {
        const writeResult = await writeDeviceRecall({
          integrityToken,
          packageName: Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME') ?? 'com.rawlifeflow.juicingdaily',
          serviceAccountJson: Deno.env.get('PLAY_INTEGRITY_SERVICE_ACCOUNT') ?? '',
          newValues: { bitFirst: true },
          operation: 'snap',
        })
        serverIntegrityLog('device_recall_write_result', requestId, writeResult.ok, undefined, {
          operation: 'snap',
          attempts: writeResult.attempts,
          residualRisk: writeResult.residualRisk,
        })
      }

      return json(200, { rawText, quota: committedQuota, isGuest: true })
    }

    const { data: commitData, error: commitError } = await admin.rpc('commit_scan', {
      p_user_id: userId,
      p_request_id: requestId,
      p_estimated_cost: null,
    })
    if (commitError) console.error('[analyze-scan] commit failed:', commitError.message)
    serverIntegrityLog('account_finalization', requestId, true, undefined, { status: 'committed' })
    const committedQuota = quotaFromRpc((commitData as Record<string, unknown>)?.quota) ?? quota

    // ── Device Recall write: mark bitFirst=true for this month ──
    // Only write if: Free user, write enabled, device recall available,
    // and we have a verified integrity token.
    if (
      deviceRecallWriteEnabled &&
      !isProUser &&
      deviceVerification?.deviceRecallAvailable &&
      deviceVerification?.ok &&
      integrityToken
    ) {
      const writeResult = await writeDeviceRecall({
        integrityToken,
        packageName: Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME') ?? 'com.rawlifeflow.juicingdaily',
        serviceAccountJson: Deno.env.get('PLAY_INTEGRITY_SERVICE_ACCOUNT') ?? '',
        newValues: { bitFirst: true },
        operation: 'snap',
      })
      serverIntegrityLog('device_recall_write_result', requestId, writeResult.ok, undefined, {
        operation: 'snap',
        attempts: writeResult.attempts,
        residualRisk: writeResult.residualRisk,
      })
    }

    // Return effective remaining for free users with device pool
    const responseQuota =
      effectiveRemaining != null && !isProUser
        ? { ...committedQuota, effectiveRemaining }
        : committedQuota

    const response: Record<string, unknown> = { rawText, quota: responseQuota }
    if (supportBonusRemaining > 0) {
      response.supportBonusRemaining = supportBonusRemaining
    }

    return json(200, response)
  } catch (e) {
    // Timeout / network failure → release, no credit spent.
    if (isGuest) {
      await admin.rpc('release_guest_scan', {
        p_user_id: userId,
        p_request_id: requestId,
        p_failure_category: 'provider_timeout',
      })
      await admin.rpc('release_guest_journey', {
        p_user_id: userId,
        p_journey_id: guestJourneyId!,
      })
      console.error('[analyze-scan] guest provider call failed:', (e as Error)?.message)
      return json(504, { message: 'Vision provider timeout', quota: null })
    }
    const { data: releaseData } = await admin.rpc('release_scan', {
      p_user_id: userId,
      p_request_id: requestId,
      p_failure_category: 'provider_timeout',
    })
    // Also release device reservation if one was made
    if (deviceRecallStateKey && devicePoolMode === 'enforce') {
      await Promise.resolve(
        admin.rpc('release_device_scan', {
          p_request_id: requestId,
          p_failure_reason: 'provider_timeout',
        }),
      ).catch(() => {})
    }
    const releasedQuota = quotaFromRpc((releaseData as Record<string, unknown>)?.quota)
    console.error('[analyze-scan] provider call failed:', (e as Error)?.message)
    return json(504, { message: 'Vision provider timeout', quota: releasedQuota })
  }
})
