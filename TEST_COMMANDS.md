# Test Gates — Juicing App

Run these after every Todo item and at each phase checkpoint.

## 1. Bundle Check (Metro)

Verifies all imports resolve and JSX compiles without errors.

```bash
# Requires Metro running on port 8082
node -e "const http=require('http');http.get('http://localhost:8082/index.bundle?platform=android&dev=true&minify=false',(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{if(r.statusCode===200){console.log('BUNDLE OK - size:',d.length)}else{console.error('BUNDLE FAIL');process.exit(1)}})})"
```

## 2. Lint (basic syntax check)

```bash
npx expo export --dump-sourcemap 2>&1 | head -20
```

## 3. Full Build Verification

```bash
npx expo export --platform android
```

## 4. Juice Calculator — Enable & Test

### Enable the flag
In the app, go to **Settings → Developer Section** and toggle **Juice Calculator** ON.
Or it's already ON by default for beta testers.

### Manual test flow
1. From Dashboard, tap **"Juice Calculator"** link
2. Set timeframe to **Per Day**
3. Select **Vitamin C** and **Potassium** (2 nutrients)
4. Use the **Standard** preset for both (auto-fills DV targets: 90mg VitC, 2600mg Potassium)
5. Leave "Allow produce combos" ON, max volume 24 oz
6. Tap **Calculate**
7. Verify:
   - Multi-produce "Best Mixes" section appears with 1–3 mix options
   - Single-produce "Top Single Produce" section appears with up to 5 items
   - Each result shows produce name, grams, estimated oz
   - Coverage bars show % met per nutrient with color coding
   - Explanation text is present
8. Tap **Save Template** on any result → should save to TemplateStore
9. Tap **← Adjust & Recalculate** to return to setup

### Example expected output (Vitamin C = 90mg/day)
- **Single best**: Parsley (~97g raw, ~2.2 oz juice, ~100% VitC coverage)
- **Multi mix**: Kale + Red Bell Pepper combo should achieve high coverage

## 5. Scan-First Navigation — Test Flow

### New user onboarding (fresh install or nuclear reset)
1. App opens to **Scan tab** with hero: "What's in your juice today?"
2. Tap **Scan My Produce** → navigates to JuiceSnap camera
3. After scan, returns to **Tracking Hook**: "Want to track your juicing journey?"
4. Tap **Start Tracking** → navigates to **Goal Selection**
5. Pick a goal (e.g. "More Energy") → auto-navigates to **Today tab**
6. Verify Today tab shows: greeting, Day pill, Vitality Rings, Scan CTA

### Returning user (onboarding complete)
1. Scan tab shows simplified scan home with "Scan My Produce" CTA
2. Today tab shows daily view with rings, streak, logged juices
3. Verify **Optimize tab** is hidden for new users (Day < 7)

### Progressive unlock verification
1. Go to **Settings → Dev Section**
2. Toggle **Optimize Tab** ON → Optimize tab appears immediately
3. Toggle OFF → tab disappears
4. Verify Nutrient Halo only appears on Today after Day 3+
5. Verify Weekly Pillar View only appears after Day 5+

### Tab navigation
- Scan / Today / Optimize tabs at bottom
- All sub-screens (JuiceSnap, Settings, Calculator, etc.) accessible from any tab
- Old Dashboard still accessible via Settings dev section or direct navigation

### Feature flag map
| Flag | Controls |
|------|----------|
| `ff_progressive_unlock` | Master switch for day-based unlocks |
| `ff_optimize_tab` | Force-show Optimize tab (overrides day check) |
| `ff_nutrient_halo_progress` | Nutrient Halo on Today (also needs Day 3+) |
| `ff_weekly_pillar_view` | Weekly Pillar on Today (also needs Day 5+) |

## Pass Criteria

- **Bundle Check**: exits 0, prints `BUNDLE OK`
- **Lint**: no `SyntaxError` or `Module not found` in output
- **Build**: exits 0 with no errors
- **Calculator**: results render offline, no network calls, analytics events fire in console
- **Scan-First**: onboarding flow completes without crash, tab navigation works, progressive unlocks respect both flags and day thresholds
