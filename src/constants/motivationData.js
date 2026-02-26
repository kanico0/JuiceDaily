// ─────────────────────────────────────────────────────────────
// motivationData.js — Centralized motivation content
// Update quotes and identity statements here without touching UI
// ─────────────────────────────────────────────────────────────

export const IDENTITY_TITLES = [
  'Master Juicer',
  'Vitality Seeker',
  'Rainbow Warrior',
  'Chlorophyll Champion',
  'Juice Alchemist',
  'Wellness Architect',
  'Nutrient Hunter',
  'Green Machine',
  'Spectrum Master',
  'Living Enzyme',
]

export const DAILY_WISDOM = [
  'Every glass is a step toward vitality.',
  'You are what you absorb, not just what you eat.',
  'Color is nature\'s nutrition label.',
  'Your body is a garden, not a machine.',
  'Drink the rainbow. Feel the difference.',
  'Small sips, big transformations.',
  'Nourish the cells that nourish you.',
  'The best investment you can make is in your health.',
  'Let food be thy medicine and medicine be thy food.',
  'Juice is liquid sunshine for your cells.',
  'Your gut is your second brain. Feed it well.',
  'Consistency compounds. One juice at a time.',
  'The greener the juice, the cleaner the fuel.',
  'Nature doesn\'t hurry, yet everything gets nourished.',
  'Every vegetable is a love letter from the earth.',
  'Hydrate. Nourish. Glow. Repeat.',
  'Your cells are listening. Speak to them with nutrients.',
  'The rainbow on your plate is the rainbow in your veins.',
  'Enzymes are the spark plugs of life.',
  'Trust the process. Trust the produce.',
  'A daily juice is a daily reset.',
  'Phytonutrients are nature\'s pharmacy — no prescription needed.',
  'One spectrum, seven days, infinite vitality.',
  'Your mitochondria run on micronutrients. Premium fuel only.',
  'The body keeps score. Feed it a winning hand.',
  'Chlorophyll is bottled sunlight. Drink the light.',
  'Antioxidants are your cellular bodyguards. Hire more.',
  'A beet a day keeps the cardiologist away.',
  'Ginger doesn\'t just add kick — it rewrites inflammation.',
  'Your immune system has a wish list. It\'s mostly green.',
  'Turmeric: 4,000 years of medicine in a single root.',
  'The difference between surviving and thriving is one glass.',
  'Celery juice at dawn. That\'s the architect\'s blueprint.',
  'Your future self will thank today\'s juice.',
  'Vitamins don\'t work in isolation. They work in color.',
]

export const MORNING_GREETINGS = [
  'Start your day strong',
  'A fresh morning ahead',
  'Your morning nutrients await',
  'Begin with intention',
  'Good morning',
]

export const AFTERNOON_GREETINGS = [
  'Nourish your afternoon',
  'Your nutrient journey continues',
  'A mindful afternoon',
  'Sustain your momentum',
  'Good afternoon',
]

export const EVENING_GREETINGS = [
  'Wind down with nutrients',
  'A restorative evening',
  'Nourish and rest well',
  'Your evening reset',
  'Good evening',
]

export const SOCIAL_PROOF_USERS = [
  { id: '1', name: 'Sam', avatar: 'S', hasJuicedToday: true, juiceColor: 'green', streak: 5, title: 'Seed Sower' },
  { id: '2', name: 'Val', avatar: 'V', hasJuicedToday: true, juiceColor: 'orange', streak: 4, title: 'Vitamin Val' },
  { id: '3', name: 'Kai', avatar: 'K', hasJuicedToday: true, juiceColor: 'red', streak: 3, title: 'Spectrum Seeker' },
  { id: '4', name: 'Luna', avatar: 'L', hasJuicedToday: true, juiceColor: 'green', streak: 5, title: 'Green Machine' },
  { id: '5', name: 'Rio', avatar: 'R', hasJuicedToday: true, juiceColor: 'kick', streak: 4, title: 'Kick Starter' },
  { id: '6', name: 'Jade', avatar: 'J', hasJuicedToday: false, juiceColor: null, streak: 3, title: 'Chlorophyll Champ' },
  { id: '7', name: 'Nico', avatar: 'N', hasJuicedToday: true, juiceColor: 'base', streak: 5, title: 'Hydration Hero' },
  { id: '8', name: 'Zara', avatar: 'Z', hasJuicedToday: true, juiceColor: 'power', streak: 4, title: 'Nutrient Hunter' },
  { id: '9', name: 'Eli', avatar: 'E', hasJuicedToday: false, juiceColor: null, streak: 2, title: 'Juice Curious' },
  { id: '10', name: 'Mika', avatar: 'M', hasJuicedToday: true, juiceColor: 'green', streak: 3, title: 'Rainbow Warrior' },
]

