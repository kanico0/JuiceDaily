Juicing App Implementation PRD (Revised with Verbiage)

This PRD contains the specific "copy" (verbiage) to be used by Cascade.

Module	Headline	Educational Content / Script	Data Points

Onboarding	Your Nutrition, Reimagined	"Welcome! Whether you’re here to boost your energy, support your heart, or simply add more color to your diet, you’ve come to the right place. Think of juicing as a 'circuit breaker' for old habits—a way to flood your system with what we call 'liquid gold'."	

Bioavailability	Unlock "Liquid Gold"	"Why juice? While whole produce is great for fiber, juicing extracts vitamins and minerals into a highly bioavailable form. Because the liquid is separated from the bulk, your body can absorb Vitamin C even more efficiently than from a supplement—achieving an absorption rate up to 25.3% higher. It’s a direct infusion of plant-based energy!"	25.3% Higher AUC

Methodology	Not All Juice is Equal	"Method matters. Cold-pressed (masticating) juicers use slow pressure to preserve up to 94% of live enzymes for up to 72 hours. High-speed centrifugal juicers use fast blades that create heat, which can destroy delicate B-vitamins and enzymes like amylase and protease."	94% vs 31% Enzyme Retention

Sourcing	Quality In, Quality Out	"What's on your fruit matters as much as what's in it. Choosing organic reduces pesticide exposure by 4x. Plus, organic plants often produce 20-40% more antioxidants as they defend themselves naturally in the field."	4x less pesticide; 20-40% more antioxidants

Mindset	Progress, Not Perfection	"In this app, we don't believe in 'failing' a diet. If you miss a day, that’s okay! We focus on cumulative progress. Every green juice you drink is a win for your gut microbiome and your long-term vitality. Just aim for 'one juice a day' to start building a habit that sticks."	66 days to form habit \[3, 4]

Safety	Safety \& Disclosures	"This information is for educational purposes only and does not substitute for professional medical advice. Consult your doctor before starting a juice plan. Fresh juice is raw and unpasteurized; wash all produce for 20 seconds. If you are pregnant or have a weakened immune system, consult a professional."	41°F Storage limit

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Part 2: The Cascade Implementation Prompt

Copy and paste the following into Windsurf Cascade:

"I need to implement a new 'Educational Module' into my juicing app. This module must use the specific verbiage and scientific data points provided below. Use a 'Progressive Disclosure' pattern where users must interact with each screen to unlock the next.

1\. Module UI Requirements:

•	Implement a 5-screen interactive 'Novice Journey' using the 'Headline' and 'Script' verbiage from the provided PRD.

•	Screen 1 (Welcome): Use the 'Nutrition Reimagined' text.

•	Screen 2 (Bioavailability): Use the 'Unlock Liquid Gold' text and highlight the '25.3% higher absorption' stat.

•	Screen 3 (Method): Use the 'Not All Juice is Equal' text. Include a visual comparison showing 94% enzyme retention (Cold-Press) vs 31% (Centrifugal).

•	Screen 4 (Sourcing): Use the 'Quality In, Quality Out' text. Highlight the '4x less pesticide' and '20-40% more antioxidants' stats.

•	Screen 5 (Habit): Use the 'Progress, Not Perfection' text. Build a 'Cumulative Progress' dashboard that tracks 'Total Lbs Juiced' rather than daily streaks.

2\. Implement 'Traffic Light' Logic:

•	Green: Ingredient is Organic, Cold-pressed, and Low-sugar.

•	Orange: Conventional (Clean 15), Centrifugal-made.

•	Red: Non-washed, 'Dirty Dozen' conventional, or high-sugar.

3\. Add Persistent Safety \& Legal Footer:

•	Display the 'Safety \& Disclosures' script at the bottom of every educational page. Ensure it is written in plain language but distinct as a legal requirement.

4\. Gamification Logic:

•	Award 'Knowledge XP' for every screen read. Completing all 5 screens should unlock a 'Beginner Enthusiast' badge and the 'Reboot Recipe' library.

Please use the provided PRD table as the primary source of truth for all text and data. Start by creating the components for the 'Novice Journey' screens."





