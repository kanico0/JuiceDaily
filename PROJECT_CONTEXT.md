\# JuicingApp — Master Project Context



Last Updated: (update date manually when major changes occur)







------------------------------------------------------------



APP VISION



------------------------------------------------------------



JuicingApp is a glow-focused wellness app that:



\- Scans produce juice via AI



\- Tracks nutrient intake



\- Encourages consistency via Glow Streak



\- Provides curated recipe library



\- Offers seasonal recipe drops



\- Introduces beginners through a structured Glow Path







Brand positioning:



Soft lifestyle glow-up movement.



Not medical.



Not detox miracle claims.







------------------------------------------------------------



MONETIZATION MODEL (LOCKED)



------------------------------------------------------------







FREE TIER



\- 10 lifetime AI scans



\- Manual logging unlimited



\- 1 recipe per category



\- Beginner Glow Path free



\- Basic nutrient summary







GLOW+ SUBSCRIPTION



\- $4.99 / month



\- No trial at launch



\- 50 AI scans per billing period (monthly)



\- Unlimited recipe access



\- Seasonal Glow Packs auto-unlocked



\- Weekly Glow Summary



\- Advanced nutrient breakdown



\- Save favorites







PAYMENT PROCESSING



\- Apple In-App Purchase (StoreKit)



\- Google Play Billing



\- NO Stripe



\- Restore Purchases button required







Product ID:



\- glow\_plus\_monthly (iOS + Android)







------------------------------------------------------------



CORE USER FLOWS (MUST NOT BREAK)



------------------------------------------------------------







Launch → Reveal my nutrients → Camera → X → Welcome/Home







Welcome/Home shows:



\- Browse juice ideas



\- Glow Library



\- Seasonal Glow Packs



\- Beginner Glow Path







Browse juice ideas:



\- Free preview list (~7 recipes)







Glow Library:



\- Full core recipe library



\- Pro recipes blurred for Free



\- Locked tap → Paywall







Seasonal Glow Packs:



\- Visible to all



\- Locked for Free



\- Auto-unlocked for Pro







Beginner Glow Path:



\- Free educational flow



\- Can link to recipes



\- Must not trap users







------------------------------------------------------------



ENTITLEMENT SYSTEM



------------------------------------------------------------







Source of truth:



EntitlementService







State must include:



\- isPro



\- periodStart



\- periodEnd



\- scansUsedThisPeriod



\- lifetimeScansUsed







Rules:



Free → max 10 lifetime scans



Pro → max 50 scans per billing period







Manual logging always free.







Must handle:



\- Purchase



\- Restore



\- Expiry



\- Reinstall



\- Offline grace (max 24h)







------------------------------------------------------------



ACTIVE BUGS TO RESOLVE BEFORE LAUNCH



------------------------------------------------------------







1\) Dev +1 day does not affect history grouping.



2\) Glow streak force override not fully respected.



3\) History grouping may be recomputing from loggedAt instead of entry.dayKey.



4\) Need on-screen proof banner to verify:



&nbsp;  - resolved dayKey



&nbsp;  - write dayKey



&nbsp;  - history grouping source







------------------------------------------------------------



DEV TOOLS (REQUIRED)



------------------------------------------------------------







Developer panel must include:



\- dev\_days\_offset



\- Hardcode +2 days toggle



\- Mock Pro toggle (UI only)



\- Force Paywall Now button



\- Entitlement debug info



\- Current resolved dayKey display







------------------------------------------------------------



LEGAL REQUIREMENTS



------------------------------------------------------------







App must include:



\- Health \& Wellness disclaimer



\- No medical miracle claims



\- Affiliate disclosure (juicer links)



\- Detox language clarification







------------------------------------------------------------



RECIPE STRUCTURE



------------------------------------------------------------







Core Recipes:



src/data/recipes.ts







Seasonal Drops:



src/data/seasonalDrops.ts







Juicer Buyer Guide:



src/data/juicers.ts



Each juicer must include:



\- Name



\- Price range



\- Type



\- Summary paragraph



\- Key strengths



\- Ideal user



\- Affiliate link placeholder







------------------------------------------------------------



BUILD MODES



------------------------------------------------------------







GO Mode:



\- Expo Go compatible



\- No native-only imports (IAP, vision-camera)







BETA/PROD:



\- Full native support



\- EAS build required







------------------------------------------------------------



LAUNCH PRIORITY



------------------------------------------------------------







Fix:



\- Day advancing



\- Entitlement stability



\- Recipe exposure structure



\- Streak accuracy







Then:



\- Final UI polish



\- Store submission







No feature creep beyond this scope.



