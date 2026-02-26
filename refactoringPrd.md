Master prompt and required inputs

Required @-mentions and placeholders

Use these exact placeholder names in the prompt. Replace the paths with your real files and paste a share link for Figma.



Placeholder mention	What you should attach / provide	Why Cascade needs it

@repo:ROOT\_REPO	The repo root	Enables repo-wide search, plan, and implementation under consistent context. 

@file:APP\_ENTRYPOINT	App bootstrap (e.g., src/App.tsx, main.dart, AppDelegate, etc.)	Ensures “no new permissions at launch” and correct initialization sequencing. 

@file:NAVIGATION\_ROUTING	Router/nav config	Needed to add Today Hub entrypoints and new screens behind feature flags.

@file:DESIGN\_TOKENS	Colors, typography, spacing, radii	Needed to implement liquid-flow styling consistently and accessibly. 

@file:MOTION\_UTILS	Animation helpers, easing constants, reduced-motion hook	Needed for consistent motion and fallback behaviors. 

@file:ANALYTICS\_SCHEMA	Existing analytics wrapper + event conventions	Needed to instrument events uniformly and safely.

@file:FEATURE\_FLAGS	Feature flag framework/config	Needed for phased rollout + rollback. 

@file:DATA\_LAYER\_OFFLINE	Local DB/storage + sync logic	Needed for offline-first logging requirement.

@file:UX\_SPEC\_ROADMAP	Your UX spec for all four phases	Primary design contract for implementation order and acceptance criteria.

@figma:FIGMA\_JUICING\_APP	A Figma link or exported frames	Used to ensure UI matches intended layouts/states and components.

@file:TEST\_COMMANDS\_DOC	How to run tests/lint/build in this repo	Ensures Cascade can gate each phase with reliable test commands.



The consolidated Cascade master prompt text

Copy/paste this into Cascade. It is written to force Plan Mode first, enforce checkpoints, small commits, feature-flagging, test gates, and privacy/accessibility constraints.



text

Copy

YOU ARE CASCADE IN WINDSURF.



MISSION

Refactor and extend the app to deliver a premium juicing experience across four roadmap phases:

\- Foundation: Today Hub + 3-step logger + rewards + analytics

\- Differentiation: Smart Pantry MVP + Use-Soon cards + recipe linking

\- Premium: templates, insights, streaks with grace, optional social

\- Acceleration: photo-to-draft, selective AI personalization, richer liquid-flow motion



OPERATING RULES (REPO-SAFE)

\- Start in Plan Mode. Produce a prioritized Todo list BEFORE touching code.

\- Work in small, PR-sized increments. After each Todo item, make a small commit (target: <= ~300 LOC change per commit unless unavoidable).

\- Use feature flags for all new UX and data flows. Default flags OFF unless explicitly told otherwise.

\- Create named checkpoints at the start and after each phase. If a phase fails tests or causes regressions, revert to the last known-good checkpoint.

\- Do not add or trigger any new runtime permissions at launch. Only request permissions in-context when the user taps the relevant feature (camera, notifications, health sync, etc.).

\- Offline-first logging is mandatory: logging must work without network and sync later when available.

\- Minimal dependencies: do not add new packages unless absolutely necessary. If you must, explain why and prefer well-maintained, lightweight libraries already used in the repo.

\- Performance budgets: avoid continuous 60fps animation loops on primary screens; no heavy SVG point simulations running constantly. Prefer transform/opacity animations; keep motion durations short; ensure reduced-motion fallbacks.

\- Privacy: NO PII in analytics. Do NOT send ingredient text, recipe names, user-entered notes, or photo payloads to analytics. Use enums, buckets, and opaque IDs only.



REQUIRED CONTEXT INPUTS (MUST READ FIRST)

\- @repo:ROOT\_REPO

\- @file:APP\_ENTRYPOINT

\- @file:NAVIGATION\_ROUTING

\- @file:DESIGN\_TOKENS

\- @file:MOTION\_UTILS

\- @file:ANALYTICS\_SCHEMA

\- @file:FEATURE\_FLAGS

\- @file:DATA\_LAYER\_OFFLINE

\- @file:UX\_SPEC\_ROADMAP

\- @figma:FIGMA\_JUICING\_APP

\- @file:TEST\_COMMANDS\_DOC



INITIAL OUTPUT (PLAN MODE ONLY)

1\) A prioritized Todo list, grouped by phase Foundation → Differentiation → Premium → Acceleration.

2\) For each Todo: impacted files/components, rollback plan, and explicit test gate.

