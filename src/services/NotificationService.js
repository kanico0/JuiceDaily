// ─────────────────────────────────────────────────────────────
// NotificationService.js — Multi-tiered psychology-driven
// notification engine with frequency caps, quiet hours,
// anti-churn protocol, and rich push support
// ─────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications'
import { Platform, LogBox } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  AFFIRMATIONS,
  EDUCATIONAL,
  FREEZER_PASS_MORNING,
  STREAK_SHIELD,
  ONBOARDING_SEQUENCE,
  NOTIFICATION_CATEGORIES,
  pickRandom,
  fillTemplate,
  getSurpriseForCount,
  getWeightMilestone,
} from '../constants/NotificationLibrary'
import { recordMeaningfulActivity } from './DormantReminderService'
import {
  INTENSITY_CAPS,
  DEFAULT_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  getSentToday,
  incrementSentToday,
  canSendNotification,
  isTimeInQuietHours,
  enforceGlobalNotificationCap,
} from './NotificationCapPolicy'

// Suppress the known Expo Go SDK 53+ Android push notification warning
LogBox.ignoreLogs(['expo-notifications: Android push notification'])

// Availability guard — notifications are non-functional in Expo Go on Android (SDK 53+)
let notificationsAvailable = true
try {
  Notifications.getPermissionsAsync().catch((e) => {
    notificationsAvailable = false
    console.warn('[notif] availability guard set to FALSE — getPermissionsAsync rejected:', e?.name || 'unknown', e?.message || '')
  })
} catch (e) {
  notificationsAvailable = false
  console.warn('[notif] availability guard set to FALSE — synchronous throw:', e?.name || 'unknown', e?.message || '')
}

// ── Storage Keys ─────────────────────────────────────────────

const KEYS = {
  SENT_TODAY: '@notif_sent_today',
  SENT_DATE: '@notif_sent_date',
  ONBOARDING_STEP: '@notif_onboard_step',
  INSTALL_DATE: '@notif_install_date',
  LAST_JUICE_TS: '@notif_last_juice_ts',
  PREV_WEIGHT_G: '@notif_prev_weight_g',
  PREV_JUICE_COUNT: '@notif_prev_juice_count',
}

// Re-export shared cap policy for backward compatibility
export {
  INTENSITY_CAPS,
  DEFAULT_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  canSendNotification,
  isTimeInQuietHours,
  incrementSentToday,
  enforceGlobalNotificationCap,
}

const ANDROID_CHANNEL_ID = 'rawlifeflow-reminders'

// ── Android Notification Channel ─────────────────────────────

let channelCreated = false

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || channelCreated) return
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#81C784',
      sound: 'glass_clink.wav',
    })
    channelCreated = true
    console.log('[notif] ensureAndroidChannel OK | channelId:', ANDROID_CHANNEL_ID)
  } catch (e) {
    console.warn('[notif] ensureAndroidChannel FAIL:', e?.name || 'unknown', e?.message || '')
  }
}

// ── Configure Handler ────────────────────────────────────────
// Wrapped in try/catch: expo-notifications Android push was removed
// from Expo Go in SDK 53+. Gracefully degrade when unavailable.

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
} catch (e) {
  // Notifications unavailable (Expo Go SDK 53+ Android)
}

// ── Register Action Categories ───────────────────────────────

async function registerCategories() {
  try {
    await Notifications.setNotificationCategoryAsync('AFFIRMATION', [
      { identifier: 'LOG_NOW', buttonTitle: 'Log Now', options: { opensAppToForeground: true } },
    ])
    await Notifications.setNotificationCategoryAsync('STREAK_ALERT', [
      { identifier: 'LOG_NOW', buttonTitle: 'Log Now', options: { opensAppToForeground: true } },
    ])
    await Notifications.setNotificationCategoryAsync('SURPRISE', [
      { identifier: 'LOG_NOW', buttonTitle: 'Log Now', options: { opensAppToForeground: true } },
    ])
    await Notifications.setNotificationCategoryAsync('EDUCATIONAL', [
      { identifier: 'LOG_NOW', buttonTitle: 'Log Now', options: { opensAppToForeground: true } },
    ])
  } catch (e) {
    // Categories may not be supported on all platforms
  }
}

