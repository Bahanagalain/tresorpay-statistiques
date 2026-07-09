import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell,
} from 'recharts';
import {
  Building2, Search, X, ArrowUp, ArrowDown, ArrowUpDown, Activity,
  ChevronLeft, CheckCircle, Clock, AlertTriangle, Users, FileText, DollarSign,
  PieChart, TrendingUp, CreditCard, LayoutDashboard, Target, BarChart3,
} from 'lucide-react';
import CountUp from '../components/ui/CountUp';
import { fetchRepartitionMinisteres, fetchMinistereDetail, fetchMinistereComparison } from '../api/analyticsApi';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { usePresentMode } from '../components/layout/MainLayout';
import { formatEntier, formatMontant } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './PerformanceCDI.css';

const fmtFull = (n) => formatMontant(n);
const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n ?? 0);


const STATUT_CONFIG = {
  PAID: { cls: 'statut-paid', label: 'Payé', icon: CheckCircle },
  PENDING: { cls: 'statut-pending', label: 'En attente', icon: Clock },
  FAILED: { cls: 'statut-failed', label: 'Échoué', icon: AlertTriangle },
};

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={12} className="sort-icon neutral" />;
  return sortDir === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />;
}

// ─── Ministry Detail Panel (4 Tabs) ────────────────────────────
const DETAIL_TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'services', label: 'Services', icon: PieChart },
  { id: 'soumissions', label: 'Soumissions', icon: Users },
  { id: 'tendances', label: 'Tendances', icon: TrendingUp },
];

const PIE_COLORS = ['#059669', '#D97706', '#DC2626'];