3\) Identify risks and unknowns (missing schemas, unclear UX decisions, data model gaps). Propose safe defaults.

4\) Propose feature flag names and default values.



CHECKPOINTS (CREATE THESE BY NAME)

\- cp\_pre\_juicing\_refactor (before any edits)

\- cp\_foundation\_done

\- cp\_differentiation\_done

\- cp\_premium\_done

\- cp\_acceleration\_done



BRANCH / WORKTREE DISCIPLINE

\- Use a dedicated branch or worktree for this refactor.

\- Keep each commit reviewable and scoped. Provide a short “PR summary” after each phase.



PHASE IMPLEMENTATION DETAILS



FOUNDATION (Today Hub + 3-step logger + rewards + analytics)

A) Today Hub

\- Add/upgrade a Today Hub screen as the main anchor.

\- Primary CTA: “Log Juice”.

\- The hub must show: today’s progress (liquid fill), streak status (if enabled), and next recommended action.

B) 3-step logger (bottom sheet or dedicated screen)

\- Must support: 3-tap logging path (Volume → Type → Log it).

\- Progressive disclosure: details optional (ingredients, notes).

\- Must work offline; persist locally immediately; sync later.

C) Rewards

\- On successful log: haptic + “splash” animation + one micro-insight card.

D) Analytics

\- Instrument the events listed in the Analytics section below using @file:ANALYTICS\_SCHEMA and respecting privacy rules.



DIFFERENTIATION (Smart Pantry MVP + Use-Soon cards + recipe linking)

A) Smart Pantry data model

\- Implement pantry items with: category, purchase/added date, storage location, quality window (guidelines), and “use soon” threshold.

\- Do NOT claim hard expiration; use “guideline” language.

B) Today Hub Use-Soon cards

\- Show “Use soon” items; tap suggests recipes using those items.

C) Recipe linking

\- Allow linking a juice log to a recipe and optionally decrement pantry inventory when recipe-linked (with undo).

D) Analytics

\- Instrument pantry\_item\_added, pantry\_use\_suggested and related conversions.



PREMIUM (templates, insights, streaks with grace, optional social)

A) Templates

\- Save and reuse templates/recipes; one-tap template logging path.

B) Insights

\- Weekly “flow” insight view; keep insights non-judgmental; no medical claims.

C) Streaks with grace

\- Streak system with “grace day” or recovery mechanic; allow hiding streak UI.

\- Ensure broken streak does not shame; provide recovery UI.

D) Optional social

\- Behind a flag: small challenge participation (opt-in). Avoid leaderboards by default.

E) Analytics

\- Instrument template\_used, streak\_started, streak\_broken, and social opts.



ACCELERATION (photo-to-draft, selective AI personalization, richer liquid-flow motion)

A) Photo-to-draft

\- When user chooses “Photo”, capture a photo and create a draft log entry. No CV required initially.

\- Camera permission only when user taps Photo flow. No permission prompts at app launch.

B) Selective AI personalization

\- Add AI recipe suggestions / timing suggestions behind a flag.

\- Do not send raw ingredient text or notes to analytics.

\- Ensure user controls: AI on/off and data transparency.

C) Richer liquid-flow motion

\- Extend motion system with tasteful transitions only if within performance budgets and with reduced-motion fallbacks.

D) Analytics

\- Instrument photo\_draft\_created and ai\_recipe\_suggested with safe fields.



ANALYTICS (EVENTS + PRIVACY)

Implement these events exactly (names are case-sensitive). Use schema tables below; do not add PII.

\- first\_log\_started

\- first\_log\_completed

\- log\_completed

\- pantry\_item\_added

\- pantry\_use\_suggested

\- reminder\_opt\_in\_shown

\- reminder\_opt\_in\_accepted

\- streak\_started

\- streak\_broken

\- template\_used

\- photo\_draft\_created

\- ai\_recipe\_suggested



ACCESSIBILITY ACCEPTANCE CRITERIA (MUST PASS)

\- Dynamic type / text scaling: no clipped text; layout reflows.

\- Screen reader: primary CTAs and controls have labels, hints, and correct grouping/order.

\- Contrast: meet minimum ratios for text and UI components.

\- Reduced motion: honor system reduce-motion. Provide crossfade fallback \& disable motion triggers.

\- Keyboard navigation (if web/desktop): full operability, no keyboard traps, visible focus.



REDUCED-MOTION SPEC (MUST IMPLEMENT)

\- If reduced motion is ON:

&nbsp; - Disable blob morphing, parallax, multi-axis motion, and looping background movement.

&nbsp; - Replace with crossfade (150–200ms) or instant state changes.

