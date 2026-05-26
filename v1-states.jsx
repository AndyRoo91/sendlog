/* v1-states.jsx — deep-dive on the TICK SHEET direction.
   States the agent needs to build: recommended hybrid, empty, lead mode,
   long-press detail sheet, end-of-session summary, after-commit confirmation. */

const V1_PALETTE = {
  flash: 'var(--mustard)',
  send: 'var(--sea)',
  proj: 'var(--cobalt)',
  fall: 'var(--red)',
};

const V1_STYLES = [
  { id: 'flash', label: 'FLASH', color: V1_PALETTE.flash, text: 'var(--ink)' },
  { id: 'send', label: 'SEND', color: V1_PALETTE.send, text: 'var(--cream)' },
  { id: 'proj', label: 'WORK', color: V1_PALETTE.proj, text: 'var(--cream)' },
  { id: 'fall', label: 'FALL', color: V1_PALETTE.fall, text: 'var(--cream)' },
];

// ─── shared sub-components ──────────────────────────────────

function StyleRibbonRow({ selected = null, big = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {V1_STYLES.map((s) => {
        const isSel = selected === s.id;
        return (
          <div key={s.id} className="chunky" style={{
            background: s.color, color: s.text,
            padding: big ? '18px 4px' : '14px 4px',
            textAlign: 'center', fontSize: big ? 15 : 13,
            boxShadow: isSel ? '5px 5px 0 var(--ink)' : '3px 3px 0 var(--ink)',
            transform: isSel ? 'translate(-2px,-2px)' : 'none',
            outline: isSel ? '3px solid var(--ink)' : 'none',
            outlineOffset: isSel ? 4 : 0,
            position: 'relative',
          }}>{s.label}</div>
        );
      })}
    </div>
  );
}

function RecentChip({ grade, style, color, text, count }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      border: 'var(--bw) solid var(--ink)',
      background: color, color: text,
      boxShadow: '3px 3px 0 var(--ink)',
      padding: '8px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>{grade}</span>
        <span style={{ fontFamily: 'var(--font-banner)', fontSize: 10, letterSpacing: '0.08em', marginTop: 2 }}>{style}</span>
      </div>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--cream)', color: 'var(--ink)',
        border: 'var(--b) solid var(--ink)',
        fontFamily: 'var(--font-display)', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>+1</div>
    </div>
  );
}

function ModeToggle({ active = 'boulder' }) {
  return (
    <div style={{ display: 'flex', padding: '14px 16px 8px', gap: 8 }}>
      <div className="chunky" style={{
        flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 13,
        background: active === 'boulder' ? 'var(--ink)' : 'var(--cream)',
        color: active === 'boulder' ? 'var(--mustard)' : 'var(--ink-2)',
        boxShadow: active === 'boulder' ? '3px 3px 0 var(--ink)' : 'none',
      }}>BOULDER</div>
      <div className="chunky" style={{
        flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 13,
        background: active === 'lead' ? 'var(--ink)' : 'var(--cream)',
        color: active === 'lead' ? 'var(--mustard)' : 'var(--ink-2)',
        boxShadow: active === 'lead' ? '3px 3px 0 var(--ink)' : 'none',
      }}>LEAD</div>
    </div>
  );
}

