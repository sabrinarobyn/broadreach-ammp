/* ============================================================
   Broadreach Platform — app shell, routing & AMMP connection
   ============================================================ */
const { useState, useEffect } = React;

const SETTINGS = { accent: '#5d809a', density: 'comfortable', defaultLayout: 'grid', showLegend: true };

function Logo() {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '11px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
      <img src="assets/broadreach-logo.png" alt="Broadreach Energy" style={{ display: 'block', width: '100%', height: 'auto' }} />
    </div>
  );
}

function LucideIcon({ name, size = 18, strokeWidth = 1.75, color = 'currentColor', style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (host && typeof window !== 'undefined' && window.lucide) {
      host.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      host.appendChild(el);
      try {
        window.lucide.createIcons({ attrs: { width: size, height: size, 'stroke-width': strokeWidth, stroke: color }, nameAttr: 'data-lucide' });
      } catch (e) { /* lucide not ready */ }
    }
  }, [name, size, strokeWidth, color]);
  return <span ref={ref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }} />;
}

const NAV = [
  { k: 'portfolio', label: 'Portfolio', icon: 'layout-grid' },
  { k: 'deepdive', label: 'Site Deep Dive', icon: 'activity' },
  { k: 'grapher', label: 'Grapher', icon: 'line-chart' },
  { k: 'schedule', label: 'O&M Schedule', icon: 'clipboard-list' },
  { k: 'reports', label: 'Reports', icon: 'file-text' },
  { k: 'settings', label: 'Settings', icon: 'settings' },
];

function signOutOfAmmp(ammp) {
  ammp.disconnect();
  location.href = '../index.html';
}

function Sidebar({ nav, setNav, live, urgent }) {
  const ammp = useAmmp();
  return (
    <aside style={{ width: 218, background: 'var(--br-dker)', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '18px 14px' }}>
      <div style={{ padding: '0 4px 18px' }}><Logo /></div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {NAV.map(n => (
          <button key={n.k} onClick={() => setNav(n.k)} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 8, border: 'none',
            background: nav === n.k ? 'rgba(255,255,255,0.12)' : 'transparent', color: nav === n.k ? '#fff' : 'rgba(255,255,255,0.62)',
            fontSize: '0.8rem', fontWeight: nav === n.k ? 700 : 500, textAlign: 'left', position: 'relative', transition: 'background .12s',
          }}>
            <span style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.92 }}><LucideIcon name={n.icon} size={17} color={nav === n.k ? '#fff' : 'rgba(255,255,255,0.62)'} /></span>{n.label}
            {n.k === 'schedule' && urgent > 0 && <span style={{ marginLeft: 'auto', background: 'var(--rd)', color: '#fff', fontSize: '0.56rem', fontWeight: 700, borderRadius: 10, padding: '1px 7px', fontFamily: 'var(--font-mono)' }}>{urgent}</span>}
          </button>
        ))}
      </nav>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: live ? 'var(--grn)' : 'var(--amb)' }} className={live ? 'live-dot' : ''}></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>AMMP {live ? 'connected' : 'offline'}</div>
            <div className="mono" style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.5)' }}>{live ? 'streaming via ammp-proxy' : 'authenticate to stream'}</div>
          </div>
          {live && <button onClick={() => signOutOfAmmp(ammp)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', textDecoration: 'underline', padding: 0 }}>Sign out</button>}
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title, crumb, live, onConnect }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  return (
    <header style={{ height: 60, background: '#fff', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0, zIndex: 10 }}>
      <div style={{ flex: 1 }}>
        {crumb && <div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)', marginBottom: 1 }}>{crumb}</div>}
        <div className="display" style={{ fontSize: '1.35rem', color: 'var(--br-dker)', letterSpacing: '-0.01em' }}>{title}</div>
      </div>
      <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--ink-light)', textAlign: 'right' }}>
        <div>{now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      {live ? (
        <span className="pill" style={{ background: 'var(--grn-lt)', borderColor: 'transparent', color: 'var(--grn-ink)' }}><span className="live-dot"></span> LIVE · {BR_DATA.totals.count} sites</span>
      ) : (
        <button className="btn btn-sm" onClick={onConnect}>Connect AMMP</button>
      )}
    </header>
  );
}

function Placeholder({ title }) {
  return (
    <div className="card" style={{ padding: 56, textAlign: 'center' }}>
      <div className="display" style={{ fontSize: '1.6rem', color: 'var(--br-dk)', marginBottom: 8 }}>{title}</div>
      <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-light)' }}>Module preview — not part of this prototype scope.</div>
    </div>
  );
}

function AppShell() {
  const ammp = useAmmp();
  const [nav, setNav] = useState('portfolio');
  const [siteId, setSiteId] = useState(null);
  const [layout, setLayout] = useState(SETTINGS.defaultLayout);

  const live = ammp.live;
  const openSite = (id) => { setSiteId(id); window.scrollTo(0, 0); };
  const back = () => setSiteId(null);
  const goConnect = () => { setSiteId(null); setNav('portfolio'); };

  const styleVars = {
    '--br': SETTINGS.accent,
    '--gap': '12px',
    '--card-pad': '14px',
  };

  const site = siteId ? BR_DATA.sites.find(s => s.id === siteId) : null;
  let title = 'Portfolio Overview', crumb = null, body;
  if (site) {
    title = site.name; crumb = 'Portfolio › ' + site.province;
    body = <SiteView siteId={siteId} live={live} onBack={back} />;
  } else if (nav === 'schedule') {
    title = 'O&M Schedule'; body = <div style={{ maxWidth: 1100 }}><Schedule onOpen={openSite} /></div>;
  } else if (nav === 'deepdive') {
    title = 'Site Deep Dive'; crumb = 'Single-site analysis'; body = <DeepDiveView live={live} />;
  } else if (nav === 'grapher') {
    title = 'Grapher'; crumb = 'Power vs inverter temperature, per AMMP asset'; body = <GrapherView />;
  } else if (nav === 'reports') {
    title = 'Reports'; body = <Placeholder title="Reports" />;
  } else if (nav === 'settings') {
    title = 'Settings'; body = <Placeholder title="Settings" />;
  } else {
    title = 'Portfolio Overview';
    crumb = live ? `Live · ${ammp.matchedCount} of ${BR_DATA.totals.count} sites matched to AMMP` : 'Offline · sample data';
    body = <PortfolioView live={live} onOpen={openSite} layout={layout} setLayout={setLayout} showLegend={SETTINGS.showLegend} />;
  }

  return (
    <div style={{ ...styleVars, display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Sidebar nav={site ? null : nav} setNav={(k) => { setSiteId(null); setNav(k); }} live={live} urgent={BR_DATA.totals.urgent} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title={title} crumb={crumb} live={live} onConnect={goConnect} />
        <main className="scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 24px 60px' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto' }}>{body}</div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AmmpProvider sites={BR_DATA.sites}>
      <AppShell />
    </AmmpProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
