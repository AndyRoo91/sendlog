# sendlog — V1 (Tick Sheet) handoff spec

A coaching doc for the agent working on the codebase. Hi-fi mockups live in
`docs/mockup/index.html` (the "V1 · Tick Sheet — deep dive" section is the canonical
reference). Read this top-to-bottom before opening a PR.

---

## TL;DR

- **Decision locked:** the new session form is the **Tick Sheet** mechanic.
  Two taps to log a send (grade chip → style ribbon), plus a one-tap repeat
  path via a "Recents" strip on top.
- **Aesthetic:** American-traditional tattoo flash crossed with Mambo
  psychedelic. Heavy black outlines, flat fills, banner ribbons, starbursts,
  cream paper background. No dark theme. No generic dashboard chrome.
- **Device priority:** phone first, desktop secondary (responsive — desktop
  is a centred phone-width column with the same layout).
- **Scope of this pass:** the session-logging path only. Dashboard,
  Sessions list, Progress, etc. keep their current functionality but adopt
  the new tokens. Charts and edit screens come in later passes.

---

## States the agent must build

Six screens in `docs/mockup/index.html` under "V1 · Tick Sheet — deep dive", in build
order:

1. **A — Recommended (Tick Sheet + Recents)** — the main screen. Land here
   after starting a session. Includes the one-tap recents strip.
2. **B — Empty / first send** — same screen on session start (no recents,
   no tallies). Includes the "Start timer" affordance.
3. **C — Lead mode** — BOULDER/LEAD toggle switches grade set (Ewbank by
   default; YDS/French chip-toggle below the route-name input). Adds an
   optional route name input and a falls stepper.
4. **D — Detail sheet** — modal opened by long-pressing a chip OR tapping
   a feed entry. Lets the user add route name, attempts, notes, photo.
   Not required for the ≤5s path — power-edit only.
5. **E — After-commit confirmation** — the satisfying micro-moment.
   ~600ms overlay with green tick, mustard rays, ink-banner reading
   "V6 · SEND ✓". Then dismisses; the tally on the chip increments and a
   new feed entry slides in.
6. **F — End-of-session summary** — the "tick certificate" card.
   Date, location, duration, sends, flash count, top grade, per-grade
   bar pyramid, free-text reflection.

---

## Visual system (canonical)

### Palette (CSS vars in `docs/mockup/styles.css`)

| Token       | Hex       | Use                                                      |
| ----------- | --------- | -------------------------------------------------------- |
| `--paper`   | `#f0e4c8` | App background. Always with a halftone dot overlay.      |
| `--cream`   | `#fbf0d4` | Card / surface fills sitting on paper.                   |
| `--ink`     | `#1a1612` | All outlines, primary text, all-purpose dark.            |
| `--ink-2`   | `#3a2e22` | Secondary text.                                          |
| `--red`     | `#d63a2a` | FALL · destructive · "burn" emphasis.                    |
| `--mustard` | `#e8a83b` | FLASH · highlight · selection ray bg · active tally.     |
| `--sea`     | `#2d8a73` | SEND · success.                                          |
| `--cobalt`  | `#2a4a8a` | WORK (in-progress project) · grade-system toggle.        |
| `--pink`    | `#d9558a` | Charts/Progress page accents. Not used in the form.      |

**Send-type colour mapping is strict** — re-use the same colour for the
same state everywhere (chip backgrounds, feed entries, charts later).

Note: the previous backend uses `redpoint / working / top-rope / onsight`
for `send_type`. Map them in the UI as:
- `flash` & `onsight` → FLASH (mustard)
- `redpoint` & sent-on-toprope → SEND (sea)
- `working` → WORK (cobalt)
- (new) `fall` → FALL (red) — see "Backend changes" below.

### Type

| Token              | Family               | Use                                         |
| ------------------ | -------------------- | ------------------------------------------- |
| `--font-display`   | **Alfa Slab One**    | Grades, headlines, big numbers.             |
| `--font-banner`    | **Bungee**           | Ribbons, all-caps labels, tab bar.          |
| `--font-body`      | **Outfit**           | Body copy, anything non-display.            |
| `--font-hand`      | **Permanent Marker** | Notes, route names, callouts.               |