&nbsp; - Keep essential feedback via subtle opacity change + haptic (where available).

\- If reduced motion is OFF:

&nbsp; - Use short transitions (195–300ms typical). Avoid animation beyond 450ms for frequent actions.

&nbsp; - Use standard easing for transforms; ensure motion communicates state, not decoration.



TEST GATES (RUN AFTER EACH TODO + PHASE)

\- Run lint, unit tests, and build commands from @file:TEST\_COMMANDS\_DOC.

\- If any gate fails, fix before proceeding. If not quickly fixable, revert to last checkpoint and report.



FINAL OUTPUTS REQUIRED

After each phase:

\- Summary of changes by commit (hash + message), files touched, flags added, and analytics integrated.

\- QA manual verification checklist for that phase.

At the end:

\- A consolidated QA checklist and rollback plan.

Prioritized Todo list the agent should produce before coding

This is the expected shape of the Todo list (what Cascade should output in Plan Mode). Cascade’s own docs describe that it will generate and maintain a Todo list for complex tasks, and you can ask it to update the plan as it learns new information. 



Priority	Todo item	Phase	Outputs	Test gate

1	Map current navigation + identify insertion points for Today Hub + Logger entry	Foundation	Plan + file list + flag plan	lint + unit + build

2	Implement Today Hub UI shell behind flag	Foundation	Screen + routing + basic state	lint + unit

3	Implement 3-step logger (offline-first write)	Foundation	Logger component + local persistence	unit + integration

4	Add reward feedback (haptic + splash) with reduced-motion fallback	Foundation	Motion util integration + fallback	unit + snapshot

5	Add analytics events for logging	Foundation	Event wiring + schema validation	unit

6	Add pantry data model + storage timeline logic (guideline framing)	Differentiation	Pantry store + migrations	unit + data tests

7	Add Today Hub “Use-Soon” cards + recipe suggestion linking	Differentiation	Cards + linking	unit + UI tests

8	Add templates (save/reuse) + template\_used analytics	Premium	Template flow	unit

9	Add streak engine with grace + safe messaging + user controls	Premium	Streak state + UI	unit + UI tests

10	Add photo-to-draft flow (in-context permission request)	Acceleration	Draft object + UX	unit + manual QA

11	Add AI suggestion flow behind flag + transparency UI	Acceleration	AI entrypoint + controls	unit + privacy checks

12	Expand liquid-flow motion system within budgets	Acceleration	Motion polish + perf check	perf smoke + UI tests



Analytics instrumentation and privacy rules

Event schema table

These schemas are designed to be implementable across mobile/web stacks, and to respect your explicit privacy constraints (“no PII, no ingredient text”). They also support offline-first logging by including offline flags and latency buckets.



Event name	When fired	Required fields	Optional fields	Prohibited fields

first\_log\_started	User enters logger first time	install\_id, session\_id, ts, surface, logger\_variant	ab\_bucket, flag\_state	Any ingredient text, notes, user name, email

first\_log\_completed	First successful log persisted locally	install\_id, session\_id, ts, log\_type, volume\_bucket, juice\_type\_enum, offline	time\_bucket, latency\_ms\_bucket	Raw volume, freeform labels, recipe names

log\_completed	Any successful log	session\_id, ts, log\_id\_opaque, log\_type, volume\_bucket, offline	source (manual/template/pantry), time\_bucket	Ingredient list, photo bytes, notes

pantry\_item\_added	Pantry item created	session\_id, ts, item\_id\_opaque, category\_enum, storage\_enum	days\_to\_quality\_end\_bucket, add\_method	Brand names, receipt text, exact purchase location

pantry\_use\_suggested	“Use soon” suggestion shown	session\_id, ts, item\_id\_opaque, days\_remaining\_bucket, surface	suggestion\_count, recipe\_suggestion\_method	Item nickname text if user-entered

reminder\_opt\_in\_shown	Reminder permission/value prompt shown	session\_id, ts, surface, reason	notif\_permission\_status\_before	OS-level identifiers

reminder\_opt\_in\_accepted	User accepts reminder setup	session\_id, ts, schedule\_bucket, notif\_permission\_status\_after	reminder\_type	Exact notification copy

streak\_started	Streak begins (first consecutive day)	session\_id, ts, streak\_len (=1)	streak\_mode	Shaming copy, health diagnosis

streak\_broken	Streak break recorded	session\_id, ts, streak\_len, grace\_used	break\_context (no log / disabled)	User mood, medical info

template\_used	Template logging used	session\_id, ts, template\_id\_opaque, log\_type	template\_category\_enum	Template name text

