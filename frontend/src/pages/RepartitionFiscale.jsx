import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell,
} from 'recharts';
import {
  PieChart as PieIcon, Search, X, ArrowUp, ArrowDown, ArrowUpDown, Activity,
  ChevronLeft, Building2, CheckCircle, Clock, AlertTriangle, DollarSign,
  FileText, LayoutDashboard, Target, FileSpreadsheet, FileDown, Layers,
} from 'lucide-react';
import { fetchRepartitionServices, fetchRepartitionDomaines, fetchDomaineDetail, fetchServiceDetail, fetchSoumissions } from '../api/analyticsApi';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatMontant } from '../utils/format';
import './RepartitionFiscale.css';

const fmtFull = (n) => formatMontant(n);
const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n ?? 0);
const PIE_COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={12} className="sort-icon neutral" />;
  return sortDir === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />;
}

// ─── Service Detail Panel ───────────────────────────────────
const STATUT_BADGE = {
  PAID:    { label: 'Payé',       bg: '#dcfce7', color: '#166534', icon: CheckCircle },
  PENDING: { label: 'En attente', bg: '#fef9c3', color: '#854d0e', icon: Clock },
  PARTIAL: { label: 'Partiel',    bg: '#dbeafe', color: '#1e40af', icon: Activity },
  FAILED:  { label: 'Échoué',     bg: '#fee2e2', color: '#991b1b', icon: AlertTriangle },
};

