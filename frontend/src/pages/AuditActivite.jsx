import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Activity, FileText, Clock, Search, X } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import ExportButtons from '../components/ui/ExportButtons';
import CountUp from '../components/ui/CountUp';
import { fetchAudit } from '../api/analyticsApi';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatEntier } from '../utils/format';

// ─── Couleurs d'actions ────────────────────────────────────
const ACTION_COLORS = {
  CREATE: '#059669', UPDATE: '#2563EB', DELETE: '#DC2626',
  LOGIN: '#8B5CF6', APPROVE: '#14B8A6', REJECT: '#F97316',
  PUBLISH: '#0EA5E9', SUBMIT: '#D97706', ACTIVATE: '#059669', DEACTIVATE: '#6B7280',
};

const PIE_COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9', '#6366F1'];

function getActionColor(action) {
  return ACTION_COLORS[action?.toUpperCase()] || '#6B7280';
}

// ─── Styles réutilisables ──────────────────────────────────
const s = {
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
    borderRadius: '14px', padding: '1.4rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)',
    margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  kpiCard: (color) => ({
    background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
    borderRadius: '14px', padding: '1.2rem 1.4rem',
    borderLeft: `3px solid ${color}`,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  }),
  badge: (action) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.68rem',
    fontWeight: 700, background: `${getActionColor(action)}15`,
    color: getActionColor(action),
  }),
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem',
  },
  th: {
    textAlign: 'left', padding: '0.6rem 0.8rem', fontWeight: 700,
    color: 'var(--text-secondary)', borderBottom: '2px solid var(--glass-border)',
    fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: {
    padding: '0.5rem 0.8rem', borderBottom: '1px solid var(--glass-border)',
    color: 'var(--text-primary)', verticalAlign: 'middle',
  },
  methodBadge: (method) => {
    const colors = { GET: '#2563EB', POST: '#059669', PUT: '#D97706', PATCH: '#8B5CF6', DELETE: '#DC2626' };
    const c = colors[(method || '').toUpperCase()] || '#6B7280';
    return {
      display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: '4px',
      fontSize: '0.65rem', fontWeight: 800, fontFamily: 'monospace',
      background: `${c}15`, color: c,
    };
  },
};

// ─── Tooltip personnalisé ──────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
      borderRadius: '10px', padding: '0.6rem 0.8rem', fontSize: '0.78rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: '2px 0', color: p.color || p.fill }}>
          {p.name}: <strong>{formatEntier(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
      borderRadius: '10px', padding: '0.5rem 0.7rem', fontSize: '0.78rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <p style={{ margin: 0, color: d.payload?.fill || 'var(--text-primary)' }}>
        {d.name}: <strong>{formatEntier(d.value)}</strong>
      </p>
    </div>
  );
};

// ─── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div style={s.kpiCard(color)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '10px',
          background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} style={{ color }} />
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        <CountUp end={value} duration={1.4} separator=" " />
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ───────────────────────────────────────
const paginBtnStyle = {
  padding: '0.3rem 0.6rem', border: '1px solid var(--glass-border)',
  borderRadius: '6px', background: 'var(--bg-surface)', color: 'var(--text-primary)',
  fontSize: '0.78rem', cursor: 'pointer',
};

