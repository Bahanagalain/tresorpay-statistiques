import { useState, useEffect, useCallback } from 'react';

import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Building2, TrendingUp, FileText, Award, X, ChevronDown } from 'lucide-react';
import { fetchMinisteres, fetchMinistereDetail } from '../api/statistiquesApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { formatMontant, formatMontantCompact, formatPourcentage } from '../utils/format';

const COLORS = ['#B8860B', '#059669', '#2563EB', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6366F1'];

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

function PeriodSelector({ state, setState }) {
  const presets = [
    { key: 'all', label: 'Toute la periode' },
    { key: 'today', label: "Aujourd'hui" },
    { key: 'month', label: 'Ce mois' },
    { key: 'custom', label: 'Personnalise' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {presets.map((p) => (
        <button
          key={p.key}
          onClick={() => setState({ preset: p.key })}
          className={state.preset === p.key ? 'btn-primary' : 'btn-secondary-outline'}
          style={{ padding: '6px 14px', fontSize: 13 }}
        >
          {p.label}
        </button>
      ))}
      {state.preset === 'custom' && (
        <>
          <input type="date" className="ghost-input" style={{ width: 150, padding: '6px 10px' }} value={state.customStart} onChange={(e) => setState({ customStart: e.target.value })} />
          <input type="date" className="ghost-input" style={{ width: 150, padding: '6px 10px' }} value={state.customEnd} onChange={(e) => setState({ customEnd: e.target.value })} />
        </>
      )}
    </div>
  );
}

export default function PerformanceMinisteres() {
  const { state: periodState, setState: setPeriodState, range } = usePeriodFilter();
  const [ministeres, setMinisteres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortField, setSortField] = useState('montant');
  const [sortDir, setSortDir] = useState('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMinisteres(range);
      setMinisteres(data);
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  const openDetail = useCallback(async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const d = await fetchMinistereDetail(id, range);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [range]);

  const sorted = [...ministeres].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'nom') return mul * a.nom.localeCompare(b.nom);
    return mul * ((a[sortField] || 0) - (b[sortField] || 0));
  });

  const totalRevenus = ministeres.reduce((s, m) => s + m.montant, 0);
  const totalSoumissions = ministeres.reduce((s, m) => s + m.nombreSoumissions, 0);
  const topMinistere = sorted.length ? sorted[0] : null;
  const avgTaux = ministeres.length ? ministeres.reduce((s, m) => s + m.tauxPaiement, 0) / ministeres.length : 0;

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const pieData = ministeres.slice(0, 8).map((m) => ({ name: m.nom, value: m.montant }));

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400, color: 'var(--text-tertiary)' }}>
        <div>Chargement des performances...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <div className="card-layer" style={{ padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>
          <button className="btn-primary" onClick={loadData}>Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h2 className="text-headline" style={{ margin: 0 }}>Performance des Ministeres</h2>
          <p className="text-body" style={{ margin: '4px 0 0' }}>Analyse comparative des revenus par ministere</p>
        </div>
        <PeriodSelector state={periodState} setState={setPeriodState} />
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Revenus Totaux', value: formatMontantCompact(totalRevenus), icon: TrendingUp, color: 'var(--accent-gold)' },
          { label: 'Soumissions', value: totalSoumissions.toLocaleString('fr-FR'), icon: FileText, color: 'var(--accent-dgi)' },
          { label: 'Ministeres', value: ministeres.length, icon: Building2, color: 'var(--accent-dgd)' },
          { label: 'Taux Moyen', value: formatPourcentage(avgTaux), icon: Award, color: '#8B5CF6' },
        ].map((kpi, i) => (
          <div key={kpi.label} className="card-layer" custom={i} variants={fadeUp} initial="hidden" animate="visible" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${kpi.color}15`, display: 'grid', placeItems: 'center' }}>
              <kpi.icon size={22} style={{ color: kpi.color }} />
            </div>
            <div>
              <div className="text-label" style={{ marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card-layer glass-panel" custom={4} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Comparaison des revenus</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sorted.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => formatMontantCompact(v).replace(' FCFA', '')} />
              <YAxis type="category" dataKey="nom" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => formatMontant(v)} />
              <Bar dataKey="montant" fill="var(--accent-gold)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-layer glass-panel" custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Repartition des revenus</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name.slice(0, 15)} (${(percent * 100).toFixed(0)}%)`} labelLine>
                {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatMontant(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="card-layer glass-panel" custom={6} variants={fadeUp} initial="hidden" animate="visible">
        <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Classement des ministeres</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                {[
                  { key: null, label: 'Rang', width: 60 },
                  { key: 'nom', label: 'Ministere' },
                  { key: 'montant', label: 'Revenus' },
                  { key: 'nombreSoumissions', label: 'Soumissions' },
                  { key: 'tauxPaiement', label: 'Taux Paiement' },
                ].map((col) => (
                  <th
                    key={col.label}
                    onClick={() => col.key && toggleSort(col.key)}
                    style={{
                      textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)',
                      fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
                      cursor: col.key ? 'pointer' : 'default', width: col.width, whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                    {col.key && sortField === col.key && (
                      <ChevronDown size={14} style={{ marginLeft: 4, transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none', verticalAlign: 'middle' }} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, idx) => (
                <tr
                  key={m.id}
                  onClick={() => openDetail(m.id)}
                  style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px', fontWeight: 700, color: idx < 3 ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}>#{idx + 1}</td>
                  <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{m.nom}</td>
                  <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{formatMontant(m.montant)}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{m.nombreSoumissions.toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: m.tauxPaiement >= 70 ? 'rgba(5,150,105,0.12)' : m.tauxPaiement >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                      color: m.tauxPaiement >= 70 ? 'var(--accent-dgi)' : m.tauxPaiement >= 40 ? '#F59E0B' : '#ef4444',
                    }}>
                      {formatPourcentage(m.tauxPaiement)}
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Aucun ministere trouve</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <>
        {selectedId && (
          <div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 24 }}
            onClick={() => setSelectedId(null)}
          >
            <div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="card-layer glass-panel"
              style={{ maxWidth: 800, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 className="text-headline" style={{ margin: 0 }}>{detail?.nom || 'Detail Ministere'}</h2>
                <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={24} /></button>
              </div>

              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Chargement...</div>
              ) : detail ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Revenus</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-gold)', marginTop: 4 }}>{formatMontantCompact(detail.montant)}</div>
                    </div>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Soumissions</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-dgi)', marginTop: 4 }}>{detail.nombreSoumissions}</div>
                    </div>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Taux</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-dgd)', marginTop: 4 }}>{formatPourcentage(detail.tauxPaiement)}</div>
                    </div>
                  </div>

                  {/* Services breakdown */}
                  {detail.services?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 className="text-title" style={{ marginBottom: 12 }}>Services</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Nom</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Montant</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Soumissions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.services.map((s) => (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{s.nom}</td>
                              <td style={{ padding: '10px 12px' }}>{formatMontant(s.montant)}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{s.nombreSoumissions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Monthly trend */}
                  {detail.evolution?.length > 0 && (
                    <div>
                      <h3 className="text-title" style={{ marginBottom: 12 }}>Evolution mensuelle</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={detail.evolution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={(v) => formatMontantCompact(v).replace(' FCFA', '')} />
                          <Tooltip formatter={(v) => formatMontant(v)} />
                          <Legend />
                          <Bar dataKey="paye" name="Paye" fill="var(--accent-dgi)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="enAttente" name="En attente" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="echoue" name="Echoue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Aucune donnee disponible</div>
              )}
            </div>
          </div>
        )}
      </>
    </div>
  );
}