function ServiceDetailPanel({ serviceId, dateRange, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localDateRange, setLocalDateRange] = useState(dateRange || {});

  // Soumissions individuelles
  const [soumissions, setSoumissions] = useState([]);
  const [soumPage, setSoumPage] = useState(1);
  const [soumPagination, setSoumPagination] = useState({});
  const [soumSearch, setSoumSearch] = useState('');
  const [soumLoading, setSoumLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchServiceDetail(serviceId, localDateRange)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [serviceId, localDateRange]);

  useEffect(() => {
    setSoumLoading(true);
    fetchSoumissions({
      serviceId,
      ...localDateRange,
      page: soumPage,
      limit: 10,
      search: soumSearch || undefined,
    })
      .then(res => {
        setSoumissions(res.donnees || []);
        setSoumPagination(res.pagination || {});
      })
      .catch(console.error)
      .finally(() => setSoumLoading(false));
  }, [serviceId, localDateRange, soumPage, soumSearch]);

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
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>Aucune donnée pour ce service.</p>
      </div>
    );
  }

  const service = detail.service || {};
  const taux = detail.tauxPaiement || 0;
  const repartitionStatuts = detail.repartitionStatuts || [];
  const evolution = detail.evolution || [];

  const pieStatut = repartitionStatuts.length > 0
    ? repartitionStatuts.map((s, i) => ({ name: s.statut, value: s.montant || s.count || 0, color: PIE_COLORS[i % PIE_COLORS.length] })).filter(d => d.value > 0)
    : [
        { name: 'Payées', value: detail.soumissionsPayees || 0, color: '#059669' },
        { name: 'Total', value: (detail.totalSoumissions || 0) - (detail.soumissionsPayees || 0), color: '#D97706' },
      ].filter(d => d.value > 0);

  return (
    <div className="cdi-detail-panel">
      <div className="cdi-detail-topbar">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <DatePresetFilter onChange={setLocalDateRange} />
      </div>

      {/* Header */}
      <div className="cdi-detail-header">
        <div className="cdi-detail-icon" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}><Layers size={28} /></div>
        <div>
          <h2 className="cdi-detail-name">{service.nomFr || service.nom || 'Service'}</h2>
          <p className="cdi-detail-sub">
            {service.ministere && <span>{service.ministere}</span>}
            {service.domaine && <span style={{ marginLeft: '0.5rem' }}>{service.domaine}</span>}
            {service.montantUnitaire != null && <span style={{ marginLeft: '0.5rem' }}>Montant unitaire : {fmtFull(service.montantUnitaire)}</span>}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="cdi-detail-kpis">
        <div className="cdi-dkpi"><DollarSign size={18} className="text-dgi" /><div><span className="cdi-dkpi-val">{fmtFull(detail.totalRevenus)}</span><span className="cdi-dkpi-label">Revenus totaux</span></div></div>
        <div className="cdi-dkpi"><FileText size={18} style={{ color: '#2563EB' }} /><div><span className="cdi-dkpi-val">{detail.totalSoumissions || 0}</span><span className="cdi-dkpi-label">Soumissions</span></div></div>
        <div className="cdi-dkpi"><CheckCircle size={18} className="text-success" /><div><span className="cdi-dkpi-val">{detail.soumissionsPayees || 0}</span><span className="cdi-dkpi-label">Payées</span></div></div>
        <div className="cdi-dkpi">
          <div className={`taux-circle ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</div>
          <div><span className="cdi-dkpi-val">Taux de paiement</span><span className="cdi-dkpi-label">{detail.soumissionsPayees || 0}/{detail.totalSoumissions || 0}</span></div>
        </div>
      </div>

      {/* Charts */}
      <div className="overview-grid">
        <div className="card">
          <h3 className="card-title">Evolution Mensuelle des Revenus</h3>
          {evolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="mois" stroke="var(--chart-axis)" fontSize={11} />
                <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                <Tooltip formatter={(v) => fmtFull(v)} />
                <Bar dataKey="montant" name="Revenus" fill="#059669" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="no-data-msg">Pas assez de données</p>}
        </div>

        <div className="card">
          <h3 className="card-title">Répartition par Statut</h3>
          {pieStatut.length > 0 ? (
            <>
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
            </>
          ) : <p className="no-data-msg">Pas de données</p>}
        </div>
      </div>

      {/* Soumissions individuelles */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Soumissions individuelles</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Rechercher un soumetteur…"
                value={soumSearch}
                onChange={e => { setSoumSearch(e.target.value); setSoumPage(1); }}
                style={{ padding: '0.4rem 0.5rem 0.4rem 1.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '200px' }}
              />
            </div>
            {soumPagination.total > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{soumPagination.total} résultat(s)</span>}
          </div>
        </div>

        {soumLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>Chargement…</div>
        ) : soumissions.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-tertiary)' }}>Aucune soumission trouvée.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Soumetteur</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '2px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Montant</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '2px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Statut</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '2px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {soumissions.map((s, i) => {
                    const badge = STATUT_BADGE[s.statutPaiement] || STATUT_BADGE.PENDING;
                    const BadgeIcon = badge.icon;
                    return (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #f3f4f6)', color: 'var(--text-tertiary)' }}>{(soumPage - 1) * 10 + i + 1}</td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #f3f4f6)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{s.uniqueCode || s.externalId?.substring(0, 8) || '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                          <div style={{ fontWeight: 500 }}>{s.soumetteurNom || 'Anonyme'}</div>
                          {s.soumetteurTelephone && <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{s.soumetteurTelephone}</div>}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #f3f4f6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtFull(s.montant)}</td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #f3f4f6)', textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: badge.bg, color: badge.color, fontSize: '0.72rem', fontWeight: 600 }}>
                            <BadgeIcon size={11} />{badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #f3f4f6)', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {s.dateSoumission ? new Date(s.dateSoumission).toLocaleDateString('fr-FR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {soumPagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button onClick={() => setSoumPage(p => Math.max(1, p - 1))} disabled={soumPage <= 1} style={{ padding: '0.3rem 0.6rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', cursor: soumPage <= 1 ? 'not-allowed' : 'pointer', opacity: soumPage <= 1 ? 0.4 : 1, fontSize: '0.8rem' }}>← Précédent</button>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Page {soumPage} / {soumPagination.totalPages}</span>
                <button onClick={() => setSoumPage(p => Math.min(soumPagination.totalPages, p + 1))} disabled={soumPage >= soumPagination.totalPages} style={{ padding: '0.3rem 0.6rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', cursor: soumPage >= soumPagination.totalPages ? 'not-allowed' : 'pointer', opacity: soumPage >= soumPagination.totalPages ? 0.4 : 1, fontSize: '0.8rem' }}>Suivant →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Domaine Detail Panel ───────────────────────────────────
function DomaineDetailPanel({ domaineId, dateRange, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localDateRange, setLocalDateRange] = useState(dateRange || {});

  useEffect(() => {
    setLoading(true);
    fetchDomaineDetail(domaineId, localDateRange)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [domaineId, localDateRange]);

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
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>Aucune donnée pour ce domaine.</p>
      </div>
    );
  }

  const domaine = detail.domaine || {};
  const taux = detail.tauxPaiement || 0;
  const services = detail.services || [];
  const evolution = detail.evolution || [];
  const maxServiceMontant = services.length > 0 ? services[0].montant || 1 : 1;

  return (
    <div className="cdi-detail-panel">
      <div className="cdi-detail-topbar">
        <button className="cdi-back-btn" onClick={onBack}><ChevronLeft size={16} /> Retour à la liste</button>
        <DatePresetFilter onChange={setLocalDateRange} />
      </div>

      {/* Header */}
      <div className="cdi-detail-header">
        <div className="cdi-detail-icon" style={{ background: `${domaine.couleur || '#2563EB'}20`, color: domaine.couleur || '#2563EB' }}><Target size={28} /></div>
        <div>
          <h2 className="cdi-detail-name">{domaine.nomFr || domaine.nom || 'Domaine'}</h2>
          <p className="cdi-detail-sub">{services.length} service(s) dans ce domaine</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="cdi-detail-kpis">
        <div className="cdi-dkpi"><DollarSign size={18} className="text-dgi" /><div><span className="cdi-dkpi-val">{fmtFull(detail.totalRevenus)}</span><span className="cdi-dkpi-label">Revenus totaux</span></div></div>
        <div className="cdi-dkpi"><FileText size={18} style={{ color: '#2563EB' }} /><div><span className="cdi-dkpi-val">{detail.totalSoumissions || 0}</span><span className="cdi-dkpi-label">Soumissions</span></div></div>
        <div className="cdi-dkpi"><CheckCircle size={18} className="text-success" /><div><span className="cdi-dkpi-val">{detail.soumissionsPayees || 0}</span><span className="cdi-dkpi-label">Payées</span></div></div>
        <div className="cdi-dkpi">
          <div className={`taux-circle ${taux >= 50 ? 'good' : taux >= 25 ? 'mid' : 'bad'}`}>{taux}%</div>
          <div><span className="cdi-dkpi-val">Taux de paiement</span><span className="cdi-dkpi-label">{detail.soumissionsPayees || 0}/{detail.totalSoumissions || 0}</span></div>
        </div>
      </div>

      {/* Charts */}
      <div className="overview-grid">
        <div className="card">
          <h3 className="card-title">Evolution Mensuelle des Revenus</h3>
          {evolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="mois" stroke="var(--chart-axis)" fontSize={11} />
                <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
                <Tooltip formatter={(v) => fmtFull(v)} />
                <Bar dataKey="montant" name="Revenus" fill="#059669" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="no-data-msg">Pas assez de données</p>}
        </div>

        <div className="card">
          <h3 className="card-title"><Layers size={14} /> Services dans ce domaine</h3>
          {services.slice(0, 8).map((s, i) => (
            <div key={i} className="overview-rank-item">
              <span className="overview-rank-num">{i + 1}</span>
              <span className="overview-rank-name">{s.nom}</span>
              <div className="perf-bar-bg" style={{ flex: 1 }}><div className="perf-bar-fill" style={{ width: `${Math.max(3, ((s.montant || 0) / maxServiceMontant) * 100)}%`, background: s.couleur || domaine.couleur || '#059669' }} /></div>
              <span className="overview-rank-val">{fmt(s.montant || 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Services table */}
      {services.length > 0 && (
        <div className="card cdi-table-card">
          <table className="cdi-detail-table">
            <thead>
              <tr>
                <th className="col-index">#</th>
                <th>Service</th>
                <th className="text-center">Soumissions</th>
                <th className="text-right">Montant</th>
                <th className="text-center">Part</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => {
                const part = detail.totalRevenus > 0 ? (((s.montant || 0) / detail.totalRevenus) * 100).toFixed(1) : '0';
                return (
                  <tr key={i}>
                    <td className="col-index">{i + 1}</td>
                    <td className="cdi-name-cell"><span style={{ color: s.couleur || '#059669', marginRight: '0.4rem' }}>●</span>{s.nom}</td>
                    <td className="text-center">{s.nombreSoumissions || 0}</td>
                    <td className="text-right montant-cell">{fmtFull(s.montant || 0)}</td>
                    <td className="text-center"><span className="taux-badge good">{part}%</span></td>
                    <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, ((s.montant || 0) / maxServiceMontant) * 100)}%`, background: s.couleur || '#059669' }} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function RepartitionFiscale() {
  const [services, setServices] = useState([]);
  const [domaines, setDomaines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getCurrentPeriodRange);
  const [tab, setTab] = useState('services');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('montant');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedDomaine, setSelectedDomaine] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [filterMinistere, setFilterMinistere] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRepartitionServices(dateRange), fetchRepartitionDomaines(dateRange)])
      .then(([s, d]) => { setServices(s); setDomaines(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateRange]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const uniqueMinisteres = useMemo(() => {
    const set = new Set();
    services.forEach(s => { if (s.ministereNom) set.add(s.ministereNom); });
    return [...set].sort();
  }, [services]);

  const currentData = tab === 'services' ? services : domaines;
  const filtered = currentData
    .filter(r => {
      if (tab === 'services' && filterMinistere && r.ministereNom !== filterMinistere) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.nom || '').toLowerCase().includes(q) || (r.ministereNom || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const totalMontant = filtered.reduce((s, r) => s + (r.montant || 0), 0);
  const maxMontant = filtered[0]?.montant || 1;

  const getExportData = useCallback(() => {
    if (tab === 'services') {
      return {
        headers: ['Service', 'Ministère', 'Soumissions', 'Montant', 'Part (%)'],
        rows: filtered.map(r => [r.nom, r.ministereNom || '', r.nombreSoumissions, fmtFull(r.montant), totalMontant > 0 ? ((r.montant / totalMontant) * 100).toFixed(1) : '0']),
        sheetName: 'Services',
        subtitle: `${filtered.length} services`,
      };
    }
    return {
      headers: ['Domaine', 'Soumissions', 'Montant', 'Taux', 'Part (%)'],
      rows: filtered.map(r => [r.nom, r.nombreSoumissions, fmtFull(r.montant), `${r.tauxPaiement || 0}%`, totalMontant > 0 ? ((r.montant / totalMontant) * 100).toFixed(1) : '0']),
      sheetName: 'Domaines',
      subtitle: `${filtered.length} domaines`,
    };
  }, [filtered, tab, totalMontant]);

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Chargement..." /></div></div>;
  }

  // Domaine drill-down mode
  if (selectedDomaine) {
    return (
      <div className="page-container">
        <DomaineDetailPanel domaineId={selectedDomaine} dateRange={dateRange} onBack={() => setSelectedDomaine(null)} />
      </div>
    );
  }

  // Service drill-down mode
  if (selectedService) {
    return (
      <div className="page-container">
        <ServiceDetailPanel
          serviceId={selectedService.serviceId}
          dateRange={dateRange}
          onBack={() => setSelectedService(null)}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><PieIcon size={24} /> Répartition des Recettes</h1>
          <p className="page-subtitle">Distribution des revenus par service et par domaine</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const { headers, rows, sheetName } = getExportData();
              if (rows?.length) {
                const d = new Date();
                const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
                import('../utils/exportUtils').then(m => m.exportToExcel(rows, headers, sheetName, `Repartition_Recettes_${ts}.xlsx`));
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
                import('../utils/exportUtils').then(m => m.exportGenericPDF({ title: 'TRESOR ANALYTICS — Répartition des Recettes', headers, rows, filename: `Repartition_Recettes_${ts}.pdf` }));
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
        <button className={`fiscal-tab ${tab === 'services' ? 'active' : ''}`} onClick={() => { setTab('services'); setSearch(''); setFilterMinistere(''); }}>Services ({services.length})</button>
        <button className={`fiscal-tab ${tab === 'domaines' ? 'active' : ''}`} onClick={() => { setTab('domaines'); setSearch(''); setFilterMinistere(''); }}>Domaines ({domaines.length})</button>
        <span className="fiscal-tab-total">Total : {fmtFull(totalMontant)}</span>
      </div>

      <div className="cdi-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder={tab === 'services' ? 'Rechercher un service...' : 'Rechercher un domaine...'} value={search} onChange={e => { setSearch(e.target.value); }} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <span className="cdi-count">{filtered.length} élément(s)</span>
      </div>

      {tab === 'services' && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <select
            value={filterMinistere}
            onChange={e => setFilterMinistere(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          >
            <option value="">Tous les ministeres</option>
            {uniqueMinisteres.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {filterMinistere && (
            <button
              onClick={() => setFilterMinistere('')}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'none', color: '#DC2626', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <X size={12} /> Effacer
            </button>
          )}
        </div>
      )}

      <div className="card cdi-table-card cdi-table-scroll cdi-table-scroll-compact">
        <table className="cdi-perf-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              {tab === 'services' ? (
                <>
                  <th className="sortable" onClick={() => handleSort('nom')}>Service <SortIcon col="nom" sortCol={sortCol} sortDir={sortDir} /></th>
                  <th className="sortable" onClick={() => handleSort('ministereNom')}>Ministère <SortIcon col="ministereNom" sortCol={sortCol} sortDir={sortDir} /></th>
                  <th className="sortable text-center" onClick={() => handleSort('nombreSoumissions')}>Soumissions <SortIcon col="nombreSoumissions" sortCol={sortCol} sortDir={sortDir} /></th>
                </>
              ) : (
                <>
                  <th className="sortable" onClick={() => handleSort('nom')}>Domaine <SortIcon col="nom" sortCol={sortCol} sortDir={sortDir} /></th>
                  <th className="sortable text-center" onClick={() => handleSort('nombreSoumissions')}>Soumissions <SortIcon col="nombreSoumissions" sortCol={sortCol} sortDir={sortDir} /></th>
                </>
              )}
              <th className="sortable text-right" onClick={() => handleSort('montant')}>Montant <SortIcon col="montant" sortCol={sortCol} sortDir={sortDir} /></th>
              {tab === 'domaines' && (
                <th className="sortable text-center" onClick={() => handleSort('tauxPaiement')}>Taux <SortIcon col="tauxPaiement" sortCol={sortCol} sortDir={sortDir} /></th>
              )}
              <th className="text-center">Part</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={tab === 'services' ? 7 : 8} className="empty-row"><div className="empty-state"><p>Aucun résultat.</p></div></td></tr>
            ) : filtered.map((r, i) => {
              const part = totalMontant > 0 ? ((r.montant / totalMontant) * 100).toFixed(1) : '0.0';
              return (
                <tr
                  key={i}
                  className="cdi-perf-row"
                  onClick={tab === 'domaines' ? () => setSelectedDomaine(r.domaineId) : () => setSelectedService(r)}
                  style={{ cursor: 'pointer' }}
                  title={tab === 'services' ? 'Voir le détail de ce service' : 'Voir le détail de ce domaine'}
                >
                  <td className="col-index">{i + 1}</td>
                  {tab === 'services' ? (
                    <>
                      <td className="cdi-name-cell"><span style={{ color: r.couleur || '#059669', marginRight: '0.5rem' }}>●</span>{r.nom}</td>
                      <td>{r.ministereNom || '—'}</td>
                      <td className="text-center">{r.nombreSoumissions}</td>
                    </>
                  ) : (
                    <>
                      <td className="cdi-name-cell"><Target size={14} className="cdi-row-icon" style={{ color: r.couleur || '#2563EB' }} />{r.nom}</td>
                      <td className="text-center">{r.nombreSoumissions}</td>
                    </>
                  )}
                  <td className="text-right montant-cell">{fmtFull(r.montant)}</td>
                  {tab === 'domaines' && (
                    <td className="text-center"><span className={`taux-badge ${r.tauxPaiement >= 50 ? 'good' : r.tauxPaiement >= 25 ? 'mid' : 'bad'}`}>{r.tauxPaiement || 0}%</span></td>
                  )}
                  <td className="text-center"><span className="taux-badge good">{part}%</span></td>
                  <td>
                    <div className="perf-bar-bg">
                      <div className="perf-bar-fill" style={{ width: `${Math.max(2, (r.montant / maxMontant) * 100)}%`, background: r.couleur || 'var(--accent-dgi)' }} />
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