export default function AuditActivite() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getCurrentPeriodRange);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntite, setFilterEntite] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await fetchAudit(dateRange, controller.signal);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          console.error(e);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [dateRange]);

  const total = data?.total ?? 0;
  const parAction = data?.parAction ?? [];
  const parEntite = data?.parEntite ?? [];
  const topActeurs = data?.topActeurs ?? [];
  const evolution = data?.evolution ?? [];
  const recentes = data?.recentes ?? [];

  // ─── Filtrage client-side ─────────────────────────────
  const filteredActions = recentes.filter(entry => {
    if (filterAction && entry.action !== filterAction) return false;
    if (filterEntite && entry.typeEntite !== filterEntite) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const haystack = [
        entry.acteurEmail, entry.acteurNom, entry.action,
        entry.typeEntite, entry.cheminRoute,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredActions.length / limit));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * limit;
  const endIdx = Math.min(startIdx + limit, filteredActions.length);
  const paginatedActions = filteredActions.slice(startIdx, endIdx);

  // Données pour les charts
  const barData = parAction.map(a => ({
    ...a,
    fill: getActionColor(a.action),
  }));

  const pieData = parEntite.map((e, i) => ({
    name: e.typeEntite,
    value: e.nombre,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const maxActeur = topActeurs.length > 0 ? Math.max(...topActeurs.map(a => a.nombre)) : 1;

  const getExportData = useCallback(() => ({
    headers: ['Date', 'Acteur', 'Action', 'Type Entité', 'Route', 'Méthode'],
    rows: filteredActions.map(r => [
      r.executeLe ? new Date(r.executeLe).toLocaleString('fr-FR') : '—',
      r.acteurEmail || '—',
      r.action || '—',
      r.typeEntite || '—',
      r.cheminRoute || '—',
      r.methodeHttp || '—',
    ]),
    sheetName: 'Audit',
    subtitle: `${formatEntier(filteredActions.length)} actions${(searchText || filterAction || filterEntite) ? ' (filtrées)' : ''}`,
  }), [filteredActions, searchText, filterAction, filterEntite]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><Shield size={24} /> Audit & Activité</h1>
          <p className="page-subtitle">Journal d'activité des administrateurs</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Audit & Activité" filenameBase="Audit" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="exec-loading"><WeaveSpinner size={80} message="Chargement de l'audit..." /></div></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem', marginBottom: '1.5rem',
          }}>
            <KpiCard icon={Activity} label="Total actions" value={total} color="#2563EB" />
            <KpiCard icon={Users} label="Acteurs uniques" value={topActeurs.length} color="#8B5CF6" />
            <KpiCard icon={FileText} label="Types d'entité" value={parEntite.length} color="#059669" />
          </div>

          {/* Filter bar */}
          <div className="card" style={{ padding: '0.8rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Rechercher par email, action, entité..."
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setPage(1); }}
                style={{ width: '100%', padding: '0.4rem 0.6rem 0.4rem 2rem', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
              />
            </div>
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
              <option value="">Toutes les actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="SUBMIT">SUBMIT</option>
              <option value="APPROVE">APPROVE</option>
              <option value="PUBLISH">PUBLISH</option>
              <option value="REJECT">REJECT</option>
            </select>
            <select value={filterEntite} onChange={e => { setFilterEntite(e.target.value); setPage(1); }}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
              <option value="">Tous les types</option>
              <option value="AdminUser">AdminUser</option>
              <option value="Service">Service</option>
              <option value="FormDefinition">FormDefinition</option>
              <option value="form">form</option>
              <option value="service">service</option>
              <option value="domain">domain</option>
              <option value="revenue-group">revenue-group</option>
              <option value="user">user</option>
            </select>
            {(searchText || filterAction || filterEntite) && (
              <button onClick={() => { setSearchText(''); setFilterAction(''); setFilterEntite(''); setPage(1); }}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'none', color: '#DC2626', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <X size={12} /> Effacer
              </button>
            )}
          </div>

          {/* Two columns: Actions par type + Par entité */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            gap: '1rem', marginBottom: '1.5rem',
          }}>
            {/* Bar chart — Actions par type */}
            <div style={s.card}>
              <h3 style={s.cardTitle}><Activity size={16} /> Actions par type</h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="action" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => formatEntier(v)} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="nombre" name="Actions" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>Aucune donnée</p>
              )}
            </div>

            {/* Pie chart — Par type d'entité */}
            <div style={s.card}>
              <h3 style={s.cardTitle}><FileText size={16} /> Par type d'entité</h3>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData} cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        dataKey="value" stroke="none"
                        isAnimationActive animationDuration={1200}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center',
                    marginTop: '0.5rem',
                  }}>
                    {pieData.map((d, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem',
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', background: d.fill,
                          display: 'inline-block', flexShrink: 0,
                        }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatEntier(d.value)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Top acteurs */}
          {topActeurs.length > 0 && (
            <div style={{ ...s.card, marginBottom: '1.5rem' }}>
              <h3 style={s.cardTitle}><Users size={16} /> Top acteurs</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, width: 40 }}>#</th>
                      <th style={s.th}>Email</th>
                      <th style={{ ...s.th, textAlign: 'right', width: 120 }}>Actions</th>
                      <th style={{ ...s.th, width: '40%' }}>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topActeurs.map((acteur, i) => (
                      <tr key={acteur.email || i}>
                        <td style={{ ...s.td, fontWeight: 700, color: 'var(--text-tertiary)' }}>{i + 1}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{acteur.email}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatEntier(acteur.nombre)}</td>
                        <td style={s.td}>
                          <div style={{
                            width: '100%', height: 8, borderRadius: 4,
                            background: 'var(--glass-border)', overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${(acteur.nombre / maxActeur) * 100}%`, height: '100%',
                              background: 'linear-gradient(90deg, #2563EB, #8B5CF6)',
                              borderRadius: 4, transition: 'width 0.8s ease',
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Timeline chart */}
          {evolution.length > 0 && (
            <div style={{ ...s.card, marginBottom: '1.5rem' }}>
              <h3 style={s.cardTitle}><Clock size={16} /> Timeline d'activité</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={evolution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => formatEntier(v)} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="nombre" name="Actions"
                    fill="#2563EB" radius={[4, 4, 0, 0]}
                    isAnimationActive animationDuration={1200}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Dernières actions */}
          {recentes.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>
                <Shield size={16} /> Journal d'activité
                <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-tertiary)', marginLeft: '0.4rem' }}>
                  ({formatEntier(filteredActions.length)}{filteredActions.length !== recentes.length ? ` / ${formatEntier(recentes.length)}` : ''})
                </span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Acteur</th>
                      <th style={s.th}>Action</th>
                      <th style={s.th}>Type Entité</th>
                      <th style={s.th}>Route</th>
                      <th style={s.th}>Méthode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedActions.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                          Aucune action ne correspond aux filtres
                        </td>
                      </tr>
                    ) : paginatedActions.map((entry, i) => {
                      const dateStr = entry.executeLe
                        ? new Date(entry.executeLe).toLocaleString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—';

                      return (
                        <tr key={entry.id || (startIdx + i)}>
                          <td style={s.td}>
                            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{dateStr}</span>
                          </td>
                          <td style={{ ...s.td, fontWeight: 600, maxWidth: 200 }}>
                            <div style={{ fontSize: '0.78rem' }}>{entry.acteurNom || '—'}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{entry.acteurEmail || ''}</div>
                          </td>
                          <td style={s.td}>
                            <span style={s.badge(entry.action)}>
                              {entry.action || '—'}
                            </span>
                          </td>
                          <td style={{ ...s.td, fontSize: '0.78rem' }}>
                            {entry.typeEntite || '—'}
                          </td>
                          <td style={s.td}>
                            <code style={{
                              fontSize: '0.7rem', background: 'var(--bg-base)',
                              padding: '0.1rem 0.35rem', borderRadius: '4px',
                              wordBreak: 'break-all',
                            }}>
                              {entry.cheminRoute || '—'}
                            </code>
                          </td>
                          <td style={s.td}>
                            {entry.methodeHttp ? (
                              <span style={s.methodBadge(entry.methodeHttp)}>
                                {entry.methodeHttp}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {filteredActions.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--glass-border)' }}>
                  <span>{startIdx + 1}–{endIdx} sur {formatEntier(filteredActions.length)} actions</span>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                      style={{ padding: '0.3rem 0.4rem', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                      <option value={30}>30 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                    <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}
                      style={{ ...paginBtnStyle, opacity: safePage <= 1 ? 0.4 : 1, cursor: safePage <= 1 ? 'default' : 'pointer' }}>
                      ← Précédent
                    </button>
                    <span style={{ padding: '0.3rem 0.5rem' }}>Page {safePage}/{totalPages}</span>
                    <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}
                      style={{ ...paginBtnStyle, opacity: safePage >= totalPages ? 0.4 : 1, cursor: safePage >= totalPages ? 'default' : 'pointer' }}>
                      Suivant →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
