# Grungy chrome — rough / hand-drawn line work

*Scoped 2026-07. Tiers 1–3 shipped in PR #77 (2026-07-04). Goal: make the UI
line work and text boxes look off-kilter and hand-drawn — rough edges, slightly
wonky — to match the grimy early-MTV feel the buddy (Crag) already has.*

## Status

- **Tier 1 shipped** — wonky border-radius on `button` / `.chunky` / `.tag`
- **Tier 2 shipped** — rough SVG border-images on `card-flat` / `.card`
  (3 seeds cycled via `nth-child`; coloured-border cards fall back to wonk)
- **Tier 3 shipped** — `ui/GrungeDefs` mounts global `#chrome-boil` /
  `#chrome-boil-still` filters; `.boil-frame` puts a boiling border-only
  pseudo-element on the ConfirmSheet dialog and the login card
- **Wave 2 shipped** — cohesion sweep (PRs #79 #80 #81); W8 chart fills parked
- **Wave 3 shipped** — print-authenticity pass (2026-07-05): P1+P6 Ribbon
  slice (PR #87), P6 hero cards + P7 props (PR #88), P2 overprint + P5
  stepped motion (PR #89), P3 duotone photos + P4 ghost watermarks (PR #90),
  P8 voice sweep (this PR). All eight critique points landed.

## Why it's tractable

Almost all the line work runs through a handful of shared classes in
`frontend/src/index.css`:

- `card-flat` — the base card
- `offset-ink` — the hard offset drop-shadow (`box-shadow: Npx Npx 0 var(--ink)`)
- `chunky`, `.btn-primary` / `.btn-secondary` / `.btn-danger`
- `--b` (2.5px) / `--bw` (3.5px) outline weights

So a roughness pass edits those class definitions and propagates everywhere —
cards, buttons, inputs, chips, the Ribbon, the tab bar, ConfirmSheet — instead
of touching every component. That centralisation is the whole reason this is
cheap at the low end.

Precedent already exists: `frontend/src/ui/Crag.tsx` uses SVG `feTurbulence` +
`feDisplacementMap` ("the boil") and a local `GRIME` palette. The visual
language and colours are established; this extends them to the chrome.

## The one hard rule

**Roughen borders and backgrounds only — never the text or input fields.** The
moment you displace type it goes blurry and readability tanks. Same for the
value inside inputs.

## Three tiers (by cost)

### Tier 1 — wonky-box CSS hack · ~half a day · ~70% of the vibe
- Asymmetric `border-radius` trick, e.g.
  `border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px`, plus a bit of
  randomised `rotate()`, applied to `card-flat` / `.btn-*`.
- Instantly reads as a "wobbly hand-drawn rectangle." No new assets, no perf cost.
- **Limitation:** wobbles the *corners*; edges stay dead straight — reads
  "wonky" more than "pencil-rough."
- **Repetition risk:** one radius value across a page looks like a pattern.
  Cycle 3–4 variants via `:nth-child` or a small random class.
- Low-risk and reversible — do this first to see if "wonky" alone scratches the
  itch before investing in textures.

### Tier 2 — rough border texture · ~1–2 days · real pencil edges
- Keep text crisp: the border can't be a CSS `border`. Use `border-image` with a
  hand-drawn border texture (SVG or PNG), defined once on the shared classes.
- The signature hard-offset shadow is a separate `box-shadow`, so it keeps
  working. A crisp shadow under a rough border looks deliberate — like a sticker.
- **Risks:** `border-image` corners can look stretched/repetitive (mitigate with
  2–3 variants); be careful on text inputs so they don't look broken or lose
  their focus affordance.

### Tier 3 — SVG turbulence on borders · most authentic · most plumbing
- Reuse Crag's boil: apply a turbulence-displaced *stroke* to a border-only
  pseudo-element (transparent fill) so content underneath stays sharp. Could
  even animate.
- **Why probably overkill for chrome:** filtering fluid HTML boxes is awkward
  (turbulence wants known dimensions), and animated boil on every card is a perf
  and visual-noise problem. Keep the boil for the character.

## Recommendation

Start with Tier 1 on the card/button classes — low-risk, reversible, immediate
read on whether "wonky" is enough before committing to producing border
textures. Then decide on Tier 2 if it needs true rough edges. Skip Tier 3 unless
a specific hero element wants it.

## Wave 2 — cohesion pass (audited 2026-07-04)

Tiers 1–3 covered the shared classes, so anything styled *inline* or drawn as
its own SVG is still machine-crisp and now reads as the odd one out. Inventory
of what's left, ordered by payoff ÷ cost.

### W1 · `.wonk` utility for inline-styled chips — low cost, big cohesion
Lots of interactive boxes are `role="button"` divs with inline borders, so the
tier-1 `button`/`.chunky` selectors never touch them:
- login mode tabs (LoginPage), mood buttons (Summary), reaction chips
  (FeedPage `ReactionRow`), achievement wall tiles (Dashboard)
- `GradeChip` — the big bordered squares all over the Tick Sheet, very visible
- `RecentChip`, feed `UsernameChip`, BrandBar settings chip, Onboarding rows

Fix: expose the tier-1 radii as utility classes (`.wonk`, `.wonk-2`) and add
the className at each site. No layout risk; pure cohesion sweep.

### W2 · Ribbon — the flagship, still crisp — medium cost
The brand element (BrandBar + every page title) has dead-straight 2px top and
bottom rules and razor SVG notch tails. Highest-value single target. Approach:
give the two `<polygon>` tails a turbulence-displaced stroke (they're already
SVG — add `filter="url(#chrome-boil-still)"`), and swap the straight
top/bottom borders for a thin rough-rule border-image (same data-URI trick as
tier 2, 1-D). Keep the fill flat so the banner text stays punchy.

### W3 · Torn ink slabs: TabBar + SessionStrip — medium cost, always visible
The two full-bleed ink bars (bottom tabs, tick-sheet header) have laser
top/bottom edges. A torn-paper edge sells the zine feel on every screen:
`::before` strip with a turbulence-displaced edge (SVG mask or a rough-edge
data-URI as `mask-image`). Do the TabBar's top edge and SessionStrip's bottom
edge only — one rough edge per slab is enough.

### W4 · Hand-drawn rules — low cost
Straight/dashed dividers read draughtsman, not sketchbook:
- `2px dashed var(--ink-2)` dividers (GymsPage, Progress, SessionList,
  TickSheet ×2)
- Summary certificate's solid stat-grid rules (`borderTop/Bottom` + column
  separators)

Fix: a `.rough-rule` utility — thin wobbly-line SVG data-URI tiled with
`border-image` (or `background` on a 0-height div). 2 seeds so stacked rules
don't repeat. Note: Summary is captured by html-to-image for SHARE — data-URI
backgrounds serialize fine (no external fetch), so the export keeps the look.

### W5 · Floating pills: Toast + OfflineStatus — low cost
Both are fixed-position pills with crisp borders. Toast is a hero moment
(errors, UNDO) → give it `.boil-frame` like ConfirmSheet (border goes
transparent, frame boils). OfflineStatus is smaller and transient → tier-1
wonk radius is enough. Watch: Toast's inner UNDO button has a cream border on
ink — leave it; it already reads like a sticker.

### W6 · Celebration overlays — low-medium cost
`AfterCommitOverlay` and `AchievementOverlay` are peak-energy moments but
their geometry is pristine: perfect tick circle, machine-cut `Ray`/`StarBurst`
polygons, straight banner chip. All three are trivial to roughen since the
boil filters are already global:
- `Ray` / `StarBurst`: add `filter="url(#chrome-boil-still)"` to the polygon
  (they're decorative SVG in-document, so the global defs are reachable)
- the ink banner chip → `.boil-frame`
- the tick circle: pseudo-element border + boil, same recipe as ConfirmSheet
LockScreen's PIN card is the same recipe if it wants in.

### W7 · Paper grain — low cost, global glue
One static `feTurbulence` grain (photocopy noise, ~3–4% opacity ink) layered
into the `.paper` background stack next to the existing halftone dot. Makes
the sharp-vs-rough contrast feel intentional everywhere. Static texture, no
perf cost. Tune opacity down on `paper-plain` (login/lock) so text contrast
holds.

### W8 · Charts — mostly leave alone — optional, medium cost
Recharts surfaces (grids, axes, bars, lines) are the sharpest thing left —
**by design** (see principles). The card frames around them are already rough
from tier 2. If more texture is wanted later: give bar/area *fills* a grain or
hatch SVG `pattern` (no displacement, no blur), keep every axis, label, line
and dot crisp. Do last, if at all.

## Wave 3 — print-authenticity pass (style critique, 2026-07-05)

Waves 1–2 made the line work hand-drawn. An external style critique argues the
next jump is from *"styled"* toward *"actually printed"* — the tells of cheap
spot-colour screenprinting, not just rough edges. Eight items below, mapped to
this codebase. Two of them **deliberately bend earlier rules** — called out
inline so we do it on purpose, not by accident.

Critic's own priority for the next cycle: **P1 + P3 + P6** move it furthest.
They offered to mock P1 + P6 on a Ribbon and a stat card on canvas first so we
can eyeball the jump before wiring — worth taking them up on it before P1.

### P1 · Misregistration — coloured off-plate duplicate · low cost, top ROI
Cheap CMYK/spot printing never lines up. Render hero **display type** a second
time in a spot colour (`--red` or `--cobalt`), offset 2–3px, *behind* the ink —
same idea as `.display-shadow` (index.css:111) but a coloured plate that's
clearly off-register.
- Cheapest impl: a `.misreg` utility using `text-shadow: 2px 3px 0 var(--red)`
  (or a `::before` clone with `content: attr(data-text)` if we want the plate
  independently displaceable). Text stays crisp — only a colour copy shifts.
- Targets: Ribbon titles (`ui/Ribbon.tsx`), big stat numerals (Dashboard /
  Summary), the "SEND"/certificate headline. Hero only — never body or inputs.
- **Rule check:** the one hard rule bans *displacing* type (it blurs). This
  doesn't displace or blur — both layers stay sharp; it's a registration
  offset. Compatible in spirit; keep it off small text where the double-image
  hurts legibility.

### P2 · Overprint multiply where colours overlap · medium cost, cross-cutting
When two spot inks overlap they multiply into a dirty third colour
(yellow+blue→murky green) — the Mambo signature. Anywhere two *coloured*
elements cross, blend instead of stacking opaque.
- `mix-blend-mode: multiply` on the top coloured layer: mustard chip on a sea
  card, coloured offset shadows, overlapping ribbons.
- Catch: `box-shadow` can't take a blend mode — the offsets (`.offset-red`
  etc., index.css:105) would need to become a real pseudo-element layer to
  multiply. Scope to a few high-overlap spots first; don't globally convert.
- **Watch:** multiply over the paper/grain darkens; verify contrast, and keep
  it off anything text sits directly on.

### P3 · Halftone / duotone user photos · medium cost, big cohesion
Raw phone photos read as another app. Push gym/route/session photos through a
duotone (ink + one spot) + scaled-up halftone so they live in the print world.
- Prefer a **display-time** SVG/CSS filter (`feColorMatrix` duotone +
  `feImage`/pattern halftone) over baking it into `backend/images.py` — the
  pipeline is destructive and originals should stay true-colour.
- **Rule check + hard exclusion:** "Sharp on purpose" currently lists photos as
  user content to leave alone. P3 reverses that *for vibe photos only*. The
  **topo / colour-pick overlay must stay full-colour and sharp** — hold-colour
  identification depends on it (`RouteDetail` topo, hold_color). Exclude topos
  explicitly.

### P4 · Ghost watermark display type · low cost
Zine layouts float a giant faded word behind content. Put a huge
`--font-shade`/`--font-display` word — section name, a grade ("V7"), "SENDLOG"
— at ~4% ink, bleeding off-edge, behind each page.
- Absolutely-positioned, `pointer-events: none`, `z-index` behind content,
  parent `overflow: hidden`. Fills dead space with hierarchy instead of filler.
- **Watch:** keep ≤4% so body text contrast holds; one word per page, not per
  card.

### P5 · Stepped motion everywhere · low cost, cross-cutting
Crag's `steps()` boil is right; the UI transitions aren't. Smooth ease reads
SaaS. Convert page/chip/overlay motion to `steps(2–3)`.
- Audit: `sendlog-picker-up`, opacity fades, the ~0.15s chart fade, any
  `transition: … ease`. Precedent already in-file: `.mv-*` use `steps(2/3)`
  (index.css:401–411).
- **Watch:** respect the existing `prefers-reduced-motion` guards; stepping a
  disabled animation is moot but keep the media queries intact.

### P6 · Line-weight hierarchy · low-medium cost
Everything is `--b` (2.5) or `--bw` (3.5) — uniform, so it reads "bordered
boxes" not "drawn." Traditional flash has a thick outer keyline and thin
interior lines.
- Add a heavier `--bx` (~5–6px) outer keyline for hero elements: Ribbon, the
  active/running card, the tick certificate. Keep dividers/interior rules thin.
- Cheap because it's a token + a few hero selectors; propagates like the others.

### P7 · Lean on the zine props already built · low cost, additive
`.tape` (index.css:122) exists and is barely used. Physical-artifact cues make
the flat UI feel photographed.
- Tape corners on the certificate + pinned/hero cards; a rubber-stamp "SENT"
  thwack on the Summary; staple marks at section tops; a coffee-ring on the
  Dashboard. Small SVG/CSS assets, drop-in.

### P8 · Voice audit — microcopy · low cost, non-visual
The look is ~60% visual, ~40% attitude. Sweep every loading / error / empty /
button / toast string for the Crag voice (irreverent climber slang — "SEND IT",
"BURN", "filthy", "cooked"). "Loading…" on Progress is a vibe leak. Establish
one voice; Crag's existing lines ("DIALLED IN", the dashboard quips) are the
reference. Copy-only, can land anytime.

## Sharp on purpose (don't grunge these)

- **Text and inputs** — the original hard rule, unchanged
- **Data marks** — chart lines/bars/axes, heatmap cells, weekly-goal rings,
  Summary pyramid bars, topo pins: displacing these misrepresents the data;
  legibility is the payoff of keeping them clean against grungy chrome
- **Focus rings** (`:focus-visible` cobalt) — a11y affordance, keep crisp
- **Hard-offset shadows** — the established sticker language; crisp shadow
  under rough frame is the signature combo
- **The colour-pick overlay and topo photos** — hold-colour identification
  depends on true colour and sharpness (note: P3 duotones *other* user photos,
  but topos stay exempt)

## Sequencing

W1 + W4 + W5 fit one small PR (utilities + className sweep). W2 and W3 are a
second PR (new SVG edge assets). W6 + W7 a third. W8 only if the appetite is
still there after living with the rest. Each step is additive CSS/className —
same easy rollback story as tiers 1–3.

**Wave 3** — waves 1–2 are shipped, so this is the live queue:
- *PR A (highest ROI, the critic's pick):* **P1 misregistration** + **P6
  keyline hierarchy** — both are token + hero-selector edits, small and very
  visible. Optionally have the mockups done first. **P7 zine props** rides along
  cheaply (tape/stamp are additive).
- *PR B (cross-cutting global CSS):* **P2 overprint multiply** + **P5 stepped
  motion** — each is a sweep with contrast/reduced-motion risks, so keep them
  off the hero PR and test in isolation.
- *PR C (needs a filter asset + care):* **P3 duotone photos** (topos excluded)
  + **P4 ghost watermark type**.
- **P8 voice audit** is copy-only — fold into whichever PR touches the relevant
  screen, or do as a standalone sweep anytime.

Everything stays additive CSS/className/copy — same rollback story as before.

Related: [[ROADMAP]] Phase R (usability polish) and the Crag design pass (PR #73:
ground shadow, sticker halo, build tiers).
