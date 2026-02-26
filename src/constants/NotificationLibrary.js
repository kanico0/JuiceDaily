// ─────────────────────────────────────────────────────────────
// NotificationLibrary.js — Psychology-driven notification content
// Categories: Affirmations, Social Proof, Educational,
// Onboarding, Surprise & Delight, Wilt Warnings, Freezer Pass
// Golden Rules: No negative reinforcement, strategic emoji,
// variable rewards
// ─────────────────────────────────────────────────────────────

// ── Color Emoji Map ──────────────────────────────────────────

export const COLOR_EMOJI = {
  red: '🍎',
  orange: '🥕',
  yellow: '🍋',
  green: '🥦',
  purple: '🍇',
  white: '🧄',
  base: '💧',
  power: '⚡',
  kick: '🔥',
}

// ── Affirmations (Identity Trigger) ──────────────────────────
// Focus on "I am" statements and high-vibe identity

export const AFFIRMATIONS = [
  {
    title: '🏗️ Wellness Architect',
    body: 'I am building my body one glass at a time. Today\'s blueprint: close all three rings.',
  },
  {
    title: '🌱 Morning Intention',
    body: 'I am someone who nourishes their body with intention. Your vitamins are waiting.',
  },
  {
    title: '✨ Daily Affirmation',
    body: 'I am choosing vitality over convenience. One juice changes the trajectory of your whole day.',
  },
  {
    title: '🌿 Architect\'s Creed',
    body: 'I am the architect of my wellness. Every ingredient is a brick in my foundation.',
  },
  {
    title: '💎 Crystal Clear',
    body: 'I am clarity in a glass. Today\'s juice fuels focus, energy, and calm.',
  },
  {
    title: '🔥 Inner Fire',
    body: 'I am metabolically alive. A Kick ring before noon sets the tone for everything.',
  },
  {
    title: '🌊 Flow State',
    body: 'I am hydrated, grounded, and ready. Your Base ring is calling — answer with cucumber.',
  },
  {
    title: '🏛️ The Blueprint',
    body: 'I am designing a body that thrives. Architects don\'t skip the foundation.',
  },
  {
    title: '🌈 Spectrum Builder',
    body: 'I am painting my week in every color. Which hue will you add today?',
  },
  {
    title: '⚡ Power Source',
    body: 'I am my own power source. Spinach, kale, beet — pick your supercharge.',
  },
  {
    title: '🧬 Cellular Renewal',
    body: 'I am renewing at the cellular level. Every sip is a micro-renovation.',
  },
  {
    title: '🎯 Precision Wellness',
    body: 'I am precise about what enters my body. Today\'s target: close one ring before breakfast.',
  },
]

// ── Social Proof Templates ───────────────────────────────────
// Placeholders: {friend_name}, {juice_color}, {color_emoji}

export const SOCIAL_PROOF_TEMPLATES = [
  {
    title: '🥂 Glass Clink!',
    body: '{friend_name} just toasted their {juice_color} ring! Clink them back? 🥂',
  },
  {
    title: '🥂 Cheers, Architect!',
    body: '{friend_name} closed their {juice_color} ring {color_emoji}. Your turn to shine!',
  },
  {
    title: '🥂 Community Vibes',
    body: '{friend_name} is on a {streak}-day streak! Send them a clink to keep the energy flowing.',
  },
  {
    title: '🥂 Rainbow Race',
    body: '{friend_name} just completed their Weekly Rainbow 🌈. Can you catch up?',
  },
]

// ── Educational (Did You Know) ───────────────────────────────