photo\_draft\_created	Draft created from photo flow	session\_id, ts, draft\_id\_opaque, offline	camera\_permission\_status	Photo payload, EXIF location

ai\_recipe\_suggested	AI suggestion shown	session\_id, ts, ai\_feature\_flag, suggestion\_type\_enum	rank\_position, model\_family	Prompt text, user notes, ingredient text



Privacy rules and enforcement strategy

No PII: never log user names, emails, phone numbers, address data, or precise location.

No ingredient text in analytics: only log enums/buckets and opaque IDs, as explicitly required by your roadmap and master prompt constraints.

No photos in analytics: only draft IDs and coarse permission/status metadata.

To enforce this, the prompt requires a single analytics wrapper (@file:ANALYTICS\_SCHEMA) and prohibits adding ad hoc tracking elsewhere (so you can centrally lint/assert field allowlists).



Accessibility and reduced-motion specification

Accessibility acceptance criteria grounded in standards

Use WCAG 2.2 as the baseline standard and apply it to mobile/software as recommended by W3C’s WCAG2ICT guidance. 

&nbsp;Key criteria relevant to your app’s UI system and this prompt:



Contrast (text): WCAG contrast minimum requirements support readability for users with low vision and impaired contrast perception. 

Non-text contrast: UI components and states should achieve at least 3:1 contrast against adjacent colors in software contexts. 

Keyboard accessibility: systems should be operable via keyboard without traps (especially relevant if you ship desktop/web). 

Reduced-motion spec grounded in Apple APIs and guidance

The reduced-motion implementation is rooted in:



Apple’s API signal for Reduce Motion (isReduceMotionEnabled) 

SwiftUI’s environment signal (accessibilityReduceMotion) for building motion-aware views 

Apple’s Human Interface Guidelines on motion (avoid frequent/ gratuitous motion; rely on subtle system motion) 

Apple’s App Store reduced-motion evaluation guidance listing motion triggers (multi-axis motion, vortex, depth simulation, auto-advancing carousels) that should be disabled or altered when Reduce Motion is enabled 

Motion durations, easing, and fallbacks grounded in Material guidance

Material’s motion guidance provides implementable defaults for duration and easing. 

&nbsp;Its “Movement” guidance includes concrete mobile transition durations such as ~225ms for entering and ~195ms for exiting independent elements, and ~300ms for temporary leave/return patterns—useful as defaults even in non-Material design systems. 



Reduced-motion behaviors per animation family

Animation family	Motion ON (default)	Reduced motion ON (fallback)

Log “splash” confirmation	195–300ms transform + opacity + haptic; no looping	150–200ms crossfade to success state + haptic; no morphing

Blob/shape morph background	Only on key moments; never continuous animator on Today Hub	Static background; optional subtle gradient shift disabled

Tab/screen transitions	Standard curve transform; keep under 300ms typical 

Crossfade; no parallax; no depth simulation 

Progress “liquid fill”	Animate fill to new level; short, predictable easing 

Jump to final state or crossfade between levels



QA, risks, and rollback strategy

QA checklist by roadmap phase

This checklist is designed to be pasted into PR descriptions and used for manual verification after each checkpoint.



Phase	Manual verification steps	Expected result

Foundation	Launch → Today Hub loads fast; tap “Log Juice” → 3-step path completes in seconds; disable network and repeat	Logging works offline; persists locally; success feedback respects reduced motion and does not stutter

Foundation	Trigger first log and subsequent logs	Correct analytics events fire: first\_log\_started, first\_log\_completed, log\_completed

Differentiation	Add pantry item → verify “Use soon” card appears when threshold reached	Card appears with guideline framing; can tap into recipe suggestions

Differentiation	Link recipe to log + undo decrement	Pantry decrement is reversible and consistent

Premium	Create template → use template → verify logging speed	template\_used fires; template path is 1–2 taps faster than manual

Premium	Streak begins → miss a day → grace mechanic	No shaming; streak recovery path works; analytics streak\_started/streak\_broken correct

Acceleration	Photo-to-draft flow → permission requested only on entering flow	No camera permission at launch; photo\_draft\_created fires without photo payload

Acceleration	AI suggestions toggled on/off → verify transparency UI	No sensitive text in analytics; ai\_recipe\_suggested includes safe enums only



Risks and mitigations

Risk	Why it matters	Mitigation encoded in the prompt

Large-scope regressions	Multi-feature refactors can break navigation, state, storage	Small commits + phase checkpoints + test gates 

