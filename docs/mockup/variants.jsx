/* variants.jsx — 5 session-form variants, all phone-first, all ≤5s to log a send */

const PALETTE = {
  flash: 'var(--mustard)',
  send: 'var(--sea)',
  proj: 'var(--cobalt)',
  fall: 'var(--red)',
};

const STYLE_INFO = [
  { id: 'flash', label: 'FLASH', color: PALETTE.flash, text: 'var(--ink)' },
  { id: 'send', label: 'SEND', color: PALETTE.send, text: 'var(--cream)' },
  { id: 'proj', label: 'PROJ', color: PALETTE.proj, text: 'var(--cream)' },
  { id: 'fall', label: 'FALL', color: PALETTE.fall, text: 'var(--cream)' },
];

// little entry chip used in feeds
function FeedEntry({ grade, style, color, time }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'stretch',
      border: 'var(--b) solid var(--ink)',
      boxShadow: '2px 2px 0 var(--ink)',
      background: 'var(--cream)',
      fontFamily: 'var(--font-banner)',
      flexShrink: 0,
    }}>
      <div style={{
        background: color, color: 'var(--ink)',
        padding: '4px 8px', fontFamily: 'var(--font-display)', fontSize: 14,
        borderRight: 'var(--b) solid var(--ink)',
        display: 'flex', alignItems: 'center',
      }}>{grade}</div>
      <div style={{ padding: '4px 8px', fontSize: 10, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
        {style}
        <span style={{ opacity: 0.5, fontFamily: 'var(--font-body)' }}>{time}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// V1 — TICK SHEET (grade pyramid, 2-tap log)
// ════════════════════════════════════════════════════════════

function V1_TickSheet() {
  const grades = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11'];
  const tallies = { V3: 2, V4: 3, V5: 4, V6: 2, V7: 1 };
  const selected = 'V6';
  return (
    <div className="paper screen no-scrollbar" style={{ overflow: 'auto', paddingBottom: 100 }}>
      <SessionStrip />

      {/* Mode toggle */}
      <div style={{ display: 'flex', padding: '14px 16px 8px', gap: 8 }}>
        <div className="chunky" style={{
          flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 13,
          background: 'var(--ink)', color: 'var(--mustard)',
          boxShadow: '3px 3px 0 var(--ink)',
        }}>BOULDER</div>
        <div className="chunky" style={{
          flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 13,
          background: 'var(--cream)', color: 'var(--ink-2)',
        }}>LEAD</div>
      </div>

      {/* Banner: pick yer poison */}
      <div style={{ padding: '8px 16px', textAlign: 'center' }}>
        <Ribbon color="var(--mustard)" textColor="var(--ink)">★ TAP A GRADE ★</Ribbon>
      </div>

      {/* Grade pyramid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14, padding: '8px 18px 4px',
      }}>
        {grades.map((g) => {
          const tally = tallies[g] || 0;
          const isSel = g === selected;
          return (
            <div key={g} style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
              {isSel && (
                <div style={{ position: 'absolute', inset: -10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <StarBurst size={94} color="var(--red)" />
                </div>
              )}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <GradeChip
                  grade={g}
                  color={isSel ? 'var(--cream)' : (tally ? 'var(--mustard)' : 'var(--cream)')}
                  tally={tally}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Style ribbon */}
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 10 }}>
          THEN HOW'D IT GO?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {STYLE_INFO.map((s) => (
            <div key={s.id} className="chunky" style={{
              background: s.color, color: s.text,
              padding: '14px 4px', textAlign: 'center', fontSize: 13,
              boxShadow: '3px 3px 0 var(--ink)',
            }}>{s.label}</div>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em' }}>
            THIS SESSION · 12 SENDS
          </div>
          <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--ink-2)', opacity: 0.4 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FeedEntry grade="V6" style="FLASH" color="var(--mustard)" time="47m" />
          <FeedEntry grade="V5" style="SEND" color="var(--sea)" time="44m" />
          <FeedEntry grade="V7" style="PROJ" color="var(--cobalt)" time="38m" />
          <FeedEntry grade="V5" style="FLASH" color="var(--mustard)" time="31m" />
          <FeedEntry grade="V4" style="SEND" color="var(--sea)" time="22m" />
          <FeedEntry grade="V4" style="SEND" color="var(--sea)" time="18m" />
        </div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// V2 — SWIPE STACK (Tinder for sends)
// ════════════════════════════════════════════════════════════

function V2_SwipeStack() {
  return (
    <div className="paper screen" style={{ overflow: 'hidden' }}>
      <SessionStrip />

      {/* Hint banner */}
      <div style={{ padding: '14px 16px 0', textAlign: 'center' }}>
        <Ribbon color="var(--red)">★ SWIPE THE SEND ★</Ribbon>
      </div>

      {/* Card stage */}
      <div style={{ position: 'relative', margin: '14px 16px 0', height: 360 }}>
        {/* Stacked behind cards */}
        <div style={{
          position: 'absolute', left: 16, right: 16, top: 12, bottom: 0,
          background: 'var(--cobalt)', border: 'var(--bw) solid var(--ink)',
          transform: 'rotate(-3deg)', zIndex: 1,
        }} />
        <div style={{
          position: 'absolute', left: 8, right: 8, top: 6, bottom: 0,
          background: 'var(--mustard)', border: 'var(--bw) solid var(--ink)',
          transform: 'rotate(2deg)', zIndex: 2,
        }} />

        {/* Top card */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--cream)', border: 'var(--bw) solid var(--ink)',
          boxShadow: '5px 5px 0 var(--ink)',
          zIndex: 3, padding: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(-1deg)',
        }}>
          {/* Sun rays behind grade */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Ray size={300} color="var(--mustard)" />
          </div>

          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.15em', position: 'relative', marginBottom: -4 }}>
            BOULDER
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 130, lineHeight: 1, color: 'var(--ink)', position: 'relative', textShadow: '4px 4px 0 var(--red)' }}>
            V6
          </div>
          <div style={{ fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--ink-2)', position: 'relative', marginTop: 4 }}>
            crimps from hell
          </div>
        </div>

        {/* Directional hints */}
        <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}>
          <DirHint dir="up" color="var(--sea)" label="SEND" />
        </div>
        <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}>
          <DirHint dir="down" color="var(--red)" label="FALL" />
        </div>
        <div style={{ position: 'absolute', top: '50%', right: -6, transform: 'translateY(-50%)', zIndex: 4 }}>
          <DirHint dir="right" color="var(--mustard)" label="FLASH" />
        </div>
        <div style={{ position: 'absolute', top: '50%', left: -6, transform: 'translateY(-50%)', zIndex: 4 }}>
          <DirHint dir="left" color="var(--cobalt)" label="PROJ" />
        </div>
      </div>

      {/* Grade stepper */}
      <div style={{ padding: '20px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div className="chunky" style={{
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, background: 'var(--cream)', boxShadow: '3px 3px 0 var(--ink)',
        }}>–</div>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-banner)', fontSize: 13, letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
          OR USE THE STEPPER →
        </div>
        <div className="chunky" style={{
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, background: 'var(--mustard)', boxShadow: '3px 3px 0 var(--ink)',
        }}>+</div>
      </div>

      {/* Feed strip */}
      <div style={{ padding: '8px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 6 }}>
          ← LAST 4
        </div>
        <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
          <FeedEntry grade="V5" style="FLASH" color="var(--mustard)" time="2m" />
          <FeedEntry grade="V4" style="SEND" color="var(--sea)" time="8m" />
          <FeedEntry grade="V7" style="PROJ" color="var(--cobalt)" time="15m" />
        </div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

function DirHint({ dir, color, label }) {
  const arrows = { up: '▲', down: '▼', left: '◀', right: '▶' };
  return (
    <div style={{
      background: color, color: 'var(--cream)',
      border: 'var(--bw) solid var(--ink)',
      padding: '4px 10px',
      fontFamily: 'var(--font-banner)',
      fontSize: 11, letterSpacing: '0.06em',
      display: 'flex', alignItems: 'center', gap: 4,
      boxShadow: '2px 2px 0 var(--ink)',
    }}>
      <span style={{ fontSize: 9 }}>{arrows[dir]}</span>
      {label}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// V3 — DIAL (combo-lock grade picker)
// ════════════════════════════════════════════════════════════

function V3_Dial() {
  const grades = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12'];
  const selectedIdx = 6;

  // Arrange grades in arc — full circle, but visually a 'wheel' rotated so selected is on top
  const N = grades.length;
  const radius = 110;
  const cx = 150, cy = 150;

  return (
    <div className="paper screen" style={{ overflow: 'hidden' }}>
      <SessionStrip />

      <div style={{ padding: '14px 16px 0', textAlign: 'center' }}>
        <Ribbon color="var(--cobalt)">★ SPIN TO PICK ★</Ribbon>
      </div>

      {/* Dial */}
      <div style={{ position: 'relative', margin: '8px auto 0', width: 300, height: 300 }}>
        <svg width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', inset: 0 }}>
          {/* outer ring */}
          <circle cx={cx} cy={cy} r={140} fill="var(--mustard)" stroke="var(--ink)" strokeWidth="3.5" />
          {/* tick ring */}
          <circle cx={cx} cy={cy} r={128} fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="2 6" />
          {/* inner disc */}
          <circle cx={cx} cy={cy} r={70} fill="var(--cream)" stroke="var(--ink)" strokeWidth="3.5" />
          {/* pointer mark at top */}
          <polygon points={`${cx-10},${cy-150} ${cx+10},${cy-150} ${cx},${cy-128}`}
            fill="var(--red)" stroke="var(--ink)" strokeWidth="2.5" />
        </svg>

        {/* grade labels positioned around */}
        {grades.map((g, i) => {
          // rotate so selectedIdx is at top (-90°)
          const angle = ((i - selectedIdx) / N) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x = cx + radius * Math.cos(rad);
          const y = cy + radius * Math.sin(rad);
          const isSel = i === selectedIdx;
          return (
            <div key={g} style={{
              position: 'absolute',
              left: x, top: y, transform: 'translate(-50%, -50%)',
              fontFamily: 'var(--font-display)',
              fontSize: isSel ? 22 : 16,
              color: isSel ? 'var(--ink)' : 'var(--ink-2)',
              opacity: isSel ? 1 : 0.55,
              textShadow: isSel ? '2px 2px 0 var(--red)' : 'none',
            }}>{g}</div>
          );
        })}

        {/* center selection */}
        <div style={{
          position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '0.1em' }}>
            SELECTED
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, color: 'var(--ink)' }}>
            {grades[selectedIdx]}
          </div>
        </div>
      </div>

      {/* action buttons */}
      <div style={{ padding: '12px 16px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div className="chunky" style={{
          padding: '14px 0', textAlign: 'center', fontSize: 14,
          background: 'var(--sea)', color: 'var(--cream)',
          boxShadow: '3px 3px 0 var(--ink)',
        }}>SEND</div>
        <div className="chunky" style={{
          padding: '14px 0', textAlign: 'center', fontSize: 14,
          background: 'var(--mustard)', color: 'var(--ink)',
          boxShadow: '3px 3px 0 var(--ink)',
        }}>FLASH</div>
        <div className="chunky" style={{
          padding: '14px 0', textAlign: 'center', fontSize: 14,
          background: 'var(--cobalt)', color: 'var(--cream)',
          boxShadow: '3px 3px 0 var(--ink)',
        }}>PROJ</div>
      </div>

      {/* compact feed */}
      <div style={{ padding: '4px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em' }}>
          LAST →
        </div>
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
          <FeedEntry grade="V5" style="FLASH" color="var(--mustard)" time="2m" />
          <FeedEntry grade="V4" style="SEND" color="var(--sea)" time="8m" />
        </div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// V4 — VOICE BANNER (hold to talk)
// ════════════════════════════════════════════════════════════

function V4_Voice() {
  return (
    <div className="paper screen" style={{ overflow: 'hidden' }}>
      <SessionStrip />

      <div style={{ padding: '20px 16px 6px', textAlign: 'center' }}>
        <Ribbon color="var(--sea)">★ HOLD &amp; HOLLER ★</Ribbon>
      </div>

      {/* Mic stage */}
      <div style={{ position: 'relative', margin: '12px auto 0', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Ray size={300} color="var(--red)" />
        </div>
        {/* mic button */}
        <div style={{
          position: 'relative', zIndex: 2,
          width: 180, height: 180, borderRadius: '50%',
          background: 'var(--red)',
          border: 'var(--bw) solid var(--ink)',
          boxShadow: '5px 5px 0 var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="var(--cream)" stroke="var(--ink)" strokeWidth="3">
            <rect x="30" y="14" width="20" height="38" rx="10" />
            <path d="M22 36 v6 a18 18 0 0 0 36 0 v-6" fill="none" strokeLinecap="round" />
            <line x1="40" y1="60" x2="40" y2="70" strokeLinecap="round" />
            <line x1="30" y1="70" x2="50" y2="70" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Transcript banner */}
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          background: 'var(--mustard)',
          border: 'var(--bw) solid var(--ink)',
          boxShadow: '4px 4px 0 var(--ink)',
          padding: '10px 18px',
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          letterSpacing: '0.04em',
          transform: 'rotate(-2deg)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: 'var(--ink)' }}>V5</span>
          <span style={{ fontFamily: 'var(--font-banner)', fontSize: 18 }}>·</span>
          <span style={{ color: 'var(--red)' }}>FLASH</span>
          <span style={{ fontSize: 22 }}>✓</span>
        </div>
      </div>

      <div style={{ padding: '20px 28px 8px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--ink-2)' }}>
          “v6 flash” · “red ten send” · “v4 proj three burns”
        </div>
      </div>

      {/* Feed */}
      <div style={{ padding: '6px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 6 }}>
          LAST 3 ↓
        </div>
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
          <FeedEntry grade="V6" style="FLASH" color="var(--mustard)" time="2m" />
          <FeedEntry grade="V5" style="SEND" color="var(--sea)" time="8m" />
          <FeedEntry grade="V4" style="SEND" color="var(--sea)" time="15m" />
        </div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// V5 — RECENT REMIX (one-tap repeat of recent combos)
// ════════════════════════════════════════════════════════════

function V5_Recent() {
  const recents = [
    { grade: 'V5', style: 'FLASH', color: PALETTE.flash, text: 'var(--ink)', count: 3, note: 'pink crimper' },
    { grade: 'V6', style: 'SEND',  color: PALETTE.send,  text: 'var(--cream)', count: 2, note: 'orange overhang' },
    { grade: 'V4', style: 'SEND',  color: PALETTE.send,  text: 'var(--cream)', count: 4, note: 'warm-up' },
    { grade: 'V7', style: 'PROJ',  color: PALETTE.proj,  text: 'var(--cream)', count: 1, note: 'crux dyno' },
  ];

  return (
    <div className="paper screen no-scrollbar" style={{ overflow: 'auto', paddingBottom: 100 }}>
      <SessionStrip />

      <div style={{ padding: '14px 16px 6px', textAlign: 'center' }}>
        <Ribbon color="var(--mustard)" textColor="var(--ink)">★ +1 ANY OF THESE ★</Ribbon>
      </div>

      <div style={{ padding: '6px 16px 0', textAlign: 'center', fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--ink-2)' }}>
        grinding the same project? one tap per burn.
      </div>

      {/* Recent combos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '14px 16px' }}>
        {recents.map((r, i) => (
          <div key={i} style={{
            border: 'var(--bw) solid var(--ink)',
            background: r.color,
            color: r.text,
            boxShadow: '4px 4px 0 var(--ink)',
            padding: '12px 12px 10px',
            position: 'relative',
            transform: i % 2 ? 'rotate(0.6deg)' : 'rotate(-0.6deg)',
            display: 'flex', flexDirection: 'column', gap: 4,
            minHeight: 140,
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, lineHeight: 0.95 }}>{r.grade}</div>
            <div style={{ fontFamily: 'var(--font-banner)', fontSize: 13, letterSpacing: '0.06em' }}>{r.style}</div>
            <div style={{
              fontFamily: 'var(--font-hand)', fontSize: 13,
              color: r.text === 'var(--cream)' ? 'var(--mustard)' : 'var(--ink-2)',
              marginTop: 2,
            }}>“{r.note}”</div>

            {/* +1 button */}
            <div style={{
              position: 'absolute', bottom: -8, right: -8,
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--cream)', color: 'var(--ink)',
              border: 'var(--bw) solid var(--ink)',
              fontFamily: 'var(--font-display)', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '2px 2px 0 var(--ink)',
            }}>+{r.count + 1}</div>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ padding: '4px 16px 0' }}>
        <div className="chunky" style={{
          padding: '14px 0', textAlign: 'center', fontSize: 18,
          background: 'var(--ink)', color: 'var(--mustard)',
          boxShadow: '4px 4px 0 var(--red)',
          letterSpacing: '0.04em',
        }}>+ ADD A NEW SEND</div>
      </div>

      {/* Feed line */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em' }}>
          12 SENDS · 47:23
        </div>
        <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--ink-2)', opacity: 0.4 }} />
      </div>

      <TabBar active="log" />
    </div>
  );
}

Object.assign(window, {
  V1_TickSheet, V2_SwipeStack, V3_Dial, V4_Voice, V5_Recent,
});
