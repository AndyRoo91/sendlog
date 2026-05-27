/* system.jsx — shared chrome: tab bar, ribbons, ornaments, mock-current */

// ─── Tattoo flash ornaments (kept simple — squares/circles/rays/banners) ───

function Ray({ size = 220, color = 'var(--mustard)', style = {} }) {
  // 16-wedge starburst behind important elements
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: 'block', ...style }}>
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i * 360) / 16;
        return (
          <polygon
            key={i}
            points="100,10 95,100 105,100"
            fill={color}
            stroke="var(--ink)"
            strokeWidth="2"
            transform={`rotate(${a} 100 100)`}
          />
        );
      })}
      <circle cx="100" cy="100" r="42" fill="var(--cream)" stroke="var(--ink)" strokeWidth="3" />
    </svg>
  );
}

function StarBurst({ size = 50, color = 'var(--red)' }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <polygon
        points="50,5 58,38 92,38 64,58 75,92 50,72 25,92 36,58 8,38 42,38"
        fill={color}
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Ribbon({ children, color = 'var(--ink)', textColor = 'var(--cream)', rotate = 0, style = {}, font = 'banner' }) {
  // banner with notched tails left/right
  const fontMap = { banner: 'var(--font-banner)', display: 'var(--font-display)', hand: 'var(--font-hand)' };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'stretch', transform: `rotate(${rotate}deg)`, ...style }}>
      <svg width="14" height="100%" viewBox="0 0 14 40" preserveAspectRatio="none" style={{ display: 'block' }}>
        <polygon points="14,0 0,20 14,40" fill={color} stroke="var(--ink)" strokeWidth="2" />
      </svg>
      <div style={{
        background: color, color: textColor,
        padding: '7px 12px', fontFamily: fontMap[font] || fontMap.banner,
        borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)',
        letterSpacing: '0.05em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
      }}>
        {children}
      </div>
      <svg width="14" height="100%" viewBox="0 0 14 40" preserveAspectRatio="none" style={{ display: 'block' }}>
        <polygon points="0,0 14,20 0,40" fill={color} stroke="var(--ink)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function Scroll({ children, color = 'var(--mustard)', style = {} }) {
  // a scroll-shaped banner with curls at each end — for headers
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
      {/* left curl */}
      <svg width="22" height="44" viewBox="0 0 22 44">
        <path d="M22 0 L8 0 Q0 0 0 12 L0 32 Q0 44 8 44 L22 44 Z"
          fill={color} stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="8" cy="22" r="5" fill="var(--cream)" stroke="var(--ink)" strokeWidth="2" />
      </svg>
      <div style={{
        background: color,
        borderTop: '2.5px solid var(--ink)',
        borderBottom: '2.5px solid var(--ink)',
        padding: '8px 16px',
        fontFamily: 'var(--font-banner)',
        fontSize: 14,
        color: 'var(--ink)',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </div>
      <svg width="22" height="44" viewBox="0 0 22 44">
        <path d="M0 0 L14 0 Q22 0 22 12 L22 32 Q22 44 14 44 L0 44 Z"
          fill={color} stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="14" cy="22" r="5" fill="var(--cream)" stroke="var(--ink)" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ─── Tab bar ───

const ICON = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" /><path d="M5 10v11h14V10" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M7 12h10" />
    </svg>
  ),
  charts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16" /><path d="M7 16V9M12 16V4M17 16v-6" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
};

function TabBar({ active = 'log' }) {
  const tabs = [
    { id: 'home', label: 'HOME', icon: ICON.home },
    { id: 'sessions', label: 'SESSIONS', icon: ICON.list },
    { id: 'log', label: 'LOG IT', icon: ICON.log },
    { id: 'charts', label: 'CHARTS', icon: ICON.charts },
  ];
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div key={t.id} className={`tab ${active === t.id ? 'active' : ''}`}>
          {t.icon}
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Top status strip — session-in-progress chip ───

function SessionStrip({ where = 'BLOC SHOP', elapsed = '47:23', date = 'TUE · 26 MAY' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '60px 16px 12px',
      background: 'var(--ink)',
      color: 'var(--cream)',
      borderBottom: 'var(--bw) solid var(--ink)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, color: 'var(--mustard)', letterSpacing: '0.1em' }}>
          ★ SESSION IN PROGRESS
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.02em' }}>
          {where}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 10, color: 'var(--paper)', opacity: 0.6, letterSpacing: '0.1em' }}>
          {date}
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--cream)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
        }}>
          {elapsed}
        </div>
      </div>
    </div>
  );
}

// ─── Grade chip — chunky outlined rectangle ───

