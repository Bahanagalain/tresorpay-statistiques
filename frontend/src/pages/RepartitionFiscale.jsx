import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell,
} from 'recharts';
import {
  PieChart as PieIcon, Search, X, ArrowUp, ArrowDown, ArrowUpDown, Activity,
  ChevronLeft, Building2, Users, CheckCircle, Clock, AlertTriangle, DollarSign,
  FileText, LayoutDashboard, Target, FileSpreadsheet, FileDown,
} from 'lucide-react';
import { fetchDgiTaxes, fetchDgiCommunes, fetchCommuneDetail, fetchTaxDetail } from '../api/dgiAnalyticsApi';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatMontant } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './RepartitionFiscale.css';

const fmtFull = (n) => formatMontant(n);
const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n ?? 0);
const PIE_COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={12} className="sort-icon neutral" />;
  return sortDir === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />;
}

// ─── Commune Detail Panel (4 Tabs) ───────────────────────────
const COMMUNE_TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'taxes', label: "Types d'Impôts", icon: PieIcon },
  { id: 'cdis', label: 'CDIs Sources', icon: Building2 },
  { id: 'contribuables', label: 'Contribuables', icon: Users },
];

function CommuneDetailPanel({ communeName, dateRange, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localDateRange, setLocalDateRange] = useState(dateRange || {});
  const [activeTab, setActiveTab] = useState('overview');
  const [searchContrib, setSearchContrib] = useState('');
  const [contribFilter, setContribFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    fetchCommuneDetail(communeName, localDateRange)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [communeName, localDateRange]);

  if (loading) {
    return (
      <div className="cdi-detail-panel">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour</button>
        <div className="exec-loading"><WeaveSpinner size={80} message="Chargement..." /></div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="cdi-detail-panel">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour</button>
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>Aucune donnée pour cette commune.</p>
      </div>
    );
  }

  const taux = detail.tauxRecouvrement || 0;
  const pieStatut = [
    { name: 'Recouvré', value: detail.montantRecouvre, color: '#059669' },
    { name: 'Reste', value: detail.montantRestant, color: '#DC2626' },
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

  return (
    <div className="cdi-detail-panel">
      <div className="cdi-detail-topbar">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <DatePresetFilter onChange={setLocalDateRange} />
      </div>

      {/* Header */}
      <div className="cdi-detail-header">
        <div className="cdi-detail-icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}><Target size={28} /></div>
        <div>
          <h2 className="cdi-detail-name">{detail.commune}</h2>
          <p className="cdi-detail-sub">{detail.nbCdis} CDI(s) sources · {detail.nbContribuables} contribuable(s) · {detail.nbImputations} imputation(s)</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="cdi-detail-kpis">
        <div className="cdi-dkpi"><DollarSign size={18} className="text-dgi" /><div><span className="cdi-dkpi-val">{fmtFull(detail.montantTotal)}</span><span className="cdi-dkpi-label">Montant Total</span></div></div>
        <div className="cdi-dkpi"><CheckCircle size={18} className="text-success" /><div><span className="cdi-dkpi-val">{fmtFull(detail.montantRecouvre)}</span><span className="cdi-dkpi-label">Recouvré</span></div></div>
        <div className="cdi-dkpi"><AlertTriangle size={18} className="text-danger" /><div><span className="cdi-dkpi-val">{fmtFull(detail.montantRestant)}</span><span className="cdi-dkpi-label">Reste à Recouvrer</span></div></div>
        <div className="cdi-dkpi">
          <div className={`taux-circle ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</div>
          <div><span className="cdi-dkpi-val">{detail.nbImputations} imput.</span><span className="cdi-dkpi-label">Taux</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="cdi-tabs">
        {COMMUNE_TABS.map(t => { const I = t.icon; return (
          <button key={t.id} className={`cdi-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <I size={14} /> {t.label}
          </button>
        ); })}
      </div>

      {/* ─── TAB: Vue d'ensemble ─── */}
      {activeTab === 'overview' && (
        <div className="cdi-tab-content">
          <div className="overview-grid">
            <div className="card" data-glow="blue">
              <h3 className="card-title">Évolution Mensuelle des Recettes</h3>
              {detail.evolution?.length > 0 ? (
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
              ) : <p className="no-data-msg">Pas assez de données</p>}
            </div>

            <div className="card" data-glow="blue">
              <h3 className="card-title">Répartition Recouvré / Reste</h3>
              <ResponsiveContainer width="100%" height={180}>
                <RechartsPie>
                  <Pie data={pieStatut} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {pieStatut.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtFull(v)} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="overview-pie-legend">
                {pieStatut.map((d, i) => (
                  <div key={i} className="overview-legend-item"><span className="legend-dot" style={{ background: d.color }} />{d.name}<strong>{fmtFull(d.value)}</strong></div>
                ))}
              </div>
            </div>
          </div>

          <div className="overview-grid">
            <div className="card" data-glow="blue">
              <h3 className="card-title"><PieIcon size={14} /> Top 5 Types d'Impôts</h3>
              {(detail.taxes || []).slice(0, 5).map((t, i) => (
                <div key={i} className="overview-rank-item" onClick={() => setActiveTab('taxes')}>
                  <span className="overview-rank-num">{i + 1}</span>
                  <span className="overview-rank-name">{t.libelle}</span>
                  <div className="perf-bar-bg" style={{ flex: 1 }}><div className="perf-bar-fill" style={{ width: `${Math.max(3, (t.montantTotal / ((detail.taxes || [])[0]?.montantTotal || 1)) * 100)}%`, background: t.color }} /></div>
                  <span className="overview-rank-val">{fmt(t.montantTotal)}</span>
                </div>
              ))}
            </div>

            <div className="card" data-glow="blue">
              <h3 className="card-title"><Building2 size={14} /> Top 5 CDIs Sources</h3>
              {(detail.cdis || []).slice(0, 5).map((c, i) => (
                <div key={i} className="overview-rank-item" onClick={() => setActiveTab('cdis')}>
                  <span className="overview-rank-num">{i + 1}</span>
                  <span className="overview-rank-name">{c.centre}</span>
                  <div className="perf-bar-bg" style={{ flex: 1 }}><div className="perf-bar-fill" style={{ width: `${Math.max(3, (c.montant / ((detail.cdis || [])[0]?.montant || 1)) * 100)}%` }} /></div>
                  <span className="overview-rank-val">{fmt(c.montant)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dernières imputations */}
          {detail.recentImputations?.length > 0 && (
            <div className="card" data-glow="blue">
              <h3 className="card-title"><FileText size={14} /> Dernières Imputations Reçues</h3>
              <table className="cdi-detail-table">
                <thead><tr><th>N° Avis</th><th>Contribuable</th><th>CDI</th><th>Type</th><th className="text-right">Montant</th><th>Statut</th></tr></thead>
                <tbody>
                  {detail.recentImputations.slice(0, 8).map((imp, i) => (
                    <tr key={i}>
                      <td><span className="avis-numero">{imp.numero}</span></td>
                      <td className="contrib-name">{imp.contribuable}</td>
                      <td><span className="centre-badge-sm">{imp.centre}</span></td>
                      <td>{imp.libelle}</td>
                      <td className="text-right montant-cell">{fmtFull(imp.montant)}</td>
                      <td><span className={`mini-badge ${imp.statut === 'PAID' ? 'paid' : imp.statut === 'OVERDUE' ? 'overdue' : 'pending'}`}>{imp.statut === 'PAID' ? 'Payé' : imp.statut === 'OVERDUE' ? 'Retard' : 'Attente'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Types d'Impôts ─── */}
      {activeTab === 'taxes' && (
        <div className="cdi-tab-content">
          <div className="tax-summary-bar">
            <span>{(detail.taxes || []).length} types d'impôts</span>
            <span>Total : <strong>{fmtFull(detail.montantTotal)}</strong></span>
            <span>Recouvré : <strong style={{ color: '#059669' }}>{fmtFull(detail.montantRecouvre)}</strong></span>
            <span>Reste : <strong style={{ color: '#DC2626' }}>{fmtFull(detail.montantRestant)}</strong></span>
          </div>
          <div className="card cdi-table-card" data-glow="green">
            <table className="cdi-detail-table">
              <thead><tr><th>Code</th><th>Type d'Impôt</th><th className="text-center">Imput.</th><th className="text-right">Total</th><th className="text-right">Recouvré</th><th className="text-right">Reste</th><th className="text-center">Taux</th><th>Progression</th></tr></thead>
              <tbody>
                {(detail.taxes || []).map((t, i) => (
                  <tr key={i}>
                    <td><code className="code-fiscal">{t.code}</code></td>
                    <td className="contrib-name"><span style={{ color: t.color, marginRight: '0.4rem' }}>●</span>{t.libelle}</td>
                    <td className="text-center">{t.nbImputations}</td>
                    <td className="text-right">{fmtFull(t.montantTotal)}</td>
                    <td className="text-right montant-recouvre-cell">{fmtFull(t.montantRecouvre)}</td>
                    <td className="text-right" style={{ color: t.montantRestant > 0 ? '#DC2626' : 'inherit' }}>{fmtFull(t.montantRestant)}</td>
                    <td className="text-center"><span className={`taux-badge ${t.tauxRecouvrement >= 50 ? 'good' : t.tauxRecouvrement >= 25 ? 'mid' : 'bad'}`}>{t.tauxRecouvrement}%</span></td>
                    <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, t.tauxRecouvrement)}%`, background: t.color }} /></div></td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={3}><strong>TOTAL</strong></td>
                  <td className="text-right"><strong>{fmtFull(detail.montantTotal)}</strong></td>
                  <td className="text-right"><strong style={{ color: '#059669' }}>{fmtFull(detail.montantRecouvre)}</strong></td>
                  <td className="text-right"><strong style={{ color: '#DC2626' }}>{fmtFull(detail.montantRestant)}</strong></td>
                  <td className="text-center"><strong>{taux}%</strong></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: CDIs Sources ─── */}
      {activeTab === 'cdis' && (
        <div className="cdi-tab-content">
          <div className="card cdi-table-card" data-glow="green">
            <table className="cdi-detail-table">
              <thead><tr><th>#</th><th>CDI Source</th><th className="text-center">Imputations</th><th className="text-right">Montant Total</th><th className="text-right">Recouvré</th><th className="text-center">Part</th><th>Performance</th></tr></thead>
              <tbody>
                {(detail.cdis || []).map((c, i) => {
                  const part = detail.montantTotal > 0 ? ((c.montant / detail.montantTotal) * 100).toFixed(1) : '0';
                  return (
                    <tr key={i}>
                      <td className="col-index">{i + 1}</td>
                      <td className="cdi-name-cell"><Building2 size={14} className="cdi-row-icon" />{c.centre}</td>
                      <td className="text-center">{c.nbImputations}</td>
                      <td className="text-right montant-cell">{fmtFull(c.montant)}</td>
                      <td className="text-right montant-recouvre-cell">{fmtFull(c.montantRecouvre)}</td>
                      <td className="text-center"><span className="taux-badge good">{part}%</span></td>
                      <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, (c.montant / ((detail.cdis || [])[0]?.montant || 1)) * 100)}%` }} /></div></td>
                    </tr>
                  );
                })}
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
              {[['all', 'Tous'], ['dette', 'Non payés'], ['solde', 'Payés']].map(([v, l]) => (
                <button key={v} className={`dpf-btn ${contribFilter === v ? 'active' : ''}`} onClick={() => setContribFilter(v)}>{l}</button>
              ))}
            </div>
            <span className="cdi-count">{filteredContrib.length} contribuable(s)</span>
          </div>
          <div className="card cdi-table-card" data-glow="green">
            <table className="cdi-detail-table">
              <thead><tr><th>Contribuable</th><th>NUI</th><th>CDI</th><th className="text-center">Imput.</th><th className="text-right">Total</th><th className="text-right">Payé</th><th className="text-right">Reste Dû</th><th className="text-center">Statut</th></tr></thead>
              <tbody>
                {filteredContrib.length === 0 ? (
                  <tr><td colSpan={8} className="empty-row"><div className="empty-state-sm"><Search size={18} /><p>Aucun contribuable trouvé.</p></div></td></tr>
                ) : filteredContrib.map((c, i) => (
                  <tr key={i}>
                    <td className="contrib-name">{c.contribuable}</td>
                    <td><span className="avis-nui">{c.nui}</span></td>
                    <td><span className="centre-badge-sm">{c.centre}</span></td>
                    <td className="text-center">{c.nbImputations}</td>
                    <td className="text-right">{fmtFull(c.montant)}</td>
                    <td className="text-right montant-recouvre-cell">{fmtFull(c.montantPaye)}</td>
                    <td className="text-right" style={{ color: c.montantDu > 0 ? '#DC2626' : 'inherit', fontWeight: c.montantDu > 0 ? 700 : 400 }}>{fmtFull(c.montantDu)}</td>
                    <td className="text-center">{c.avisNonPayes === 0 ? <span className="mini-badge paid">Soldé</span> : <span className="mini-badge overdue">{c.avisNonPayes} dû(s)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tax Detail Panel (drill-down by tax code) ──────────────
const STATUT_FILTERS = [
  { id: 'all',     label: 'Tous' },
  { id: 'PAID',    label: 'Payés' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'OVERDUE', label: 'En retard' },
];

const STATUT_META = {
  PAID:    { label: 'Payé',       cls: 'paid',    icon: CheckCircle },
  PENDING: { label: 'En attente', cls: 'pending', icon: Clock },
  OVERDUE: { label: 'En retard',  cls: 'overdue', icon: AlertTriangle },
};

function TaxDetailPanel({ taxCode, taxColor, taxLabel, dateRange, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localDateRange, setLocalDateRange] = useState(dateRange || {});
  const [statutFilter, setStatutFilter] = useState('all');
  const [searchAvis, setSearchAvis] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchTaxDetail(taxCode, localDateRange)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [taxCode, localDateRange]);

  if (loading) {
    return (
      <div className="cdi-detail-panel">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour</button>
        <div className="exec-loading"><WeaveSpinner size={80} message="Chargement..." /></div>
      </div>
    );
  }

  if (!detail || detail.avis.length === 0) {
    return (
      <div className="cdi-detail-panel">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour</button>
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>Aucun avis pour cette taxe sur la période sélectionnée.</p>
      </div>
    );
  }

  const { kpi } = detail;
  const filteredAvis = detail.avis.filter((a) => {
    if (statutFilter !== 'all' && a.statut !== statutFilter) return false;
    if (searchAvis) {
      const s = searchAvis.toLowerCase();
      return a.numero?.toLowerCase().includes(s)
        || a.contribuable?.toLowerCase().includes(s)
        || a.nui?.toLowerCase().includes(s)
        || a.centre?.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="cdi-detail-panel">
      <div className="cdi-detail-topbar">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <DatePresetFilter onChange={setLocalDateRange} />
      </div>

      <div className="cdi-detail-header">
        <div className="cdi-detail-icon" style={{ background: `${taxColor}20`, color: taxColor }}><PieIcon size={26} /></div>
        <div>
          <h2 className="cdi-detail-name">{detail.libelle || taxLabel}</h2>
          <p className="cdi-detail-sub">
            <code className="code-fiscal">{detail.code}</code>
            <span style={{ marginLeft: '0.5rem' }}>{kpi.nbAvis} avis concerné(s)</span>
          </p>
        </div>
      </div>

      <div className="cdi-detail-kpis">
        <div className="cdi-dkpi">
          <DollarSign size={18} className="text-dgi" />
          <div><span className="cdi-dkpi-val">{fmtFull(kpi.totalMontant)}</span><span className="cdi-dkpi-label">Montant total</span></div>
        </div>
        <div className="cdi-dkpi">
          <CheckCircle size={18} className="text-success" />
          <div><span className="cdi-dkpi-val">{fmtFull(kpi.montantPaye)}</span><span className="cdi-dkpi-label">Payé ({kpi.nbPaye})</span></div>
        </div>
        <div className="cdi-dkpi">
          <Clock size={18} style={{ color: '#D97706' }} />
          <div><span className="cdi-dkpi-val">{fmtFull(kpi.montantAttente)}</span><span className="cdi-dkpi-label">En attente ({kpi.nbAttente})</span></div>
        </div>
        <div className="cdi-dkpi">
          <AlertTriangle size={18} className="text-danger" />
          <div><span className="cdi-dkpi-val">{fmtFull(kpi.montantRetard)}</span><span className="cdi-dkpi-label">En retard ({kpi.nbRetard})</span></div>
        </div>
      </div>

      <div className="cdi-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder="Rechercher un avis, contribuable, NUI ou CDI..." value={searchAvis} onChange={e => setSearchAvis(e.target.value)} />
          {searchAvis && <button className="search-clear" onClick={() => setSearchAvis('')}><X size={12} /></button>}
        </div>
        <div className="contrib-filter-btns">
          {STATUT_FILTERS.map(f => (
            <button key={f.id} className={`dpf-btn ${statutFilter === f.id ? 'active' : ''}`} onClick={() => setStatutFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <span className="cdi-count">{filteredAvis.length} avis</span>
      </div>

      <div className="card cdi-table-card" data-glow="green">
        <table className="cdi-detail-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              <th>N° Avis</th>
              <th>Contribuable</th>
              <th>NUI</th>
              <th>CDI</th>
              <th>Date émission</th>
              <th className="text-right">Montant taxe</th>
              <th className="text-right">Montant total</th>
              <th className="text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredAvis.length === 0 ? (
              <tr><td colSpan={9} className="empty-row"><div className="empty-state-sm"><Search size={18} /><p>Aucun avis correspondant au filtre.</p></div></td></tr>
            ) : filteredAvis.map((a, i) => {
              const meta = STATUT_META[a.statut] || STATUT_META.PENDING;
              const StatutIcon = meta.icon;
              return (
                <tr key={a.numero + '-' + i}>
                  <td className="col-index">{i + 1}</td>
                  <td><span className="avis-numero">{a.numero}</span></td>
                  <td className="contrib-name">{a.contribuable}</td>
                  <td><span className="avis-nui">{a.nui || '—'}</span></td>
                  <td><span className="centre-badge-sm">{a.centre}</span></td>
                  <td><span className="avis-date">{a.dateCreation || '—'}</span></td>
                  <td className="text-right montant-cell">{fmtFull(a.montantTaxe)}</td>
                  <td className="text-right">{fmtFull(a.montantTotal)}</td>
                  <td className="text-center"><span className={`mini-badge ${meta.cls}`}><StatutIcon size={11} /> {meta.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function RepartitionFiscale() {
  const [taxes, setTaxes] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getCurrentPeriodRange);
  const [tab, setTab] = useState('taxes');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('montant');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedCommune, setSelectedCommune] = useState(null);
  const [selectedTax, setSelectedTax] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDgiTaxes(dateRange), fetchDgiCommunes(dateRange)])
      .then(([t, c]) => { setTaxes(t); setCommunes(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateRange]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const currentData = tab === 'taxes' ? taxes : communes;
  const searchField = tab === 'taxes' ? 'type' : 'commune';
  const filtered = currentData
    .filter(r => !search || (r[searchField] || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const totalMontant = filtered.reduce((s, r) => s + (r.montant || 0), 0);
  const maxMontant = filtered[0]?.montant || 1;

  const getExportData = useCallback(() => {
    if (tab === 'taxes') {
      return {
        headers: ['Code', 'Type', 'Nb Imputations', 'Montant', 'Part (%)'],
        rows: filtered.map(r => [r.code, r.type, r.count, fmtFull(r.montant), totalMontant > 0 ? ((r.montant / totalMontant) * 100).toFixed(1) : '0']),
        sheetName: 'Taxes',
        subtitle: `${filtered.length} types de taxes`,
      };
    }
    return {
      headers: ['Commune / Bénéficiaire', 'Montant', 'Part (%)'],
      rows: filtered.map(r => [r.commune, fmtFull(r.montant), totalMontant > 0 ? ((r.montant / totalMontant) * 100).toFixed(1) : '0']),
      sheetName: 'Communes',
      subtitle: `${filtered.length} communes`,
    };
  }, [filtered, tab, totalMontant]);

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Chargement..." /></div></div>;
  }

  // Commune drill-down mode
  if (selectedCommune) {
    return (
      <div className="page-container">
        <CommuneDetailPanel communeName={selectedCommune} dateRange={dateRange} onBack={() => setSelectedCommune(null)} />
      </div>
    );
  }

  // Tax drill-down mode
  if (selectedTax) {
    return (
      <div className="page-container">
        <TaxDetailPanel
          taxCode={selectedTax.code}
          taxLabel={selectedTax.type}
          taxColor={selectedTax.color || 'var(--accent-dgi)'}
          dateRange={dateRange}
          onBack={() => setSelectedTax(null)}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><PieIcon size={24} /> Répartition Fiscale</h1>
          <p className="page-subtitle">Distribution des recettes par type d'impôt et par commune bénéficiaire</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const { headers, rows, sheetName } = getExportData();
              if (rows?.length) {
                const d = new Date();
                const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
                import('../utils/exportUtils').then(m => m.exportToExcel(rows, headers, sheetName, `Repartition_Fiscale_${ts}.xlsx`));
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#555', border: '1px solid #ddd' }}
          >
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button
            onClick={() => {
              const { headers, rows } = getExportData();
              if (rows?.length) {
                const d = new Date();
                const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
                import('../utils/exportUtils').then(m => m.exportGenericPDF({ title: 'TRESOR ANALYTICS — Répartition Fiscale', headers, rows, filename: `Repartition_Fiscale_${ts}.pdf` }));
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', boxShadow: '0 3px 10px rgba(5,150,105,0.3)' }}
          >
            <FileDown size={14} /> PDF
          </button>
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      <div className="fiscal-tabs">
        <button className={`fiscal-tab ${tab === 'taxes' ? 'active' : ''}`} onClick={() => { setTab('taxes'); setSearch(''); }}>Types de Taxes ({taxes.length})</button>
        <button className={`fiscal-tab ${tab === 'communes' ? 'active' : ''}`} onClick={() => { setTab('communes'); setSearch(''); }}>Communes Bénéficiaires ({communes.length})</button>
        <span className="fiscal-tab-total">Total : {fmtFull(totalMontant)}</span>
      </div>

      <div className="cdi-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder={tab === 'taxes' ? 'Rechercher une taxe...' : 'Rechercher une commune...'} value={search} onChange={e => { setSearch(e.target.value); }} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <span className="cdi-count">{filtered.length} élément(s)</span>
      </div>

      <div className="card cdi-table-card cdi-table-scroll cdi-table-scroll-compact">
        <table className="cdi-perf-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              {tab === 'taxes' ? (
                <>
                  <th>Code</th>
                  <th className="sortable" onClick={() => handleSort('type')}>Libellé <SortIcon col="type" sortCol={sortCol} sortDir={sortDir} /></th>
                  <th className="sortable text-center" onClick={() => handleSort('count')}>Nb Imputations <SortIcon col="count" sortCol={sortCol} sortDir={sortDir} /></th>
                </>
              ) : (
                <th className="sortable" onClick={() => handleSort('commune')}>Commune / Bénéficiaire <SortIcon col="commune" sortCol={sortCol} sortDir={sortDir} /></th>
              )}
              <th className="sortable text-right" onClick={() => handleSort('montant')}>Montant <SortIcon col="montant" sortCol={sortCol} sortDir={sortDir} /></th>
              <th className="text-center">Part</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={tab === 'taxes' ? 7 : 5} className="empty-row"><div className="empty-state"><p>Aucun résultat.</p></div></td></tr>
            ) : filtered.map((r, i) => {
              const part = totalMontant > 0 ? ((r.montant / totalMontant) * 100).toFixed(1) : '0.0';
              return (
                <tr
                  key={i}
                  className="cdi-perf-row"
                  onClick={tab === 'communes' ? () => setSelectedCommune(r.commune) : (tab === 'taxes' && r.code ? () => setSelectedTax(r) : undefined)}
                  style={(tab === 'communes' || (tab === 'taxes' && r.code)) ? { cursor: 'pointer' } : undefined}
                  title={tab === 'taxes' && r.code ? 'Voir les avis pour cette taxe' : undefined}
                >
                  <td className="col-index">{i + 1}</td>
                  {tab === 'taxes' ? (
                    <>
                      <td><code className="code-fiscal">{r.code}</code></td>
                      <td className="cdi-name-cell"><span style={{ color: r.color, marginRight: '0.5rem' }}>●</span>{r.type}</td>
                      <td className="text-center">{r.count}</td>
                    </>
                  ) : (
                    <td className="cdi-name-cell"><Target size={14} className="cdi-row-icon" style={{ color: '#2563EB' }} />{r.commune}</td>
                  )}
                  <td className="text-right montant-cell">{fmtFull(r.montant)}</td>
                  <td className="text-center"><span className="taux-badge good">{part}%</span></td>
                  <td>
                    <div className="perf-bar-bg">
                      <div className="perf-bar-fill" style={{ width: `${Math.max(2, (r.montant / maxMontant) * 100)}%`, background: r.color || 'var(--accent-dgi)' }} />
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