// ── Permission ───────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!notificationsAvailable) {
    console.warn('[notif] requestNotificationPermission SKIP — notificationsAvailable=false')
    return false
  }
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    console.log('[notif] requestNotificationPermission → finalStatus:', finalStatus)
    if (finalStatus === 'granted') {
      await registerCategories()
    }
    return finalStatus === 'granted'
  } catch (e) {
    console.warn('[notif] requestNotificationPermission FAIL:', e?.name || 'unknown', e?.message || '')
    return false
  }
}

// ── Core Schedule Function ───────────────────────────────────
// isEmergency parameter retained for backward compatibility but
// no longer bypasses cap or quiet hours — all notifications count.

async function scheduleNotif({ id, title, body, data, triggerDate, categoryId }) {
  if (!notificationsAvailable) {
    console.warn('[notif] scheduleNotif SKIP — notificationsAvailable=false | id:', id)
    return false
  }
  const settings = await loadNotificationSettings()

  // For immediate/near-future: check caps now
  // For far-future scheduled: we trust the trigger-time quiet hours check
  const isNearFuture = !triggerDate || (triggerDate - Date.now() < 60000)
  if (isNearFuture) {
    const allowed = await canSendNotification(settings)
    if (!allowed) {
      console.warn('[notif] scheduleNotif BLOCKED by canSendNotification | id:', id, 'enabled:', settings.enabled, 'intensity:', settings.intensity)
      return false
    }
  }

  // Check if scheduled time falls in quiet hours
  if (triggerDate) {
    const d = new Date(triggerDate)
    if (isTimeInQuietHours(d.getHours(), d.getMinutes(), settings)) {
      console.warn('[notif] scheduleNotif BLOCKED by quiet hours | id:', id, 'trigger:', d.toISOString())
      return false
    }
  }

  await ensureAndroidChannel()

  const content = {
    title,
    body,
    data: { ...data, sentAt: new Date().toISOString() },
    sound: 'glass_clink.wav',
  }

  if (Platform.OS === 'android') {
    content.channelId = ANDROID_CHANNEL_ID
  }

  if (categoryId) {
    content.categoryIdentifier = categoryId
  }

  const triggerIso = triggerDate ? new Date(triggerDate).toISOString() : 'immediate'
  const trigger = triggerDate
    ? {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: ANDROID_CHANNEL_ID,
      }
    : null
  try {
    const result = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
      identifier: id,
    })
    console.log('[notif] scheduleNotif OK | id:', id, 'trigger:', triggerIso, 'result:', result || '(no id returned)')
    if (isNearFuture) await incrementSentToday()
    return true
  } catch (e) {
    console.warn('[notif] scheduleNotif FAIL | id:', id, 'trigger:', triggerIso, 'error:', e?.name || 'unknown', e?.message || '')
    return false
  }
}

// ── Safe Cancel ──────────────────────────────────────────────

async function safeCancel(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER 1: Identity Trigger (Scheduled Daily Affirmation)
// 10 minutes before typical juicing time (default 7:20 AM)
// ═══════════════════════════════════════════════════════════════

export async function scheduleIdentityTrigger() {
  await safeCancel('identity-affirmation')
  const settings = await loadNotificationSettings()
  if (!settings.affirmations) return

  const affirmation = pickRandom(AFFIRMATIONS)
  const targetHour = settings.typicalJuiceHour
  const targetMinute = Math.max(0, settings.typicalJuiceMinute - 10)

  // Skip if in quiet hours
  if (isTimeInQuietHours(targetHour, targetMinute, settings)) return

  const now = new Date()
  const trigger = new Date(now)
  trigger.setHours(targetHour, targetMinute, 0, 0)

  // If time already passed today, schedule for tomorrow
  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1)
  }

  await scheduleNotif({
    id: 'identity-affirmation',
    title: affirmation.title,
    body: affirmation.body,
    data: { type: 'affirmation', action: 'open_dashboard' },
    triggerDate: trigger,
    categoryId: 'AFFIRMATION',
  })
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER 2: Inventory Trigger (36-hour Inactivity Wilt Warning)
// RETIRED in 1.0.20 — Inventory Alerts setting removed.
// Function retained as a no-op that cancels any legacy scheduled
// wilt-warning notification so it cannot fire on upgraded devices.
// ═══════════════════════════════════════════════════════════════

