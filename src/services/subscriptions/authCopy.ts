// ─────────────────────────────────────────────────────────────
// authCopy.ts — Centralized customer-facing copy for entitlement
// and quota states. Avoids technical terminology (no mention of
// Supabase, RevenueCat, API keys, or environment variables).
//
// All copy is concise and consistent with the RawLifeFlow visual
// style.
// ─────────────────────────────────────────────────────────────

// ── Entitlement states ───────────────────────────────────────

export const ENTITLEMENT_LOADING_TITLE = 'Checking your RawLifeFlow access…'
export const ENTITLEMENT_LOADING_BODY = 'Just a moment while we verify your account.'

export const ENTITLEMENT_UNKNOWN_TITLE = 'Unable to Verify Access'
export const ENTITLEMENT_UNKNOWN_BODY =
  'We couldn\u2019t verify your account or plan right now. Check your connection and try again.'

// ── Quota states ─────────────────────────────────────────────

export const QUOTA_UNKNOWN_TITLE = 'Unable to Verify Access'
export const QUOTA_UNKNOWN_BODY =
  'We couldn\u2019t verify your account or plan right now. Check your connection and try again.'

export const QUOTA_UNKNOWN_RETRY = 'Retry'

// ── Juice Snap specific ──────────────────────────────────────

export const SNAP_UNKNOWN_TITLE = 'Unable to Verify Access'
export const SNAP_UNKNOWN_BODY =
  'We couldn\u2019t verify your scan allowance right now. Check your connection and try again.'

// ── Advanced Blend specific ──────────────────────────────────

export const BLEND_UNKNOWN_TITLE = 'Unable to Verify Access'
export const BLEND_UNKNOWN_BODY =
  'We couldn\u2019t verify your Advanced Blend allowance right now. Check your connection and try again.'

export const BLEND_ACCOUNT_REQUIRED_TITLE = 'Protect Your Account'
export const BLEND_ACCOUNT_REQUIRED_BODY =
  'Protect your account to unlock Advanced Blend analysis.'

// ── Production config gate ───────────────────────────────────

export const CONFIG_GATE_TITLE = 'RawLifeFlow needs an update'
export const CONFIG_GATE_BODY =
  'We couldn\u2019t initialize the account services required by this version of RawLifeFlow. Please check for an update and try again.'

export const CONFIG_GATE_CHECK_UPDATE = 'Check for Update'
export const CONFIG_GATE_CHECK_AGAIN = 'Check Again'
