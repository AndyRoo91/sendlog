# sendlog — design review

A fresh pass over the spec, the canonical mockups in `docs/mockup/`, and the
shipped frontend in `frontend/src/`. Sections are ordered roughly by impact.

---

## TL;DR

The Tick Sheet logging path is real and it works — 2-tap commit, optimistic
update, tally bump, recents refresh. The visual system, however, dies at the
door of the form: Dashboard, Sessions list, and Progress are still wearing the
pre-redesign skin, which makes the app feel like two products bolted together.
There are also a handful of UX papercuts and small bugs on the form itself
worth fixing before PR 3 lands.

---

## 1. The biggest gap — the visual system stops at `/sessions/:id`

SPEC PR 1 was explicit: retokenise dashboard / sessions / progress, replace the
wordmark, no functional changes. The wordmark replacement landed. Nothing else
did.

- **`Dashboard.tsx`** is still `h1` + `.card` + `📍 Projects`. The "drop the
  emoji" line from SPEC didn't get applied. Three identical stat cards in a
  row, plain numerals, no Ribbon header, no halftone, no flat offset shadow on
  a single element. It reads as a stock React boilerplate dashboard with new
  colour tokens — not as part of the same app as the form.
- **`Progress.tsx`** is closer (chart strokes are tokenised) but the
  *containers* are still `.card`. No Ribbon for the page title, no banner type
  for chart headings. The charts feel imported from a different product.
- **`SessionList.tsx`** — presumably the same story; worth re-skinning in the
  same pass.

This is the single most impactful thing to fix. Until "dashboard + sessions list
+ progress all render in the new visual system" is actually true, the form is
an island.

Concretely:

- Page titles: `<Ribbon color="var(--red)">★ DASHBOARD ★</Ribbon>` etc., not
  `<h1>`.
- Stat cards: `.card-flat` with `offset-ink`, display font for the number,
  banner font for the label. Tilt the "This month" card -1° and the "Total"
  card +0.5° to introduce the rotation rhythm the system promises.
- Halftone overlay on body background, not just on `.paper`. `.paper-plain`
  (used by TickSheet) is flat — pick one and apply consistently.
- Kill the 📍 emoji on the Projects card; replace with a small `<Ribbon>` or a
  proper outline icon from `ui/icons.tsx`.

## 2. Drift from the mockup on the form itself

Items the spec/mockup specified that the implementation didn't pick up.

- **No card rotation anywhere.** The mockup called for ±0.5–2° tilt as a
  signature ornament. The only place it lands is the empty-state handwritten
  text and the Detail sheet. Recents, feed entries, the start-timer chip, the
  end-session pill should all sit at small varied angles. Without that, the
  heavy outlines just read as "chunky form", not "flash sheet".
- **Halftone dots are missing from the form.** TickSheet uses `.paper-plain`
  (flat cream) rather than `.paper` (cream + halftone). The mockup had dots
  everywhere.
- **No randomised after-commit phrase.** SPEC called for a pool of 6–8
  ("burned it!" / "filthy!" / "send city!"). Worth checking
  `AfterCommitOverlay.tsx` — if it isn't wired, this is the cheapest dopamine
  win in the product.
- **Top wordmark + SessionStrip stacks two headers on the form.** The
  `★ SENDLOG ★` ribbon is glued to the top of every route via `BrandBar` in
  `App.tsx`. On the logging path it pushes the timer strip down ~50px for no
  reason. The brand ribbon belongs on lobby screens (Dashboard, Sessions,
  Progress) only; the form should own its own top edge.
- **End-session affordance.** SPEC said end-of-session "replaces the START
  TIMER button". It's instead a 11px mustard pill wedged into the bottom-right
  of `SessionStrip` via `position: absolute`. It's hard to see and feels like
  an afterthought next to the START TIMER's full-sized red chunky button. The
  running-state strip should carry an equally weighted "● END SESSION" on the
  right side, at the same scale as the start state.

## 3. UX bugs on the form

Real, not nitpicks.

- **Long-press doesn't behave the way you think.** TickSheet wires
  `onContextMenu` to open the detail sheet. On mobile that's unreliable — iOS
  Safari fires a callout menu *and* the handler; Android Chrome's behaviour
  varies by version. Replace with a proper pointerdown timer (~450ms) and a
  small movement-cancel threshold. The mockup leans on long-press; it has to
  feel solid.