function GradeChip({ grade, color = 'var(--cream)', tally = 0, big = false, style = {} }) {
  const w = big ? 80 : 64;
  const h = big ? 80 : 60;
  return (
    <div style={{
      width: w, height: h,
      border: 'var(--bw) solid var(--ink)',
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontSize: big ? 32 : 24,
      color: 'var(--ink)',
      position: 'relative',
      boxShadow: '3px 3px 0 var(--ink)',
      ...style,
    }}>
      {grade}
      {tally > 0 && (
        <div style={{
          position: 'absolute', top: -10, right: -10,
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--red)', color: 'var(--cream)',
          border: '2px solid var(--ink)',
          fontFamily: 'var(--font-banner)', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {tally}
        </div>
      )}
    </div>
  );
}

// ─── Mock of current state for before/after context ───

function CurrentState() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#0f1117', color: '#e8eaf0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', overflow: 'hidden', position: 'relative' }}>
      {/* faux status bar */}
      <div style={{ height: 56, background: '#0f1117' }} />
      {/* nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a1d27' }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>🧗 ClimbLog</span>
        <div style={{ display: 'flex', gap: 14, fontSize: 13, color: '#7880a0' }}>
          <span>Dashboard</span><span>Sessions</span><span>Progress</span>
        </div>
      </div>
      {/* page */}
      <div style={{ padding: '24px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>New Session</h1>
          <button style={{ background: '#5b8dee', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>Save</button>
        </div>
        <div style={{ background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 10, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#7880a0', marginBottom: 4 }}>Date</div>
          <div style={{ background: '#22263a', border: '1px solid #2e3350', borderRadius: 10, padding: '8px 12px', fontSize: 14, marginBottom: 12 }}>2026-05-26</div>
          <div style={{ fontSize: 13, color: '#7880a0', marginBottom: 4 }}>Location</div>
          <div style={{ background: '#22263a', border: '1px solid #2e3350', borderRadius: 10, padding: '8px 12px', fontSize: 14, marginBottom: 12 }}>Bloc Shop</div>
          <div style={{ fontSize: 13, color: '#7880a0', marginBottom: 4 }}>Duration (min)</div>
          <div style={{ background: '#22263a', border: '1px solid #2e3350', borderRadius: 10, padding: '8px 12px', fontSize: 14 }}>—</div>
        </div>
        <div style={{ background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 10, padding: 20, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Lead Routes</h2>
            <button style={{ background: '#22263a', border: '1px solid #2e3350', color: '#e8eaf0', padding: '4px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>+ Add</button>
          </div>
          <p style={{ color: '#7880a0', fontSize: 13, margin: 0 }}>No routes yet.</p>
        </div>
        <div style={{ background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 10, padding: 20, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Boulders</h2>
            <button style={{ background: '#22263a', border: '1px solid #2e3350', color: '#e8eaf0', padding: '4px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>+ Add</button>
          </div>
          <p style={{ color: '#7880a0', fontSize: 13, margin: 0 }}>No boulders yet.</p>
        </div>
        <div style={{ background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Fingerboard</h2>
            <button style={{ background: '#22263a', border: '1px solid #2e3350', color: '#e8eaf0', padding: '4px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>+ Add</button>
          </div>
          <p style={{ color: '#7880a0', fontSize: 13, margin: 0 }}>No entries.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Mood / system tile — palette + type + ornaments ───

function MoodBoard() {
  const swatch = (label, color, text = 'var(--cream)') => (
    <div style={{
      background: color, color: text,
      padding: '8px 10px',
      border: 'var(--b) solid var(--ink)',
      fontFamily: 'var(--font-banner)', fontSize: 11,
      letterSpacing: '0.06em',
      display: 'flex', justifyContent: 'space-between',
      boxShadow: '2px 2px 0 var(--ink)',
    }}>
      <span>{label}</span>
      <span style={{ opacity: 0.7 }}>{color.replace('var(--', '').replace(')', '').toUpperCase()}</span>
    </div>
  );

  return (
    <div className="paper" style={{ padding: '24px 20px', overflow: 'auto' }}>
      <div style={{ marginBottom: 14 }}>
        <Ribbon color="var(--red)" font="banner">★ SENDLOG · SYSTEM ★</Ribbon>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 0.95, margin: '8px 0 18px', letterSpacing: '-0.01em' }}>
        SEND IT.<br/>LOG IT.<br/>
        <span style={{ color: 'var(--red)' }}>BURN</span> IT.
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {swatch('PAPER', 'var(--paper)', 'var(--ink)')}
        {swatch('INK', 'var(--ink)', 'var(--cream)')}
        {swatch('RED', 'var(--red)', 'var(--cream)')}
        {swatch('MUSTARD', 'var(--mustard)', 'var(--ink)')}
        {swatch('SEA', 'var(--sea)', 'var(--cream)')}
        {swatch('COBALT', 'var(--cobalt)', 'var(--cream)')}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, letterSpacing: '0.1em', marginBottom: 8, color: 'var(--ink-2)' }}>TYPE</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1 }}>Alfa Slab One</div>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 22, lineHeight: 1.1 }}>BUNGEE · BANNERS</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4 }}>Outfit — body copy &amp; chips. Quiet, modern, neutral.</div>
        <div style={{ fontFamily: 'var(--font-hand)', fontSize: 20, lineHeight: 1.1, color: 'var(--red)' }}>Permanent Marker — notes</div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-banner)', fontSize: 11, letterSpacing: '0.1em', marginBottom: 8, color: 'var(--ink-2)' }}>ORNAMENTS</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
          <StarBurst size={42} color="var(--mustard)" />
          <StarBurst size={42} color="var(--red)" />
          <StarBurst size={42} color="var(--sea)" />
          <div style={{ width: 50, height: 50, background: 'var(--cobalt)', border: 'var(--bw) solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Ribbon color="var(--mustard)" textColor="var(--ink)">FLASH</Ribbon>
          <Ribbon color="var(--sea)">SEND</Ribbon>
          <Ribbon color="var(--cobalt)">PROJ</Ribbon>
          <Ribbon color="var(--red)">FALL</Ribbon>
        </div>
      </div>

      <div style={{
        background: 'var(--cream)', border: 'var(--bw) solid var(--ink)',
        boxShadow: '4px 4px 0 var(--ink)', padding: 12,
        fontFamily: 'var(--font-hand)', color: 'var(--red)',
        fontSize: 16, transform: 'rotate(-1.5deg)',
      }}>
        “every screen is a piece of flash. heavy outlines,<br/>flat fills, banners that scream what they do.”
      </div>
    </div>
  );
}

Object.assign(window, {
  Ray, StarBurst, Ribbon, Scroll, TabBar, SessionStrip, GradeChip, CurrentState, MoodBoard, ICON,
});