Analytics privacy leakage	Ingredient text/notes/photos are sensitive and can violate privacy expectations	Central event wrapper + prohibited fields list + schema allowlisting

Permission backlash	Prompting permissions too early reduces trust	“No new permissions at launch”; request in-context per Android guidance 

Motion-related discomfort	Multi-axis / depth effects can trigger discomfort	Apple Reduce Motion APIs and evaluation guidance; crossfade fallbacks 

Pantry “expiration” misuse	Overstating expiration can be inaccurate/misleading	Use USDA FoodKeeper framing: “guidelines,” not hard rules 

Performance/jank	Continuous heavy animated backgrounds can degrade UX and battery	Animation budgets + reduced-motion + avoid constant 60fps loops



Rollback strategy with named checkpoints and test gates

Because Cascade supports named checkpoints and reverts, each phase ends with a revertable “safe point.” 

&nbsp;The master prompt formalizes:



cp\_pre\_juicing\_refactor

cp\_foundation\_done

cp\_differentiation\_done

cp\_premium\_done

cp\_acceleration\_done

Rollback rule: if phase tests fail or QA reveals a critical blocker, revert to the prior checkpoint, disable flags, and resume with a smaller scoped plan.



Model strategy and Arena validation plan

Recommended model strategy inside Windsurf

Windsurf’s model documentation emphasizes you can switch models within Cascade and that availability is best confirmed in the IDE model selector. 

&nbsp;Additionally, Windsurf enterprise admin guidance explicitly references enabling models such as SWE‑1.5 and Claude Opus 4.6, indicating these are part of its supported model set (subject to plan and availability). 



A practical strategy for this roadmap:



Planning (Plan Mode): choose the “smartest / largest-context” model you have access to (often a top-tier reasoning model) to produce a careful Todo plan, risk list, and flag strategy. This aligns with Cascade’s plan-driven approach for longer tasks. 

Execution (Code Mode): choose a strong coding-focused model (often a fast, high-quality coding model) for incremental component refactors and wiring analytics, while keeping the plan fixed and gated by tests. 

Debugging / tricky regressions: temporarily switch back to the planning-grade model to reason through state/storage issues or cross-cutting architecture changes, then return to the execution model.

Arena test plan to validate model choice

Arena Mode exists specifically to compare model performance in your environment rather than relying on generalized benchmarks. Windsurf’s docs describe running multiple Cascade instances in parallel; each model runs in a separate session and receives its own worktree for isolation. 



Use this short Arena plan:



Arena prompt A (Planning quality):

“Given @repo:ROOT\_REPO, produce the phase-grouped Todo list with flags, risks, and test gates. No code changes.”

Score models on: completeness, flag discipline, risk identification, and test gating.

Arena prompt B (Execution quality):

“Implement Foundation logger UI shell behind flags + wire analytics events; keep PR small.”

Score models on: minimal diffs, adherence to privacy rules, passing tests, and clean abstractions.

Arena prompt C (A11y + reduced-motion rigor):

“Add reduced-motion fallbacks and verify accessibility labels and contrast rules.”

Score models on: correct fallback implementation and no regressions.

Pick the winner per category or adopt a paired strategy (one model for planning, one for execution).



Key reference URLs

text

Copy

Windsurf Cascade (planning, todos, checkpoints, reverts, .codeiumignore):

https://docs.windsurf.com/windsurf/cascade/cascade



Windsurf Arena Mode (parallel runs + worktrees):

https://docs.windsurf.com/windsurf/cascade/arena



Windsurf changelog (Arena Mode overview / workflow):

https://windsurf.com/changelog



Material motion (why motion; duration \& easing; movement timing examples):

https://m1.material.io/motion/material-motion.html

https://m1.material.io/motion/duration-easing.html

https://m1.material.io/motion/movement.html



WCAG 2.2 standard + software/mobile guidance:

https://www.w3.org/TR/WCAG22/

https://www.w3.org/TR/wcag2ict-22/

https://www.w3.org/TR/wcag2mobile-22/



Apple Reduce Motion APIs and guidance:

https://developer.apple.com/documentation/uikit/uiaccessibility/isreducemotionenabled

https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion

https://developer.apple.com/design/human-interface-guidelines/motion

https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/



USDA FoodKeeper (storage timelines + notifications concept; guideline framing):

https://www.usda.gov/about-usda/news/blog/new-usda-foodkeeper-app-your-new-tool-smart-food-storage

https://www.usda.gov/about-usda/news/press-releases/2015/04/02/usda-announces-foodkeeper-application-advance-world-health-day

https://apps.apple.com/us/app/usda-foodkeeper/id978186100

