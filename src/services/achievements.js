// ─────────────────────────────────────────────────────────────
// achievements.js — Lightweight achievement system
//
// 4 achievements unlocked once each. Persisted via AsyncStorage.
// checkAchievements() returns newly unlocked achievements.
// Respects DevClock for testing.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY_UNLOCKED = 'achievements_unlocked'

export const ACHIEVEMENTS = [
  {
    id: 'first_juice',
    title: 'First Juice Logged',
    subtitle: 'Your glow journey begins',
    emoji: '🌱',
    condition: (ctx) => ctx.totalLogs >= 1,
  },
  {
    id: 'streak_3',
    title: '3-Day Glow Streak',
    subtitle: 'Consistency is your superpower',
    emoji: '🔥',
    condition: (ctx) => ctx.streakCount >= 3,
  },
  {
    id: 'streak_7',
    title: '7-Day Glow Streak',
    subtitle: 'A full week of glow',
    emoji: '✨',
    condition: (ctx) => ctx.streakCount >= 7,
  },
  {
    id: 'logs_10',
    title: '10 Juices Logged',
    subtitle: 'Double digits — you\'re committed',
    emoji: '🏆',
    condition: (ctx) => ctx.totalLogs >= 10,
  },
]

export async function getUnlockedIds() {
  const raw = await AsyncStorage.getItem(KEY_UNLOCKED)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Check all achievements against current context.
// Returns array of newly unlocked achievement objects (may be empty).
export async function checkAchievements({ totalLogs, streakCount }) {
  const unlocked = await getUnlockedIds()
  const newlyUnlocked = []

  for (const ach of ACHIEVEMENTS) {
    if (unlocked.includes(ach.id)) continue
    if (ach.condition({ totalLogs, streakCount })) {
      newlyUnlocked.push(ach)
      unlocked.push(ach.id)
    }
  }

  if (newlyUnlocked.length > 0) {
    await AsyncStorage.setItem(KEY_UNLOCKED, JSON.stringify(unlocked))
  }

  return newlyUnlocked
}

// Dev reset
export async function resetAchievements() {
  await AsyncStorage.removeItem(KEY_UNLOCKED)
}
