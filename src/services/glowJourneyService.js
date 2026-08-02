// ─────────────────────────────────────────────────────────────
// glowJourneyService.js — Weekly progress, lifetime days,
// stage computation, and celebration persistence.
//
// Reuses existing JuiceLogStore entries and ChallengeStore
// week-start convention (Monday). Does NOT duplicate streak
// or logging logic.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDevNow } from '../utils/DevClock'
import {
  WEEKLY_GLOW_GOAL,
  getJourneyStage,
  getNextStage,
  getDaysToNextStage,
} from '../constants/glowJourneyStages'

const KEY_CELEBRATED_STAGES = 'glowJourney_celebratedStages'
const KEY_CELEBRATED_WEEKS = 'glowJourney_celebratedWeeks'
const KEY_BASELINE_INITIALIZED = 'glowJourney_baselineInitialized'

// ── Date helpers (match ChallengeStore convention) ───────────

function getTodayKey() {
  const d = getDevNow()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStartKey(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  const dow = d.getDay()
  const diff = d.getDate() - dow + (dow === 0 ? -6 : 1)
  const monday = new Date(y, m - 1, diff)
  const my = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const md = String(monday.getDate()).padStart(2, '0')
  return `${my}-${mm}-${md}`
}

// ── Weekly progress ──────────────────────────────────────────

export function getWeekStartToday() {
  return getWeekStartKey(getTodayKey())
}

export function getWeeklyLeafStates(entries) {
  if (!entries || !Array.isArray(entries)) return []
  const todayKey = getTodayKey()
  const weekStart = getWeekStartKey(todayKey)

  const [sy, sm, sd] = weekStart.split('-').map(Number)

  const loggedDays = new Set()
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const key = e.dateKey
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    if (key >= weekStart && key <= todayKey) {
      loggedDays.add(key)
    }
  }

  const leaves = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sy, sm - 1, sd + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${day}`
    const isToday = key === todayKey
    const isFuture = key > todayKey
    const hasLog = loggedDays.has(key)

    leaves.push({
      dayIndex: i,
      dateKey: key,
      hasLog,
      isToday,
      isFuture,
      isPast: !isFuture && !isToday,
    })
  }
  return leaves
}

export function getWeeklyQualifyingDays(entries) {
  if (!entries || !Array.isArray(entries)) return 0
  const todayKey = getTodayKey()
  const weekStart = getWeekStartKey(todayKey)
  const loggedDays = new Set()
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const key = e.dateKey
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    if (key >= weekStart && key <= todayKey) {
      loggedDays.add(key)
    }
  }
  return loggedDays.size
}

export function getWeeklyProgressRatio(entries) {
  const days = getWeeklyQualifyingDays(entries)
  return Math.min(days / WEEKLY_GLOW_GOAL, 1)
}

export function isWeeklyGoalComplete(entries) {
  return getWeeklyQualifyingDays(entries) >= WEEKLY_GLOW_GOAL
}

// ── Lifetime qualifying days ─────────────────────────────────

export function getLifetimeQualifyingDays(entries) {
  if (!entries || !Array.isArray(entries)) return 0
  const validKeys = new Set()
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const key = e.dateKey
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    validKeys.add(key)
  }
  return validKeys.size
}

// ── Journey stage helpers ────────────────────────────────────

export { getJourneyStage, getNextStage, getDaysToNextStage }

export function getJourneyInfo(lifetimeDays) {
  const stage = getJourneyStage(lifetimeDays)
  const nextStage = getNextStage(lifetimeDays)
  const daysToNext = getDaysToNextStage(lifetimeDays)
  return { stage, nextStage, daysToNext }
}

// ── Milestone message ────────────────────────────────────────

export function getMilestoneMessage({
  lifetimeDays,
  weeklyQualifyingDays,
  weeklyGoal,
}) {
  const goal = weeklyGoal || WEEKLY_GLOW_GOAL
  const daysRemaining = goal - weeklyQualifyingDays
  const nextStage = getNextStage(lifetimeDays)
  const daysToNextStage = getDaysToNextStage(lifetimeDays)

  if (!lifetimeDays || lifetimeDays < 1) {
    return 'Your journey starts with your first juice'
  }

  const weeklyMessages = []
  if (daysRemaining > 0) {
    if (daysRemaining === 1) {
      weeklyMessages.push('One more juice completes your Weekly Glow')
    } else {
      weeklyMessages.push(`${daysRemaining} more juicing days to complete your Weekly Glow`)
    }
  } else {
    weeklyMessages.push('Your Weekly Glow is complete')
  }

  const stageMessages = []
  if (nextStage && daysToNextStage > 0) {
    if (daysToNextStage === 1) {
      stageMessages.push(`1 more juicing day to reach ${nextStage.label}`)
    } else {
      stageMessages.push(`${daysToNextStage} more juicing days to reach ${nextStage.label}`)
    }
  }

  if (!nextStage) {
    return weeklyMessages[0]
  }

  if (daysToNextStage <= daysRemaining && daysToNextStage > 0) {
    return `${stageMessages[0]}. ${weeklyMessages[0]}.`
  }

  return `${weeklyMessages[0]} ${stageMessages[0] ? '· ' + stageMessages[0] : ''}`.trim()
}

// ── Celebration persistence ──────────────────────────────────

export async function getCelebratedStages() {
  try {
    const raw = await AsyncStorage.getItem(KEY_CELEBRATED_STAGES)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function shouldCelebrateStage(lifetimeDays, prevLifetimeDays) {
  if (!lifetimeDays || lifetimeDays < 1) return null
  const stage = getJourneyStage(lifetimeDays)
  if (!stage) return null
  const celebrated = await getCelebratedStages()
  if (celebrated.includes(stage.key)) return null
  const initialized = await isBaselineInitialized()
  if (!initialized) return null
  if (prevLifetimeDays !== undefined && prevLifetimeDays > 0) {
    const prevStage = getJourneyStage(prevLifetimeDays)
    if (prevStage && prevStage.key === stage.key) return null
  }
  return stage
}

export async function markStageCelebrated(stageKey) {
  const celebrated = await getCelebratedStages()
  if (!celebrated.includes(stageKey)) {
    celebrated.push(stageKey)
    await AsyncStorage.setItem(KEY_CELEBRATED_STAGES, JSON.stringify(celebrated))
  }
}

export async function getCelebratedWeeks() {
  try {
    const raw = await AsyncStorage.getItem(KEY_CELEBRATED_WEEKS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function shouldCelebrateWeekly(entries) {
  if (!isWeeklyGoalComplete(entries)) return null
  const weekStart = getWeekStartKey(getTodayKey())
  const celebrated = await getCelebratedWeeks()
  if (celebrated.includes(weekStart)) return null
  const initialized = await isBaselineInitialized()
  if (!initialized) return null
  return { weekStart, days: getWeeklyQualifyingDays(entries) }
}

export async function markWeeklyCelebrated(weekStart) {
  const celebrated = await getCelebratedWeeks()
  if (!celebrated.includes(weekStart)) {
    celebrated.push(weekStart)
    await AsyncStorage.setItem(KEY_CELEBRATED_WEEKS, JSON.stringify(celebrated))
  }
}

// ── Baseline initialization ─────────────────────────────────

export async function isBaselineInitialized() {
  try {
    const val = await AsyncStorage.getItem(KEY_BASELINE_INITIALIZED)
    return val === 'true'
  } catch {
    return false
  }
}

export async function initializeBaseline(entries) {
  const already = await isBaselineInitialized()
  if (already) return false
  const lifetimeDays = getLifetimeQualifyingDays(entries)
  const stage = getJourneyStage(lifetimeDays)
  if (stage) {
    const celebrated = await getCelebratedStages()
    if (!celebrated.includes(stage.key)) {
      celebrated.push(stage.key)
      await AsyncStorage.setItem(KEY_CELEBRATED_STAGES, JSON.stringify(celebrated))
    }
  }
  if (isWeeklyGoalComplete(entries)) {
    const weekStart = getWeekStartKey(getTodayKey())
    const celebratedWeeks = await getCelebratedWeeks()
    if (!celebratedWeeks.includes(weekStart)) {
      celebratedWeeks.push(weekStart)
      await AsyncStorage.setItem(KEY_CELEBRATED_WEEKS, JSON.stringify(celebratedWeeks))
    }
  }
  await AsyncStorage.setItem(KEY_BASELINE_INITIALIZED, 'true')
  return true
}

// ── Dev reset ────────────────────────────────────────────────

export async function resetGlowJourneyCelebrations() {
  await AsyncStorage.multiRemove([KEY_CELEBRATED_STAGES, KEY_CELEBRATED_WEEKS, KEY_BASELINE_INITIALIZED])
}
