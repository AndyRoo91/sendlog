# sendlog — Roadmap

Sizing: **S** = small, **M** = medium, **L** = large.

---

## ✅ Completed

### Phase A — Hardening
- [x] API test suite (pytest + httpx), CI runs on PRs
- [x] Error toasts (`useToast` hook, 3.5s auto-dismiss)
- [x] `/healthz` endpoint + Docker HEALTHCHECK
- [x] Drop Alembic, hand-rolled migrations documented
- [x] JSON export (`GET /api/export`) + import (`POST /api/import`)

### Phase B — Photos & projects
- [x] Server-side resize + thumbnails, EXIF auto-rotate, HEIC→JPEG (Pillow)
- [x] Lightbox for any photo
- [x] Multiple photos per route/entry; drag-to-reposition topo pins
- [x] Boulder projects + pins (reuses Route machinery, `kind=boulder`)

### Phase C — Logging depth
- [x] Onsight + top-rope as first-class styles (quick-log + detail sheet)
- [x] Session date editing (inline in SessionView)
- [x] Search/filter on sessions list and projects list (client-side)
- [x] Favourite locations autocomplete (`GET /api/locations`, datalist)

### Phase D — Analytics
- [x] Boulder send pyramid (V-scale, flash + send stacked bar)
- [x] Lead send pyramid (Ewbank, onsight/flash/redpoint stacked bar)
- [x] Lead progression chart (onsight / flash / redpoint over time)
- [x] Boulder max grade over time
- [x] Session volume (ticks per session bar chart)
- [x] Send rate (% sends per session line chart)
- [x] Falls trend (avg falls/route per session line chart)
- [x] Fingerboard max weight + strength max weight charts

### Phase E — Platform
- [x] PWA: installable, service worker (Workbox), offline shell cache
- [x] Accessibility pass — focus-visible ring, role=button, aria-labels, keyboard nav
- [x] Code-splitting — Progress page lazy-loaded (recharts in own chunk)

---

## ✅ Shipped (F–L)

### Phase F — Multi-user support ✅ *(shipped #32, #33)*

| Item | Size |
|------|------|
| `users` table + DB migration | S |
| Password hashing (bcrypt via passlib) | S |
| `POST /api/auth/register` + `POST /api/auth/login` (httpOnly session cookie) | S |
| `GET /api/auth/me` + `POST /api/auth/logout` | S |
| Auth middleware — all routes require login, 401 if no session | M |
| Scope all data queries to `user_id` | M |
| Login/register pages in frontend | M |
| PIN auth gate (4-digit, lightweight single-user mode) | M |

---

### Phase G — Quick wins ✅ *(shipped #28)*

| Item | Notes |
|------|-------|
| Haptic feedback on commit | `navigator.vibrate(50)` on SAVE TICK |
| Days-since-last-session on Dashboard | *"X days since your last climb"* nudge |
| Route name autocomplete | `<datalist>` from past lead route names — same pattern as locations |
| Swipe-to-delete feed entries | Swipe left on a FeedEntry to reveal delete, skip the DetailSheet |

---

### Phase H — Achievements ✅ *(shipped #29)*

| Item | Notes |
|------|-------|
| Achievement definitions + unlock detection | Checked on each save |
| Achievements to implement | First send, grade milestones ("First V7!", "First 25!"), 5-session streak, flash machine (3 flashes in one session), project slayer (send after 5+ attempts), century club (100 ticks), The Grind (working same project 3 sessions in a row), crimp lord (10 fingerboard sessions), send it Sundays |
| Unlock notification | Special `AfterCommitOverlay` variant — bigger, different phrases |
| Achievement wall | Dashboard section or page showing earned badges with unlock dates |
| Easter egg: log a V16/grade 38 | Special overlay: *"sure about that?"* 🤨 |

---

### Phase I — Stats enhancements ✅ *(shipped #30)*

| Item | Notes |
|------|-------|
| Mood tag on session close | 1–5 emoji scale after END SESSION; stored on session |
| Mood vs send-rate correlation chart | On Progress page |
| Crag/gym breakdown | Which locations produce your best sessions |
| Attempts-to-send histogram | How many attempts does it typically take you |
| Personal best timeline | Lead PB + boulder PB on same chart over time |