- **6-second selection timeout silently drops state.** Tap V6, rack up,
  return after 8s and tap SEND — nothing visible happens. The style row has
  gone dim, the StarBurst is gone, and the user wonders what they did wrong.
  Either don't time out, or make the StarBurst a visible 6s countdown (a
  thinning ring), or warn on tap-after-timeout ("tap a grade first"). This is
  effectively SPEC open question #5.
- **Recents in lead mode are detached from the route-name input.** If the user
  types "Kachoong", logs a WORK, then taps the V24/WORK recent — neither the
  recent's previous `route_name` nor the current input value propagate. Same
  combo, but the next tick is unnamed. Two fixes: (a) have `recent_combos`
  carry `last_route_name`, and (b) prefer the current input value over the
  recent's stored name when both exist.
- **Empty-state copy is too aggressive.** "empty session / go climb
  something" shows whenever the *current mode* has no entries. Toggle
  boulder → lead mid-session with sends in boulder and you're told the
  session is empty. Differentiate: "no leads yet" vs "no ticks yet".
- **Boulder grade window is fixed V0–V11.** A V11 climber sees V0 every time;
  the only path to log V13 is the Detail sheet (and recents, if any exist).
  The lead path adapts via `leadGradeWindow(gradeSystem)` — boulder should
  similarly slide. Suggested default: window of 8 centred on the user's
  last-3-sessions max, with a small "show all" affordance to expand. Right now
  there's a UI ceiling that contradicts the data model.
- **TabBar overlaps feed.** Fixed 84px bar, content padded only 24px. The last
  1–2 feed rows slide under the tab bar. Pad bottom to ~110px or use
  `env(safe-area-inset-bottom)`.
- **Red-on-red conflict.** Selecting a grade flips the "pick a style" ribbon
  to red. The style row right below has a red FALL button. There's a moment
  where two competing red ink-blocks share attention. The mockup kept the
  active ribbon mustard for this reason — flip back.

## 4. Smaller polish

- `routeName` clears on commit but only via the StyleRibbonRow path —
  `RecentChip` commits don't clear it. Trivial fix.
- `falls` state is alive in boulder mode too (harmless, but dead). Move into a
  lead-only branch.
- `selectTimer.current` isn't cleared on unmount → potential stale setState if
  the user navigates away mid-selection.
- The "✦ END" pill uses `box-shadow: 2px 2px 0 var(--red)` against
  `var(--ink)` background — the red reads as a bug glow more than a
  registration shadow. Mustard-on-red is closer to the system.
- The 12-chip 4×3 grid renders even when only 3 grades have tallies; half the
  surface is dead air on every session. A sliding window (see above) fixes
  this for free.
- Detail-sheet trigger via context menu also fires the chip's `selectGrade`.
  Long-pressing a chip both opens the sheet *and* leaves the chip selected for
  6s. Stop-propagation needed.

## 5. Things working well — keep

Worth protecting while the above gets fixed.

- 2-tap commit, optimistic add, tally bump and recents refresh in one flow —
  clean.
- Centralised style/send-type mapping (`STYLE_BY_ID`, `sendTypeToStyle`) keeps
  the boulder/lead enum mapping in one place. Good call.
- The Summary "tick certificate" is faithful to the mockup, captureable for
  share, and the textarea-on-mustard handwritten reflection is the best
  surviving piece of the aesthetic.
- TickSheet fits LEAD route-name + grade-system chips + falls counter on one
  screen without feeling cramped.
- Persisting `mode` and `gradeSystem` to localStorage is the right default.

## 6. Suggested PR order from here

1. **Visual-system spread.** Reskin Dashboard, SessionList, Progress to use
   Ribbon / halftone / offset-shadow / display-type. Highest perceived-quality
   lift per hour of work.
2. **Form fixes pass.** Proper long-press, sliding boulder window, lead
   recents carry `route_name`, end-session affordance equal in weight to
   start, halftone on the form, ribbon stays mustard on select, tab-bar
   bottom padding.
3. **Surprise pool.** Wire the 6–8 randomised after-commit phrases. Add a
   "new max this session" overlay variant. Tiny effort, big mood.
