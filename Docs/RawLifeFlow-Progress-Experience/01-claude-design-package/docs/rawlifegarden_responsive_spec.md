# RawLife Garden — Responsive Specification

Both master canvases (`0 0 1200 900` full, `0 0 1200 540` compact) scale
proportionally as a unit via react-native-svg's `width`/`height` props with
`preserveAspectRatio="xMidYMid meet"` — the artwork itself is never
recomposed per breakpoint, only which optional detail groups render and how
native text wraps around it changes. Nothing in this system requires
horizontal scrolling at any supported width.

## Breakpoint behavior

### Below 360dp width
- Full Garden: render at 100% of available width; because everything scales
  as one unit, all seven beds remain proportionally identical to larger
  breakpoints, just smaller in absolute size.
- **Details safe to hide** at this width: `bed_[key]_blossoms` (subtle,
  small-scale elements that add little at this size) and, if profiling shows
  it's worth it, one of the two `flourishing_layer` groups per bed collapsed
  into a single combined pass — this is a *performance* optimization, not a
  visual requirement, and should only be applied if real-device testing
  shows a need.
- Compact card: reduce the number of simultaneously-legible bed icons
  gracefully isn't necessary — because the card is one composition scaled as
  a whole, all seven remain visible, just smaller. If a future audit finds
  any single bed silhouette stops reading below ~360dp, the fallback is to
  increase that bed's `COMPACT_SCALE` value slightly (see design system §4)
  rather than to hide it.
- Touch regions on the full screen remain at their documented canvas-space
  size; because RN-SVG touch handling can be attached to the scaled group,
  regions stay proportionally tappable — implementation should still verify
  the smallest region (Herb & Booster Bed, 340×220 canvas units) resolves to
  at least 44×44pt at the smallest supported render width, and pad the
  invisible hit-testing view if not.

### 360–412dp width (standard phone)
- Reference width. All groups render as authored; no hidden details.
- This is the width the master files were designed and demo'd against.

### Large phones (e.g. Samsung Galaxy S22 Ultra)
- Garden renders larger in absolute terms but at the same proportions —
  recommend capping the full-screen Garden's max rendered width (e.g., via a
  `maxWidth` container) rather than letting it stretch edge-to-edge on very
  wide viewports, so bed spacing doesn't feel sparse. A sensible cap is
  roughly 480–520pt of rendered width, center-aligned, with the native
  background color extending to the edges.
- Compact card: similarly capped, or allowed to stretch slightly wider than
  360dp reference with extra breathing room in the safe text zones rather
  than stretching the illustration itself disproportionately.

### Large system fonts / Android display scaling
- Nothing in the SVG resizes with font scale (there is no text in the SVG).
  The only responsive concern is **native text overflow** in the safe zones:
  - Compact card "next-discovery message" zone (§4 of the design system doc)
    should be allotted a minimum of 2 lines at the largest supported font
    scale before truncating, since it's the most content-dense zone at
    small card size.
  - Full-screen info panel zones should be treated as height-flexible native
    content below the fixed-height illustration, not as fixed-height
    overlays — this avoids clipping at large font scales entirely.
  - No safe-zone text should ever overlap illustration content even at
    maximum font scale; because zones sit either fully outside the
    illustration bounds or over guaranteed-plain background (see design
    system §3–4), this holds automatically as long as native layout code
    respects the documented zone boundaries.

## Summary table

| Range | Illustration change | Text/zone change |
|---|---|---|
| <360dp | Optional: hide blossoms / merge flourishing layers if profiling requires it | Tightest wrapping; verify touch-target minimums |
| 360–412dp | None — reference size | Reference layout |
| Large phones | Optional max-width cap, centered | More breathing room, not larger illustration |
| Large system fonts | None | Flexible-height native zones, 2-line minimum for the discovery message |
| Android display scaling | None (vector, scales cleanly) | Same as above |

No breakpoint requires re-authoring the SVGs themselves — this is the
practical payoff of building the Garden as one proportionally-scaling
composition rather than a set of breakpoint-specific layouts.
