// ─────────────────────────────────────────────────────────────
// lessonContent.js — Tailored lessons for three experience levels
// Shared data structure consumed by LessonScreen.js
// ─────────────────────────────────────────────────────────────

export const EXPERIENCE_LEVELS = ['new', 'casual', 'experienced']

export const LESSON_DISCLAIMER =
  'This app provides general wellness information and is not medical advice. Consult your doctor before starting any juice plan.'

// ── New to Juicing ───────────────────────────────────────────
const NEW_TO_JUICING = {
  level: 'new',
  title: 'New to Juicing',
  emoji: '🌱',
  accentColor: '#81C784',
  sections: [
    {
      id: 'what-is-juicing',
      headline: 'What Is Juicing?',
      body: 'Juicing extracts liquid vitamins and minerals from fresh produce, giving your body a concentrated, easy-to-absorb dose of plant-based nutrients. Think of it as a quick way to flood your system with goodness.',
    },
    {
      id: 'start-simple',
      headline: 'Start with a Simple Juice',
      body: 'Begin with something easy — apple, celery, and lemon is a classic first juice. It tastes great, uses familiar produce, and takes just minutes to make.',
    },
    {
      id: 'three-four-ingredients',
      headline: 'Three or Four Ingredients Is Perfect',
      body: 'You do not need a long ingredient list. Three or four produce items are enough for a nutritious juice. As you get comfortable, you can experiment with more variety.',
    },
    {
      id: 'wash-prepare',
      headline: 'Washing and Preparing Produce',
      body: 'Rinse all produce under running water for about 20 seconds. Cut away bruised spots. Remove seeds and pits from stone fruits. You do not need to peel most produce — many nutrients live in or just under the skin.',
    },
    {
      id: 'scanning-produce',
      headline: 'Scanning Your Produce',
      body: 'Use the Scan button to photograph your produce. The app identifies the ingredients and estimates quantities automatically. This is the fastest way to build a juice recipe.',
    },
    {
      id: 'entering-manually',
      headline: 'Entering Produce Manually',
      body: 'Prefer to type? Tap the manual entry option to add ingredients by name. You can adjust the weight or quantity for each item to match what you actually have.',
    },
    {
      id: 'reviewing-nutrition',
      headline: 'Reviewing Nutrition Information',
      body: 'After building your juice, the app shows a nutrition summary with traffic-light indicators. Green means excellent, yellow means good, and red flags help you spot high-sugar or conventional-concern ingredients.',
    },
    {
      id: 'logging-juice',
      headline: 'Logging Your Completed Juice',
      body: 'When your juice is ready, tap Log to save it. Logging builds your history, unlocks weekly insights, and helps the app suggest improvements over time.',
    },
    {
      id: 'wellness-reminder',
      headline: 'A Quick Note',
      body: LESSON_DISCLAIMER,
    },
  ],
}

// ── Casual Juicer ────────────────────────────────────────────
const CASUAL_JUICER = {
  level: 'casual',
  title: 'Casual Juicer',
  emoji: '📚',
  accentColor: '#64B5F6',
  sections: [
    {
      id: 'repeatable-routine',
      headline: 'Build a Repeatable Routine',
      body: 'Consistency matters more than complexity. Pick a time that works — morning, post-workout, or afternoon — and aim for one juice a day. The app tracks your streak to help you stay on track.',
    },
    {
      id: 'rotate-produce',
      headline: 'Rotate Produce for Variety',
      body: 'Eating the same vegetables every day limits your nutrient range. Try swapping one ingredient each week. If you always use spinach, try Swiss chard or kale. Variety keeps your microbiome happy.',
    },
    {
      id: 'high-sugar',
      headline: 'Understanding High Sugar Indicators',
      body: 'Some fruits are naturally high in sugar. The app flags high-sugar ingredients with a red indicator so you can balance sweet fruits with low-sugar vegetables like cucumber or celery.',
    },
    {
      id: 'todays-focus-nutrient',
      headline: 'Using Today\u2019s Focus Nutrient',
      body: 'Each day, the app highlights a focus nutrient — like Vitamin C or potassium. Use it as inspiration: try to include produce that covers that nutrient in your next juice.',
    },
    {
      id: 'wellness-focus',
      headline: 'Using Wellness Focus',
      body: 'Wellness Focus lets you target specific health goals — like heart health or immunity. The app suggests produce combinations that align with your chosen focus area.',
    },
    {
      id: 'logging-history',
      headline: 'Log Juices to Build History',
      body: 'Every juice you log contributes to your weekly insights. Over time, the app identifies patterns, gaps, and strengths in your nutrition — but only if you log consistently.',
    },
    {
      id: 'simple-to-advanced',
      headline: 'Progressing to Advanced Blends',
      body: 'Once you are comfortable with three or four ingredients, try adding a fifth. The app provides Advanced Blend analysis for juices with five or more distinct ingredients, giving you deeper nutritional insight.',
    },
  ],
}

