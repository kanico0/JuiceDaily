// ─────────────────────────────────────────────────────────────
// juicers.ts — Juicer Buyer's Guide data
// Source of truth: JuiceReferences.md — "2025 Juicer Comparison
// and Purchase Guide". Structure per PROJECT_CONTEXT.md:
// name, price range, type, summary, key strengths, ideal user,
// affiliate link placeholder.
// ─────────────────────────────────────────────────────────────

export type JuicerType = 'masticating' | 'centrifugal'

export interface JuicerEntry {
  id: string
  name: string
  priceRange: string
  type: JuicerType
  summary: string
  keyStrengths: string[]
  idealUser: string
  affiliateLink: string // placeholder — replace with affiliate URL
}

export const JUICERS: JuicerEntry[] = [
  {
    id: 'nama_j2',
    name: 'Nama J2 Cold Press',
    priceRange: '$599',
    type: 'masticating',
    summary: 'Best Overall. Hands-free batch juicing with consistently high yield — cold-press models like the Nama J2 yield up to 60% more juice from leafy greens compared to centrifugal models.',
    keyStrengths: ['Best overall pick', 'Hands-free batch juicing', 'High leafy-green yield'],
    idealUser: 'Committed juicers who want the best all-round machine.',
    affiliateLink: 'https://namawell.com',
  },
  {
    id: 'kuvings_auto_10_plus',
    name: 'Kuvings AUTO 10 Plus',
    priceRange: '$739',
    type: 'masticating',
    summary: 'Premium option built for high volume with the quietest operation of the models tested.',
    keyStrengths: ['Premium build', 'High volume', 'Quietest operation'],
    idealUser: 'High-volume households wanting a premium, quiet machine.',
    affiliateLink: 'https://kuvings.com',
  },
  {
    id: 'nama_j3',
    name: 'Nama J3 Cold Press',
    priceRange: '$450',
    type: 'masticating',
    summary: 'Compact and travel-friendly while keeping a high green yield.',
    keyStrengths: ['Compact footprint', 'Travel-friendly', 'High green yield'],
    idealUser: 'Small kitchens and travelers who still want cold-press quality.',
    affiliateLink: 'https://namawell.com',
  },
  {
    id: 'tribest_shine',
    name: 'Tribest Shine Multi-Batch',
    priceRange: '$149',
    type: 'masticating',
    summary: 'Best budget cold-press. Designed for small spaces without giving up masticating extraction.',
    keyStrengths: ['Best budget cold-press', 'Fits small spaces'],
    idealUser: 'Budget-conscious beginners who want cold-press nutrition.',
    affiliateLink: 'https://tribest.com',
  },
  {
    id: 'hamilton_beach_pro',
    name: 'Hamilton Beach Prof.',
    priceRange: '$188',
    type: 'centrifugal',
    summary: 'High speed and powerful for hard produce like carrots and beets.',
    keyStrengths: ['High speed', 'Powerful for hard produce'],
    idealUser: 'Speed-first juicers who mostly juice hard produce.',
    affiliateLink: 'https://hamiltonbeach.com',
  },
  {
    id: 'nutribullet_juicer',
    name: 'Nutribullet Juicer',
    priceRange: '$119',
    type: 'centrifugal',
    summary: 'The easiest entry point — built for absolute beginners with simple operation.',
    keyStrengths: ['Ease of use', 'Low entry price'],
    idealUser: 'Absolute beginners trying juicing for the first time.',
    affiliateLink: 'https://nutribullet.com',
  },
  {
    id: 'omega_sana_727',
    name: 'Omega Sana 727',
    priceRange: '$599+',
    type: 'masticating',
    summary: 'Purest juice of the group with exceptional durability.',
    keyStrengths: ['Purest juice', 'Exceptional durability'],
    idealUser: 'Purists who prioritize juice quality and machine longevity.',
    affiliateLink: 'https://omegajuicers.com',
  },
]

// Consumer insights from 2025 testing (JuiceReferences.md)
export const BUYER_INSIGHTS: string[] = [
  'Yield efficiency: cold-press models (like the Nama J2) consistently yield up to 60% more juice from leafy greens compared to centrifugal models.',
  'Maintenance: the Ninja NeverClog ($129–$149) is noted for being the easiest model to clean for those with time constraints.',
  'Value: while cold-press juicers have a higher upfront cost, their improved yield and nutrient stability (up to 72 hours) often results in lower produce costs over time.',
]
