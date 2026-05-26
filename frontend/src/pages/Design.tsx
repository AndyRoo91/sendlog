import type { ReactNode } from "react";
import {
  Ray, StarBurst, Ribbon, Scroll, GradeChip, SessionStrip,
  FeedEntry, StyleRibbonRow, ModeToggle, RecentChip, STYLES,
} from "../ui";

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
    </div>
  );
}