function MinistereDetailPanel({ ministereId, dateRange: initialDateRange = {}, onBack }) {
  const [detail, setDetail] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailDateRange, setDetailDateRange] = useState(initialDateRange);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchSoumetteur, setSearchSoumetteur] = useState('');
  const [soumetteurFilter, setSoumetteurFilter] = useState('all');
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMinistereDetail(ministereId, detailDateRange),
      fetchMinistereComparison(ministereId, detailDateRange).catch(() => null),
    ]).then(([d, c]) => { setDetail(d); setComparison(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ministereId, detailDateRange]);

  if (loading) {
    return (
      <div className="cdi-detail-panel">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <div className="exec-loading"><WeaveSpinner size={80} message="Chargement..." /></div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="cdi-detail-panel">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>Aucune donnée disponible pour ce ministère.</p>
      </div>
    );
  }

  const taux = detail.tauxPaiement || 0;
  const montantEnAttente = (detail.totalSoumissions - detail.soumissionsPayees) > 0
    ? detail.totalRevenus * ((100 - taux) / 100)
    : 0;
  const pieData = [
    { name: 'Payées', value: detail.soumissionsPayees, color: '#059669' },
    { name: 'En attente', value: detail.soumissionsEnAttente || (detail.totalSoumissions - detail.soumissionsPayees - (detail.soumissionsEchouees || 0)), color: '#D97706' },
    { name: 'Échouées', value: detail.soumissionsEchouees || 0, color: '#DC2626' },
  ].filter(d => d.value > 0);

  return (
    <div className="cdi-detail-panel">
      {/* Top bar */}
      <div className="cdi-detail-topbar">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <DatePresetFilter onChange={setDetailDateRange} />
      </div>

      {/* Header + KPIs */}
      <div className="cdi-detail-header">
        <div className="cdi-detail-icon" style={detail.ministere?.couleur ? { color: detail.ministere.couleur } : {}}><Building2 size={28} /></div>
        <div>
          <h2 className="cdi-detail-name">{detail.ministere?.nomFr || 'Ministère'}</h2>
          {detail.ministere?.code && <p className="cdi-detail-sub">Code : {detail.ministere.code}</p>}
        </div>
      </div>

      <div className="cdi-detail-kpis">
        <div className="cdi-dkpi" data-glow="green"><DollarSign size={18} className="text-dgi" /><div><span className="cdi-dkpi-val">{fmtFull(detail.totalRevenus)}</span><span className="cdi-dkpi-label">Revenus collectés</span></div></div>
        <div className="cdi-dkpi" data-glow="green"><FileText size={18} className="text-info" /><div><span className="cdi-dkpi-val">{detail.totalSoumissions}</span><span className="cdi-dkpi-label">Soumissions</span></div></div>
        <div className="cdi-dkpi" data-glow="green"><CheckCircle size={18} className="text-success" /><div><span className="cdi-dkpi-val">{detail.soumissionsPayees}</span><span className="cdi-dkpi-label">Payées</span></div></div>
        <div className="cdi-dkpi" data-glow="green">
          <div className={`taux-circle ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</div>
          <div><span className="cdi-dkpi-val">{detail.soumissionsPayees} / {detail.totalSoumissions}</span><span className="cdi-dkpi-label">Taux de paiement</span></div>
        </div>
      </div>

      <div className="cdi-detail-statuts">
        <div className="cdi-stat-pill paid"><CheckCircle size={14} /> {detail.soumissionsPayees} Payées</div>
        <div className="cdi-stat-pill pending"><Clock size={14} /> {detail.soumissionsEnAttente || (detail.totalSoumissions - detail.soumissionsPayees - (detail.soumissionsEchouees || 0))} En attente</div>
        <div className="cdi-stat-pill overdue"><AlertTriangle size={14} /> {detail.soumissionsEchouees || 0} Échouées</div>
      </div>

      {/* Tab navigation */}
      <div className="cdi-tabs">
        {DETAIL_TABS.map(t => { const I = t.icon; return (
          <button key={t.id} className={`cdi-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <I size={14} /> {t.label}
          </button>
        ); })}
      </div>

      {/* ─── TAB: Vue d'ensemble ─── */}
      {activeTab === 'overview' && (
        <div className="cdi-tab-content">
          <div className="overview-grid">
            {/* Evolution */}
            <div className="card" data-glow="blue">
              <h3 className="card-title">Évolution Mensuelle</h3>
              {detail.evolution && detail.evolution.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={detail.evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="periode" stroke="var(--chart-axis)" fontSize={11} />
                    <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                    <Tooltip formatter={(v) => fmtFull(v)} />
                    <Bar dataKey="paye" name="Payé" fill="#059669" radius={[4,4,0,0]} />
                    <Bar dataKey="enAttente" name="En attente" fill="#D97706" radius={[4,4,0,0]} />
                    <Bar dataKey="echoue" name="Échoué" fill="#DC2626" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="no-data-msg">Pas assez de données pour le graphique</p>}
            </div>

            {/* Donut statuts */}
            <div className="card" data-glow="blue">
              <h3 className="card-title">Répartition Statuts</h3>
              <ResponsiveContainer width="100%" height={180}>
                <RechartsPie>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatEntier(v)} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="overview-pie-legend">
                {pieData.map((d, i) => (
                  <div key={i} className="overview-legend-item"><span className="legend-dot" style={{ background: d.color }} />{d.name}<strong>{d.value}</strong></div>
                ))}
              </div>
            </div>
          </div>

          {/* Top 5 Services */}
          <div className="overview-grid">
            <div className="card" data-glow="blue">
              <h3 className="card-title"><PieChart size={14} /> Top 5 Services</h3>
              {(detail.services || []).slice(0, 5).map((s, i) => (
                <div key={i} className="overview-rank-item" onClick={() => { setActiveTab('services'); setSelectedService(s.serviceId); }}>
                  <span className="overview-rank-num">{i + 1}</span>
                  <span className="overview-rank-name">{s.nom}</span>
                  <div className="perf-bar-bg" style={{ flex: 1 }}><div className="perf-bar-fill" style={{ width: `${Math.max(3, (s.montant / ((detail.services || [])[0]?.montant || 1)) * 100)}%` }} /></div>
                  <span className="overview-rank-val">{fmt(s.montant)}</span>
                </div>
              ))}
            </div>

            <div className="card" data-glow="blue">
              <h3 className="card-title"><FileText size={14} /> Résumé</h3>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="overview-rank-item">
                  <span className="overview-rank-name">Total revenus</span>
                  <span className="overview-rank-val">{fmtFull(detail.totalRevenus)}</span>
                </div>
                <div className="overview-rank-item">
                  <span className="overview-rank-name">Soumissions totales</span>
                  <span className="overview-rank-val">{detail.totalSoumissions}</span>
                </div>
                <div className="overview-rank-item">
                  <span className="overview-rank-name">Taux de paiement</span>
                  <span className="overview-rank-val"><span className={`taux-badge ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</span></span>
                </div>
                <div className="overview-rank-item">
                  <span className="overview-rank-name">Services actifs</span>
                  <span className="overview-rank-val">{(detail.services || []).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: Services ─── */}
      {activeTab === 'services' && (
        <div className="cdi-tab-content">
          <div className="tax-summary-bar">
            <span>{(detail.services || []).length} services</span>
            <span>Total : <strong>{fmtFull(detail.totalRevenus)}</strong></span>
          </div>
          <div className="card cdi-table-card" data-glow="blue">
            <table className="cdi-detail-table">
              <thead>
                <tr><th>ID</th><th>Service</th><th className="text-right">Montant</th><th className="text-center">Soumissions</th></tr>
              </thead>
              <tbody>
                {(detail.services || []).map((s, i) => (
                  <tr key={i} className={`cdi-perf-row ${selectedService === s.serviceId ? 'selected-row' : ''}`} onClick={() => setSelectedService(selectedService === s.serviceId ? null : s.serviceId)}>
                    <td><code className="code-fiscal">{s.serviceId}</code></td>
                    <td className="contrib-name">{s.nom}</td>
                    <td className="text-right montant-recouvre-cell">{fmtFull(s.montant)}</td>
                    <td className="text-center">{s.nombreSoumissions}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={2}><strong>TOTAL</strong></td>
                  <td className="text-right"><strong>{fmtFull(detail.totalRevenus)}</strong></td>
                  <td className="text-center"><strong>{detail.totalSoumissions}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: Soumissions ─── */}
      {activeTab === 'soumissions' && (
        <div className="cdi-tab-content">
          <div className="cdi-controls">
            <div className="search-box">
              <Search size={14} />
              <input className="search-input" placeholder="Rechercher un soumetteur..." value={searchSoumetteur} onChange={e => setSearchSoumetteur(e.target.value)} />
              {searchSoumetteur && <button className="search-clear" onClick={() => setSearchSoumetteur('')}><X size={12} /></button>}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Users size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.3, marginBottom: '1rem' }} />
            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>Données de soumissions</h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', maxWidth: '400px', margin: '0 auto' }}>
              Le détail des soumissions par soumetteur sera disponible prochainement.
            </p>
          </div>
        </div>
      )}

      {/* ─── TAB: Tendances ─── */}
      {activeTab === 'tendances' && (
        <div className="cdi-tab-content">
          {/* Evolution stacked */}
          {detail.evolution && detail.evolution.length > 0 && (
            <div className="card" data-glow="blue">
              <h3 className="card-title">Performance Mensuelle (Payé / En attente / Échoué)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={detail.evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="periode" stroke="var(--chart-axis)" fontSize={11} />
                  <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                  <Tooltip formatter={(v) => fmtFull(v)} />
                  <Bar dataKey="paye" name="Payé" fill="#059669" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="enAttente" name="En attente" fill="#D97706" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="echoue" name="Échoué" fill="#DC2626" stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparaison — évolution du ministère */}
          {comparison?.evolution?.length > 0 && (
            <div className="card" data-glow="blue">
              <h3 className="card-title"><Building2 size={14} /> Évolution — {comparison.ministere?.nomFr || 'Ministère'}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparison.evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="periode" stroke="var(--chart-axis)" fontSize={11} />
                  <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                  <Tooltip formatter={(v) => fmtFull(v)} />
                  <Bar dataKey="paye" name="Payé" fill="#059669" radius={[4,4,0,0]} />
                  <Bar dataKey="enAttente" name="En attente" fill="#D97706" radius={[4,4,0,0]} />
                  <Bar dataKey="echoue" name="Échoué" fill="#DC2626" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function PerformanceCDI() {
  const { slideshowCdi, slideshowActive, slideshowDateRange } = usePresentMode();

  const isSlideshowDriven = slideshowActive && slideshowCdi;

  const [ministereData, setMinistereData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('montant');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedMinistere, setSelectedMinistere] = useState(isSlideshowDriven ? slideshowCdi : null);
  const [dateRange, setDateRange] = useState(() => isSlideshowDriven ? (slideshowDateRange || {}) : getCurrentPeriodRange());

  // When slideshow changes, update selection
  useEffect(() => {
    if (slideshowActive && slideshowCdi) {
      setSelectedMinistere(slideshowCdi);
      setDateRange(slideshowDateRange || {});
    }
  }, [slideshowCdi, slideshowActive, slideshowDateRange]);

  useEffect(() => {
    setLoading(true);
    fetchRepartitionMinisteres(dateRange)
      .then(setMinistereData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateRange]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const filtered = ministereData
    .filter(m => !search || m.nom.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const maxMontant = filtered[0]?.montant || 1;

  const getExportData = useCallback(() => ({
    headers: ['Ministère', 'Montant Total', 'Soumissions', 'Taux de Paiement'],
    rows: filtered.map(m => [m.nom, fmtFull(m.montant), m.nombreSoumissions, `${m.tauxPaiement}%`]),
    sheetName: 'Performance Ministères',
    subtitle: `${filtered.length} ministères`,
  }), [filtered]);

  // Drill-down mode
  if (selectedMinistere) {
    return (
      <div className="page-container">
        <MinistereDetailPanel ministereId={selectedMinistere} dateRange={dateRange} onBack={() => setSelectedMinistere(null)} />
      </div>
    );
  }

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Chargement..." /></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><Building2 size={24} /> Performance des Ministères</h1>
          <p className="page-subtitle">Analyse comparative des performances par ministère — cliquer sur un ministère pour voir le détail</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Performance Ministères" filenameBase="Performance_Ministeres" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      {/* Filters */}
      <div className="cdi-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder="Rechercher un ministère..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <span className="cdi-count">{filtered.length} ministère(s)</span>
      </div>

      {/* Table — internal scroll */}
      <div className="card cdi-table-card cdi-table-scroll" data-glow="green">
        <table className="cdi-perf-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              <th className="sortable" onClick={() => handleSort('nom')}>Ministère <SortIcon col="nom" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="sortable text-right" onClick={() => handleSort('montant')}>Montant Total <SortIcon col="montant" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="sortable text-center" onClick={() => handleSort('nombreSoumissions')}>Soumissions <SortIcon col="nombreSoumissions" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="sortable text-center" onClick={() => handleSort('tauxPaiement')}>Taux <SortIcon col="tauxPaiement" sortCol={sortCol} sortDir={sortDir} /></th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="empty-row"><div className="empty-state"><Search size={32} /><p>Aucun ministère trouvé.</p></div></td></tr>
            ) : filtered.map((m, i) => {
              const taux = m.tauxPaiement || 0;
              return (
                <tr key={m.ministereId} className="cdi-perf-row" onClick={() => setSelectedMinistere(m.ministereId)}>
                  <td className="col-index">{i + 1}</td>
                  <td className="cdi-name-cell">
                    <Building2 size={14} className="cdi-row-icon" style={m.couleur ? { color: m.couleur } : {}} />
                    <span>{m.nom}</span>
                  </td>
                  <td className="text-right montant-cell">{fmtFull(m.montant)}</td>
                  <td className="text-center">{m.nombreSoumissions}</td>
                  <td className="text-center">
                    <span className={`taux-badge ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</span>
                  </td>
                  <td>
                    <div className="perf-bar-bg">
                      <div className="perf-bar-fill" style={{ width: `${Math.max(2, (m.montant / maxMontant) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
