# sendlog — Roadmap

A running list of features and hardening work to tackle in future sessions. Sizing: **S** = small, **M** = medium, **L** = large.

## Project review (snapshot)

### In great shape
- Clean separation: FastAPI + SQLAlchemy backend, typed React/Vite frontend, single-container deploy, CI → GHCR → Watchtower. Genuinely well-structured for a personal app.
- Consistent design system (`src/ui/`) and a real component library; the logging UX (2-tap, recents, projects/pins) is thoughtful and verified end-to-end.
- Data safety basics done right: bind-mount persistence, idempotent lightweight migrations, photos owned by routes survive tick deletion.

### Gaps & risks

**Correctness / quality**
- Zero tests anywhere. Every change so far verified by hand/browser — fine while driving manually, risky long-term. A small pytest suite on the API would catch regressions cheaply.
- `alembic` is a dependency but unused — migrations are hand-rolled in `database.py`. Pick one: adopt Alembic properly, or drop the dep. The hand-rolled approach gets fragile as the schema grows.
- Dead code: after the lead-charts change, `YDS_GRADE_ORDER`, `FRENCH_GRADE_ORDER`, `GRADE_ORDERS` in `main.py` are now unused.
- Errors are swallowed: many `.catch(() => {})` and optimistic saves with no rollback or user feedback. A failed save silently does nothing.

**Photos**
- HEIC won't preview — backend accepts `image/heic`, but browsers can't render HEIC in `<img>`. iPhone photos upload then show broken.
- No EXIF-orientation handling → phone photos may display rotated/sideways.
- No resize/thumbnails — full ~3–5MB photos stored and served raw; storage grows and views get slow.
- No upload size limit → a stray large file can fill the NAS volume.

**Infra / security**
- No auth. Fine on a trusted LAN; a real risk if ever reverse-proxied to the internet. A simple PIN/basic-auth gate would be cheap insurance.
- No `/healthz` endpoint for Portainer/Docker health checks.
- No in-app backup/export — data lives only in the bind mount.

**UX / product**
- Onsight & top-rope aren't loggable in quick-log or detail sheet (only flash/send/work/fall), so the flash chart conflates onsight.
- LOG IT tab isn't context-aware and highlights SESSIONS on the Tick Sheet.
- Sessions/Projects lists have no search/filter/pagination — they grow unbounded.
- Accessibility: clickable `<div>`s, color-only signals, no keyboard/aria. The spec's "Lighthouse a11y ≥95" was never measured.
- Bundle is one 716KB chunk (recharts + html-to-image) — no code-splitting.

## Roadmap

### Phase A — Hardening (do early; unglamorous but pays off)
- [ ] API test suite with pytest + httpx; CI runs it on PRs (M)
- [ ] Surface errors: lightweight toast + rollback on failed saves (M)
- [ ] `/healthz` endpoint + Docker/Portainer healthcheck (S)
- [ ] Decide Alembic vs. keep-and-document; remove dead grade constants (S)
- [ ] In-app export/import (JSON) + an upload size limit (M)

### Phase B — Photos done right
- [x] Server-side resize + thumbnails, EXIF auto-rotate, HEIC→JPEG conversion on upload (Pillow) (M)
- [ ] Generic lightbox for any photo (not just topos) (S)
- [ ] Multiple photos per project + drag-to-reposition pins (M)
- [ ] Boulder projects/pins (reuse the Route machinery) (M)

### Phase C — Logging depth
- [x] Add onsight + top-rope as first-class styles (quick-log + detail) (S) → unlocks a true onsight progression line
- [ ] Backdating ticks / editing session dates (S)
- [ ] Crags as entities (autocomplete, per-crag stats) + route beta/tags (M)
- [ ] Search/filter on sessions & projects (M)
- [ ] Goals & pyramid-readiness ("ready to try 24?") indicator (M)

### Phase D — Analytics
- [ ] Volume/mileage over time, send rate, attempts-to-send efficiency, falls trend (M)
- [ ] Boulder send pyramid (reuse lead pyramid) (S)
- [ ] Training-load / rest-day view (M)

### Phase E — Platform
- [ ] PWA: installable + offline logging — big for logging at the crag with no signal (L)
- [ ] Accessibility pass to hit the Lighthouse target (M)
- [ ] Code-splitting / lazy-load charts to shrink the bundle (S)
- [ ] Optional PIN/basic-auth gate for safe remote access (S)

### Phase F — Design & UX polish

Full detail in [REVIEW.md](REVIEW.md). The visual system currently stops at the Tick Sheet — the lobby screens still wear the pre-redesign skin, plus a set of form papercuts and small bugs.

**Visual-system spread (highest perceived-quality lift)**
- [ ] Reskin Dashboard to the new system: Ribbon page title, `.card-flat` + `offset-ink` stat cards, display/banner type, card rotation rhythm, drop the 📍 emoji (M)
- [ ] Reskin SessionList in the same pass (S)
- [ ] Reskin Progress: Ribbon title + banner chart headings, retokenise containers (S)
- [ ] Halftone overlay applied consistently (`.paper` vs `.paper-plain`) (S)

**Form fixes pass**
- [ ] Replace `onContextMenu` long-press with a pointerdown timer (~450ms) + movement-cancel threshold (M)
- [ ] Fix the 6s selection timeout silently dropping state — countdown ring or warn-on-tap (S)
- [ ] Lead recents carry `last_route_name`; prefer current input over stored name (M)
- [ ] Sliding boulder grade window (centre on recent max, "show all" affordance) (M)
- [ ] End-session affordance equal in weight to START TIMER (S)
- [ ] Card rotation (±0.5–2°) on recents, feed entries, timer/end chips (S)
- [ ] Keep the "pick a style" ribbon mustard on select (fix red-on-red) (S)
- [ ] TabBar bottom padding (~110px / safe-area inset) so feed rows clear it (S)
- [ ] Differentiate empty-state copy per mode ("no leads yet" vs "no ticks yet") (S)
- [ ] `RecentChip` commit clears `routeName`; move `falls` into lead-only branch; clear `selectTimer` on unmount; stop-propagation on detail-sheet long-press (S)

**Surprise pool**
- [ ] Wire 6–8 randomised after-commit phrases in `AfterCommitOverlay`; add "new max this session" variant (S)

## Top 3 next sessions
1. **HEIC/EXIF/resize photo pipeline** — it's actively biting you.
2. **pytest API suite** — so future changes are safe.
3. **Onsight/top-rope styles** — small change, real climbing value.

> Note: if perceived quality matters more than correctness right now, Phase F's **visual-system spread** is the single highest lift-per-hour item — see [REVIEW.md](REVIEW.md) §1.