export const STARTER_TIPS = [
  {
    day: 1,
    pillar: 'base',
    tip: 'Start with your Base Ring — cucumber + celery hydrates your cells. Then add a Power and Kick juice to close all three.',
  },
  {
    day: 2,
    pillar: 'power',
    tip: 'Close your Power Ring today. Spinach + kale + carrot delivers dense micronutrients your body craves.',
  },
  {
    day: 3,
    pillar: 'kick',
    tip: 'Time for the Kick Ring! A ginger-lemon-turmeric shot fires up your metabolism in seconds.',
  },
  {
    day: 4,
    pillar: 'base',
    tip: 'Hydration day! Cucumber + celery + green apple = the ultimate Base ring closer.',
  },
  {
    day: 5,
    pillar: 'power',
    tip: 'Beet + carrot + pineapple is today\'s Power combo. Your blood will thank you.',
  },
  {
    day: 6,
    pillar: 'kick',
    tip: 'Double down on the Kick. Ginger + turmeric + lemon — anti-inflammatory supercharger.',
  },
  {
    day: 7,
    pillar: 'all',
    tip: 'Final day! Close all three rings to complete your daily rings. You\'ve got this!',
  },
]

export const LEVEL_UP_MESSAGES = [
  { threshold: 10, title: 'Juice Curious', message: 'You\'re exploring the rainbow!' },
  { threshold: 25, title: 'Green Apprentice', message: 'Your cells are waking up.' },
  { threshold: 40, title: 'Spectrum Seeker', message: 'The colors are calling you.' },
  { threshold: 55, title: 'Vitality Builder', message: 'Your body is transforming.' },
  { threshold: 70, title: 'Wellness Architect', message: 'You\'re designing your health.' },
  { threshold: 85, title: 'Rainbow Master', message: 'Almost legendary status!' },
  { threshold: 100, title: 'Prism Legend', message: 'Peak vitality achieved.' },
]

export const BODY_BENEFITS = {
  base: [
    'Targeting: Deep Cellular Hydration & Electrolytes',
    'Targeting: Gut Health & Alkalinity',
    'Targeting: Kidney Flush & Detox Volume',
  ],
  power: [
    'Targeting: Iron Absorption & Blood Oxygenation',
    'Targeting: Vitamin A Surge & Skin Glow',
    'Targeting: Antioxidant Defense & Recovery',
  ],
  kick: [
    'Targeting: Metabolism Ignition & Fat Burn',
    'Targeting: Anti-Inflammatory Response',
    'Targeting: Digestive Fire & Immune Boost',
  ],
}

export function getStarterTip(day, todayLog) {
  const allEmpty = !todayLog.base && !todayLog.power && !todayLog.kick
  if (!allEmpty) return null
  const tip = STARTER_TIPS.find((t) => t.day === day) || STARTER_TIPS[0]
  return tip
}

export function getLevelUp(vitalityScore) {
  let current = LEVEL_UP_MESSAGES[0]
  for (const level of LEVEL_UP_MESSAGES) {
    if (vitalityScore >= level.threshold) current = level
  }
  return current
}

export function getBodyBenefit(colors) {
  const benefits = []
  for (const color of colors) {
    const pool = BODY_BENEFITS[color]
    if (pool) benefits.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return benefits.length > 0 ? benefits[0] : 'Targeting: Overall Wellness & Vitality'
}

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) {
    return MORNING_GREETINGS[Math.floor(Math.random() * MORNING_GREETINGS.length)]
  } else if (hour < 17) {
    return AFTERNOON_GREETINGS[Math.floor(Math.random() * AFTERNOON_GREETINGS.length)]
  }
  return EVENING_GREETINGS[Math.floor(Math.random() * EVENING_GREETINGS.length)]
}

export function getDailyWisdom() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  )
  return DAILY_WISDOM[dayOfYear % DAILY_WISDOM.length]
}

export function getIdentityTitle() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  )
  return IDENTITY_TITLES[dayOfYear % IDENTITY_TITLES.length]
}