All Google Fonts; loaded once via `@import` at top of stylesheet.

Minimum body size 14px. Grade numerals never below 28px on a phone (chip)
or 22px (feed entry).

### Outline & depth

- Default outline weight: **2.5px** (`--b`). Heavy outline: **3.5px** (`--bw`).
- **No CSS box-shadow blur.** Replace all soft shadows with **flat offset
  shadows**, e.g. `box-shadow: 3px 3px 0 var(--ink)`. The offset colour can
  be ink, red, or mustard depending on emphasis.
- **No rounded corners** above 4px. Cards/chips are right-angled. The only
  curves are circles (tally badges, success tick) and ribbon end-notches.
- **No gradients.** Flat fills only. The conic-rays starburst is the one
  acceptable "almost-gradient".

### Ornaments

- `<Ribbon>` — coloured bar with notched/triangular end-tails. Used for
  section labels and ★ headers.
- `<StarBurst>` — 10-point star drawn in SVG. Used for the
  selected-grade halo.
- `<Ray>` — 16-wedge conic burst. Used behind big focal moments
  (after-commit overlay).
- Halftone dots — `radial-gradient(circle at 1px 1px, rgba(...) 1px, 0) /
  14px 14px` over `--paper`.
- Slight rotation — cards may sit at ±0.5–2°. Apply with `transform:
  rotate(...)`. Never more than 3°.

### Iconography

Monoline, 2.5px stroke, square caps & joins. See `docs/mockup/system.jsx#ICON` for the
home / log / charts / list set. No emoji anywhere except inside
user-entered notes.

---

## Components to port from the mockup into the codebase

All live in `docs/mockup/system.jsx` in this project; copy and re-implement in TS:

| Component         | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `<Ribbon>`        | Header banner with notched tails. Colours via prop.          |
| `<StarBurst>`     | 10-pt SVG selection star. Sizes & colour via prop.           |
| `<Ray>`           | 16-wedge SVG conic burst. Used behind focal elements.        |
| `<GradeChip>`     | Outlined grade rectangle, optional tally badge.              |
| `<SessionStrip>`  | Sticky top header w/ location + elapsed timer (ink bg).      |
| `<TabBar>`        | Phone bottom tab bar (ink bg, mustard active).               |
| `<FeedEntry>`     | Logged-tick chip used in the session feed strip.             |
| `<StyleRibbonRow>`| The 4-up FLASH/SEND/WORK/FALL ribbon grid.                   |
| `<ModeToggle>`    | The BOULDER/LEAD top toggle (sticky between sessions).       |
| `<RecentChip>`    | The one-tap-repeat chip for the recents strip.               |

Create a `src/ui/` folder for these. Each should be its own file with a
named export. Storybook them on a private `/design` route during dev.

---

## Logging flow — the exact interaction

### Happy path (≤5s, two taps)

1. User taps a grade chip → chip gets a red **StarBurst** halo + slight
   scale; selection persists for ~6 seconds.
2. User taps a style ribbon (FLASH/SEND/WORK/FALL) → entry is committed
   optimistically.
3. The After-commit overlay (E) shows for ~600ms, then dismisses.
4. The tapped chip's tally badge increments. New `<FeedEntry>` slides in
   from the right of the feed row.
5. Selection clears. Ready for next send.

### Recents (one tap, even faster)

- The top of the screen shows up to 2 `<RecentChip>` cards representing
  the user's recent grade+style combos this session.
- Tap one → logs another instance of that combo immediately (no style
  pick). Same overlay flash + tally + feed update.
- The chips re-sort by recency; oldest combo evicts when a 3rd appears.

### Power-edit (long-press OR tap-feed-entry)

- Long-press a grade chip OR tap a feed entry → opens the **Detail sheet
  (D)**. Includes:
  - Route name (optional, hand-written font)
  - Attempts (stepper, default 1)
  - Style ribbon (pre-selected if editing)
  - Notes (free text)
  - Photo upload (uses existing `PhotoUploader` component)
  - "Save tick" commit button
- Sheet should also offer a "Delete tick" affordance when editing an
  existing entry.

