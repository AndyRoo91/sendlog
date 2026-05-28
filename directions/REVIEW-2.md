# sendlog — design review (round 2)

Follow-up pass after the round-1 review (`REVIEW.md`) was actioned. Sections
ordered: what landed → what's still open from round 1 → new issues surfaced
this pass.

---

## What landed well — protect this

- **Visual system spread.** Dashboard, Progress, SessionList all wear the new
  skin. Ribbons as page titles, `card-flat offset-ink` everywhere, stat cards
  tilted ±0.5–1°, the Projects card on ink with mustard offset is the strongest
  single component in the dashboard. It now feels like one product.
- **`useLongPress` is properly built.** Pointer events, 8px movement
  threshold, `didFire()` to suppress the click. `GradeChipSlot` consumes it
  cleanly. Re-usable on FeedEntry / RecentChip later if long-press-to-edit ever
  comes up.
- **Visible countdown ring on selection.** Combined with the StarBurst halo,
  the 6s window now has a clear visual countdown — the "tap a grade, get
  nothing" failure mode is resolved.
- **`boulderGradeWindow` + `showAllBoulder`.** Data-driven window, max sits
  ~2 chips from the top, fresh users get V0–V7. "↓ SHOW ALL 17" expansion is
  the right escape hatch.
- **New-max detection in `AfterCommitOverlay`.** Computed pre-append, separate
  phrase pool, 12 standard phrases + 6 new-max phrases wired. Nice touch.
- **Recent chip route-name carry.** `carriedName = routeName.trim() ||
  c.last_route_name || null` — exactly the precedence requested.
- **Bottom padding 110px on TickSheet.** Feed no longer slides under the tab
  bar.
- **Empty-state per-mode copy.** "no leads yet" / "no boulders yet" with the
  red ink "go climb something" — small fix, big improvement.
- **Card tilts via deterministic table.** `CARD_TILTS` cycling is the right
  call — random would re-shuffle on every render. Same tilt every time per
  index, so a card doesn't jitter when its neighbours change.

## Still open from round 1

Two items from `REVIEW.md` didn't land.

### 1. `★ SENDLOG ★` BrandBar still renders on the logging path

`App.tsx` only hides the brand bar for `/design`. On `/sessions/:id` the user
sees **wordmark → SessionStrip → ModeToggle** stacked, which costs ~50px of
vertical real-estate the form badly needs on a phone.

```tsx
const isTickSheet = /^\/sessions\/\d+$/.test(pathname);
const hideBrand = isDesign || isTickSheet;
```

Same logic could apply to `Summary` (`/sessions/:id/summary`) — the
certificate is its own self-contained page-as-artifact.

### 2. TickSheet still uses `.paper-plain`

Body has halftone, `.paper` has halftone, but the form is the one place dots
would best reinforce the flash-sheet feel and it's deliberately flat. Decide:
either halftone is a lobby-only signal (then make that intentional and
consistent), or flip TickSheet to `.paper`.

## New issues this pass surfaced

The kind of thing only visible *after* the bigger items are fixed.

### 1. `isNewMax` fires on the very first tick of every fresh session

`currentMax` reduces from `-1`, any logged grade has `gradeOrder ≥ 0`, so the
first tick is always "NEW MAX!". The overlay should only celebrate a *true*
new max — i.e. the session needs at least one prior entry in that mode/system
before `isNewMax` can be true. One-liner:

```ts
const isNewMax = currentMax >= 0 && newGradeOrder > currentMax;
```

(Comparing against the user's all-time max across sessions would give a true
PB overlay — different feature.)

### 2. `leadGradeWindow` is hardcoded, not data-driven

Boulder slides; lead is fixed at Ewbank 16–27 / YDS 5.10a–5.12d / French
6a–7c+. An Ewbank-28 climber sees an off-screen ceiling and there's no "show
all" affordance. Mirror the boulder treatment: compute recent max from
`entries`, window of ~12 centred ~2 from the top, plus a "↓ SHOW ALL" toggle
for the rare beyond-the-window case.

### 3. Recents don't display grade system

In lead mode, both recents are filtered to `kind === mode` but a V-system
mismatch is hidden — if the user is in Ewbank and the recent is YDS, tapping
it logs a YDS entry without the user knowing. Either (a) filter recents to
the active `grade_system` too, or (b) badge the chip with a tiny `EWB` /
`YDS` / `FR` tag so the system is legible before tap.

### 4. "THEN — HOW'D IT GO?" header sits above dimmed controls

`StyleRibbonRow` is dimmed to 0.45 opacity when nothing's selected, but the
header above is at full opacity. The header invites action while the controls
are non-interactive. Either dim the header too, or change the copy when
nothing's selected ("TAP A GRADE FIRST").

### 5. Lead "BURNS" vs Progress "ticks" terminology drift

The feed says "BURNS" for lead entries; the Volume chart on Progress says
"ticks per session" and Send Rate says "sends per session". Inconsistent — a
"burn" implies a no-send go, a "tick" implies any logged attempt, a "send" is
success. Pick a lexicon and stick to it. Suggested:

- **Ticks** = anything logged
- **Sends** = subset of ticks (flash / redpoint / onsight)
- **Burn** = colloquial alias for a tick on a lead route, kept in TickSheet
  for flavour only

Use "ticks" in Progress titles.

### 6. Start/End buttons use inline `style` instead of `.btn-*` classes

They land in the right place visually, but they're not part of the system —
if `.btn-primary`'s shadow direction or border weight ever changes, these
won't follow. Suggest a `.btn-start` / `.btn-end` class pair, or just reuse
`.btn-primary` and `.btn-danger` (red on cream).

### 7. `AfterCommitOverlay` hold is now 400ms

Total on-screen time is ~500ms (100ms fade in + 400ms hold + 100ms fade
out). At full speed it reads as a flash, not a celebration; the dopamine hit
from the phrase + new-max may not register before it's gone. Push back to
~700–800ms hold. Test by logging 5 in a row and seeing if you actually *read*
the phrases.

### 8. Inconsistent offset weights inside Dashboard

The recent-sessions row uses `boxShadow: "2px 2px 0 var(--ink)"` inline
instead of `offset-ink` (which is `4px 4px`). Same component class
(`card-flat`) wearing two different offset weights in the same view (stat
cards 4px, recent rows 2px). Pick one. 4px reads more "flash sheet"; 2px
reads more "list item" — both defensible, just be deliberate.

### 9. Dashboard stat numerals feel small

30px Alfa Slab One sitting under a "★ DASHBOARD ★" ribbon and next to the
Projects card's 18px display type. Try 40–44px — Alfa Slab One wants to be
loud, and three large stats is exactly the dial-mood the system reaches for.

### 10. Progress page lacks section ribbons

Top of page has the page ribbon, then nine identical-looking chart cards. The
mockup vocabulary supports section ribbons (LEAD, BOULDER, TRAINING). Worth
grouping into 3 ribboned sections — faster to scan and reinforces the
system.

## Suggested next move

If picking a single most-impactful change for round 3, it's **fix the
BrandBar on TickSheet/Summary, and make `leadGradeWindow` data-driven** — the
form is the heart of the product, and those two together give back real
estate + correctness on the path users live in. Progress section ribbons and
the `isNewMax` false-positive are second-priority polish.
