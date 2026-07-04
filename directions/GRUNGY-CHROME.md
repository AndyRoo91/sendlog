# Grungy chrome — rough / hand-drawn line work

*Scoped 2026-07. A design idea, not yet built. Goal: make the UI line work and
text boxes look off-kilter and hand-drawn — rough edges, slightly wonky — to
match the grimy early-MTV feel the buddy (Crag) already has.*

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

Related: [[ROADMAP]] Phase R (usability polish) and the Crag design pass (PR #73:
ground shadow, sticker halo, build tiers).
