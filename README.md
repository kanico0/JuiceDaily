# JuicingApp — Nutrition Performance Tracking

Clinical-grade nutritional tracking for cold-pressed juicing. React Native (Expo SDK 54), iOS + Android.

## Architecture

```
JuicingApp/
├── App.js                          # Entry, navigation, provider tree
├── src/
│   ├── components/
│   │   ├── performance-dashboard/  # Dashboard UI components
│   │   │   ├── MomentumCard.js     # Primary score card (0–1000)
│   │   │   ├── LifetimeScoreCard.js# Cumulative lifetime score
│   │   │   ├── PerformanceRow.js   # Streak / Ingredients / Nutrients
│   │   │   ├── WeekIngredientsList.js # Rolling 7-day ingredient chips
│   │   │   └── ScoreBreakdownModal.js # Full dimension breakdown
│   │   ├── GlassSurface.js         # Shared glassmorphism wrapper
│   │   ├── MeshGradientBg.js       # Animated gradient background
│   │   └── ...                     # Other UI components
│   ├── constants/
│   │   └── tokens.js               # Design tokens (typography, spacing, colors)
│   ├── hooks/                      # Custom React hooks
│   ├── screens/
│   │   ├── PerformanceDashboardScreen.js  # Main dashboard layout
│   │   ├── PerformanceOnboardingScreen.js # 2-slide onboarding → camera
│   │   ├── ScanSuccessScreen.js           # Post-scan celebration + metrics
│   │   ├── HomeScreen.js                  # Camera + ingredient editor
│   │   └── ...                            # Other screens
│   ├── services/
│   │   ├── NutritionScoreEngine.ts # Pure scoring math (no React)
│   │   ├── NutritionScoreStore.js  # React Context + useReducer store
│   │   ├── ChallengeStore.js       # 7-Day Rainbow Challenge state
│   │   ├── JuiceEngine.ts          # Nutritional calculation engine
│   │   ├── AnalyticsService.js     # Event tracking with PII enforcement
│   │   ├── FeatureFlags.js         # AsyncStorage-backed feature flags
│   │   ├── UserProfileStore.js     # User profile + nuclear reset
│   │   ├── ActivationStore.js      # Progressive unlock tracking
│   │   └── __tests__/
│   │       └── NutritionScoreEngine.test.ts  # Unit tests
│   └── utils/
│       └── motion.js               # Animation presets + useReducedMotion
├── .eslintrc.js                    # ESLint config (Expo + Prettier)
├── .prettierrc                     # Prettier config (no semi, single quotes)
├── jest.config.js                  # Jest config (jest-expo preset)
└── package.json
```

## State Management

**Pattern**: React Context + `useReducer` + `AsyncStorage` persistence.

All stores follow the same pattern:
1. `useReducer` for synchronous state transitions
2. `useEffect` hydration from `AsyncStorage` on mount
3. `useEffect` persistence to `AsyncStorage` on state change
4. `useMemo` for derived/computed values (selectors)
5. `useCallback` for stable action dispatchers

### NutritionScoreStore

**Storage key**: `@juicing_nutrition_score_v1`

**State shape** (`NutritionScoreState`):
```typescript
{
  activeCycle: MomentumCycle       // Current 30-day scoring cycle
  completedCycles: MomentumCycle[] // Finalized past cycles
  lifetimeScore: number            // Sum of all finalized cycle scores
  allTimeUniqueIngredients: string[]
  allTimeNutrientsDiscovered: string[]
  longestEverStreak: number
  totalLifetimeScans: number
}
```

**Actions**:
- `HYDRATE` — Restore from storage (with validation + sanitization)
- `RECORD_LOG` — Record a juice scan (ingredientIds + nutrient totals)
- `RESET` — Clear to empty state

**Hook**: `useNutritionScore()` returns:
- `breakdown` — Full 4-dimension score breakdown
- `momentum` — Current cycle Momentum (0–1000)
- `lifetime` — Total lifetime score
- `cycleProgress` — Days remaining/elapsed, log count
- `diversity` — Unique ingredients (cycle + all-time)
- `coverage` — Nutrients discovered (cycle + all-time)
- `streak` — Current cycle streak + longest ever
- `weeklyActivity` — Rolling 7-day scan count
- `recordNutritionLog(ingredientIds, totals)` — Action
- `resetScore()` — Action

## Scoring Rules

### Nutrition Momentum (0–1000 per 30-day cycle)

Calculated from 4 weighted dimensions:

| Dimension | Weight | Raw Metric | Normalization Cap |
|-----------|--------|------------|-------------------|
| Ingredient Diversity | 30% | Unique produce IDs scanned | 20 |
| Nutrient Coverage | 30% | Distinct nutrients discovered | 8 |
| Consistency (Streak) | 20% | Longest consecutive-day streak | 25 |
| Weekly Activity | 20% | Scans in rolling 7-day window | 10 |

**Formula**:
```
For each dimension:
  normalized = min(raw / cap, 1.0)
  contribution = normalized × weight × 1000

Total Momentum = Σ contributions (rounded)
```

**Example** (perfect scores):
```
Diversity:  20/20 × 0.30 × 1000 = 300
Coverage:    8/8  × 0.30 × 1000 = 300
Streak:    25/25  × 0.20 × 1000 = 200
Activity:  10/10  × 0.20 × 1000 = 200
Total: 1000
```

### Lifetime Nutrition Score

Accumulates finalized cycle scores. When a 30-day cycle expires:
1. Cycle is finalized (Momentum score frozen)
2. Finalized score added to `lifetimeScore`
3. New cycle starts automatically

### Tracked Nutrients (8)

`calories`, `sugar`, `vitaminC`, `vitaminA`, `potassium`, `iron`, `magnesium`, `folate`

A nutrient is "discovered" when any scan yields a non-zero value for it.

## Error Handling

- **Storage corruption**: `sanitizeHydratedState()` validates every field on hydrate, falls back to empty state for invalid data
- **Invalid dates**: `safeDateOrToday()` returns today for any unparseable date
- **Invalid log entries**: `recordLog()` rejects entries that fail `isValidLogEntry()` shape check
- **Null props**: All dashboard components use default parameter values and `?.` / `??` operators
- **Async failures**: Storage read/write wrapped in try-catch with `console.warn` logging

## Testing

```bash
# Install dev dependencies
npm install

# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

Test coverage targets `NutritionScoreEngine.ts` — all pure scoring functions, cycle management, validation helpers, and reset logic.

## Linting

```bash
npm run lint
```

Config: ESLint with `expo` + `prettier` extends. Prettier: no semicolons, single quotes, trailing commas.

## Bundle Verification

```bash
# With Metro running on port 8082:
node -e "const http = require('http'); http.get('http://localhost:8082/index.bundle?platform=android&dev=true&minify=false', (res) => { let d=''; res.on('data', c => d+=c); res.on('end', () => { if(res.statusCode===200) console.log('BUNDLE OK - size:',d.length); else console.log('BUNDLE ERROR:',d.substring(0,3000)); }); }).on('error', e => console.log('FETCH ERROR:', e.message))"
```
