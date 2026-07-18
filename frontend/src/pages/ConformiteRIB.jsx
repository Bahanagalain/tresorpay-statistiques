import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell,
} from 'recharts';
import {
  Handshake, Building2, CheckCircle, XCircle, Clock, ChevronLeft,
  Search, X, Activity, ArrowUp, ArrowDown, ArrowUpDown, TrendingUp, CreditCard, AlertTriangle,
} from 'lucide-react';
import CountUp from '../components/ui/CountUp';
import { fetchPartenaires, fetchPartenaireDetail } from '../api/analyticsApi';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatEntier, formatMontant } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './ConformiteRIB.css';

const fmtFull = (n) => formatMontant(n);
const fmt = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(n ?? 0);

const STATUT_DEMANDE = {
  PENDING: { label: 'En attente', cls: 'pending', color: '#D97706' },
  PAID: { label: 'Payé', cls: 'paid', color: '#059669' },
  PARTIALLY_PAID: { label: 'Partiel', cls: 'partial', color: '#2563EB' },
  FAILED: { label: 'Échoué', cls: 'failed', color: '#DC2626' },
  EXPIRED: { label: 'Expiré', cls: 'expired', color: '#6B7280' },
  CALLBACK_SENT: { label: 'Callback envoyé', cls: 'callback', color: '#8B5CF6' },
  CALLBACK_FAILED: { label: 'Callback échoué', cls: 'failed', color: '#DC2626' },
};

const STATUT_PLATEFORME = {
  ACTIVE: { label: 'Active', color: '#059669' },
  SUSPENDED: { label: 'Suspendue', color: '#D97706' },
  INACTIVE: { label: 'Inactive', color: '#6B7280' },
};

function StatutBadge({ statut }) {
  const cfg = STATUT_PLATEFORME[statut] || { label: statut, color: '#6B7280' };
  return (
    <span
      className="mini-badge"
      style={{
        background: `${cfg.color}18`,
        color: cfg.color,
        fontWeight: 700,
        fontSize: '0.7rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '6px',
      }}
    >
      {cfg.label}
    </span>
  );
}

function DemandeBadge({ statut }) {
  const cfg = STATUT_DEMANDE[statut] || { label: statut, cls: 'pending', color: '#6B7280' };
  return <span className={`mini-badge ${cfg.cls}`}>{cfg.label}</span>;
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={12} className="sort-icon neutral" />;
  return sortDir === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />;
}

