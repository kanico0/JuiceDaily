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
  WILT_WARNINGS,
  FREEZER_PASS_MORNING,
  STREAK_SHIELD,
  ONBOARDING_SEQUENCE,
  NOTIFICATION_CATEGORIES,
  COLOR_EMOJI,
  pickRandom,
  fillTemplate,
  getSurpriseForCount,
  getWeightMilestone,
} from '../constants/NotificationLibrary'

// Suppress the known Expo Go SDK 53+ Android push notification warning
LogBox.ignoreLogs(['expo-notifications: Android push notification'])

// Availability guard — notifications are non-functional in Expo Go on Android (SDK 53+)
let notificationsAvailable = true
try {
  Notifications.getPermissionsAsync().catch(() => { notificationsAvailable = false })
} catch (e) {
  notificationsAvailable = false
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

// ── Default Settings ─────────────────────────────────────────

const DEFAULT_SETTINGS = {
  enabled: true,
  intensity: 'balanced',
  quietStart: { hour: 21, minute: 30 },
  quietEnd: { hour: 6, minute: 30 },
  affirmations: true,
  vitalityReminders: true,
  freezerAlerts: true,
  glassClinks: true,
  weeklyLeaderboard: true,
  privacyMode: false,
  inventoryAlerts: true,
  shoppingReminders: true,
  typicalJuiceHour: 7,
  typicalJuiceMinute: 30,
}

const INTENSITY_CAPS = {
  zen: 1,
  balanced: 3,
  'high-vibe': 5,
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
      { identifier: 'USE_FREEZER', buttonTitle: 'Use Freezer Pass 🧊', options: { opensAppToForeground: true } },
    ])
    await Notifications.setNotificationCategoryAsync('WILT_WARNING', [
      { identifier: 'VIEW_RECIPE', buttonTitle: 'View Recipe', options: { opensAppToForeground: true } },
      { identifier: 'SNOOZE', buttonTitle: 'Remind Later', options: { opensAppToForeground: false } },
    ])
    await Notifications.setNotificationCategoryAsync('SOCIAL', [
      { identifier: 'CLINK_BACK', buttonTitle: 'Clink Back 🥂', options: { opensAppToForeground: true } },
      { identifier: 'LOG_NOW', buttonTitle: 'Log Now', options: { opensAppToForeground: true } },
    ])
    await Notifications.setNotificationCategoryAsync('FREEZER_MORNING', [
      { identifier: 'LOG_NOW', buttonTitle: 'Log Now', options: { opensAppToForeground: true } },
      { identifier: 'VIEW_RECIPE', buttonTitle: 'View Recipe', options: { opensAppToForeground: true } },
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
  if (!notificationsAvailable) return false
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus === 'granted') {
      await registerCategories()
    }
    return finalStatus === 'granted'
  } catch (e) {
    // Notifications unavailable (Expo Go SDK 53+ Android)
    return false
  }
}

// ── Settings Persistence ─────────────────────────────────────

