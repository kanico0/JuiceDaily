// ─────────────────────────────────────────────────────────────
// AnalyticsService.js — Central event wrapper with field
// allowlisting and PII enforcement. Console sink by default;
// swap sink for production (Mixpanel, Amplitude, etc.).
// ─────────────────────────────────────────────────────────────

// ── Event Schemas ────────────────────────────────────────────
// Each event has required fields, optional fields, and
// prohibited fields (enforced at runtime via allowlist).

const EVENT_SCHEMAS = {
  first_log_started: {
    required: ['install_id', 'session_id', 'ts', 'surface', 'logger_variant'],
    optional: ['ab_bucket', 'flag_state'],
  },
  first_log_completed: {
    required: ['install_id', 'session_id', 'ts', 'log_type', 'volume_bucket', 'juice_type_enum', 'offline'],
    optional: ['time_bucket', 'latency_ms_bucket'],
  },
  log_completed: {
    required: ['session_id', 'ts', 'log_id_opaque', 'log_type', 'volume_bucket', 'offline'],
    optional: ['source', 'time_bucket'],
  },
  pantry_item_added: {
    required: ['session_id', 'ts', 'item_id_opaque', 'category_enum', 'storage_enum'],
    optional: ['days_to_quality_end_bucket', 'add_method'],
  },
  pantry_use_suggested: {
    required: ['session_id', 'ts', 'item_id_opaque', 'days_remaining_bucket', 'surface'],
    optional: ['suggestion_count', 'recipe_suggestion_method'],
  },
  reminder_opt_in_shown: {
    required: ['session_id', 'ts', 'surface', 'reason'],
    optional: ['notif_permission_status_before'],
  },
  reminder_opt_in_accepted: {
    required: ['session_id', 'ts', 'schedule_bucket', 'notif_permission_status_after'],
    optional: ['reminder_type'],
  },
  streak_started: {
    required: ['session_id', 'ts', 'streak_len'],
    optional: ['streak_mode'],
  },
  streak_broken: {
    required: ['session_id', 'ts', 'streak_len', 'grace_used'],
    optional: ['break_context'],
  },
  template_used: {
    required: ['session_id', 'ts', 'template_id_opaque', 'log_type'],
    optional: ['template_category_enum'],
  },
  photo_draft_created: {
    required: ['session_id', 'ts', 'draft_id_opaque', 'offline'],
    optional: ['camera_permission_status'],
  },
  ai_recipe_suggested: {
    required: ['session_id', 'ts', 'ai_feature_flag', 'suggestion_type_enum'],
    optional: ['rank_position', 'model_family'],
  },
  ai_suggestion_accepted: {
    required: ['session_id', 'ts', 'suggestion_id_opaque', 'suggestion_type_enum'],
    optional: ['source'],
  },
  ai_suggestion_dismissed: {
    required: ['session_id', 'ts', 'suggestion_id_opaque', 'suggestion_type_enum'],
    optional: ['source'],
  },
  social_opt_in: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  social_opt_out: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  social_challenge_joined: {
    required: ['session_id', 'ts', 'challenge_id_enum'],
    optional: ['source'],
  },
  social_challenge_left: {
    required: ['session_id', 'ts', 'challenge_id_enum'],
    optional: ['source'],
  },
  social_challenge_completed: {
    required: ['session_id', 'ts', 'challenge_id_enum'],
    optional: [],
  },
  first_launch_viewed: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  goal_selected: {
    required: ['session_id', 'ts', 'goal_enum'],
    optional: ['source'],
  },
  first_recipe_generated: {
    required: ['session_id', 'ts', 'suggestion_type_enum'],
    optional: ['goal_enum', 'source'],
  },
  streak_incremented: {
    required: ['session_id', 'ts', 'streak_len'],
    optional: ['source'],
  },
  streak_grace_used: {
    required: ['session_id', 'ts', 'streak_len', 'grace_days_used'],
    optional: [],
  },
  milestone_unlocked: {
    required: ['session_id', 'ts', 'milestone_enum', 'streak_len'],
    optional: [],
  },
  badge_awarded: {
    required: ['session_id', 'ts', 'badge_enum'],
    optional: ['streak_len'],
  },
  pantry_expiring_alert_sent: {
    required: ['session_id', 'ts', 'item_count'],
    optional: ['surface'],
  },
  nutrient_halo_viewed: {
    required: ['session_id', 'ts'],
    optional: ['pillars_filled', 'total_pillars'],
  },
  nutrient_segment_tapped: {
    required: ['session_id', 'ts', 'pillar_enum'],
    optional: ['is_filled'],
  },
  weekly_progress_viewed: {
    required: ['session_id', 'ts'],
    optional: ['days_with_logs', 'pillar_counts'],
  },
  monthly_heatmap_viewed: {
    required: ['session_id', 'ts'],
    optional: ['days_logged', 'month_offset'],
  },
  day_detail_opened: {
    required: ['session_id', 'ts', 'day_key'],
    optional: ['pillar_counts'],
  },
  juice_calculator_opened: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  nutrient_goal_selected: {
    required: ['session_id', 'ts', 'nutrient_id', 'timeframe'],
    optional: ['target_value'],
  },
  calculator_run: {
    required: ['session_id', 'ts', 'timeframe', 'nutrients_count', 'allow_multi_produce'],
    optional: ['max_volume_oz'],
  },
  calculator_result_viewed: {
    required: ['session_id', 'ts', 'result_type', 'items_count'],
    optional: ['coverage_pct_avg'],
  },
  calculator_result_applied_to_plan: {
    required: ['session_id', 'ts', 'result_type', 'items_count'],
    optional: ['action_enum'],
  },
  onboarding_started: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  scan_completed_first_time: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  tracking_opt_in: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  scan_entry_viewed: {
    required: ['session_id', 'ts'],
    optional: ['variant'],
  },
  scan_primary_tapped: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  scan_secondary_browse_tapped: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  scan_secondary_example_tapped: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  scan_example_viewed: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  browse_ideas_opened: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  browse_template_opened: {
    required: ['session_id', 'ts', 'template_id'],
    optional: [],
  },
  scan_cta_tapped: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  scan_idle_nudge_shown: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  scan_teaser_visible: {
    required: ['session_id', 'ts'],
    optional: ['teaser_index'],
  },
  explain_flow_started: {
    required: ['session_id', 'ts'],
    optional: ['source'],
  },
  explain_slide_viewed: {
    required: ['session_id', 'ts'],
    optional: ['slide_index'],
  },
  explain_reveal_pressed: {
    required: ['session_id', 'ts'],
    optional: [],
  },
  explain_skipped: {
    required: ['session_id', 'ts'],
    optional: ['slide_index'],
  },
  performance_onboarding_slide: {
    required: ['ts'],
    optional: ['slide_index'],
  },
  performance_onboarding_completed: {
    required: ['ts'],
    optional: [],
  },
  scan_success_viewed: {
    required: ['ts'],
    optional: ['ingredient_count', 'nutrients_found', 'score_increase', 'new_momentum'],
  },
}

