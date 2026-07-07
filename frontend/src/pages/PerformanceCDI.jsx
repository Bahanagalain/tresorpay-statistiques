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
import { fetchDgiCdi, fetchCdiDetail, fetchCdiComparison } from '../api/dgiAnalyticsApi';
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
  OVERDUE: { cls: 'statut-overdue', label: 'En retard', icon: AlertTriangle },
};

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={12} className="sort-icon neutral" />;
  return sortDir === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />;
}

// ─── CDI Detail Panel (5 Tabs) ───────────────────────────────
const CDI_TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'taxes', label: 'Impôts', icon: PieChart },
  { id: 'contribuables', label: 'Contribuables', icon: Users },
  { id: 'tendances', label: 'Tendances', icon: TrendingUp },
  { id: 'paiements', label: 'Paiements', icon: CreditCard },
];

const PIE_COLORS = ['#059669', '#D97706', '#DC2626'];

function CdiDetailPanel({ centreName, dateRange: initialDateRange = {}, onBack }) {
  const [detail, setDetail] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailDateRange, setDetailDateRange] = useState(initialDateRange);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchContrib, setSearchContrib] = useState('');
  const [searchAvis, setSearchAvis] = useState('');
  const [contribFilter, setContribFilter] = useState('all');
  const [selectedTax, setSelectedTax] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCdiDetail(centreName, detailDateRange),
      fetchCdiComparison(centreName, detailDateRange).catch(() => null),
    ]).then(([d, c]) => { setDetail(d); setComparison(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [centreName, detailDateRange]);

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
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>Aucune donnée disponible pour ce centre.</p>
      </div>
    );
  }

  const taux = detail.tauxRecouvrement || 0;
  const restant = detail.montantRestant || (detail.montant - detail.montantRecouvre);
  const pieData = [
    { name: 'Payés', value: detail.avisPaies, color: '#059669' },
    { name: 'En attente', value: detail.avisEnAttente, color: '#D97706' },
    { name: 'En retard', value: detail.avisEnRetard, color: '#DC2626' },
  ].filter(d => d.value > 0);

  const filteredContrib = (detail.contribuables || []).filter(c => {
    if (contribFilter === 'solde' && c.avisNonPayes > 0) return false;
    if (contribFilter === 'dette' && c.avisNonPayes === 0) return false;
    if (searchContrib) {
      const s = searchContrib.toLowerCase();
      return c.contribuable?.toLowerCase().includes(s) || c.nui?.toLowerCase().includes(s);
    }
    return true;
  });

  const filteredAvis = (detail.avisRecents || []).filter(a =>
    !searchAvis || a.contribuable?.toLowerCase().includes(searchAvis.toLowerCase()) || a.numero?.toLowerCase().includes(searchAvis.toLowerCase())
  );

  const operateurs = detail.operateurs || [];
  const totalOpMontant = operateurs.reduce((s, o) => s + o.montant, 0);

  return (
    <div className="cdi-detail-panel">
      {/* Top bar */}
      <div className="cdi-detail-topbar">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <DatePresetFilter onChange={setDetailDateRange} />
      </div>

      {/* Header + KPIs */}
      <div className="cdi-detail-header">
        <div className="cdi-detail-icon"><Building2 size={28} /></div>
        <div>
          <h2 className="cdi-detail-name">{detail.centre}</h2>
          <p className="cdi-detail-sub">Du {detail.premierAvis ? new Date(detail.premierAvis).toLocaleDateString('fr-FR') : '—'} au {detail.dernierAvis ? new Date(detail.dernierAvis).toLocaleDateString('fr-FR') : '—'}</p>
        </div>
      </div>

      <div className="cdi-detail-kpis">
        <div className="cdi-dkpi" data-glow="green"><DollarSign size={18} className="text-dgi" /><div><span className="cdi-dkpi-val">{fmtFull(detail.montant)}</span><span className="cdi-dkpi-label">Montant Total</span></div></div>
        <div className="cdi-dkpi" data-glow="green"><CheckCircle size={18} className="text-success" /><div><span className="cdi-dkpi-val">{fmtFull(detail.montantRecouvre)}</span><span className="cdi-dkpi-label">Recouvré</span></div></div>
        <div className="cdi-dkpi" data-glow="green"><AlertTriangle size={18} className="text-danger" /><div><span className="cdi-dkpi-val">{fmtFull(restant)}</span><span className="cdi-dkpi-label">Reste à Recouvrer</span></div></div>
        <div className="cdi-dkpi" data-glow="green"><FileText size={18} className="text-info" /><div><span className="cdi-dkpi-val">{detail.nombreAvis}</span><span className="cdi-dkpi-label">Avis émis</span></div></div>
        <div className="cdi-dkpi" data-glow="green">
          <div className={`taux-circle ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</div>
          <div><span className="cdi-dkpi-val">{detail.avisPaies} / {detail.nombreAvis}</span><span className="cdi-dkpi-label">Taux</span></div>
        </div>
      </div>

      <div className="cdi-detail-statuts">
        <div className="cdi-stat-pill paid"><CheckCircle size={14} /> {detail.avisPaies} Payés</div>
        <div className="cdi-stat-pill pending"><Clock size={14} /> {detail.avisEnAttente} En attente</div>
        <div className="cdi-stat-pill overdue"><AlertTriangle size={14} /> {detail.avisEnRetard} En retard</div>
      </div>

      {/* Tab navigation */}
      <div className="cdi-tabs">
        {CDI_TABS.map(t => { const I = t.icon; return (
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
                    <XAxis dataKey="mois" stroke="var(--chart-axis)" fontSize={11} />
                    <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                    <Tooltip formatter={(v) => fmtFull(v)} />
                    <Bar dataKey="montantRecouvre" name="Recouvré" fill="#059669" radius={[4,4,0,0]} />
                    <Bar dataKey="montant" name="Total" fill="var(--bg-surface-elevated)" radius={[4,4,0,0]} />
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

          {/* Top 5 Impôts + 5 derniers avis */}
          <div className="overview-grid">
            <div className="card" data-glow="blue">
              <h3 className="card-title"><PieChart size={14} /> Top 5 Types d'Impôts</h3>
              {(detail.taxes || []).slice(0, 5).map((t, i) => (
                <div key={i} className="overview-rank-item" onClick={() => { setActiveTab('taxes'); setSelectedTax(t.code); }}>
                  <span className="overview-rank-num">{i + 1}</span>
                  <span className="overview-rank-name">{t.libelle}</span>
                  <div className="perf-bar-bg" style={{ flex: 1 }}><div className="perf-bar-fill" style={{ width: `${Math.max(3, (t.montantTotal / ((detail.taxes || [])[0]?.montantTotal || 1)) * 100)}%`, background: t.color }} /></div>
                  <span className="overview-rank-val">{fmt(t.montantTotal)}</span>
                </div>
              ))}
            </div>

            <div className="card" data-glow="blue">
              <h3 className="card-title"><FileText size={14} /> Activité Récente</h3>
              {(detail.avisRecents || []).slice(0, 5).map((a, i) => {
                const cfg = STATUT_CONFIG[a.statut] || STATUT_CONFIG.PENDING;
                return (
                  <div key={i} className="overview-avis-item">
                    <span className="avis-numero">{a.numero}</span>
                    <span className="overview-avis-name">{a.contribuable}</span>
                    <span className="overview-avis-amount">{fmtFull(a.montantTotal)}</span>
                    <span className={`mini-badge ${a.statut === 'PAID' ? 'paid' : a.statut === 'OVERDUE' ? 'overdue' : 'pending'}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: Impôts ─── */}
      {activeTab === 'taxes' && (
        <div className="cdi-tab-content">
          <div className="tax-summary-bar">
            <span>{(detail.taxes || []).length} types d'impôts</span>
            <span>Total : <strong>{fmtFull(detail.montant)}</strong></span>
            <span>Recouvré : <strong style={{ color: '#059669' }}>{fmtFull(detail.montantRecouvre)}</strong></span>
            <span>Reste : <strong style={{ color: '#DC2626' }}>{fmtFull(restant)}</strong></span>
          </div>
          <div className="card cdi-table-card" data-glow="blue">
            <table className="cdi-detail-table">
              <thead>
                <tr><th>Code</th><th>Type d'Impôt</th><th className="text-right">Montant Total</th><th className="text-right">Recouvré</th><th className="text-right">Reste</th><th className="text-center">Taux</th><th>Progression</th></tr>
              </thead>
              <tbody>
                {(detail.taxes || []).map((t, i) => (
                  <tr key={i} className={`cdi-perf-row ${selectedTax === t.code ? 'selected-row' : ''}`} onClick={() => setSelectedTax(selectedTax === t.code ? null : t.code)}>
                    <td><code className="code-fiscal">{t.code}</code></td>
                    <td className="contrib-name"><span style={{ color: t.color, marginRight: '0.4rem' }}>●</span>{t.libelle}</td>
                    <td className="text-right">{fmtFull(t.montantTotal)}</td>
                    <td className="text-right montant-recouvre-cell">{fmtFull(t.montantRecouvre)}</td>
                    <td className="text-right" style={{ color: t.montantRestant > 0 ? '#DC2626' : 'inherit' }}>{fmtFull(t.montantRestant)}</td>
                    <td className="text-center"><span className={`taux-badge ${t.tauxRecouvrement >= 50 ? 'good' : t.tauxRecouvrement >= 25 ? 'mid' : 'bad'}`}>{t.tauxRecouvrement}%</span></td>
                    <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, t.tauxRecouvrement)}%`, background: t.color }} /></div></td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={2}><strong>TOTAL</strong></td>
                  <td className="text-right"><strong>{fmtFull(detail.montant)}</strong></td>
                  <td className="text-right"><strong style={{ color: '#059669' }}>{fmtFull(detail.montantRecouvre)}</strong></td>
                  <td className="text-right"><strong style={{ color: '#DC2626' }}>{fmtFull(restant)}</strong></td>
                  <td className="text-center"><strong>{taux}%</strong></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: Contribuables ─── */}
      {activeTab === 'contribuables' && (
        <div className="cdi-tab-content">
          <div className="cdi-controls">
            <div className="search-box">
              <Search size={14} />
              <input className="search-input" placeholder="Rechercher un contribuable..." value={searchContrib} onChange={e => setSearchContrib(e.target.value)} />
              {searchContrib && <button className="search-clear" onClick={() => setSearchContrib('')}><X size={12} /></button>}
            </div>
            <div className="contrib-filter-btns">
              {[['all', 'Tous'], ['dette', 'En dette'], ['solde', 'Soldés']].map(([v, l]) => (
                <button key={v} className={`dpf-btn ${contribFilter === v ? 'active' : ''}`} onClick={() => setContribFilter(v)}>{l}</button>
              ))}
            </div>
            <span className="cdi-count">{filteredContrib.length} contribuable(s)</span>
          </div>
          <div className="card cdi-table-card" data-glow="blue">
            <table className="cdi-detail-table">
              <thead>
                <tr><th>Contribuable</th><th>NUI</th><th className="text-center">Avis</th><th className="text-right">Total</th><th className="text-right">Payé</th><th className="text-right">Reste Dû</th><th className="text-center">Taux</th><th className="text-center">Statut</th></tr>
              </thead>
              <tbody>
                {filteredContrib.length === 0 ? (
                  <tr><td colSpan={8} className="empty-row"><div className="empty-state-sm"><Search size={18} /><p>Aucun contribuable trouvé.</p></div></td></tr>
                ) : filteredContrib.map((c, i) => {
                  const ct = c.tauxPaiement || 0;
                  return (
                    <tr key={i} className="cdi-perf-row">
                      <td className="contrib-name">{c.contribuable}</td>
                      <td><span className="avis-nui">{c.nui}</span></td>
                      <td className="text-center">{c.nombreAvis}</td>
                      <td className="text-right">{fmtFull(c.montant)}</td>
                      <td className="text-right montant-recouvre-cell">{fmtFull(c.montantPaye)}</td>
                      <td className="text-right" style={{ color: c.montantDu > 0 ? '#DC2626' : 'inherit', fontWeight: c.montantDu > 0 ? 700 : 400 }}>{fmtFull(c.montantDu)}</td>
                      <td className="text-center"><span className={`taux-badge ${ct >= 75 ? 'good' : ct >= 40 ? 'mid' : 'bad'}`}>{ct}%</span></td>
                      <td className="text-center">{c.avisNonPayes === 0 ? <span className="mini-badge paid">Soldé</span> : <span className="mini-badge overdue">{c.avisNonPayes} dû(s)</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: Tendances ─── */}
      {activeTab === 'tendances' && (
        <div className="cdi-tab-content">
          {/* Indicateurs dérivés */}
          <div className="tendance-indicators">
            <div className="tend-card"><Target size={20} className="text-dgi" /><div><span className="tend-val">{fmtFull(comparison?.indicateurs?.montantMoyenParAvis || 0)}</span><span className="tend-label">Montant moyen / avis</span></div></div>
            <div className="tend-card"><Clock size={20} className="text-warning" /><div><span className="tend-val">{comparison?.indicateurs?.delaiMoyenNonPaye || 0} jours</span><span className="tend-label">Délai moyen non-payé</span></div></div>
            <div className="tend-card"><AlertTriangle size={20} className="text-danger" /><div><span className="tend-val">{comparison?.indicateurs?.avisGrosRetard || 0}</span><span className="tend-label">Avis &gt; 1M en retard</span></div></div>
            <div className="tend-card"><BarChart3 size={20} className="text-info" /><div><span className="tend-val">{comparison?.moyenneNationale?.tauxRecouvrement || 0}%</span><span className="tend-label">Moyenne nationale</span></div></div>
          </div>

          {/* Evolution stacked */}
          {detail.evolution && detail.evolution.length > 0 && (
            <div className="card" data-glow="blue">
              <h3 className="card-title">Performance Mensuelle (Recouvré vs Total)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={detail.evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="mois" stroke="var(--chart-axis)" fontSize={11} />
                  <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                  <Tooltip formatter={(v) => fmtFull(v)} />
                  <Bar dataKey="montantRecouvre" name="Recouvré" fill="#059669" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="montant" name="Non recouvré" fill="#DC262630" stackId="b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparaison CDIs de la région */}
          {comparison?.regionCdis?.length > 0 && (
            <div className="card" data-glow="blue">
              <h3 className="card-title"><Building2 size={14} /> Comparaison — Région {comparison.region}</h3>
              <table className="cdi-detail-table">
                <thead><tr><th>#</th><th>Centre CDI</th><th className="text-right">Montant</th><th className="text-right">Recouvré</th><th className="text-center">Taux</th><th>Performance</th></tr></thead>
                <tbody>
                  {comparison.regionCdis.map((c, i) => {
                    const isTarget = c.centre === centreName;
                    return (
                      <tr key={i} className={isTarget ? 'selected-row' : ''}>
                        <td className="col-index">{i + 1}</td>
                        <td className="contrib-name">{c.centre} {isTarget && <span className="mini-badge paid" style={{ marginLeft: '0.4rem' }}>Ce CDI</span>}</td>
                        <td className="text-right">{fmtFull(c.montant)}</td>
                        <td className="text-right montant-recouvre-cell">{fmtFull(c.montantRecouvre)}</td>
                        <td className="text-center"><span className={`taux-badge ${c.tauxRecouvrement >= 50 ? 'good' : c.tauxRecouvrement >= 25 ? 'mid' : 'bad'}`}>{c.tauxRecouvrement}%</span></td>
                        <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, (c.montantRecouvre / (comparison.regionCdis[0]?.montantRecouvre || 1)) * 100)}%`, background: isTarget ? '#059669' : 'var(--text-tertiary)' }} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Paiements ─── */}
      {activeTab === 'paiements' && (
        <div className="cdi-tab-content">
          {operateurs.length > 0 ? (
            <>
              <div className="overview-grid">
                <div className="card" data-glow="blue">
                  <h3 className="card-title">Répartition par Opérateur</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie data={operateurs.map((o, i) => ({ name: o.operateur, value: o.montant, color: PIE_COLORS[i % PIE_COLORS.length] }))} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                        {operateurs.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtFull(v)} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="card" data-glow="blue">
                  <h3 className="card-title">Détail par Opérateur</h3>
                  <table className="cdi-detail-table">
                    <thead><tr><th>Opérateur</th><th className="text-center">Transactions</th><th className="text-right">Montant</th><th className="text-center">Part</th></tr></thead>
                    <tbody>
                      {operateurs.map((o, i) => (
                        <tr key={i}>
                          <td className="contrib-name">{o.operateur}</td>
                          <td className="text-center">{o.nombre}</td>
                          <td className="text-right montant-cell">{fmtFull(o.montant)}</td>
                          <td className="text-center"><span className="taux-badge good">{totalOpMontant > 0 ? ((o.montant / totalOpMontant) * 100).toFixed(1) : 0}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <CreditCard size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.3, marginBottom: '1rem' }} />
              <h3 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>Données de paiement en attente</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', maxWidth: '400px', margin: '0 auto' }}>
                Les informations sur les opérateurs de paiement seront disponibles dès que les avis payés contiendront le champ opérateur.
              </p>
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

  // If slideshow is driving, init directly with the CDI and the effective slideshow filter
  const isSlideshowDriven = slideshowActive && slideshowCdi;

  const [cdiData, setCdiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('montant');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedCdi, setSelectedCdi] = useState(isSlideshowDriven ? slideshowCdi : null);
  const [dateRange, setDateRange] = useState(() => isSlideshowDriven ? (slideshowDateRange || {}) : getCurrentPeriodRange());

  // When slideshow changes the CDI name, update selectedCdi
  useEffect(() => {
    if (slideshowActive && slideshowCdi) {
      setSelectedCdi(slideshowCdi);
      setDateRange(slideshowDateRange || {});
    }
  }, [slideshowCdi, slideshowActive, slideshowDateRange]);

  useEffect(() => {
    setLoading(true);
    fetchDgiCdi(dateRange)
      .then(setCdiData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateRange]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const filtered = cdiData
    .filter(c => !search || c.centre.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const maxMontant = filtered[0]?.montant || 1;

  const getExportData = useCallback(() => ({
    headers: ['Centre CDI', 'Montant Total', 'Recouvré', 'Nb Avis', 'Payés', 'Attente', 'Retard', 'Taux'],
    rows: filtered.map(c => [c.centre, fmtFull(c.montant), fmtFull(c.montantRecouvre), c.nombreAvis, c.avisPaies, c.avisEnAttente, c.avisEnRetard, `${c.tauxRecouvrement}%`]),
    sheetName: 'Performance CDI',
    subtitle: `${filtered.length} centres CDI`,
  }), [filtered]);

  // Drill-down mode (checked BEFORE loading so slideshow CDI detail shows immediately)
  if (selectedCdi) {
    return (
      <div className="page-container">
        <CdiDetailPanel centreName={selectedCdi} dateRange={dateRange} onBack={() => setSelectedCdi(null)} />
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
          <h1 className="page-title"><Building2 size={24} /> Performance des Centres CDI</h1>
          <p className="page-subtitle">Analyse comparative des performances de recouvrement par centre — cliquer sur un CDI pour voir le détail</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Performance CDI" filenameBase="Performance_CDI" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      {/* Filters */}
      <div className="cdi-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder="Rechercher un centre CDI..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <span className="cdi-count">{filtered.length} centre(s)</span>
      </div>

      {/* Table — internal scroll */}
      <div className="card cdi-table-card cdi-table-scroll" data-glow="green">
        <table className="cdi-perf-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              <th className="sortable" onClick={() => handleSort('centre')}>Centre CDI <SortIcon col="centre" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="sortable text-right" onClick={() => handleSort('montant')}>Montant Total <SortIcon col="montant" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="sortable text-right" onClick={() => handleSort('montantRecouvre')}>Recouvré <SortIcon col="montantRecouvre" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="sortable text-center" onClick={() => handleSort('nombreAvis')}>Avis <SortIcon col="nombreAvis" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="text-center">Payés</th>
              <th className="text-center">Attente</th>
              <th className="text-center">Retard</th>
              <th className="sortable text-center" onClick={() => handleSort('tauxRecouvrement')}>Taux <SortIcon col="tauxRecouvrement" sortCol={sortCol} sortDir={sortDir} /></th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="empty-row"><div className="empty-state"><Search size={32} /><p>Aucun centre CDI trouvé.</p></div></td></tr>
            ) : filtered.map((cdi, i) => {
              const taux = cdi.tauxRecouvrement || 0;
              return (
                <tr key={cdi.centre} className="cdi-perf-row" onClick={() => setSelectedCdi(cdi.centre)}>
                  <td className="col-index">{i + 1}</td>
                  <td className="cdi-name-cell">
                    <Building2 size={14} className="cdi-row-icon" />
                    <span>{cdi.centre}</span>
                  </td>
                  <td className="text-right montant-cell">{fmtFull(cdi.montant)}</td>
                  <td className="text-right montant-recouvre-cell">{fmtFull(cdi.montantRecouvre)}</td>
                  <td className="text-center">{cdi.nombreAvis}</td>
                  <td className="text-center"><span className="mini-badge paid">{cdi.avisPaies}</span></td>
                  <td className="text-center"><span className="mini-badge pending">{cdi.avisEnAttente}</span></td>
                  <td className="text-center"><span className="mini-badge overdue">{cdi.avisEnRetard}</span></td>
                  <td className="text-center">
                    <span className={`taux-badge ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</span>
                  </td>
                  <td>
                    <div className="perf-bar-bg">
                      <div className="perf-bar-fill" style={{ width: `${Math.max(2, (cdi.montant / maxMontant) * 100)}%` }} />
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
