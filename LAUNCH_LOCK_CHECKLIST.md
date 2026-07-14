\# JuicingApp — LAUNCH LOCK CHECKLIST (Permanent)







This file prevents scope creep and protects launch stability.







RULE:



If any BLOCKER item fails → do NOT submit to store.







Last Updated: \_\_\_\_\_\_\_\_\_\_\_







------------------------------------------------------------



0\) SCOPE LOCK (DO NOT MODIFY WITHOUT DECISION UPDATE)



------------------------------------------------------------







MONETIZATION (LOCKED)



\- Store payments only (Apple IAP + Google Play Billing)



\- No Stripe



\- Product ID: glow\_plus\_monthly



\- $4.99/month



\- No free trial



\- Free: 10 lifetime AI scans



\- Pro: 50 AI scans per billing period



\- Manual logging always free



\- Pro includes:



&nbsp; - Unlimited recipes



&nbsp; - Seasonal Glow Packs



&nbsp; - Weekly Glow Summary



&nbsp; - Advanced nutrient breakdown



&nbsp; - Favorites







BRAND (LOCKED)



\- Soft glow-up lifestyle



\- No medical claims



\- No “cure/treat/prevent disease” language







------------------------------------------------------------



1\) CORE FLOWS (BLOCKER)



------------------------------------------------------------







\[ ] Launch → Reveal → Camera → X → Welcome/Home works



\[ ] Welcome/Home contains:



&nbsp;   - Browse juice ideas



&nbsp;   - Glow Library



&nbsp;   - Seasonal Glow Packs



&nbsp;   - Beginner Glow Path



\[ ] No screen traps user without visible exit



\[ ] No non-responsive buttons







------------------------------------------------------------



2\) DAY + STREAK SYSTEM (BLOCKER)



------------------------------------------------------------







REAL DAY



\[ ] After real 24h, day increments correctly



\[ ] History groups by entry.dayKey (NOT by loggedAt recalculation)







DEV TOOLS



\[ ] +1 day changes resolved dayKey (visible proof)



\[ ] Hardcode +2 days toggle changes resolved dayKey immediately



\[ ] Logging after day change writes correct entry.dayKey



\[ ] DevProofBanner displays:



&nbsp;   - offset



&nbsp;   - resolved dayKey



&nbsp;   - last entry dayKey



&nbsp;   - history source/store



\[ ] Force streak override updates ALL streak displays



\[ ] 3-day and 7-day achievements appear correctly







------------------------------------------------------------



3\) RECIPES + CONTENT EXPOSURE (BLOCKER)



------------------------------------------------------------







BROWSE PREVIEW



\[ ] Shows limited preview list (~7 recipes)



\[ ] All preview recipes open freely







GLOW LIBRARY



\[ ] Shows full core recipe set (more than preview)



\[ ] Pro-only recipes blurred for Free



\[ ] Locked tap → Paywall



\[ ] Pro can open all recipes







SEASONAL PACKS



\[ ] Packs visible to Free users (teaser)



\[ ] Packs locked for Free



\[ ] Packs open for Pro users



\[ ] Seasonal recipes accessible within pack







BEGINNER GLOW PATH



\[ ] Entry visible on Welcome/Home



\[ ] Day screens flow without trap



\[ ] “Start Juicing Now” option exists



\[ ] Recipe links inside Beginner path open correctly



\[ ] Beginner recipes do NOT trigger paywall







------------------------------------------------------------



4\) PAYWALL + ENTITLEMENTS (BLOCKER)



------------------------------------------------------------







PAYWALL UI



\[ ] Title: "Unlock Your Full Glow Library"



\[ ] Subtitle: "More recipes. More inspiration. More glow."



\[ ] $4.99/month clearly shown



\[ ] “Not now” works



\[ ] Restore Purchases button visible







ENTITLEMENT LOGIC



\[ ] Purchase unlocks Pro immediately



\[ ] Pro persists after restart



\[ ] Restore Purchases works after reinstall



\[ ] Expired subscription relocks features but keeps history



\[ ] Offline grace max 24h



\[ ] No permanent unlock from cached state







SCAN LIMITS



\[ ] Free scan #11 → paywall + manual fallback



\[ ] Pro scan #51 in same period → cap reached + manual fallback



\[ ] Manual logging always functional



\[ ] Remaining scan count displays correctly







------------------------------------------------------------



5\) LEGAL + COMPLIANCE (BLOCKER)



------------------------------------------------------------







\[ ] Legal screen exists



\[ ] Health \& Wellness disclaimer present



\[ ] Affiliate disclosure present



\[ ] Detox clarification present



\[ ] No prohibited health claims anywhere







------------------------------------------------------------



6\) BUILD SAFETY (BLOCKER)



------------------------------------------------------------







GO MODE



\[ ] Runs in Expo Go



\[ ] No native-only import crashes







BETA MODE



\[ ] Standalone APK builds



\[ ] IAP works in sandbox



\[ ] No debug screens visible in production







------------------------------------------------------------



7\) PERFORMANCE + STABILITY (BLOCKER)



------------------------------------------------------------







\[ ] App boots under 3 seconds



\[ ] Camera open/close stable



\[ ] AI failure shows fallback UI



\[ ] No infinite loaders



\[ ] No unhandled promise rejections







------------------------------------------------------------



8\) STORE READINESS (FINAL)



------------------------------------------------------------







\[ ] App icon finalized



\[ ] Screenshots ready



\[ ] Privacy Policy URL live



\[ ] Terms URL live



\[ ] Support email set



\[ ] Version numbers correct



\[ ] No test keys in production







------------------------------------------------------------



LAUNCH DECISION



------------------------------------------------------------







If ALL BLOCKERS pass:



✅ Submit to Apple \& Google.







If ANY BLOCKER fails:



🛑 Fix before proceeding.



