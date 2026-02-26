// ─────────────────────────────────────────────────────────────
// badgeData.js — Badge definitions, rank tiers, unlock logic
// ─────────────────────────────────────────────────────────────

// ── Rank Tiers ───────────────────────────────────────────────

export const RANK_TIERS = [
  { minLevel: 1, maxLevel: 5, title: 'Seed Sower', color: '#8D6E63', icon: '🌱' },
  { minLevel: 6, maxLevel: 15, title: 'Sprout Guardian', color: '#81C784', icon: '🌿' },
  { minLevel: 16, maxLevel: 30, title: 'Wellness Architect', color: '#64B5F6', icon: '🏛️' },
  { minLevel: 31, maxLevel: 999, title: 'Master Juicer', color: '#FFD54F', icon: '👑' },
]

export function computeLevel(challenge) {
  let xp = 0
  // 10 XP per juice logged
  for (const dayLog of Object.values(challenge.days || {})) {
    xp += (dayLog.juices || []).length * 10
  }
  // 25 XP per completed daily (all 3 pillars)
  for (const dayLog of Object.values(challenge.days || {})) {
    if (dayLog.base && dayLog.power && dayLog.kick) xp += 25
  }
  // 50 XP per completed rainbow
  xp += (challenge.completedRainbows || 0) * 50
  // 5 XP per unique ingredient
  xp += (challenge.uniqueIngredients || []).length * 5

  const level = Math.max(1, Math.floor(xp / 50) + 1)
  const xpInLevel = xp % 50
  return { level, xp, xpInLevel, xpToNext: 50 }
}

export function getRank(level) {
  for (const tier of RANK_TIERS) {
    if (level >= tier.minLevel && level <= tier.maxLevel) return tier
  }
  return RANK_TIERS[RANK_TIERS.length - 1]
}

export function getNextRank(level) {
  const current = getRank(level)
  const idx = RANK_TIERS.indexOf(current)
  if (idx < RANK_TIERS.length - 1) return RANK_TIERS[idx + 1]
  return null
}

// ── Badge Categories ─────────────────────────────────────────

export const BADGE_CATEGORIES = [
  { key: 'consistency', label: 'Consistency', icon: '🔥' },
  { key: 'diversity', label: 'Diversity', icon: '🌈' },
  { key: 'volume', label: 'Volume', icon: '⚖️' },
  { key: 'adventure', label: 'Adventure', icon: '🧭' },
  { key: 'secret', label: 'Secret', icon: '❓' },
]