export const EDUCATIONAL = [
  {
    title: '🧠 Did You Know?',
    body: 'Ginger contains gingerol, which has powerful anti-inflammatory effects similar to ibuprofen — but from a root.',
    produce: 'ginger',
  },
  {
    title: '🔬 Juice Science',
    body: 'Beets contain nitrates that your body converts to nitric oxide, improving blood flow and lowering blood pressure.',
    produce: 'beet',
  },
  {
    title: '🧪 Nutrient Intel',
    body: 'One cup of kale provides 684% of your daily Vitamin K. That\'s bone density in a leaf.',
    produce: 'kale',
  },
  {
    title: '🍋 Citrus File',
    body: 'Lemon juice increases iron absorption by up to 6x when consumed with iron-rich greens. Pair wisely.',
    produce: 'lemon',
  },
  {
    title: '🥕 Beta-Carotene Brief',
    body: 'Your body converts beta-carotene from carrots into Vitamin A — essential for night vision and skin repair.',
    produce: 'carrot',
  },
  {
    title: '🫚 Turmeric Truth',
    body: 'Curcumin in turmeric is 400x more potent when paired with black pepper. Add a pinch to your next juice.',
    produce: 'turmeric',
  },
  {
    title: '🥒 Hydration Hero',
    body: 'Cucumber is 96% water — making it the most efficient hydration vehicle in your produce drawer.',
    produce: 'cucumber',
  },
  {
    title: '🥬 Chlorophyll Class',
    body: 'Spinach\'s chlorophyll binds to carcinogens in your gut, helping your body escort them out. Green = clean.',
    produce: 'spinach',
  },
  {
    title: '🍍 Enzyme Edge',
    body: 'Pineapple contains bromelain — a protein-digesting enzyme that reduces inflammation and aids recovery.',
    produce: 'pineapple',
  },
  {
    title: '🍉 Lycopene Lesson',
    body: 'Watermelon has more lycopene per serving than raw tomatoes. Your cardiovascular system approves.',
    produce: 'watermelon',
  },
  {
    title: '🧄 Allicin Alert',
    body: 'Crushing garlic and waiting 10 minutes before juicing maximizes allicin — its most powerful compound.',
    produce: 'garlic',
  },
  {
    title: '🫐 Anthocyanin Academy',
    body: 'Blueberries\' deep purple pigment crosses the blood-brain barrier, directly protecting neurons. Brain food, literally.',
    produce: 'blueberry',
  },
]

// ── Onboarding Sequence (Day 1-2) ────────────────────────────
// Hard-coded first 3 notifications for new users

export const ONBOARDING_SEQUENCE = [
  {
    id: 'onboard-1',
    delayHours: 1,
    title: '🏗️ Welcome, Wellness Architect',
    body: 'Have you checked your rings today? Tap to see your Day 1 Rainbow goal.',
    data: { type: 'onboarding', step: 1, action: 'open_dashboard' },
  },
  {
    id: 'onboard-2',
    scheduledTime: { hour: 7, minute: 30 },
    dayOffset: 1,
    title: '☀️ Day 2 Starts Now',
    body: 'A simple Lemon-Ginger shot takes 2 minutes and closes your \'Kick\' ring. Ready?',
    data: { type: 'onboarding', step: 2, action: 'open_recipes' },
  },
  {
    id: 'onboard-3',
    scheduledTime: { hour: 18, minute: 0 },
    dayOffset: 1,
    title: '🔥 Don\'t Break the Seal!',
    body: 'Your first streak is one juice away. Let\'s find a recipe with what you have.',
    data: { type: 'onboarding', step: 3, action: 'open_fridge_forager' },
    condition: 'rings_at_zero',
  },
]

// ── Wilt Warnings (Inventory/Inactivity Trigger) ─────────────
// Triggered after 36 hours of no juice log

export const WILT_WARNINGS = [
  {
    title: '🥀 Your Vitamins Are Waiting',
    body: 'It\'s been a while since your last squeeze. Your {last_ingredient} is still in the fridge — shall we put it to work?',
  },
  {
    title: '🌿 The Fridge Misses You',
    body: 'Your produce is at peak freshness right now. A quick {last_ingredient} juice takes under 3 minutes.',
  },
  {
    title: '🍃 Gentle Nudge',
    body: 'Your body is ready for nutrients. Even a simple {last_ingredient} shot counts toward your rings.',
  },
  {
    title: '🧊 Freshness Window',
    body: 'Pro tip: {last_ingredient} loses 30% of its vitamins after 3 days in the fridge. Today is the day.',
  },
]

// ── Freezer Pass Morning-After ───────────────────────────────
// No guilt trips — positive framing only

export const FREEZER_PASS_MORNING = [
  {
    title: '🧊 Streak Saved!',
    body: 'Phew! We used a Freezer Pass to save your {streak}-day streak. Ready to thaw out with a quick morning squeeze?',
  },
  {
    title: '🧊 You\'re Still in the Game',
    body: 'Your {streak}-day streak is frozen solid. One juice today melts the ice and keeps you rolling.',
  },
  {
    title: '🧊 The Ice Held',
    body: 'Life happens, Architect. Your {streak}-day streak survived thanks to your Freezer Pass. Time to thaw?',
  },
]

// ── Streak Shield (8 PM Loss Aversion) ───────────────────────

export const STREAK_SHIELD = [
  {
    title: '🛡️ Streak Shield Active',
    body: 'Your rings are at 0% today. You have a Freezer Pass ready, but a 2-minute Ginger Shot would be even better.',
  },
  {
    title: '⏰ Evening Check-In',
    body: 'Your {streak}-day streak needs one juice before midnight. Your Freezer Pass is standing by as backup.',
  },
  {
    title: '🔥 Don\'t Let It Cool Down',
    body: 'Your vitamins are waiting, Architect. One quick squeeze keeps your {streak}-day fire burning.',
  },
]

// ── Surprise & Delight (Variable Rewards) ────────────────────
// Triggered every 5th log

