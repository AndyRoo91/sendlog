import type { ReactNode } from "react";
import {
  Ray, StarBurst, Ribbon, Scroll, GradeChip, SessionStrip,
  FeedEntry, StyleRibbonRow, ModeToggle, RecentChip, STYLES,
  Crag, CRAG_SPECIES, SPECIES_INFO,
} from "../ui";
import type { CragState } from "../ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 12 }}>
        <Ribbon color="var(--ink)">{title}</Ribbon>
      </div>
      <div className="gap-col">{children}</div>
    </div>
  );
}

const SWATCHES: [string, string, string][] = [
  ["PAPER", "var(--paper)", "var(--ink)"],
  ["INK", "var(--ink)", "var(--cream)"],
  ["RED", "var(--red)", "var(--cream)"],
  ["MUSTARD", "var(--mustard)", "var(--ink)"],
  ["SEA", "var(--sea)", "var(--cream)"],
  ["COBALT", "var(--cobalt)", "var(--cream)"],
  ["PINK", "var(--pink)", "var(--cream)"],
  ["CREAM", "var(--cream)", "var(--ink)"],
];

export default function Design() {
  return (
    <div style={{ padding: "20px 16px 60px" }}>
      <h1 style={{ marginBottom: 6 }}>DESIGN SYSTEM</h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 13 }}>
        Private component showcase — every primitive from <code>src/ui/</code>.
      </p>

      <Section title="★ PALETTE ★">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {SWATCHES.map(([label, color, text]) => (
            <div
              key={label}
              style={{
                background: color, color: text, padding: "10px 12px",
                border: "var(--b) solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
                fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.06em",
                display: "flex", justifyContent: "space-between",
              }}
            >
              <span>{label}</span>
              <span style={{ opacity: 0.7 }}>{color.replace("var(--", "").replace(")", "").toUpperCase()}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="★ TYPE ★">
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1 }}>Alfa Slab One — display</div>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 22 }}>BUNGEE · BANNERS</div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 14 }}>Outfit — body copy &amp; chips.</div>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 20, color: "var(--red)" }}>Permanent Marker — notes</div>
      </Section>

      <Section title="★ RIBBONS ★">
        <div className="gap-row">
          <Ribbon color="var(--red)">★ SENDLOG ★</Ribbon>
          <Ribbon color="var(--mustard)" textColor="var(--ink)">FLASH</Ribbon>
          <Ribbon color="var(--sea)">SEND</Ribbon>
          <Ribbon color="var(--cobalt)">PROJ</Ribbon>
        </div>
        <div className="gap-row" style={{ marginTop: 8 }}>
          <Scroll color="var(--mustard)">SCROLL HEADER</Scroll>
        </div>
      </Section>

      <Section title="★ ORNAMENTS ★">
        <div className="gap-row">
          <StarBurst size={48} color="var(--red)" />
          <StarBurst size={48} color="var(--mustard)" />
          <StarBurst size={48} color="var(--sea)" />
          <Ray size={120} />
        </div>
      </Section>

      <Section title="★ GRADE CHIPS ★">
        <div className="gap-row">
          <GradeChip grade="V5" />
          <GradeChip grade="V6" color="var(--mustard)" tally={3} />
          <GradeChip grade="24" big color="var(--mustard)" tally={1} />
        </div>
      </Section>

      <Section title="★ STYLE RIBBON ROW ★">
        <StyleRibbonRow selected="send" />
      </Section>

      <Section title="★ RECENTS ★">
        <div style={{ display: "flex", gap: 10 }}>
          <RecentChip grade="V5" style="FLASH" color="var(--mustard)" text="var(--ink)" />
          <RecentChip grade="V6" style="WORK" color="var(--cobalt)" />
        </div>
      </Section>

      <Section title="★ FEED ENTRIES ★">
        <div className="gap-row">
          {STYLES.map((s) => (
            <FeedEntry key={s.id} grade="V6" style={s.label} color={s.color} text={s.text} time="2m" />
          ))}
        </div>
      </Section>

      <Section title="★ MODE TOGGLE ★">
        <ModeToggle active="boulder" />
        <ModeToggle active="lead" />
      </Section>

      <Section title="★ SESSION STRIP ★">
        <div style={{ border: "var(--b) solid var(--ink)" }}>
          <SessionStrip />
        </div>
      </Section>

      <Section title="★ CRAG — ALL STATES ★">
        <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Six states · size=160 with bg · each gets a unique uid to avoid filter-id collisions.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}>
          {(["primed","training","detrained","stoked","shakeoff","resting"] as CragState[]).map((s) => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Crag state={s} size={160} showBg uid={`design-${s}`} />
              <div style={{
                fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em",
                color: "var(--ink-2)", textAlign: "center",
              }}>
                {s.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            showBg=false (transparent) · size=90 — for embedding in cards
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {(["primed","stoked","resting"] as CragState[]).map((s) => (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <Crag state={s} size={90} showBg={false} uid={`design-sm-${s}`} />
                <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-2)" }}>
                  {s}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="★ CRAG — SPECIES ★">
        <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Buddy species × key states. Ibex horns scale with build (shown at build=3).
        </p>
        {CRAG_SPECIES.map((sp) => (
          <div key={sp} style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.1em", color: "var(--ink)" }}>
              {SPECIES_INFO[sp].name} <span className="muted" style={{ fontFamily: "var(--font-hand)", fontSize: 13 }}>{SPECIES_INFO[sp].tagline}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 6 }}>
              {(["primed","stoked","training","detrained"] as CragState[]).map((s) => (
                <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <Crag species={sp} state={s} size={165} showBg uid={`design-sp-${sp}-${s}`}
                    build={s === "training" ? 3 : 0} still />
                  <div style={{ fontFamily: "var(--font-banner)", fontSize: 9, letterSpacing: "0.1em", color: "var(--ink-2)" }}>
                    {s}{s === "training" ? " · b3" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