function FeedRow({ entries }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {entries.map((e, i) => (
        <FeedEntry key={i} grade={e.grade} style={e.style} color={e.color} time={e.time} />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// A · RECOMMENDED — V1 with Recents strip on top
// ════════════════════════════════════════════════════════════

function V1_Recommended() {
  const grades = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11'];
  const tallies = { V3: 2, V4: 3, V5: 4, V6: 2, V7: 1 };
  return (
    <div className="paper screen no-scrollbar" style={{ overflow: 'auto', paddingBottom: 100 }}>
      <SessionStrip />
      <ModeToggle active="boulder" />

      {/* Recents strip — one-tap repeat path */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em' }}>
            ★ +1 A RECENT
          </div>
          <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--ink-2)', opacity: 0.4 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <RecentChip grade="V5" style="FLASH" color={V1_PALETTE.flash} text="var(--ink)" count={3} />
          <RecentChip grade="V6" style="WORK" color={V1_PALETTE.proj} text="var(--cream)" count={2} />
        </div>
      </div>

      {/* Or pick fresh */}
      <div style={{ padding: '14px 16px 0', textAlign: 'center' }}>
        <Ribbon color="var(--mustard)" textColor="var(--ink)">★ OR TAP A GRADE ★</Ribbon>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '10px 18px 4px' }}>
        {grades.map((g) => (
          <div key={g} style={{ display: 'flex', justifyContent: 'center' }}>
            <GradeChip
              grade={g}
              color={tallies[g] ? 'var(--mustard)' : 'var(--cream)'}
              tally={tallies[g] || 0}
            />
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 8 }}>
          THEN — HOW'D IT GO?
        </div>
        <StyleRibbonRow />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em' }}>
            THIS SESSION · 12 SENDS
          </div>
          <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--ink-2)', opacity: 0.4 }} />
        </div>
        <FeedRow entries={[
          { grade: 'V6', style: 'FLASH', color: V1_PALETTE.flash, time: '2m' },
          { grade: 'V5', style: 'SEND', color: V1_PALETTE.send, time: '8m' },
          { grade: 'V7', style: 'WORK', color: V1_PALETTE.proj, time: '14m' },
          { grade: 'V5', style: 'FLASH', color: V1_PALETTE.flash, time: '22m' },
        ]} />
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// B · EMPTY — first 5 seconds of a fresh session
// ════════════════════════════════════════════════════════════

function V1_Empty() {
  const grades = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11'];
  return (
    <div className="paper screen no-scrollbar" style={{ overflow: 'auto', paddingBottom: 100 }}>
      {/* Slightly different strip — no elapsed yet, just started */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 16px 12px', background: 'var(--ink)', color: 'var(--cream)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--mustard)', letterSpacing: '0.1em' }}>
            ★ NEW SESSION
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>BLOC SHOP</div>
        </div>
        <div className="chunky" style={{
          padding: '8px 12px', background: 'var(--red)', color: 'var(--cream)',
          fontSize: 12, fontFamily: 'var(--font-banner)', letterSpacing: '0.06em',
          boxShadow: '3px 3px 0 var(--mustard)',
        }}>● START TIMER</div>
      </div>

      <ModeToggle active="boulder" />

      {/* Big empty-state banner with arrow pointing to grid */}
      <div style={{ padding: '14px 16px 0', textAlign: 'center' }}>
        <Ribbon color="var(--red)">★ FIRST SEND? TAP A GRADE ★</Ribbon>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '14px 18px 4px' }}>
        {grades.map((g) => (
          <div key={g} style={{ display: 'flex', justifyContent: 'center' }}>
            <GradeChip grade={g} color="var(--cream)" />
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 8 }}>
          STYLE
        </div>
        <div style={{ opacity: 0.45 }}>
          <StyleRibbonRow />
        </div>
      </div>

      {/* big handwritten encouragement */}
      <div style={{ padding: '24px 28px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-hand)', fontSize: 18, color: 'var(--ink-2)', transform: 'rotate(-1deg)', display: 'inline-block' }}>
          empty session.<br/>
          <span style={{ color: 'var(--red)' }}>go climb something.</span>
        </div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// C · LEAD MODE — Ewbank, route name optional, falls counter
// ════════════════════════════════════════════════════════════

function V1_Lead() {
  const ewbank = ['16','17','18','19','20','21','22','23','24','25','26','27'];
  const tallies = { '22': 1, '23': 2, '24': 1 };
  const selected = '24';
  return (
    <div className="paper screen no-scrollbar" style={{ overflow: 'auto', paddingBottom: 100 }}>
      <SessionStrip where="ARAPILES" elapsed="2:14:08" date="SAT · 30 MAY" />
      <ModeToggle active="lead" />

      {/* Route name input — only on LEAD */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 6 }}>
          ROUTE NAME · OPTIONAL
        </div>
        <div style={{
          border: 'var(--b) solid var(--ink)', background: 'var(--cream)',
          padding: '10px 12px', fontFamily: 'var(--font-hand)', fontSize: 18, color: 'var(--ink)',
          boxShadow: '3px 3px 0 var(--ink)',
        }}>
          Kachoong
          <span style={{ borderLeft: '2px solid var(--red)', marginLeft: 2, opacity: 0.8 }}></span>
        </div>
      </div>

      {/* Grade system chips (within Lead) */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 6 }}>
        {['EWBANK', 'YDS', 'FRENCH'].map((sys, i) => (
          <div key={sys} className="chunky" style={{
            padding: '4px 10px', fontSize: 10, letterSpacing: '0.06em',
            background: i === 0 ? 'var(--cobalt)' : 'var(--cream)',
            color: i === 0 ? 'var(--cream)' : 'var(--ink-2)',
            boxShadow: i === 0 ? '2px 2px 0 var(--ink)' : 'none',
            fontFamily: 'var(--font-banner)',
          }}>{sys}</div>
        ))}
      </div>

      {/* Pyramid */}
      <div style={{ padding: '10px 18px 4px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {ewbank.map((g) => {
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
                <GradeChip grade={g} color={isSel ? 'var(--cream)' : (tally ? 'var(--mustard)' : 'var(--cream)')} tally={tally} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 8 }}>
          HOW'D IT GO? · FALLS COUNT
        </div>
        <StyleRibbonRow />
        {/* fall counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.08em' }}>FALLS</span>
          <div className="chunky" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', boxShadow: '2px 2px 0 var(--ink)' }}>–</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, minWidth: 28, textAlign: 'center' }}>2</div>
          <div className="chunky" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mustard)', boxShadow: '2px 2px 0 var(--ink)' }}>+</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 8 }}>
          TODAY · 4 BURNS
        </div>
        <FeedRow entries={[
          { grade: '24', style: 'WORK', color: V1_PALETTE.proj, time: '12m' },
          { grade: '23', style: 'SEND', color: V1_PALETTE.send, time: '45m' },
          { grade: '22', style: 'FLASH', color: V1_PALETTE.flash, time: '1h' },
          { grade: '23', style: 'WORK', color: V1_PALETTE.proj, time: '1h20' },
        ]} />
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// D · DETAIL SHEET — long-press a chip opens this modal
// ════════════════════════════════════════════════════════════

function V1_DetailSheet() {
  // Show a dim'd background V1 with a detail sheet sliding up over it
  const grades = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11'];
  return (
    <div className="paper screen" style={{ overflow: 'hidden', position: 'relative' }}>
      {/* dim background */}
      <div style={{ filter: 'brightness(0.6) saturate(0.7)' }}>
        <SessionStrip />
        <ModeToggle active="boulder" />
        <div style={{ padding: '14px 16px 0', textAlign: 'center' }}>
          <Ribbon color="var(--mustard)" textColor="var(--ink)">★ TAP A GRADE ★</Ribbon>
        </div>
        <div style={{ padding: '10px 18px 4px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {grades.map((g) => <div key={g} style={{ display: 'flex', justifyContent: 'center' }}>
            <GradeChip grade={g} color="var(--cream)" />
          </div>)}
        </div>
      </div>

      {/* Backdrop fade */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,22,18,0.45)', zIndex: 10 }} />

      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 100,
        background: 'var(--paper)',
        border: 'var(--bw) solid var(--ink)',
        boxShadow: '6px 6px 0 var(--ink)',
        padding: '16px 16px 18px',
        zIndex: 11,
        transform: 'rotate(-0.6deg)',
      }}>
        {/* sheet handle */}
        <div style={{ width: 44, height: 5, background: 'var(--ink)', margin: '0 auto 12px' }} />

        {/* Header — grade chip + tally + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <GradeChip grade="V6" color="var(--mustard)" tally={3} />
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>V6 · CRIMPS</div>
            <div style={{ fontFamily: 'var(--font-hand)', fontSize: 15, color: 'var(--ink-2)' }}>
              3 sends this session · 1 flash · 2 work
            </div>
          </div>
          <div className="chunky" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', fontFamily: 'var(--font-banner)', fontSize: 16 }}>×</div>
        </div>

        {/* Route name */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 4 }}>ROUTE NAME · OPTIONAL</div>
          <div style={{
            border: 'var(--b) solid var(--ink)', background: 'var(--cream)',
            padding: '8px 10px', fontFamily: 'var(--font-hand)', fontSize: 16,
          }}>pink crimper</div>
        </div>

        {/* Attempts + Style row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 4 }}>ATTEMPTS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="chunky" style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', fontSize: 14, boxShadow: '2px 2px 0 var(--ink)' }}>–</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, minWidth: 26, textAlign: 'center' }}>4</div>
              <div className="chunky" style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mustard)', fontSize: 14, boxShadow: '2px 2px 0 var(--ink)' }}>+</div>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 4 }}>STYLE</div>
            <StyleRibbonRow selected="proj" />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 4 }}>NOTES</div>
          <div style={{
            border: 'var(--b) solid var(--ink)', background: 'var(--cream)',
            padding: '8px 10px', fontFamily: 'var(--font-hand)', fontSize: 16, minHeight: 40, color: 'var(--ink-2)',
          }}>sticky moves, dropped at the rail</div>
        </div>

        {/* Photo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{
            flex: 1, height: 68,
            border: 'var(--b) dashed var(--ink-2)', background: 'rgba(26,22,18,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.08em',
          }}>＋ ADD PHOTO</div>
        </div>

        {/* Commit */}
        <div className="chunky" style={{
          padding: '14px 0', textAlign: 'center', fontSize: 18,
          background: 'var(--ink)', color: 'var(--mustard)',
          boxShadow: '4px 4px 0 var(--red)', letterSpacing: '0.04em',
        }}>★ SAVE TICK ★</div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// E · AFTER-COMMIT confirmation — satisfying success state
// ════════════════════════════════════════════════════════════

function V1_AfterCommit() {
  const grades = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11'];
  const tallies = { V3: 2, V4: 3, V5: 4, V6: 3, V7: 1 };
  return (
    <div className="paper screen" style={{ overflow: 'hidden' }}>
      <SessionStrip />
      <ModeToggle active="boulder" />

      <div style={{ padding: '14px 16px 0', textAlign: 'center' }}>
        <Ribbon color="var(--mustard)" textColor="var(--ink)">★ TAP A GRADE ★</Ribbon>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '10px 18px 4px', position: 'relative' }}>
        {grades.map((g) => (
          <div key={g} style={{ display: 'flex', justifyContent: 'center' }}>
            <GradeChip grade={g} color={tallies[g] ? 'var(--mustard)' : 'var(--cream)'} tally={tallies[g] || 0} />
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 8 }}>
          STYLE
        </div>
        <StyleRibbonRow />
      </div>

      {/* Overlay: big tick confirm */}
      <div style={{
        position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)',
        zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        pointerEvents: 'none',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ray size={300} color="var(--mustard)" />
          <div style={{
            position: 'absolute',
            width: 130, height: 130, borderRadius: '50%',
            background: 'var(--sea)', border: 'var(--bw) solid var(--ink)',
            boxShadow: '5px 5px 0 var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="70" height="70" viewBox="0 0 70 70" fill="none" stroke="var(--cream)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 36 L30 52 L58 18" />
            </svg>
          </div>
        </div>
        <div style={{
          background: 'var(--ink)', color: 'var(--mustard)',
          padding: '6px 14px', fontFamily: 'var(--font-display)', fontSize: 22,
          border: 'var(--bw) solid var(--ink)', transform: 'rotate(-2deg)',
          boxShadow: '3px 3px 0 var(--red)', letterSpacing: '0.04em',
        }}>V6 · SEND ✓</div>
        <div style={{ fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--red)', transform: 'rotate(1deg)' }}>
          burned it!
        </div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// F · SESSION SUMMARY — end of session ticket
// ════════════════════════════════════════════════════════════

function V1_Summary() {
  return (
    <div className="paper screen no-scrollbar" style={{ overflow: 'auto', paddingBottom: 100 }}>
      {/* status bar dark area */}
      <div style={{ height: 60, background: 'var(--ink)' }} />

      <div style={{ padding: '20px 16px 0', textAlign: 'center' }}>
        <Ribbon color="var(--red)" font="display">★ SESSION DONE ★</Ribbon>
      </div>

      {/* The "tick certificate" card */}
      <div style={{
        margin: '16px 14px 0',
        background: 'var(--cream)',
        border: 'var(--bw) solid var(--ink)',
        boxShadow: '6px 6px 0 var(--ink)',
        padding: '16px 14px',
        position: 'relative',
      }}>
        {/* perforated top edge */}
        <div style={{ position: 'absolute', top: -2, left: 0, right: 0, height: 8, background: 'repeating-linear-gradient(90deg, var(--paper) 0 6px, transparent 6px 12px)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, letterSpacing: '0.1em' }}>TUE · 26 MAY</div>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-2)' }}>BLOC SHOP</div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1, marginBottom: 14 }}>
          1:47:23
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
          {[
            { n: '12', l: 'SENDS' },
            { n: '4', l: 'FLASH' },
            { n: 'V7', l: 'TOP' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '12px 6px', textAlign: 'center',
              borderRight: i < 2 ? '2px solid var(--ink)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Pyramid */}
        <div style={{ padding: '14px 0 4px' }}>
          <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.1em', marginBottom: 8, textAlign: 'center' }}>
            BY GRADE
          </div>
          {[
            { g: 'V7', n: 1, color: V1_PALETTE.proj },
            { g: 'V6', n: 3, color: V1_PALETTE.send },
            { g: 'V5', n: 4, color: V1_PALETTE.flash },
            { g: 'V4', n: 3, color: V1_PALETTE.send },
            { g: 'V3', n: 1, color: V1_PALETTE.flash },
          ].map((row) => (
            <div key={row.g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 32, fontFamily: 'var(--font-display)', fontSize: 16, textAlign: 'right' }}>{row.g}</div>
              <div style={{
                flex: 1, height: 22,
                background: 'var(--paper-2)',
                border: 'var(--b) solid var(--ink)',
                position: 'relative',
              }}>
                <div style={{
                  width: `${row.n * 18}%`, height: '100%',
                  background: row.color,
                  borderRight: 'var(--b) solid var(--ink)',
                }} />
              </div>
              <div style={{ width: 22, fontFamily: 'var(--font-display)', fontSize: 14 }}>×{row.n}</div>
            </div>
          ))}
        </div>

        {/* Handwritten note */}
        <div style={{
          marginTop: 14, padding: '8px 10px',
          background: 'var(--mustard)', border: 'var(--b) solid var(--ink)',
          fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--ink)',
          transform: 'rotate(-1deg)',
        }}>
          good arvo. felt strong on crimps. tweak in left ring.
        </div>
      </div>

      <div style={{ padding: '20px 16px 0', display: 'flex', gap: 8 }}>
        <div className="chunky" style={{ flex: 1, padding: '12px 0', textAlign: 'center', fontSize: 13, background: 'var(--cream)', boxShadow: '3px 3px 0 var(--ink)' }}>
          SHARE
        </div>
        <div className="chunky" style={{ flex: 1, padding: '12px 0', textAlign: 'center', fontSize: 13, background: 'var(--ink)', color: 'var(--mustard)', boxShadow: '3px 3px 0 var(--red)' }}>
          DONE
        </div>
      </div>

      <TabBar active="log" />
    </div>
  );
}

Object.assign(window, {
  V1_Recommended, V1_Empty, V1_Lead, V1_DetailSheet, V1_AfterCommit, V1_Summary,
});