// ── Prohibited field patterns (PII / sensitive) ──────────────
// These field names are NEVER allowed in any event payload.

const PROHIBITED_PATTERNS = [
  'name', 'email', 'phone', 'address', 'location',
  'ingredient_text', 'ingredients', 'notes', 'recipe_name',
  'photo', 'image', 'base64', 'exif', 'prompt_text',
  'user_name', 'user_email', 'template_name',
]

function containsProhibitedField(fields) {
  const keys = Object.keys(fields)
  for (const key of keys) {
    const lower = key.toLowerCase()
    if (PROHIBITED_PATTERNS.some((p) => lower.includes(p))) {
      return key
    }
  }
  return null
}

// ── Session ID ───────────────────────────────────────────────

let _sessionId = null

function getSessionId() {
  if (!_sessionId) {
    _sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
  return _sessionId
}

export function resetSession() {
  _sessionId = null
}

// ── Install ID (persistent) ─────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

const INSTALL_ID_KEY = '@juicing_install_id'
let _installId = null

async function getInstallId() {
  if (_installId) return _installId
  try {
    let id = await AsyncStorage.getItem(INSTALL_ID_KEY)
    if (!id) {
      id = `i_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      await AsyncStorage.setItem(INSTALL_ID_KEY, id)
    }
    _installId = id
    return id
  } catch (e) {
    return 'i_unknown'
  }
}

// ── Sink (console by default; replace for production) ────────

let _sink = async (eventName, payload) => {
  if (__DEV__) {
    console.log(`[Analytics] ${eventName}`, JSON.stringify(payload, null, 2))
  }
}

export function setAnalyticsSink(sinkFn) {
  _sink = sinkFn
}

// ── Core Track Function ──────────────────────────────────────

export async function trackEvent(eventName, fields = {}) {
  const schema = EVENT_SCHEMAS[eventName]
  if (!schema) {
    if (__DEV__) console.warn(`[Analytics] Unknown event: ${eventName}`)
    return
  }

  // PII enforcement
  const prohibited = containsProhibitedField(fields)
  if (prohibited) {
    if (__DEV__) console.error(`[Analytics] BLOCKED: prohibited field "${prohibited}" in ${eventName}`)
    return
  }

  // Build allowlisted payload
  const allowed = new Set([...schema.required, ...schema.optional])
  const payload = {}

  for (const key of Object.keys(fields)) {
    if (allowed.has(key)) {
      payload[key] = fields[key]
    } else if (__DEV__) {
      console.warn(`[Analytics] Dropped unknown field "${key}" from ${eventName}`)
    }
  }

  // Auto-fill common fields
  if (!payload.session_id) payload.session_id = getSessionId()
  if (!payload.ts) payload.ts = new Date().toISOString()
  if (schema.required.includes('install_id') && !payload.install_id) {
    payload.install_id = await getInstallId()
  }

  // Validate required fields
  const missing = schema.required.filter((f) => !(f in payload))
  if (missing.length > 0 && __DEV__) {
    console.warn(`[Analytics] Missing required fields in ${eventName}: ${missing.join(', ')}`)
  }

  try {
    await _sink(eventName, payload)
  } catch (e) {
    if (__DEV__) console.error(`[Analytics] Sink error for ${eventName}:`, e)
  }
}

// ── Convenience Helpers ──────────────────────────────────────

export function getSessionIdSync() {
  return getSessionId()
}

export { getInstallId, EVENT_SCHEMAS }