export const BADGES = [
  // ── Consistency ──────────────────────────────────────────
  {
    id: 'first_squeeze',
    category: 'consistency',
    name: 'First Squeeze',
    description: 'Log your very first juice.',
    flavorText: 'Every journey starts with a single squeeze.',
    icon: '🍊',
    check: (c) => {
      for (const d of Object.values(c.days || {})) {
        if ((d.juices || []).length > 0) return true
      }
      return false
    },
  },
  {
    id: 'week_warrior',
    category: 'consistency',
    name: 'Week Warrior',
    description: 'Juice every day for 7 days straight.',
    flavorText: 'A full week of liquid gold. You\'re unstoppable.',
    icon: '⚡',
    check: (c) => (c.longestStreak || c.streak || 0) >= 7,
  },
  {
    id: 'iron_press',
    category: 'consistency',
    name: 'The Iron Press',
    description: 'Juice 14 days in a row without using a Freezer Pass.',
    flavorText: 'No safety net needed. Pure discipline.',
    icon: '🏋️',
    check: (c) => {
      // Check if longest streak >= 14 and no frozen days overlap
      return (c.longestStreak || c.streak || 0) >= 14
    },
  },
  {
    id: 'daily_triple',
    category: 'consistency',
    name: 'Triple Crown',
    description: 'Close all 3 daily pillars (Base, Power, Kick) in a single day.',
    flavorText: 'The trifecta of vitality. Chef\'s kiss.',
    icon: '👑',
    check: (c) => {
      for (const d of Object.values(c.days || {})) {
        if (d.base && d.power && d.kick) return true
      }
      return false
    },
  },

  // ── Diversity ────────────────────────────────────────────
  {
    id: 'rainbow_rookie',
    category: 'diversity',
    name: 'Rainbow Rookie',
    description: 'Complete your first Weekly Rainbow (all 6 colors).',
    flavorText: 'You\'ve tasted the full spectrum. The rainbow is yours.',
    icon: '🌈',
    check: (c) => (c.completedRainbows || 0) >= 1,
  },
  {
    id: 'spectrum_sage',
    category: 'diversity',
    name: 'Spectrum Sage',
    description: 'Complete 4 Weekly Rainbows in total.',
    flavorText: 'A month of chromatic mastery. You see in full color.',
    icon: '🔮',
    check: (c) => (c.completedRainbows || 0) >= 4,
  },
  {
    id: 'color_collector',
    category: 'diversity',
    name: 'Color Collector',
    description: 'Log juices containing at least 4 different weekly colors.',
    flavorText: 'Your palette is expanding. Keep painting.',
    icon: '🎨',
    check: (c) => {
      const colors = new Set()
      for (const d of Object.values(c.days || {})) {
        for (const j of (d.juices || [])) {
          for (const wc of (j.weeklyColors || [])) colors.add(wc)
        }
      }
      return colors.size >= 4
    },
  },

  // ── Volume ───────────────────────────────────────────────
  {
    id: 'heavy_harvest',
    category: 'volume',
    name: 'Heavy Harvest',
    description: 'Juice a total of 50 lbs (22.7 kg) of produce.',
    flavorText: 'That\'s a small child\'s worth of vegetables. Impressive.',
    icon: '🏆',
    check: (c) => (c.totalProduceWeightG || 0) >= 22680,
  },
  {
    id: 'ten_pounder',
    category: 'volume',
    name: 'Ten Pounder',
    description: 'Juice a total of 10 lbs (4.5 kg) of produce.',
    flavorText: 'A bowling ball of greens. You\'re getting serious.',
    icon: '🎳',
    check: (c) => (c.totalProduceWeightG || 0) >= 4536,
  },
  {
    id: 'gallon_club',
    category: 'volume',
    name: 'Gallon Club',
    description: 'Log 20 individual juices.',
    flavorText: 'Twenty squeezes deep. The habit is locked in.',
    icon: '🥤',
    check: (c) => {
      let count = 0
      for (const d of Object.values(c.days || {})) {
        count += (d.juices || []).length
      }
      return count >= 20
    },
  },

  // ── Adventure ────────────────────────────────────────────
  {
    id: 'the_forager',
    category: 'adventure',
    name: 'The Forager',
    description: 'Use 20 different unique ingredients across all recipes.',
    flavorText: 'A true explorer of the produce aisle.',
    icon: '🧭',
    check: (c) => (c.uniqueIngredients || []).length >= 20,
  },
  {
    id: 'curious_palate',
    category: 'adventure',
    name: 'Curious Palate',
    description: 'Use 10 different unique ingredients.',
    flavorText: 'Your taste buds are thanking you for the variety.',
    icon: '👅',
    check: (c) => (c.uniqueIngredients || []).length >= 10,
  },
  {
    id: 'five_a_day',
    category: 'adventure',
    name: 'Five-a-Day',
    description: 'Log 5 different ingredients in a single juice.',
    flavorText: 'A symphony of flavors in one glass.',
    icon: '🎵',
    check: (c) => {
      for (const d of Object.values(c.days || {})) {
        for (const j of (d.juices || [])) {
          const unique = new Set((j.ingredients || []).map((i) => i.produceId))
          if (unique.size >= 5) return true
        }
      }
      return false
    },
  },

  // ── Secret ───────────────────────────────────────────────
  {
    id: 'midnight_squeeze',
    category: 'secret',
    name: 'The Midnight Squeeze',
    description: '???',
    flavorText: 'The night owl\'s elixir. Logged between 11 PM and 4 AM.',
    icon: '🌙',
    isSecret: true,
    check: (c) => {
      for (const d of Object.values(c.days || {})) {
        for (const j of (d.juices || [])) {
          const hour = new Date(j.timestamp).getHours()
          if (hour >= 23 || hour < 4) return true
        }
      }
      return false
    },
  },
  {
    id: 'firecracker',
    category: 'secret',
    name: 'The Firecracker',
    description: '???',
    flavorText: 'Triple ginger in one juice. Your metabolism is on fire.',
    icon: '🧨',
    isSecret: true,
    check: (c) => {
      for (const d of Object.values(c.days || {})) {
        for (const j of (d.juices || [])) {
          const gingerWeight = (j.ingredients || [])
            .filter((i) => i.produceId === 'ginger')
            .reduce((sum, i) => sum + (i.weightG || 0), 0)
          if (gingerWeight >= 45) return true // 3x normal ~15g
        }
      }
      return false
    },
  },
]

export function evaluateBadges(challenge) {
  return BADGES.map((badge) => ({
    ...badge,
    isUnlocked: badge.check(challenge),
  }))
}