export const SURPRISE_DELIGHT = [
  {
    threshold: 5,
    title: '🎉 Five & Thriving!',
    body: 'Your cells are dancing! 5 juices logged. You\'re officially in the habit zone.',
  },
  {
    threshold: 10,
    title: '🏆 Double Digits!',
    body: 'Ten juices deep. Your body is running on premium fuel now.',
  },
  {
    threshold: 15,
    title: '⚡ Fifteen & Fierce!',
    body: 'You just hit 15 juices. Your mitochondria are throwing a party.',
  },
  {
    threshold: 20,
    title: '🌟 Twenty Squeezes!',
    body: 'Twenty juices logged. You\'ve consumed more produce than 95% of adults this month.',
  },
  {
    threshold: 25,
    title: '💎 Quarter Century!',
    body: '25 juices! At this rate, you\'re building a body that runs on liquid gold.',
  },
  {
    threshold: 50,
    title: '👑 The Fifty Club',
    body: '50 juices. You\'re not just juicing — you\'re a Wellness Architect in full blueprint mode.',
  },
]

export const WEIGHT_MILESTONES = [
  {
    thresholdLbs: 5,
    title: '⚖️ Five Pounds of Produce!',
    body: 'You\'ve juiced 5 lbs of produce. That\'s a bag of potatoes worth of vitamins!',
  },
  {
    thresholdLbs: 10,
    title: '🏆 Ten Pound Club!',
    body: 'Your cells are dancing! You just hit 10 lbs of produce this month. 🏆',
  },
  {
    thresholdLbs: 25,
    title: '🎯 Twenty-Five Pounds!',
    body: '25 lbs of produce juiced. That\'s a toddler\'s weight in pure nutrition.',
  },
  {
    thresholdLbs: 50,
    title: '🍉 Fifty Pound Legend!',
    body: '50 lbs! You\'ve juiced a medium dog\'s weight in fruits and vegetables. Legendary.',
  },
]

// ── Helper: Pick Random from Array ───────────────────────────

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Helper: Fill Template Placeholders ───────────────────────

export function fillTemplate(template, vars) {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return result
}

// ── Helper: Get Surprise for Juice Count ─────────────────────

export function getSurpriseForCount(juiceCount) {
  return SURPRISE_DELIGHT.find((s) => s.threshold === juiceCount) || null
}

// ── Helper: Get Weight Milestone ─────────────────────────────

export function getWeightMilestone(totalWeightG, previousWeightG) {
  const currentLbs = totalWeightG / 453.6
  const previousLbs = previousWeightG / 453.6
  for (const m of WEIGHT_MILESTONES) {
    if (currentLbs >= m.thresholdLbs && previousLbs < m.thresholdLbs) {
      return m
    }
  }
  return null
}

// ── Notification Action Buttons ──────────────────────────────

export const ACTION_BUTTONS = {
  log_now: {
    identifier: 'LOG_NOW',
    buttonTitle: 'Log Now',
    options: { opensAppToForeground: true },
  },
  clink_back: {
    identifier: 'CLINK_BACK',
    buttonTitle: 'Clink Back 🥂',
    options: { opensAppToForeground: true },
  },
  view_recipe: {
    identifier: 'VIEW_RECIPE',
    buttonTitle: 'View Recipe',
    options: { opensAppToForeground: true },
  },
  use_freezer: {
    identifier: 'USE_FREEZER',
    buttonTitle: 'Use Freezer Pass 🧊',
    options: { opensAppToForeground: true },
  },
  snooze: {
    identifier: 'SNOOZE',
    buttonTitle: 'Remind Later',
    options: { opensAppToForeground: false },
  },
}

// ── Notification Categories (for action buttons) ─────────────

export const NOTIFICATION_CATEGORIES = [
  {
    identifier: 'AFFIRMATION',
    actions: [ACTION_BUTTONS.log_now],
  },
  {
    identifier: 'SOCIAL',
    actions: [ACTION_BUTTONS.clink_back, ACTION_BUTTONS.log_now],
  },
  {
    identifier: 'STREAK_ALERT',
    actions: [ACTION_BUTTONS.log_now, ACTION_BUTTONS.use_freezer],
  },
  {
    identifier: 'WILT_WARNING',
    actions: [ACTION_BUTTONS.view_recipe, ACTION_BUTTONS.snooze],
  },
  {
    identifier: 'EDUCATIONAL',
    actions: [ACTION_BUTTONS.log_now],
  },
  {
    identifier: 'SURPRISE',
    actions: [ACTION_BUTTONS.log_now],
  },
  {
    identifier: 'FREEZER_MORNING',
    actions: [ACTION_BUTTONS.log_now, ACTION_BUTTONS.view_recipe],
  },
]