// ── Experienced Juicer ───────────────────────────────────────
const EXPERIENCED_JUICER = {
  level: 'experienced',
  title: 'Experienced Juicer',
  emoji: '⚡',
  accentColor: '#FFB74D',
  sections: [
    {
      id: 'advanced-blend',
      headline: 'Advanced Blend Analysis',
      body: 'When your juice has five or more distinct ingredients, the app unlocks Advanced Blend analysis. This gives you a deeper nutritional breakdown, synergy indicators, and optimization suggestions.',
    },
    {
      id: 'primary-produce-recipes',
      headline: 'Primary-Produce Recipe Discovery',
      body: 'Select a primary produce item and tap "Find Recipes with My Primary Produce." The app searches over 1,000 recipes that feature your chosen ingredient or a curated family equivalent.',
    },
    {
      id: 'recipe-pagination',
      headline: 'Recipe Pagination and Browsing',
      body: 'Recipe results are paginated 25 at a time. Use Previous and Next to browse all matching recipes. Every result is reachable — no duplicates, no skips.',
    },
    {
      id: 'wellness-focus-finder',
      headline: 'Wellness Focus Recipe Finder',
      body: 'Wellness Focus lets you target specific health goals and discover produce combinations that align with them. Use it to plan juices around your nutritional priorities.',
    },
    {
      id: 'juicer-type-settings',
      headline: 'Juicer-Type Selection in Settings',
      body: 'Choose between Cold Press and Centrifugal in Settings. This affects estimated yield calculations and enzyme retention guidance shown throughout the app.',
    },
    {
      id: 'yield-differences',
      headline: 'Estimated Yield Differences',
      body: 'The app adjusts estimated juice yield based on your selected juicer type. Cold-press typically yields more from leafy greens, while centrifugal handles hard produce efficiently.',
    },
    {
      id: 'nutrition-quality',
      headline: 'Nutrition and Quality Indicators',
      body: 'Traffic-light badges show quality at a glance: green for excellent, yellow for good, red for high-sugar or conventional-concern ingredients. Use these to balance your blends.',
    },
    {
      id: 'organic-designation',
      headline: 'Organic / Non-Organic Designation',
      body: 'Each ingredient can be marked Organic or Non-Organic. The app uses this to adjust pesticide-exposure estimates and antioxidant guidance based on published research.',
    },
    {
      id: 'juice-history',
      headline: 'Juice History',
      body: 'Your full juice history is available in the History tab. Review past juices, nutrient trends, and diversity scores. Use it to identify gaps and plan improvements.',
    },
    {
      id: 'momentum-summaries',
      headline: 'Momentum, Diversity, and Weekly Summaries',
      body: 'The app tracks momentum (consistency), diversity (ingredient variety), and weekly nutrition coverage. Check your weekly summary to see how your juicing habits evolve over time.',
    },
    {
      id: 'pro-capabilities',
      headline: 'Pro Capabilities',
      body: 'Pro users get unlimited Advanced Blend analyses, expanded recipe access, and enhanced insights. Existing pricing and entitlement policies remain unchanged — upgrade only if it fits your needs.',
    },
  ],
}

// ── Export ───────────────────────────────────────────────────

export const LESSONS = {
  new: NEW_TO_JUICING,
  casual: CASUAL_JUICER,
  experienced: EXPERIENCED_JUICER,
}

export function getLesson(level) {
  return LESSONS[level] || null
}

export function getLessonTitle(level) {
  const lesson = getLesson(level)
  return lesson ? lesson.title : ''
}

export function getLessonSections(level) {
  const lesson = getLesson(level)
  return lesson ? lesson.sections : []
}