---

### Phase J — Polish & easter eggs ✅ *(shipped #31)*

| Item | Notes |
|------|-------|
| Animated grade chip on new max | Bounce/shake animation when a PB is hit in the feed |
| Session quality score | Auto 1–5 stars from send rate + falls, shown on session card |
| Midnight sender easter egg | `started_at` after 23:00 → special commit phrase 🦉 |
| Konami code on dashboard | All ★ → 🦆 for the session |
| **Canvas hold colour-picker** *(M)* | Tap a hold in a gym topo photo → sample the RGB pixel at that point → scan the full image for pixels within a configurable colour-distance tolerance → draw dark ink outlines around all matching regions. Helps distinguish colour-coded routes when multiple sets share the wall. All client-side (Canvas API, no backend changes). UI: tolerance slider (default ~30 RGB Euclidean distance) so the climber can tighten/loosen the match for tricky lighting. Tech: `canvas.getContext("2d")`, `getImageData` pixel scan, connected-component or dilation pass to build outlines, rendered as an `<svg>` overlay on the photo. |

---

### Phase K — Climbing Buddy ✅ *(shipped #34, #44, #45, #46, #47; "Crag" the gecko)*

A tamagotchi-style companion that lives on the Dashboard and reacts to how you're climbing. Rig ported from `design_handoff_climbing_buddy/`; mood + build computed server-side via `GET /api/buddy`.

**States** — each a `CragState` pose driven by the buddy mood engine:

| State | Triggered by | Status |
|-------|-------------|--------|
| 😤 Primed / psyched | In-form session, no new ground | ✅ |
| 💪 Buff / gnarly | Build tier from all-time hardest send | ✅ (physique evolution) |
| 😴 Detrained / couch | 7+ days since last session | ✅ |
| 😵 Cooked | High falls, low send rate | ✅ |
| 🏋️ Training mode | Fingerboard/strength logged | ✅ |
| 🎉 Stoked | New PB | ✅ |
| 😬 Nervous | Attempted a grade above PB without sending | ✅ |
| 🤸 Shake it off | Came off, go again | ✅ (used on Summary) |
| 😪 Resting | 4–6 day rest window | ✅ |
| 🤌 Focused | Long session (90+ min) | ✅ *(#47)* |
| 🎉 Stoked (achievement) | Achievement unlocked | ✅ *(#47)* |

**Evolution:** ✅ scrawny → jacked as all-time max grade climbs (build tier 0–3, broader shoulders + graduating six-pack); persists through rest days, bloated poses stay soft.

**Art style:** grungy early-MTV cel — bold ink outlines, limited GRIME palette, turbulence "boil", `prefers-reduced-motion` aware. Parametric SVG puppet rig (pose table), no redraw per state.

**Tech approach:** state computed from existing session data via `GET /api/buddy` (no new DB columns).

---

### Phase L — QOL & friction reduction ✅ *(shipped #39–#43)*

The daily-use surface is `TickSheet`; most of these cut friction there or close gaps around it.

| Item | Size | Notes |
|------|------|-------|
| **Offline commit queue** ✅ | L | `commit()` is optimistic but a network failure *loses the tick* (toast + rollback). Crags have no signal — this is the real-world risk. Queue failed `addLead`/`addBoulder` payloads in IndexedDB/localStorage, flush on reconnect, show a "N pending sync" chip. Pairs with the existing service worker. |
| **Undo last tick from toast** ✅ | S | Post-commit toast gets an "Undo" action → deletes the just-created entry. Today you must scroll the feed and swipe-delete the right chip. |
| **Selection timeout fix** ✅ | S | `SELECTION_MS = 6000` deselects your grade if you pause mid-log. Drop the auto-deselect; clear only on commit or on selecting another grade. |
| **Resume in-progress session** ✅ | S | A session can be `started_at` with no `ended_at`. Surface a "● SESSION RUNNING · 47 min" banner on Dashboard → resume. |
| **Auto-link ticks to Projects** ✅ | M | When a lead `route_name` matches an existing Route, set `route_id` automatically (schema already supports it). Unifies project high-points with session ticks. |
| **Rest timer between burns** ✅ | M | Tappable 3–5 min countdown on the lead view — climbing-native, reuses elapsed-timer + haptics infra. |
| **One-handed reachability** ✅ | M | Tap-grade (top) → reach to style row (bottom) is a thumb stretch each tick. Shipped the sticky-style-bar approach: selecting a grade surfaces a `StylePicker` tray (style + lead falls) pinned in the thumb zone above the tab bar. |
| **Confirm END SESSION when entries exist** ✅ | S | Stray tap currently ends + navigates to summary. |
| **Pull-to-refresh on lists** ✅ | S | Mobile expectation on Dashboard/lists. |

---

## 🔜 Carry-over

Small items unblocked by earlier phases but not yet built:

- **Per-user buddy customisation** *(M)* — avatar/name picker for Crag. Unblocked now that Phase F (multi-user) + K (buddy) are done. Pick a palette/skin variant + a name; store on `users` (or a `user_prefs` row); render in `Crag.tsx` via the existing pose table.

PIN auth shipped in Phase F2 (#33) — no longer deferred.

---

## 🧭 Proposed next phases (M–Q)

Phases A–L are shipped. The five directions below expand the earlier "new phase, TBD"
note into scoped work. They're **independent** — pick by appetite — but there are natural
pairings (sharing ↔ year-in-review; gym-sets ↔ the Phase J canvas hold-picker; training
plans ↔ the buddy rest ladder). Rough priority order: **M → N → O** give the most value for
the least surface area; **P → Q** are larger bets.

Guardrails carried from prior phases: derive from existing session data where possible
(the buddy engine added *zero* DB columns), keep new charts in the lazy `recharts` chunk,
all data scoped to `user_id`, sharing strictly opt-in / per-item.

---

### Phase M — Data-viz depth *(M)*

Phases D & I gave us the chart *library*; this phase makes it **explorable** instead of a
static wall of graphs. Mostly frontend — recharts + existing `/api/sessions` data — with at
most one aggregation endpoint.

| Item | Size | Notes |
|------|------|-------|
| **Global date-range filter** | S | A range chip (`6w · 6mo · 1y · all`) on the Progress page that drives every chart. Today each chart shows all-time; comparing "this season vs last" is impossible. |
| **Contribution heatmap** | M | GitHub-style calendar grid, one cell per day, intensity = tick volume (or max grade). The single best at-a-glance "am I consistent" view; reads great in the grungy palette. |
| **Drill-down on the send pyramids** | S | Tap a pyramid bar → sheet listing those specific sends (route name, date, session link). Charts are currently read-only dead-ends. |
| **Volume vs intensity scatter** | S | One dot per session: x = tick count, y = hardest grade. Surfaces "junk volume" vs "quality" days. |
| **Training-load trend (acute:chronic)** | M | Rolling 7-day load ÷ 28-day load — the climbing-native overtraining/injury-risk signal. Ties into the buddy's rest ladder (a spiking ratio could feed a future "ease off" mood). |
| **Max-grade projection line** | S | Linear/LOESS trend overlay on the existing max-grade-over-time charts → a "where you're trending" dotted extension. |

---

### Phase N — Stats "Year in Review" *(M)*

A Spotify-Wrapped-style annual (and monthly) recap. High delight-per-effort because it
**reuses Crag's art and the grungy MTV cel style** — story cards, not a dashboard. Pure
read-model over existing data; pairs naturally with Phase O (sharing the cards).

| Item | Size | Notes |
|------|------|-------|
| **Recap aggregation endpoint** | M | `GET /api/recap?year=2026` → totals: sessions, ticks, hardest boulder + lead, biggest single day, top crag, new grades unlocked, achievements earned, longest streak, send-rate, days-on-rock. All derivable from `sessions` + entries. |
| **Story-card deck** | M | Full-screen swipeable cards (one stat each), animated in the cel style, Crag reacting on the finale card ("what a year"). Reuses the `AfterCommitOverlay`/Summary motion vocabulary. |
| **Monthly mini-recap** | S | Same engine, last-30-days, surfaced as a dismissible Dashboard card on the 1st. |
| **"On this day" / anniversary nudge** | S | "1 year ago you sent your first V5." Cheap nostalgia from `logged_at`/`date`. |

---

### Phase O — Social & sharing *(M–L)*

sendlog is multi-user but **islanded** — no way to see what anyone else has been climbing.
The deployment model makes this easy: a sendlog instance is **you and your friends** — a
single, trusted group. That lets us skip the heavy social-network machinery (follow graphs,
per-item opt-in, public slugs, moderation) and just build a **shared clubhouse feed** where
the trust boundary is *the instance itself*, not each item.

**O1 — Shared activity feed** ✅ *(shipped)* — the flagship.

A 5th bottom tab opening a cross-user feed of everyone on the instance.

| Item | Size | Status |
|------|------|--------|
| **`FEED` tab** | S | ✅ 5th tab in `TabBar.tsx`, order `HOME · SESSIONS · [LOG IT] · FEED · CHARTS` keeps `LOG IT` dead-centre; new `feed` icon + `/feed` route. |
| **`GET /api/feed` endpoint** | M | ✅ The one deliberate exception to per-user scoping — reads across all opted-in users, no new tables. Session events (location, ticks, sends, hardest grade, running-PB flag) + achievement unlocks, sorted newest-first, `limit` param. |
| **`FeedPage`** | M | ✅ Reuses `card-flat` styling + `PullToRefresh`; per-climber colour chips, relative timestamps, NEW PB highlight, Crag cameo on the empty state. |
| **Per-user feed opt-out** | S | ✅ `share_to_feed` boolean on `users` (default on), toggled in Settings via `POST /api/auth/me/feed_sharing`; opting out hides you from everyone's feed. |

**O2 — Reactions / "props"** *(M)* — the social hook *(wanted; v2 of the feed)*.

Lightweight emoji reactions on a feed item ("props 💪", "🔥", "🤙"). The thing that turns a
read-only feed into banter. Needs a small **`reactions` table** (`user_id`, `event` ref,
`emoji`) — the first real write-path on the feed — plus a `POST /api/feed/{event}/react` and
a reaction row under each card. Defer until O1 is in use.

**O3 — Export & extras** — sharing *outside* the instance + small social metadata.

| Item | Size | Notes |
|------|------|-------|
| **Shareable session/recap card image** | M | Render the Summary certificate (or a Phase N recap card) to canvas → PNG → `navigator.share()` / download. For bragging in group chat / Instagram — outside the instance. No backend, no accounts exposed. Pairs with N. |
| **Partner tagging** | S | Free-text "climbed with …" on a session (datalist of past partners, same pattern as locations). Enriches feed cards ("climbed with Sam"). |
| **Beta notes on projects** | S | A notes/comment thread on a `Route` (project) for crux beta — naturally social once the feed exists. |

*Dropped from the earlier draft: opt-in public permalinks. The shared feed makes
per-item public links redundant for a trusted instance. Cross-instance follow graphs and
leaderboards remain out of scope until there's demand.*

---

### Phase P — Gym-set & board tracking *(L)*

Indoor reality the model doesn't capture: gyms **reset walls on a schedule**, and board
climbing (MoonBoard/Kilter/spray) is benchmark-based. Today a re-set "red V4" is
indistinguishable from last month's. This is the first phase that needs **new tables**.

| Item | Size | Notes |
|------|------|-------|
| **`Gym` / `Wall` entities** | M | First-class indoor venues (vs the current free-text `location`). A wall has an angle and a set/reset date. Migrate existing location strings opportunistically. |
| **Set / reset events** | M | Mark a wall "reset on date X" → ticks attribute to the active set; old set archived (not deleted) so history survives. Enables "you've done 80% of the current set." |
| **Colour/circuit tracking** | M | Log a tick by hold-colour within a set. **Pairs directly with the Phase J canvas hold colour-picker** (#31) — sample a colour, attach it to the circuit. |
| **Board climbing (MoonBoard/Kilter)** | L | Benchmark problems as a distinct entry kind: board angle, problem id/name, benchmark flag. Its own mini-pyramid since board grades aren't comparable to outdoor V-scale. |

*Largest schema footprint here — sequence it after the lighter read-model phases unless
indoor tracking is the priority.*

---

### Phase Q — Training plans *(L)*

The whole app is **reactive** (log what happened); this adds a **prescriptive** side (plan
what's next). Biggest behaviour-change potential, biggest build. Leans on the existing
fingerboard/strength loggers and the buddy's rest logic.

| Item | Size | Notes |
|------|------|-------|
| **Plan templates** | M | Pick a block (e.g. "4-week power-endurance", "max-strength hangs") → generates scheduled sessions. A `Plan` + `PlannedSession` model, planned-vs-actual matched against real sessions. |
| **Weekly volume targets + progress rings** | S | Set a weekly tick/session goal, ring fills as you log. Cheap, motivating, reuses session aggregates. |
| **Fingerboard protocol library** | M | Named hang protocols (max hangs, 7/3 repeaters) with prescribed edge/weight/rest → **prefills the existing fingerboard logger** instead of blank fields. |
| **Periodisation + deload nudges** | M | Tag a plan phase (base/strength/power/peak/rest); when training-load (Phase M acute:chronic) spikes, the buddy nudges a deload. Closes the loop: M measures load, K's mood reacts, Q prescribes the fix. |

---

### Suggested sequencing

1. **M (data-viz depth)** then **N (year-in-review)** — both pure read-models over data we
   already have, fast to ship, high delight. N reuses Crag's art.
2. **O (social)** — ship **O1 (shared feed)** first; it's the highest-value social piece
   and reuses existing feed cards. Add **O2 (reactions)** once the feed's in daily use, and
   **O3 (export cards)** alongside N.
3. **P (gym-sets)** / **Q (training plans)** — the big bets; do these when there's a clear
   pull, since each adds real schema and a new mental model.

---

## 🧭 Phase R — Usability polish *(scoped 2026-07, phases A–Q all shipped)*

A friction-driven pass over the finished feature set. Grounded in real gaps, not
generic UX advice. Tiered by effort; each tier is roughly one PR.

### R1 — Quick wins *(S each; #1–2 are the standouts)*

| # | Item | Friction today |
|---|------|----------------|
| 1 | **Gym + partner pickers on the *new session* form** | `SessionForm` only has date/location — the gym dropdown + partner field exist only on the *edit* form, so gym-set tracking needs a create → edit round-trip, and TickSheet's wall chips never appear until the gym is tagged. |
| 2 | **Remember last gym/wall/colour** | TickSheet already persists mode + grade system in localStorage; extend to last wall + hold colour per gym, and default the new-session gym to the last used. |
| 3 | **Themed confirm dialogs** | 4 native `confirm()` calls (delete gym/project/session, abandon plan) — jarring vs the app's visual identity. One `ConfirmSheet` component + undo-toast pattern. |
| 4 | **Feed cards → tap through** | Own session cards in the feed aren't links; tapping should open the session. |
| 5 | **Heatmap cell → day drill-down** | Cells only have a hover title (useless on touch). Tap → that day's session(s). |

### R2 — Structural *(M each)*

| # | Item | Why |
|---|------|-----|
| 6 | **Progress page sections/tabs** | ~16 charts in one scroll. Group as `OVERVIEW · BOULDER · LEAD · TRAINING` chips (reuse the range-chip pattern) or collapsible sections. Biggest IA debt. |
| 7 | **Full plan view** | Dashboard plan card shows only *this week*; add a tap-through page with all weeks, phases, done ticks. |
| 8 | **First-run onboarding** | Empty Dashboard for new users; a dismissible 3-step checklist card (add gym → set goal → log first session), derived from data, no new state. |
| 9 | **Actionable deload nudge** | Q4's banner advises but offers nothing; one tap → swap this week's planned sessions for a deload week. |

### R3 — Deeper polish *(M–L)*

| # | Item | Why |
|---|------|-----|
| 10 | **Accessibility pass on new features** | Colour swatches distinguish by colour alone (colour-blind climbers!); add colour names to selection + chips. Aria for rings/heatmap; `--ink-2` contrast check. |
| 11 | **Global sync/offline status** | Offline queue chip lives only in TickSheet; edits elsewhere fail silently offline. |
| 12 | **Timezone audit** | Naive-UTC handling patched ad hoc (`whenLabel`, `setDate`); consolidate into `lib/dates.ts` and sweep for date-shift bugs. |

### Still parked (pre-R backlog)

- **Floorplan** slice (P, deferred — fiddly), **P4 board climbing** (gated on board use),
  **buddy customisation** (name/skin picker for Crag), **Phase N year-in-review**.