export async function scheduleWiltWarning() {
  // Retired — cancel any previously scheduled wilt-warning
  await safeCancel('wilt-warning')
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER 3: Streak Shield (8 PM Loss Aversion)
// If Vitality Rings at 0% at 8:00 PM
// ═══════════════════════════════════════════════════════════════

export async function scheduleStreakShield(streak) {
  await safeCancel('streak-shield')
  const settings = await loadNotificationSettings()
  if (!settings.vitalityReminders) return
  if (streak <= 0) return

  const now = new Date()
  const evening = new Date(now)
  evening.setHours(20, 0, 0, 0)

  if (evening <= now) return

  const template = pickRandom(STREAK_SHIELD)

  await scheduleNotif({
    id: 'streak-shield',
    title: template.title,
    body: fillTemplate(template.body, { streak: String(streak) }),
    data: { type: 'streak_shield', action: 'open_dashboard' },
    triggerDate: evening,
    categoryId: 'STREAK_ALERT',
  })
}

// ═══════════════════════════════════════════════════════════════
// Saturday Rainbow Nudge
// RETIRED in 1.0.20 — Shopping Reminders setting removed.
// Function retained as a no-op that cancels any legacy scheduled
// saturday-rainbow-nudge notification so it cannot fire on upgraded devices.
// ═══════════════════════════════════════════════════════════════

export async function scheduleSaturdayNudge() {
  // Retired — cancel any previously scheduled saturday-rainbow-nudge
  await safeCancel('saturday-rainbow-nudge')
}

// ═══════════════════════════════════════════════════════════════
// Freezer Pass Morning-After — RETIRED in 1.0.20
// Freezer Pass functionality has been retired. This function is
// kept as a no-op that only cancels any legacy scheduled
// freezer-morning notifications. It no longer schedules new ones.
// ═══════════════════════════════════════════════════════════════

export async function scheduleFreezerMorning() {
  // Retired: cancel any legacy freezer-morning notifications
  await safeCancel('freezer-morning')
}

// ═══════════════════════════════════════════════════════════════
// Onboarding Sequence (First 3 Notifications)
// ═══════════════════════════════════════════════════════════════

export async function scheduleOnboardingSequence() {
  try {
    const step = parseInt(await AsyncStorage.getItem(KEYS.ONBOARDING_STEP) || '0', 10)
    if (step >= ONBOARDING_SEQUENCE.length) return

    let installDate = await AsyncStorage.getItem(KEYS.INSTALL_DATE)
    if (!installDate) {
      installDate = new Date().toISOString()
      await AsyncStorage.setItem(KEYS.INSTALL_DATE, installDate)
    }
    const install = new Date(installDate)

    for (let i = step; i < ONBOARDING_SEQUENCE.length; i++) {
      const notif = ONBOARDING_SEQUENCE[i]
      let triggerDate

      if (notif.delayHours) {
        triggerDate = new Date(install.getTime() + notif.delayHours * 60 * 60 * 1000)
      } else if (notif.scheduledTime) {
        triggerDate = new Date(install)
        triggerDate.setDate(triggerDate.getDate() + (notif.dayOffset || 0))
        triggerDate.setHours(notif.scheduledTime.hour, notif.scheduledTime.minute, 0, 0)
      }

      if (!triggerDate || triggerDate <= new Date()) continue

      await scheduleNotif({
        id: notif.id,
        title: notif.title,
        body: notif.body,
        data: notif.data,
        triggerDate,
        categoryId: 'AFFIRMATION',
      })
    }

    await AsyncStorage.setItem(KEYS.ONBOARDING_STEP, String(ONBOARDING_SEQUENCE.length))
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// Surprise & Delight (Variable Rewards)
// Called after each juice log to check milestones
// ═══════════════════════════════════════════════════════════════

export async function checkSurpriseAndDelight(totalJuiceCount, totalWeightG) {
  try {
    const prevCount = parseInt(await AsyncStorage.getItem(KEYS.PREV_JUICE_COUNT) || '0', 10)
    const prevWeight = parseInt(await AsyncStorage.getItem(KEYS.PREV_WEIGHT_G) || '0', 10)

    // Check juice count milestones
    const surprise = getSurpriseForCount(totalJuiceCount)
    if (surprise && totalJuiceCount > prevCount) {
      await scheduleNotif({
        id: `surprise-${totalJuiceCount}`,
        title: surprise.title,
        body: surprise.body,
        data: { type: 'surprise', action: 'open_hall' },
        triggerDate: null,
        categoryId: 'SURPRISE',
      })
    }

    // Check weight milestones
    const weightMilestone = getWeightMilestone(totalWeightG, prevWeight)
    if (weightMilestone) {
      await scheduleNotif({
        id: `weight-${weightMilestone.thresholdLbs}`,
        title: weightMilestone.title,
        body: weightMilestone.body,
        data: { type: 'weight_milestone', action: 'open_hall' },
        triggerDate: null,
        categoryId: 'SURPRISE',
      })
    }

    await AsyncStorage.setItem(KEYS.PREV_JUICE_COUNT, String(totalJuiceCount))
    await AsyncStorage.setItem(KEYS.PREV_WEIGHT_G, String(totalWeightG))
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// Educational Notification (Scheduled periodically)
// ═══════════════════════════════════════════════════════════════

export async function scheduleEducational() {
  await safeCancel('educational-tip')
  const settings = await loadNotificationSettings()
  if (!settings.enabled) return

  const tip = pickRandom(EDUCATIONAL)

  // Schedule for tomorrow at 12:30 PM (lunchtime learning)
  const now = new Date()
  const trigger = new Date(now)
  trigger.setDate(trigger.getDate() + 1)
  trigger.setHours(12, 30, 0, 0)

  if (isTimeInQuietHours(12, 30, settings)) return

  await scheduleNotif({
    id: 'educational-tip',
    title: tip.title,
    body: tip.body,
    data: { type: 'educational', produce: tip.produce, action: 'open_dashboard' },
    triggerDate: trigger,
    categoryId: 'EDUCATIONAL',
  })
}

// ═══════════════════════════════════════════════════════════════
// Master Orchestrator — called from ChallengeProvider
// Schedules all relevant notifications based on current state
// ═══════════════════════════════════════════════════════════════

export async function orchestrateNotifications({
  weeklyDiversity,
  todayLog,
  streak,
  totalWeightG,
  lastIngredients,
}) {
  const granted = await requestNotificationPermission()
  if (!granted) return

  // 1. Onboarding (first-time only)
  await scheduleOnboardingSequence()

  // 2. Identity Trigger (daily affirmation)
  await scheduleIdentityTrigger()

  // 3. Educational tip
  await scheduleEducational()

  // 4. Saturday rainbow nudge
  await scheduleSaturdayNudge(weeklyDiversity)

  // 5. Streak Shield (if rings at 0% today)
  const hasJuicedToday = todayLog.base || todayLog.power || todayLog.kick
  if (!hasJuicedToday && streak > 0) {
    await scheduleStreakShield(streak)
  } else {
    await safeCancel('streak-shield')
  }

  // 6. Freezer Pass morning-after — RETIRED, just cancel legacy
  await scheduleFreezerMorning()

  // 7. Wilt warning (inactivity)
  if (lastIngredients && lastIngredients.length > 0) {
    await scheduleWiltWarning(lastIngredients)
  }

  // 8. Enforce global daily intensity cap across all scheduled
  // notifications from both NotificationService and
  // NotificationNudges. This cancels excess lowest-priority
  // notifications per local calendar day.
  const settings = await loadNotificationSettings()
  await enforceGlobalNotificationCap(settings)
}

// ═══════════════════════════════════════════════════════════════
// Called when user logs a juice — cancel alerts, track timestamp
// ═══════════════════════════════════════════════════════════════

export async function onJuiceLogged(totalJuiceCount, totalWeightG) {
  await safeCancel('streak-shield')
  await safeCancel('wilt-warning')
  await AsyncStorage.setItem(KEYS.LAST_JUICE_TS, new Date().toISOString())
  await recordMeaningfulActivity()

  // Check for surprise & delight milestones
  if (totalJuiceCount !== undefined) {
    await checkSurpriseAndDelight(totalJuiceCount, totalWeightG || 0)
  }
}

// ── Legacy compat exports ────────────────────────────────────

export async function scheduleMercyAlert(streak, freezerPasses) {
  await scheduleStreakShield(streak, freezerPasses)
}

export async function cancelMercyAlert() {
  await safeCancel('streak-shield')
}

// ── Reconcile / Reschedule on intensity change ──────────────

export async function reconcileNotificationSchedule() {
  const settings = await loadNotificationSettings()
  console.log('[notif] reconcileNotificationSchedule START | enabled:', settings.enabled, 'intensity:', settings.intensity, 'affirmations:', settings.affirmations, 'vitalityReminders:', settings.vitalityReminders)
  if (!settings.enabled) {
    // Cancel all scheduled notifications
    const ids = [
      'identity-affirmation',
      'educational-tip',
      'saturday-rainbow-nudge',
      'streak-shield',
      'wilt-warning',
      'freezer-morning', // Legacy — cancel if present
      'dormant-reminder-day-7', // Legacy — retired 1.0.20
      'dormant-reminder-day-14', // Legacy — retired 1.0.20
      'dormant-reminder-day-30', // Legacy — retired 1.0.20
      'dormant-reminder-day-60', // Legacy — retired 1.0.20
    ]
    await Promise.all(ids.map(safeCancel))
    return
  }

  // Cancel and reschedule motivational notifications so the
  // new intensity cap takes effect immediately without requiring a
  // restart or foregrounding.
  await safeCancel('identity-affirmation')
  await safeCancel('educational-tip')
  await safeCancel('saturday-rainbow-nudge')
  await safeCancel('streak-shield')
  await safeCancel('wilt-warning')
  await safeCancel('freezer-morning') // Legacy — cancel if present
  await safeCancel('dormant-reminder-day-7') // Legacy — retired 1.0.20
  await safeCancel('dormant-reminder-day-14') // Legacy — retired 1.0.20
  await safeCancel('dormant-reminder-day-30') // Legacy — retired 1.0.20
  await safeCancel('dormant-reminder-day-60') // Legacy — retired 1.0.20

  // Reschedule the ones that don't require external state
  await scheduleIdentityTrigger()
  await scheduleEducational()

  // Reconcile nudges so the new intensity cap applies to them too
  try {
    const { refreshNudges } = require('./NotificationNudges')
    await refreshNudges()
  } catch (e) {
    console.warn('[notif] reconcileNotificationSchedule — refreshNudges error:', e?.name || 'unknown', e?.message || '')
  }

  // Enforce global daily intensity cap across all scheduled
  // ordinary notifications from both services.
  await enforceGlobalNotificationCap(settings)

  // Diagnostic: dump all scheduled notifications after reconciliation
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    console.log('[notif] reconcileNotificationSchedule DIAGNOSTIC | scheduledCount:', scheduled.length)
    for (const s of scheduled) {
      const trigger = s.trigger
      const triggerStr = trigger?.date || trigger?.hour !== undefined ? `${trigger.hour || ''}:${trigger.minute || ''}` : JSON.stringify(trigger || {})
      console.log('[notif] scheduled | id:', s.identifier, 'trigger:', triggerStr)
    }
  } catch (e) {
    console.warn('[notif] reconcileNotificationSchedule DIAGNOSTIC FAIL:', e?.name || 'unknown', e?.message || '')
  }
}

export async function cancelSaturdayNudge() {
  await safeCancel('saturday-rainbow-nudge')
}
