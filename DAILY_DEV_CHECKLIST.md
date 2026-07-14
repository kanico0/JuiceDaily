\# JuicingApp — Daily Dev Regression Checklist



Run this after ANY code change before committing or building.







------------------------------------------------------------



1\) APP BOOT



------------------------------------------------------------



\[ ] App launches without crash



\[ ] Welcome/Home loads



\[ ] No red screens / no console fatal errors







------------------------------------------------------------



2\) CORE NAVIGATION



------------------------------------------------------------



\[ ] Reveal → Camera → X → returns to Welcome/Home



\[ ] Browse juice ideas opens



\[ ] Glow Library opens



\[ ] Seasonal Glow Packs screen opens



\[ ] Beginner Glow Path opens



\[ ] Every screen has a visible way back







------------------------------------------------------------



3\) AI SCAN SAFETY



------------------------------------------------------------



\[ ] AI scan succeeds OR fails gracefully



\[ ] On failure → manual logging option visible



\[ ] After successful scan → “Log to Daily Squeeze” works



\[ ] No double logging when button tapped once







------------------------------------------------------------



4\) DAY + STREAK (DEV MODE)



------------------------------------------------------------



\[ ] +1 day changes resolved dayKey (visible in DevProofBanner)



\[ ] Logging after +1 day creates entry under new day



\[ ] Glow streak increments correctly



\[ ] Force streak override updates UI everywhere







------------------------------------------------------------



5\) RECIPE GATING



------------------------------------------------------------



Free user:



\[ ] Browse preview recipes open



\[ ] Locked Glow Library recipe → Paywall



\[ ] Locked Seasonal Pack → Paywall







Pro (Mock Pro or real):



\[ ] All recipes open



\[ ] Seasonal packs open



\[ ] No paywall shown for Pro







------------------------------------------------------------



6\) PAYWALL



------------------------------------------------------------



\[ ] Paywall opens when expected



\[ ] “Not now” dismiss works



\[ ] Restore Purchases button visible



\[ ] No broken buttons







------------------------------------------------------------



7\) ENTITLEMENT STATE



------------------------------------------------------------



\[ ] Free: 10 lifetime cap enforced



\[ ] Pro: 50/month cap enforced



\[ ] Manual logging always works



\[ ] Settings shows correct remaining scan count







------------------------------------------------------------



8\) NO NEW TRAPS



------------------------------------------------------------



\[ ] No screen traps user with no exit



\[ ] No infinite loading spinners



\[ ] No hidden navigation breaks







------------------------------------------------------------



9\) BUILD MODE SAFETY



------------------------------------------------------------



GO mode:



\[ ] Runs in Expo Go (no native crash)







BETA mode:



\[ ] Native modules load correctly







------------------------------------------------------------



IF ANY ITEM FAILS:



------------------------------------------------------------



🛑 Fix immediately.



Do NOT move to new features.



Do NOT run store builds.