### Lead-mode differences (C)

- BOULDER/LEAD toggle at top.
- LEAD shows an optional route-name input above the grade pyramid (slot
  for "Kachoong" etc).
- Grade-system chip toggle (EWBANK / YDS / FRENCH) sits below the name.
  Default = Ewbank for AU users; remember last choice in localStorage.
- The style ribbon also exposes a **falls** stepper (the FALL button stays
  but falls counter lives in the same row — see mockup C).

### Empty / first send (B)

- No recents strip.
- "START TIMER" affordance in the top strip if the user hasn't tapped
  start yet. (Auto-start on first tick, but let them start manually too.)
- Handwritten encouragement at the bottom in lieu of feed entries.

### After-commit overlay (E)

- 600ms overlay, dismissable on tap.
- Green tick disc in the middle (sea bg, ink outline, cream tick stroke).
- Mustard rays behind it.
- Below: ink banner with "V6 · SEND ✓" (display font).
- Tiny handwritten "burned it!" / "send city!" / "filthy!" — randomise
  from a short pool of 6–8 phrases.

### End-of-session summary (F)

- Triggered by an end-session affordance at the top of the form
  (replaces the START TIMER button once timer is running).
- The "tick certificate" card shows: date, location, duration, total
  sends, flash count, top grade, per-grade horizontal-bar pyramid.
- Free-text reflection at the bottom on mustard bg (the existing
  session-level `notes` field).
- SHARE / DONE actions at the bottom. SHARE renders the cert as a
  capturable image (use `html-to-image`).

---

## Code-level changes

### Frontend

1. **Replace `src/index.css` entirely.** Adopt all tokens from this
   project's `docs/mockup/styles.css`. Body bg = `--paper` + halftone overlay.
   Body color = `--ink`. No dark theme.
2. **Delete the old `.card` / `.btn-*` / `.tag-*` classes.** Replace
   `.card` usages with the new `<GradeChip>`/`<RecentChip>` or chunky
   outlined divs as appropriate. Replace `.btn-primary` with `<Ribbon>`
   (for nav) or `.chunky` outlined buttons (for in-form actions).
3. **Replace the `🧗 ClimbLog` wordmark** with
   `<Ribbon color="var(--red)">★ SENDLOG ★</Ribbon>`. The repo is
   already named "sendlog" — embrace it. Drop the emoji.
4. **Add the new `<TabBar>`** at the bottom of all phone-width views.
   Order: HOME · SESSIONS · LOG IT · CHARTS. LOG IT is the centre tab
   and deep-links to the in-progress session form (or to "new session"
   if none is in progress).
5. **Build the new logging route** at `/sessions/:id/quick` (or fold
   into `/sessions/:id` as the default view; keep
   `/sessions/:id/edit` for full power-edit).
6. **Touch targets** — every primary action ≥ 56px. Style ribbons
   should be ~64px tall on phone. Chips ~64px square.
7. **Animations** — keep it cheap: a CSS class with
   `transform: scale(1.08)` + a 200ms transition for chip-tap; the
   After-commit overlay is a portal that fades in for 100ms, holds for
   400ms, fades out for 100ms.

### Backend (`backend/main.py`, `backend/models.py`, `backend/schemas.py`)

Minimal changes:

- **Add timer state to `Session`:** new fields `started_at:
  datetime | null`, `ended_at: datetime | null`. Migration: nullable, no
  default. Endpoints `POST /api/sessions/{id}/start` and `.../end`.
  Auto-start on first tick if not already started.
- **Add `fall` to the send_type enum** for both `LimitBoulderEntry` and
  `LeadRouteEntry`. Boulders currently only have a `sent: bool` — replace
  with `send_type: str` matching the lead entry's enum (`flash`,
  `redpoint` (= SEND), `working` (= WORK), `fall`). Data migration:
  `sent=True → 'redpoint'`, `sent=False → 'working'` (best guess).
- **Add `GET /api/sessions/{id}/recent_combos`** returning the top 4
  (grade+send_type) tuples by recency for that session.
  Response shape: `[{kind, grade, grade_system, send_type, count,
  last_logged_at}]`.

### Routing changes (`src/App.tsx`)

