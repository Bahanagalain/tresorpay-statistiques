import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle, Clock, AlertTriangle,
  Building2, Ship, ChevronDown, ChevronUp, Search, Filter, Download,
  RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Globe,
  FileSpreadsheet, Package,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import GaugeChart from '../components/ui/GaugeChart';
import { exportToExcel } from '../utils/exportUtils';
import {
  KPI_DGD, EVOLUTION_MENSUELLE_DGD, PAR_BUREAU, PAR_TYPE_MARCHANDISE,
  DECLARATIONS_DOUANE, PAR_PAYS_ORIGINE
} from '../data/dgdData';
import './DGDReport.css';

const fmt = (n) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)} Md`
  : n >= 1_000_000   ? `${(n / 1_000_000).toFixed(2)} M`
  : n >= 1_000       ? `${(n / 1_000).toFixed(0)} K`
  : n.toString();

const fmtFull = (n) => n.toLocaleString('fr-FR') + ' FCFA';

const STATUT_CONFIG = {
  VALIDE:     { label: 'Validé',     cls: 'orb-paid',    icon: CheckCircle   },
  EN_ATTENTE: { label: 'En attente', cls: 'orb-pending',  icon: Clock         },
  LITIGIEUX:  { label: 'Litigieux',  cls: 'orb-overdue',  icon: AlertTriangle },
};

function useCountUp(target, duration = 1500) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

const SEEDS = {
  primary:  [{ v:980 },{ v:870 },{ v:1600 }],
  default:  [{ v:2200 },{ v:2550 },{ v:2847 }],
  success:  [{ v:1620 },{ v:1580 },{ v:2103 }],
  warning:  [{ v:350 },{ v:480 },{ v:512 }],
  danger:   [{ v:180 },{ v:280 },{ v:232 }],
};
const SPARK_COLORS = { primary:'#2563EB', default:'#6366F1', success:'#059669', warning:'#D97706', danger:'#DC2626' };

function Sparkline({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={34}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35}/>
            <stop offset="100%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sp${color.replace('#','')})`} dot={false} isAnimationActive animationDuration={1100}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({ icon: Icon, label, value, numericValue, sub, variant = 'default', trend }) {
  const count = useCountUp(numericValue ?? 0);
  const sparkData  = SEEDS[variant] || SEEDS.default;
  const sparkColor = SPARK_COLORS[variant] || '#6366F1';
  const displayVal = numericValue !== undefined
    ? (value.includes('Md') || value.includes('M') || value.includes('K')
        ? value.replace(/[\d.]+/, fmt(count === 0 ? numericValue : count))
        : count.toLocaleString('fr-FR'))
    : value;
  return (
    <div className={`dgd-kpi-card kpi-${variant}`}>
      <div className="dgd-kpi-card__top">
        <div className="dgd-kpi-card__icon"><Icon size={18}/></div>
        {trend !== undefined && (
          <div className={`dgd-kpi-card__trend ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
            {trend >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="dgd-kpi-card__body">
        <span className="dgd-kpi-card__label">{label}</span>
        <div className="dgd-kpi-card__value">{displayVal}</div>
        {sub && <span className="dgd-kpi-card__sub">{sub}</span>}
      </div>
      <div className="dgd-kpi-card__sparkline">
        <Sparkline data={sparkData} color={sparkColor}/>
      </div>
    </div>
  );
}

const DGDTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dgd-tooltip">
      <p className="dgd-tooltip__label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{fmtFull(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

function TreemapCell({ x, y, width, height, name, value, color }) {
  if (width < 20 || height < 20) return null;
  return (
    <g>
      <rect x={x+1} y={y+1} width={width-2} height={height-2}
        fill={color || '#2563EB'} stroke="var(--bg-surface)" strokeWidth={2} rx={5}/>
      {width > 70 && height > 35 && (
        <>
          <text x={x+width/2} y={y+height/2-7} textAnchor="middle" fill="white" fontSize={Math.min(11,width/9)} fontWeight={600} fontFamily="Inter,sans-serif">
            {name?.length > 16 ? name.slice(0,16)+'...' : name}
          </text>
          <text x={x+width/2} y={y+height/2+9} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize={Math.min(9,width/11)} fontFamily="Inter,sans-serif">
            {fmt(value)} FCFA
          </text>
        </>
      )}
    </g>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={13} className="sort-icon neutral"/>;
  return sortDir === 'asc'
    ? <ArrowUp size={13} className="sort-icon active"/>
    : <ArrowDown size={13} className="sort-icon active"/>;
}

function DeclarationRow({ dec }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUT_CONFIG[dec.statut];
  const Icon = cfg.icon;
  return (
    <>
      <tr className="dgd-row" onClick={() => setOpen(!open)}>
        <td><code className="dec-numero">{dec.numero}</code></td>
        <td>
          <div className="dec-declarant">{dec.declarant}</div>
          <span className="dec-ninea">{dec.ninea}</span>
        </td>
        <td><span className="bureau-badge">{dec.bureau}</span></td>
        <td className="dec-marchandise">{dec.typeMarchandise}</td>
        <td className="text-right dec-montant">{fmtFull(dec.montantTotal)}</td>
        <td>
          <span className={`statut-orb ${cfg.cls}`}><Icon size={10}/> {cfg.label}</span>
        </td>
        <td className="text-right dec-date">{dec.dateDepot}</td>
        <td className="expand-toggle">{open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</td>
      </tr>
      {open && (
        <tr className="dec-detail-row">
          <td colSpan={8}>
            <div className="dec-detail-panel">
              <div className="dec-detail-grid">
                <div className="dec-detail-item">
                  <span className="dec-detail-lbl">Pays d'origine</span>
                  <span className="dec-detail-val"><Globe size={13}/> {dec.pays}</span>
                </div>
                <div className="dec-detail-item">
                  <span className="dec-detail-lbl">Regime douanier</span>
                  <span className="dec-detail-val">{dec.regime}</span>
                </div>
                <div className="dec-detail-item">
                  <span className="dec-detail-lbl">Droits de douane</span>
                  <span className="dec-detail-val" style={{ color:'#2563EB' }}>{fmtFull(dec.droitsDouane)}</span>
                </div>
                <div className="dec-detail-item">
                  <span className="dec-detail-lbl">TVA a l'importation</span>
                  <span className="dec-detail-val" style={{ color:'#6366F1' }}>{fmtFull(dec.tvaImport)}</span>
                </div>
                <div className="dec-detail-item">
                  <span className="dec-detail-lbl">Valeur CAF totale</span>
                  <span className="dec-detail-val" style={{ color:'#059669', fontWeight:700 }}>{fmtFull(dec.montantTotal)}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DGDReport() {
  const [search, setSearch]           = useState('');
  const [filterStatut, setFilter]     = useState('TOUS');
  const [sortCol, setSortCol]         = useState(null);
  const [sortDir, setSortDir]         = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab]     = useState('overview');
  const PAGE_SIZE = 8;

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const decFiltres = useMemo(() => {
    let list = DECLARATIONS_DOUANE.filter(d => {
      const matchSearch = d.numero.includes(search) || d.declarant.toLowerCase().includes(search.toLowerCase()) || d.ninea.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filterStatut === 'TOUS' || d.statut === filterStatut;
      return matchSearch && matchStatut;
    });
    if (sortCol) {
      list = [...list].sort((a, b) => {
        let va = a[sortCol]; let vb = b[sortCol];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
        return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
      });
    }
    return list;
  }, [search, filterStatut, sortCol, sortDir]);

  useEffect(() => setCurrentPage(1), [decFiltres.length]);
  const totalPages = Math.ceil(decFiltres.length / PAGE_SIZE);
  const decPage    = decFiltres.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExportExcel = () => {
    const headers = ['N° Declaration', 'Declarant', 'NINEA', 'Bureau', 'Type Marchandise', 'Montant Total', 'Droits Douane', 'TVA Import', 'Statut', 'Date', 'Pays'];
    const data = decFiltres.map(d => [d.numero, d.declarant, d.ninea, d.bureau, d.typeMarchandise, d.montantTotal, d.droitsDouane, d.tvaImport, d.statut, d.dateDepot, d.pays]);
    exportToExcel(data, headers, 'DGD Declarations', `DGD_Dec_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Export Excel DGD telecharge !');
  };

  const treemapData = PAR_TYPE_MARCHANDISE.map(t => ({ name: t.type, size: t.montant, color: t.color }));

  return (
    <div className="dgd-page animate-fade-in">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }}/>

      <div className="dgd-header">
        <div className="dgd-header-left">
          <div className="dgd-dept-icon"><Ship size={28}/></div>
          <div>
            <h1 className="dgd-page-title">Statistiques DGD</h1>
            <p className="dgd-page-sub">Direction Generale des Douanes -- Declarations et recouvrement douanier</p>
          </div>
        </div>
        <div className="dgd-header-right">
          <button className="dgd-btn outline" onClick={() => { toast.loading('Actualisation...', { duration: 1200 }); }}>
            <RefreshCw size={14}/> Actualiser
          </button>
          <button className="dgd-btn primary" onClick={handleExportExcel}>
            <FileSpreadsheet size={14}/> Excel
          </button>
        </div>
      </div>

      <div className="dgd-kpi-grid">
        <KpiCard icon={TrendingUp}    label="Total Recouvre"     value={`${fmt(KPI_DGD.totalRecouvreDouane)} FCFA`} numericValue={KPI_DGD.totalRecouvreDouane} sub="Cumul Mars 2026" variant="primary" trend={KPI_DGD.progressionMoisPrecedent}/>
        <KpiCard icon={FileText}      label="Declarations"       value={KPI_DGD.totalDeclarations.toLocaleString()} numericValue={KPI_DGD.totalDeclarations}     sub="Periode en cours" variant="default"/>
        <KpiCard icon={CheckCircle}   label="Validees"           value={KPI_DGD.declarationsValidees.toLocaleString()} numericValue={KPI_DGD.declarationsValidees} sub={`${Math.round(KPI_DGD.declarationsValidees/KPI_DGD.totalDeclarations*100)}% du total`} variant="success" trend={5}/>
        <KpiCard icon={Clock}         label="En Attente"         value={KPI_DGD.declarationsEnAttente.toLocaleString()} numericValue={KPI_DGD.declarationsEnAttente} sub={fmtFull(KPI_DGD.montantEnAttente)} variant="warning" trend={-2}/>
        <KpiCard icon={AlertTriangle} label="Litigieuses"        value={KPI_DGD.declarationsLitigieuses.toLocaleString()} numericValue={KPI_DGD.declarationsLitigieuses} sub={fmtFull(KPI_DGD.montantLitigieux)} variant="danger" trend={-8}/>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="module-tabs-wrapper">
        <div className="module-tabs">
          <button className={`module-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Aperçu Stratégique</button>
          <button className={`module-tab ${activeTab === 'bureau' ? 'active' : ''}`} onClick={() => setActiveTab('bureau')}>Bureaux & Origines</button>
          <button className={`module-tab ${activeTab === 'marchandises' ? 'active' : ''}`} onClick={() => setActiveTab('marchandises')}>Marchandises</button>
          <button className={`module-tab ${activeTab === 'registre' ? 'active' : ''}`} onClick={() => setActiveTab('registre')}>Registre</button>
        </div>
      </div>

      <div className="tab-content-area">
        {/* ── TAB : OVERVIEW ────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="tab-pane animate-fade-in">
            <div className="dgd-charts-row dgd-charts-row--3-1">
              <div className="dgd-chart-card">
                <div className="dgd-chart-header">
                  <h2 className="dgd-chart-title">Evolution Mensuelle des Recouvrements</h2>
                  <span className="dgd-chart-sub">Jan - Mar 2026</span>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={EVOLUTION_MENSUELLE_DGD} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dgdvalide"    x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/><stop offset="95%" stopColor="#2563EB" stopOpacity={0}/></linearGradient>
                      <linearGradient id="dgdattente"   x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.3}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient>
                      <linearGradient id="dgdlitigieux" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/><stop offset="95%" stopColor="#DC2626" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)"/>
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }}/>
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }}/>
                    <Tooltip content={<DGDTooltip/>}/>
                    <Legend/>
                    <Area type="monotone" dataKey="valide"    name="Valide"     stroke="#2563EB" fill="url(#dgdvalide)"    strokeWidth={2} isAnimationActive animationDuration={1400}/>
                    <Area type="monotone" dataKey="enAttente" name="En attente" stroke="#D97706" fill="url(#dgdattente)"   strokeWidth={2} isAnimationActive animationDuration={1600}/>
                    <Area type="monotone" dataKey="litigieux" name="Litigieux"  stroke="#DC2626" fill="url(#dgdlitigieux)" strokeWidth={2} isAnimationActive animationDuration={1800}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="dgd-chart-card gauge-card">
                <div className="dgd-chart-header">
                  <h2 className="dgd-chart-title">Taux de Dedouanement</h2>
                </div>
                <div className="gauge-center">
                  <GaugeChart value={KPI_DGD.tauxDedouanement} max={100} label="Dedouanement" color="#2563EB" size={180} thickness={16}/>
                </div>
                <div className="gauge-legend">
                  <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#DC2626' }}/> &lt;60% Critique</div>
                  <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#D97706' }}/> 60-79% Attention</div>
                  <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#2563EB' }}/> &gt;=80% Conforme</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB : BUREAU ──────────────────────────────── */}
        {activeTab === 'bureau' && (
          <div className="tab-pane animate-fade-in">
            <div className="dgd-charts-row">
              <div className="dgd-chart-card">
                <div className="dgd-chart-header">
                  <h2 className="dgd-chart-title">Recouvrement par Bureau de Douane</h2>
                  <span className="dgd-chart-sub">Montant total valide</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={PAR_BUREAU} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false}/>
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }}/>
                    <YAxis type="category" dataKey="bureau" width={165} tick={{ fontSize: 10 }}/>
                    <Tooltip content={<DGDTooltip/>}/>
                    <Bar dataKey="montant" name="Montant recouvre" radius={[0,4,4,0]} isAnimationActive animationDuration={1200}>
                      {PAR_BUREAU.map((e, i) => <Cell key={i} fill={e.color || `hsl(${210+i*10},70%,${45+i*2}%)`}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="dgd-chart-card">
                <div className="dgd-chart-header">
                  <h2 className="dgd-chart-title"><Globe size={16}/> Pays d'Origine</h2>
                  <span className="dgd-chart-sub">Top importateurs</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={PAR_PAYS_ORIGINE.slice(0,6)} cx="50%" cy="50%" innerRadius={48} outerRadius={75}
                      dataKey="montant" nameKey="pays" stroke="none" isAnimationActive animationDuration={1200} animationBegin={300}>
                      {PAR_PAYS_ORIGINE.map((_,i) => <Cell key={i} fill={`hsl(${215+i*18},65%,${45+i*3}%)`}/>)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [fmtFull(v), n]}/>
                    <Legend/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pays-list">
                  {PAR_PAYS_ORIGINE.slice(0,5).map((p, i) => (
                    <div key={p.pays} className="pays-item">
                      <span className="pays-item__rank" style={{ background:`hsl(${215+i*18},65%,45%)` }}>{i+1}</span>
                      <span className="pays-item__nom">{p.pays}</span>
                      <span className="pays-item__pct">{p.pct}%</span>
                      <span className="pays-item__mt">{fmt(p.montant)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB : MARCHANDISES ────────────────────────── */}
        {activeTab === 'marchandises' && (
          <div className="tab-pane animate-fade-in">
            <div className="dgd-chart-card">
              <div className="dgd-chart-header">
                <h2 className="dgd-chart-title"><Package size={16}/> Repartition par Type de Marchandise -- Treemap</h2>
                <span className="dgd-chart-sub">Surface proportionnelle au montant</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <Treemap data={treemapData} dataKey="size" aspectRatio={16/5} stroke="var(--bg-surface)"
                  isAnimationActive animationDuration={1200} content={<TreemapCell/>}>
                  <Tooltip formatter={(v, n, p) => [`${fmtFull(v)}`, p?.payload?.name]}/>
                </Treemap>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── TAB : REGISTRE ────────────────────────────── */}
        {activeTab === 'registre' && (
          <div className="tab-pane animate-fade-in">
            <div className="dgd-registre">
              <div className="dgd-registre-header">
                <h2 className="dgd-chart-title">Registre des Declarations en Douane</h2>
                <div className="dgd-controls">
                  <div className="search-box">
                    <Search size={14}/>
                    <input className="search-input" placeholder="N declaration, declarant, NINEA..." value={search} onChange={e => setSearch(e.target.value)}/>
                    {search && <button className="search-clear" onClick={() => setSearch('')}>x</button>}
                  </div>
                  <div className="filter-group">
                    <Filter size={13}/>
                    <select className="filter-select" value={filterStatut} onChange={e => setFilter(e.target.value)}>
                      <option value="TOUS">Tous statuts</option>
                      <option value="VALIDE">Valide</option>
                      <option value="EN_ATTENTE">En attente</option>
                      <option value="LITIGIEUX">Litigieux</option>
                    </select>
                  </div>
                  {(search || filterStatut !== 'TOUS') && (
                    <button className="dgd-btn outline reset-btn" onClick={() => { setSearch(''); setFilter('TOUS'); }}>
                      <RotateCcw size={13}/> Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="table-wrapper">
                <table className="dgd-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => handleSort('numero')}>N Decl. <SortIcon col="numero" sortCol={sortCol} sortDir={sortDir}/></th>
                      <th className="sortable" onClick={() => handleSort('declarant')}>Declarant <SortIcon col="declarant" sortCol={sortCol} sortDir={sortDir}/></th>
                      <th>Bureau</th>
                      <th>Marchandise</th>
                      <th className="text-right sortable" onClick={() => handleSort('montantTotal')}>Montant <SortIcon col="montantTotal" sortCol={sortCol} sortDir={sortDir}/></th>
                      <th className="sortable" onClick={() => handleSort('statut')}>Statut <SortIcon col="statut" sortCol={sortCol} sortDir={sortDir}/></th>
                      <th className="text-right sortable" onClick={() => handleSort('dateDepot')}>Date <SortIcon col="dateDepot" sortCol={sortCol} sortDir={sortDir}/></th>
                      <th/>
                    </tr>
                  </thead>
                  <tbody>
                    {decPage.length ? (
                      decPage.map(d => <DeclarationRow key={d.numero} dec={d}/>)
                    ) : (
                      <tr><td colSpan={8} style={{ padding:'2.5rem', textAlign:'center', color:'var(--text-tertiary)', fontSize:'0.85rem' }}>
                        Aucune declaration trouvee.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <span>{decFiltres.length} declaration(s) sur {DECLARATIONS_DOUANE.length}</span>
                {totalPages > 1 && (
                  <div className="pagination">
                    <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p-1)}>prev</button>
                    {Array.from({ length: totalPages }, (_,i) => i+1).map(p => (
                      <button key={p} className={`page-btn ${currentPage === p ? 'active-dgd' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                    ))}
                    <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p+1)}>next</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
