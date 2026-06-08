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

### Phase K — Climbing Buddy ✅ *(shipped #34, #44, #45, #46; "Crag" the gecko)*

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
| 🤌 Focused | Long session (90+ min) | 🔜 in progress |
| 🎉 Stoked (achievement) | Achievement unlocked | 🔜 in progress |

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

## 🔜 Remaining / next up

Phases A–L are shipped. What's left:

- **🤌 Focused buddy state** *(S)* — pose for long sessions (90+ min). *In progress.*
- **🎉 Achievement-unlock buddy reaction** *(S)* — buddy goes stoked when an achievement unlocks. *In progress.*
- **Per-user buddy customisation** *(M–L)* — avatar/name picker. Unblocked now that Phase F (multi-user) + K (buddy) are done.
- **New phase, TBD** — no Phase M+ scoped yet. Candidates: deeper data-viz, social/sharing, gym-set tracking, training plans, "year in review".

PIN auth shipped in Phase F2 (#33) — no longer deferred.