- Default route after `POST /api/sessions`: redirect to
  `/sessions/:id` which now renders the quick form (state A).
- LOG IT tab in the bottom bar is context-aware — opens the in-progress
  session, or creates one if none exists.

### Visual debt to retire

- `:root` colour tokens in current `index.css` — delete, replace.
- The 🧗 emoji wordmark — replace as above.
- All `border-radius: var(--radius)` (`10px`) — drop to 0 (or 2px max
  on tiny pills).
- `box-shadow` with blur — replace with flat 3px/4px offset shadows.
- Inline-style `color: '#7880a0'` etc. — kill the inline styles, use
  the new tokens via classes.

---

## Build order (suggested 3 PRs)

### PR 1 — Visual system + container

- Adopt `docs/mockup/styles.css` tokens. Replace `index.css`.
- Build the 9 reusable components in `src/ui/`.
- Storybook page at `/design` listing all of them.
- Replace the wordmark and nav across the app.
- No functional changes to logging.
- **DoD:** dashboard + sessions list + progress all render in the new
  visual system. No regressions.

### PR 2 — The Tick Sheet (states A + B + E)

- New `/sessions/:id` view = the Tick Sheet form.
- Boulder mode only (LEAD mode lands in PR 3).
- Two-tap logging works end-to-end with optimistic UI.
- After-commit overlay (E).
- Empty state (B) — START TIMER + handwritten copy.
- Recents strip — call `GET /sessions/:id/recent_combos`, render `<= 2`
  cards, +1 logs another.
- **DoD:** the ≤5s logging path is measurably real (record a 5-tick
  session in under 30s on a phone).

### PR 3 — LEAD mode + Detail sheet + Summary (C + D + F)

- LEAD toggle, route-name input, grade-system chip toggle, falls
  stepper.
- Long-press / tap-feed-entry opens the Detail sheet (D).
- "End session" action on top strip → Summary (F).
- Share-as-image via html-to-image.
- **DoD:** full V1 spec shipped. Old `/sessions/:id/edit` remains for
  power-edit; you can rip it later.

### Out of scope for these 3 PRs

- Dashboard restyle beyond tokens.
- Progress page restyle beyond tokens.
- Photo gallery view.
- Warmup / fingerboard / strength logging — leave on the existing
  `/sessions/:id/edit` page.
- Offline support. Voice. Haptics.
- Multi-user / accounts.

---

## Open questions (answer before PR 3)

1. **Grade systems UI.** Currently the data model stores
   `grade_system` per lead-route entry. Should the chip-toggle change
   the value stored on each new entry, or be a "display" setting that
   also normalises old entries? *Recommendation:* per-entry, no
   normalisation.
2. **First-send-of-session and timer.** Should `started_at` auto-set on
   first tick, or require explicit START TIMER tap? *Recommendation:*
   auto-set on first tick; allow manual start so warmup can be logged
   pre-climb.
3. **Tally semantics.** A tally chip on V6 currently counts *all* V6
   ticks this session, regardless of style. Do you want it to reflect
   sends only (FLASH+SEND) and exclude WORK/FALL? *Recommendation:*
   count everything; the colour of the most-recent style on the chip
   communicates the latest outcome.
4. **Photos per tick vs per route.** Schema currently allows photos on
   either lead or boulder entries via `EntryPhoto.entry_type`. Keep as
   per-tick (matches the mockup detail sheet).
5. **The 5 sec target.** I designed for 2 taps + ~1s overlay. Verify on
   a real device — if the overlay feels sluggish, cut it to 350ms.

---

## Definition of done for V1

- Two-tap log path works on phone. Recents strip works one-tap.
- All 6 states (A–F) are reachable from the new session view.
- Visual system is consistent across dashboard, sessions list, and
  progress (tokens only — no layout rework on those).
- Lighthouse mobile a11y ≥ 95.
- No regressions in `/sessions/:id/edit` (the legacy long form).
- Backend timer + recent_combos endpoint shipped + tested.

---

*Visual reference: open `docs/mockup/index.html` and drag/scroll through the canvas.
The "V1 · Tick Sheet — deep dive" section is the source of truth for
this PR.*