export async function loadNotificationSettings() {
  try {
    const raw = await AsyncStorage.getItem('@notification_settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

export async function saveNotificationSettings(settings) {
  try {
    await AsyncStorage.setItem('@notification_settings', JSON.stringify(settings))
  } catch (e) { /* ignore */ }
}

// ── Frequency Cap ────────────────────────────────────────────
// No more than N notifications per 24-hour period

async function getSentToday() {
  try {
    const dateStr = await AsyncStorage.getItem(KEYS.SENT_DATE)
    const today = new Date().toISOString().split('T')[0]
    if (dateStr !== today) {
      await AsyncStorage.setItem(KEYS.SENT_DATE, today)
      await AsyncStorage.setItem(KEYS.SENT_TODAY, '0')
      return 0
    }
    const count = parseInt(await AsyncStorage.getItem(KEYS.SENT_TODAY) || '0', 10)
    return count
  } catch (e) { return 0 }
}

async function incrementSentToday() {
  try {
    const count = await getSentToday()
    await AsyncStorage.setItem(KEYS.SENT_TODAY, String(count + 1))
  } catch (e) { /* ignore */ }
}

async function canSendNotification(settings, isEmergency = false) {
  if (!settings.enabled) return false

  // Frequency cap
  const sent = await getSentToday()
  const cap = INTENSITY_CAPS[settings.intensity] || 3
  if (sent >= cap && !isEmergency) return false

  // Quiet hours check (Freezer Pass alerts bypass quiet hours)
  if (!isEmergency) {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const currentMinutes = hour * 60 + minute
    const quietStartMin = settings.quietStart.hour * 60 + settings.quietStart.minute
    const quietEndMin = settings.quietEnd.hour * 60 + settings.quietEnd.minute

    if (quietStartMin > quietEndMin) {
      // Quiet hours span midnight (e.g., 21:30 - 06:30)
      if (currentMinutes >= quietStartMin || currentMinutes < quietEndMin) return false
    } else {
      if (currentMinutes >= quietStartMin && currentMinutes < quietEndMin) return false
    }
  }

  return true
}

// ── Check if a scheduled time is in quiet hours ──────────────

function isTimeInQuietHours(hour, minute, settings) {
  const targetMin = hour * 60 + minute
  const quietStartMin = settings.quietStart.hour * 60 + settings.quietStart.minute
  const quietEndMin = settings.quietEnd.hour * 60 + settings.quietEnd.minute

  if (quietStartMin > quietEndMin) {
    return targetMin >= quietStartMin || targetMin < quietEndMin
  }
  return targetMin >= quietStartMin && targetMin < quietEndMin
}

// ── Core Schedule Function ───────────────────────────────────

async function scheduleNotif({ id, title, body, data, triggerDate, categoryId, isEmergency }) {
  if (!notificationsAvailable) return false
  const settings = await loadNotificationSettings()

  // For immediate/near-future: check caps now
  // For far-future scheduled: we trust the trigger-time quiet hours check
  const isNearFuture = !triggerDate || (triggerDate - Date.now() < 60000)
  if (isNearFuture) {
    const allowed = await canSendNotification(settings, isEmergency)
    if (!allowed) return false
  }

  // Check if scheduled time falls in quiet hours (skip for emergencies)
  if (triggerDate && !isEmergency) {
    const d = new Date(triggerDate)
    if (isTimeInQuietHours(d.getHours(), d.getMinutes(), settings)) return false
  }

  const content = {
    title,
    body,
    data: { ...data, sentAt: new Date().toISOString() },
    sound: 'glass_clink.wav',
  }

  if (categoryId) {
    content.categoryIdentifier = categoryId
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: triggerDate ? { date: triggerDate } : null,
      identifier: id,
    })
    if (isNearFuture) await incrementSentToday()
    return true
  } catch (e) {
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
// ═══════════════════════════════════════════════════════════════

export async function scheduleWiltWarning(lastIngredients) {
  await safeCancel('wilt-warning')
  const settings = await loadNotificationSettings()
  if (!settings.inventoryAlerts) return

  const lastTs = await AsyncStorage.getItem(KEYS.LAST_JUICE_TS)
  if (!lastTs) return

  const lastJuice = new Date(lastTs)
  const wiltTime = new Date(lastJuice.getTime() + 36 * 60 * 60 * 1000)
  const now = new Date()

  // If 36 hours haven't passed, schedule for when they do
  if (wiltTime <= now) {
    // Already past 36 hours — send soon (next non-quiet window)
    const soon = new Date(now.getTime() + 5 * 60 * 1000)
    const template = pickRandom(WILT_WARNINGS)
    const lastIng = lastIngredients?.[0]?.produceId || 'produce'
    const ingName = lastIng.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    await scheduleNotif({
      id: 'wilt-warning',
      title: template.title,
      body: fillTemplate(template.body, { last_ingredient: ingName }),
      data: { type: 'wilt_warning', action: 'open_fridge_forager' },
      triggerDate: soon,
      categoryId: 'WILT_WARNING',
    })
  } else {
    // Schedule for the 36-hour mark
    const template = pickRandom(WILT_WARNINGS)
    const lastIng = lastIngredients?.[0]?.produceId || 'produce'
    const ingName = lastIng.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    await scheduleNotif({
      id: 'wilt-warning',
      title: template.title,
      body: fillTemplate(template.body, { last_ingredient: ingName }),
      data: { type: 'wilt_warning', action: 'open_fridge_forager' },
      triggerDate: wiltTime,
      categoryId: 'WILT_WARNING',
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER 3: Streak Shield (8 PM Loss Aversion)
// If Vitality Rings at 0% at 8:00 PM
// ═══════════════════════════════════════════════════════════════

export async function scheduleStreakShield(streak, freezerPasses) {
  await safeCancel('streak-shield')
  const settings = await loadNotificationSettings()
  if (!settings.vitalityReminders) return
  if (streak <= 0) return

  const now = new Date()
  const evening = new Date(now)
  evening.setHours(20, 0, 0, 0)

  if (evening <= now) return

  const template = pickRandom(STREAK_SHIELD)

  // This is an emergency if freezer passes exist (bypasses quiet hours)
  const isEmergency = settings.freezerAlerts && freezerPasses > 0

  await scheduleNotif({
    id: 'streak-shield',
    title: template.title,
    body: fillTemplate(template.body, { streak: String(streak) }),
    data: { type: 'streak_shield', action: 'open_dashboard', freezerPasses },
    triggerDate: evening,
    categoryId: 'STREAK_ALERT',
    isEmergency,
  })
}

// ═══════════════════════════════════════════════════════════════
// Saturday Rainbow Nudge
// ═══════════════════════════════════════════════════════════════

export async function scheduleSaturdayNudge(weeklyDiversity) {
  await safeCancel('saturday-rainbow-nudge')

  const colorOrder = ['red', 'orange', 'yellow', 'green', 'purple', 'white']
  const missing = colorOrder.filter((c) => !weeklyDiversity[c])
  if (missing.length === 0) return

  const settings = await loadNotificationSettings()
  if (!settings.shoppingReminders) return

  const colorNames = missing.slice(0, 2).map((c) => {
    const names = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', purple: 'Purple', white: 'White' }
    return names[c] || c
  })
  const emojis = missing.slice(0, 2).map((c) => COLOR_EMOJI[c] || '').join('')

  const suggestions = {
    red: 'Beet or Pomegranate',
    orange: 'Carrot or Mango',
    yellow: 'Lemon or Pineapple',
    green: 'Kale or Spinach',
    purple: 'Blueberries or Red Cabbage',
    white: 'Cauliflower or Garlic',
  }
  const suggestText = missing.slice(0, 2).map((c) => suggestions[c]).join(' or ')

  const body = `Almost there, Architect! ${emojis} Your ${colorNames.join(' and ')} ring${missing.length > 1 ? 's are' : ' is'} still ghosted. Grab some ${suggestText} today to secure your Weekend Warrior Badge.`

  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + daysUntilSaturday)
  saturday.setHours(10, 0, 0, 0)
  if (saturday <= now) saturday.setDate(saturday.getDate() + 7)

  await scheduleNotif({
    id: 'saturday-rainbow-nudge',
    title: '🌈 Weekend Rainbow Check',
    body,
    data: { type: 'saturday_nudge', action: 'open_weekly_report' },
    triggerDate: saturday,
    categoryId: 'WILT_WARNING',
  })
}

// ═══════════════════════════════════════════════════════════════
// Freezer Pass Morning-After
// ═══════════════════════════════════════════════════════════════

export async function scheduleFreezerMorning(streak) {
  await safeCancel('freezer-morning')
  const settings = await loadNotificationSettings()
  if (!settings.freezerAlerts) return

  const template = pickRandom(FREEZER_PASS_MORNING)

  const now = new Date()
  const morning = new Date(now)
  morning.setDate(morning.getDate() + 1)
  morning.setHours(7, 30, 0, 0)

  await scheduleNotif({
    id: 'freezer-morning',
    title: template.title,
    body: fillTemplate(template.body, { streak: String(streak) }),
    data: { type: 'freezer_morning', action: 'open_dashboard' },
    triggerDate: morning,
    categoryId: 'FREEZER_MORNING',
    isEmergency: true,
  })
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
  freezerPasses,
  isFrozen,
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
    await scheduleStreakShield(streak, freezerPasses)
  } else {
    await safeCancel('streak-shield')
  }

  // 6. Freezer Pass morning-after
  if (isFrozen) {
    await scheduleFreezerMorning(streak)
  }

  // 7. Wilt warning (inactivity)
  if (lastIngredients && lastIngredients.length > 0) {
    await scheduleWiltWarning(lastIngredients)
  }
}

// ═══════════════════════════════════════════════════════════════
// Called when user logs a juice — cancel alerts, track timestamp
// ═══════════════════════════════════════════════════════════════

export async function onJuiceLogged(totalJuiceCount, totalWeightG) {
  await safeCancel('streak-shield')
  await safeCancel('wilt-warning')
  await AsyncStorage.setItem(KEYS.LAST_JUICE_TS, new Date().toISOString())

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

export async function cancelSaturdayNudge() {
  await safeCancel('saturday-rainbow-nudge')
}