// ─── Detail Panel ──────────────────────────────────────────────
function PartenaireDetailPanel({ partenaireId, dateRange: initialDateRange = {}, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [detailDateRange, setDetailDateRange] = useState(initialDateRange);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetchPartenaireDetail(partenaireId, detailDateRange)
      .then(d => setDetail(d || null))
      .catch(err => { console.error(err); setFetchError(err.message || 'Erreur'); setDetail(null); })
      .finally(() => setLoading(false));
  }, [partenaireId, detailDateRange]);

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
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>
          {fetchError ? `Erreur : ${fetchError}` : 'Aucune donnée disponible pour cette plateforme.'}
        </p>
      </div>
    );
  }

  const pf = detail.plateforme || {};
  const totalDemandes = detail.totalDemandes || 0;
  const demandesPayees = detail.demandesPayees || 0;
  const demandesEchouees = (detail.repartitionStatuts || [])
    .filter(s => s.statut === 'FAILED' || s.statut === 'CALLBACK_FAILED')
    .reduce((sum, s) => sum + (s.nombre || 0), 0);
  const montantPaye = detail.montantPaye || 0;
  const tauxSucces = detail.tauxSucces || 0;

  const statutPieData = (detail.repartitionStatuts || [])
    .map(s => ({
      name: STATUT_DEMANDE[s.statut]?.label || s.statut,
      value: s.nombre || s.count || 0,
      color: STATUT_DEMANDE[s.statut]?.color || '#6B7280',
    }))
    .filter(d => d.value > 0);

  const methodeData = (detail.methodesPaiement || []).map(m => ({
    methode: m.methode || m.nom,
    montant: m.montant || 0,
    count: m.nombre || m.count || 0,
  }));

  const evolutionData = detail.evolution || [];
  const dernieresDemandes = (detail.recentes || detail.dernieresDemandes || []).slice(0, 20);

  return (
    <div className="cdi-detail-panel">
      {/* Top bar */}
      <div className="cdi-detail-topbar">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <DatePresetFilter onChange={setDetailDateRange} />
      </div>

      {/* Header */}
      <div className="cdi-detail-header">
        <div className="cdi-detail-icon" style={{ color: '#059669' }}><Handshake size={28} /></div>
        <div>
          <h2 className="cdi-detail-name">{pf.nom || detail.nom || 'Plateforme'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            {(pf.code || detail.code) && <code className="rib-code">{pf.code || detail.code}</code>}
            <StatutBadge statut={pf.statut || detail.statut || 'ACTIVE'} />
          </div>
          {(pf.ministere || detail.ministere) && (
            <p className="cdi-detail-sub"><Building2 size={13} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
              {typeof (pf.ministere || detail.ministere) === 'object' ? (pf.ministere || detail.ministere)?.nomFr || (pf.ministere || detail.ministere)?.nom : (pf.ministere || detail.ministere)}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="cdi-detail-kpis">
        <div className="cdi-dkpi">
          <Activity size={18} style={{ color: '#2563EB' }} />
          <div>
            <span className="cdi-dkpi-val"><CountUp end={totalDemandes} separator=" " duration={0.8} /></span>
            <span className="cdi-dkpi-label">Total Demandes</span>
          </div>
        </div>
        <div className="cdi-dkpi">
          <CheckCircle size={18} style={{ color: '#059669' }} />
          <div>
            <span className="cdi-dkpi-val"><CountUp end={demandesPayees} separator=" " duration={0.8} /></span>
            <span className="cdi-dkpi-label">Payées</span>
          </div>
        </div>
        <div className="cdi-dkpi">
          <XCircle size={18} style={{ color: '#DC2626' }} />
          <div>
            <span className="cdi-dkpi-val"><CountUp end={demandesEchouees} separator=" " duration={0.8} /></span>
            <span className="cdi-dkpi-label">Échouées</span>
          </div>
        </div>
        <div className="cdi-dkpi">
          <CreditCard size={18} style={{ color: '#059669' }} />
          <div>
            <span className="cdi-dkpi-val">{fmtFull(montantPaye)}</span>
            <span className="cdi-dkpi-label">Montant Payé</span>
          </div>
        </div>
        <div className="cdi-dkpi">
          <div className={`taux-circle ${tauxSucces >= 50 ? 'good' : tauxSucces >= 25 ? 'mid' : 'bad'}`}>{tauxSucces}%</div>
          <div>
            <span className="cdi-dkpi-val">{demandesPayees} / {totalDemandes}</span>
            <span className="cdi-dkpi-label">Taux de Succès</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="overview-grid">
        {/* Status PieChart */}
        <div className="card">
          <h3 className="card-title">Répartition par Statut</h3>
          {statutPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie data={statutPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {statutPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatEntier(v)} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="overview-pie-legend">
                {statutPieData.map((d, i) => (
                  <div key={i} className="overview-legend-item">
                    <span className="legend-dot" style={{ background: d.color }} />
                    {d.name}
                    <strong>{formatEntier(d.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="no-data-msg">Aucune donnée disponible</p>}
        </div>

        {/* Payment Methods BarChart */}
        <div className="card">
          <h3 className="card-title"><CreditCard size={14} /> Méthodes de Paiement</h3>
          {methodeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={methodeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="methode" stroke="var(--chart-axis)" fontSize={11} />
                <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                <Tooltip formatter={(v) => fmtFull(v)} />
                <Bar dataKey="montant" name="Montant" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="no-data-msg">Aucune donnée disponible</p>}
        </div>
      </div>

      {/* Monthly Evolution */}
      {evolutionData.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 className="card-title"><TrendingUp size={14} /> Évolution Mensuelle</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="periode" stroke="var(--chart-axis)" fontSize={11} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
              <Tooltip formatter={(v) => fmtFull(v)} />
              <Bar dataKey="paye" name="Payé" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="enAttente" name="En attente" fill="#D97706" radius={[4, 4, 0, 0]} />
              <Bar dataKey="echoue" name="Échoué" fill="#DC2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Demands Table */}
      {dernieresDemandes.length > 0 && (
        <div className="card cdi-table-card cdi-table-scroll" style={{ marginTop: '1rem', padding: 0 }}>
          <h3 className="card-title" style={{ padding: '1rem 1rem 0.5rem' }}>20 dernières demandes</h3>
          <table className="cdi-detail-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Code unique</th>
                <th className="text-right">Montant</th>
                <th className="text-center">Statut</th>
                <th>Méthode</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {dernieresDemandes.map((d, i) => (
                <tr key={i} className="cdi-perf-row">
                  <td><code className="rib-code">{d.platformReference || d.reference || '-'}</code></td>
                  <td><code className="rib-code">{d.uniqueCode || '-'}</code></td>
                  <td className="text-right montant-cell">{fmtFull(d.montant)}</td>
                  <td className="text-center"><DemandeBadge statut={d.statut} /></td>
                  <td>{d.methodePaiement || d.methode || '-'}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{d.creeLe ? new Date(d.creeLe).toLocaleDateString('fr-FR') : (d.date || '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function ConformiteRIB() {
  const [partenaires, setPartenaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('montantPaye');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedId, setSelectedId] = useState(null);
  const [dateRange, setDateRange] = useState(() => getCurrentPeriodRange());

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPartenaires(dateRange)
      .then(data => setPartenaires(Array.isArray(data) ? data : []))
      .catch(err => { console.error(err); setError(err.message || 'Erreur de chargement'); })
      .finally(() => setLoading(false));
  }, [dateRange]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const getMinNom = (p) => typeof p.ministere === 'object' ? (p.ministere?.nomFr || p.ministere?.nom || '') : (p.ministere || '');
    return partenaires
      .filter(p => !q || p.nom?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) || getMinNom(p).toLowerCase().includes(q))
      .sort((a, b) => {
        const va = a[sortCol] ?? 0;
        const vb = b[sortCol] ?? 0;
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc' ? va - vb : vb - va;
      });
  }, [partenaires, search, sortCol, sortDir]);

  const maxMontant = useMemo(() => {
    if (!filtered.length) return 1;
    return Math.max(...filtered.map(p => p.montantPaye || 0)) || 1;
  }, [filtered]);

  const getExportData = useCallback(() => ({
    headers: ['Code', 'Plateforme', 'Statut', 'Ministère', 'Demandes', 'Payées', 'Montant Payé', 'Taux Succès'],
    rows: filtered.map(p => [
      p.code, p.nom,
      STATUT_PLATEFORME[p.statut]?.label || p.statut,
      (typeof p.ministere === 'object' ? (p.ministere?.nomFr || p.ministere?.nom) : p.ministere) || '-',
      p.totalDemandes, p.demandesPayees,
      fmtFull(p.montantPaye),
      `${p.tauxSucces || 0}%`,
    ]),
    sheetName: 'Plateformes Partenaires',
    subtitle: `${filtered.length} plateformes`,
  }), [filtered]);

  // Drill-down mode
  if (selectedId) {
    return (
      <div className="page-container">
        <PartenaireDetailPanel
          partenaireId={selectedId}
          dateRange={dateRange}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Chargement des plateformes..." /></div></div>;
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header"><h1 className="page-title"><Handshake size={24} /> Plateformes Partenaires</h1></div>
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <AlertTriangle size={40} style={{ marginBottom: '1rem', color: '#D97706' }} />
          <p style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Erreur de chargement</p>
          <p style={{ fontSize: '0.85rem' }}>{error}</p>
          <button onClick={() => { setError(null); setLoading(true); fetchPartenaires(dateRange).then(d => setPartenaires(Array.isArray(d) ? d : [])).catch(e => setError(e.message)).finally(() => setLoading(false)); }} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><Handshake size={24} /> Plateformes Partenaires</h1>
          <p className="page-subtitle">Performance et suivi des plateformes intégrées</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Plateformes Partenaires" filenameBase="Plateformes_Partenaires" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      {/* Search */}
      <div className="cdi-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder="Rechercher une plateforme, un code ou un ministère..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <span className="cdi-count">{filtered.length} plateforme(s)</span>
      </div>

      {/* Platforms grid */}
      <div className="rib-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
            <Search size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>Aucune plateforme trouvée.</p>
          </div>
        )}
        {filtered.map((p) => {
          const taux = p.tauxSucces || 0;
          const pId = p.plateformeId || p.id || p.code;
          const minNom = typeof p.ministere === 'object' ? (p.ministere?.nomFr || p.ministere?.nom || '') : (p.ministere || '');
          return (
            <div
              key={pId}
              className="card"
              style={{ cursor: 'pointer', padding: '1rem 1.2rem', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onClick={() => setSelectedId(pId)}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <code className="rib-code" style={{ fontSize: '0.7rem' }}>{p.code}</code>
                    <StatutBadge statut={p.statut} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.nom}</h3>
                </div>
                <Handshake size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: '0.15rem' }} />
              </div>

              {/* Ministry */}
              {minNom && (
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Building2 size={12} /> {minNom}
                </p>
              )}

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Demandes</span>
                  <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)' }}>{formatEntier(p.totalDemandes)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Payées</span>
                  <span style={{ display: 'block', fontWeight: 700, color: '#059669' }}>{formatEntier(p.demandesPayees)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Montant</span>
                  <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{fmtFull(p.montantPaye)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Taux succès</span>
                  <span className={`taux-badge ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`} style={{ display: 'inline-block', marginTop: '0.15rem' }}>{taux}%</span>
                </div>
              </div>

              {/* Performance bar */}
              <div className="perf-bar-bg" style={{ marginTop: '0.6rem' }}>
                <div className="perf-bar-fill" style={{ width: `${Math.max(2, ((p.montantPaye || 0) / maxMontant) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
