import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Activity, FileText, Clock, Search, X, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import ExportButtons from '../components/ui/ExportButtons';
import CountUp from '../components/ui/CountUp';
import { fetchAudit } from '../api/analyticsApi';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatEntier } from '../utils/format';
import './AuditActivite.css';

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

// ─── Tooltip personnalisé ──────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="audit-tooltip">
      <p className="audit-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: '2px 0', color: p.color || p.fill, fontSize: '0.8rem' }}>
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
    <div className="audit-tooltip">
      <p style={{ margin: 0, color: d.payload?.fill || 'var(--text-primary)', fontSize: '0.82rem' }}>
        {d.name}: <strong>{formatEntier(d.value)}</strong>
      </p>
    </div>
  );
};

// ─── PAGE PRINCIPALE ───────────────────────────────────────
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
          <div className="audit-kpi-row">
            <div className="audit-kpi-card">
              <div className="audit-kpi-icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>
                <Activity size={20} />
              </div>
              <div className="audit-kpi-body">
                <span className="audit-kpi-label">Total actions</span>
                <span className="audit-kpi-value"><CountUp end={total} duration={1.4} separator=" " /></span>
              </div>
            </div>
            <div className="audit-kpi-card">
              <div className="audit-kpi-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
                <Users size={20} />
              </div>
              <div className="audit-kpi-body">
                <span className="audit-kpi-label">Acteurs uniques</span>
                <span className="audit-kpi-value"><CountUp end={topActeurs.length} duration={1.4} separator=" " /></span>
              </div>
            </div>
            <div className="audit-kpi-card">
              <div className="audit-kpi-icon" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
                <FileText size={20} />
              </div>
              <div className="audit-kpi-body">
                <span className="audit-kpi-label">Types d'entité</span>
                <span className="audit-kpi-value"><CountUp end={parEntite.length} duration={1.4} separator=" " /></span>
              </div>
            </div>
          </div>

          {/* Charts row: 3-column layout */}
          <div className="audit-charts-row">
            {/* Bar chart — Actions par type */}
            <div className="audit-chart-card audit-chart-bar">
              <h3 className="audit-card-title"><BarChart3 size={16} /> Actions par type</h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                    <XAxis dataKey="action" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => formatEntier(v)} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="nombre" name="Actions" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1200}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="audit-empty">Aucune donnée</p>
              )}
            </div>

            {/* Pie chart — Par type d'entité */}
            <div className="audit-chart-card audit-chart-pie">
              <h3 className="audit-card-title"><FileText size={16} /> Par type d'entité</h3>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData} cx="50%" cy="50%"
                        innerRadius={50} outerRadius={80}
                        dataKey="value" stroke="var(--bg-surface)" strokeWidth={2}
                        isAnimationActive animationDuration={1200}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="audit-pie-legend">
                    {pieData.map((d, i) => (
                      <div key={i} className="audit-pie-legend-item">
                        <span className="audit-legend-dot" style={{ background: d.fill }} />
                        <span className="audit-legend-name">{d.name}</span>
                        <strong className="audit-legend-val">{formatEntier(d.value)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="audit-empty">Aucune donnée</p>
              )}
            </div>

            {/* Top acteurs — integrated */}
            <div className="audit-chart-card audit-chart-actors">
              <h3 className="audit-card-title"><Users size={16} /> Top acteurs</h3>
              {topActeurs.length > 0 ? (
                <div className="audit-actors-list">
                  {topActeurs.slice(0, 8).map((acteur, i) => (
                    <div key={acteur.email || i} className="audit-actor-row">
                      <span className="audit-actor-rank">{i + 1}</span>
                      <div className="audit-actor-info">
                        <span className="audit-actor-email">{acteur.email}</span>
                        <div className="audit-actor-bar-wrap">
                          <div
                            className="audit-actor-bar"
                            style={{ width: `${(acteur.nombre / maxActeur) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="audit-actor-count">{formatEntier(acteur.nombre)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="audit-empty">Aucun acteur</p>
              )}
            </div>
          </div>

          {/* Timeline chart */}
          {evolution.length > 0 && (
            <div className="audit-chart-card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="audit-card-title"><Clock size={16} /> Timeline d'activité</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatEntier(v)} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="nombre" name="Actions" fill="#2563EB" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Filter bar */}
          {recentes.length > 0 && (
            <div className="audit-chart-card" style={{ padding: 0 }}>
              {/* Toolbar */}
              <div className="audit-journal-header">
                <h3 className="audit-card-title" style={{ margin: 0 }}>
                  <Shield size={16} /> Journal d'activité
                  <span className="audit-journal-count">
                    {formatEntier(filteredActions.length)}{filteredActions.length !== recentes.length ? ` / ${formatEntier(recentes.length)}` : ''}
                  </span>
                </h3>
                <div className="audit-journal-filters">
                  <div className="audit-search-wrap">
                    <Search size={13} className="audit-search-icon" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchText}
                      onChange={e => { setSearchText(e.target.value); setPage(1); }}
                      className="audit-search-input"
                    />
                  </div>
                  <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} className="audit-filter-select">
                    <option value="">Toutes les actions</option>
                    {['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE', 'PUBLISH', 'REJECT'].map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <select value={filterEntite} onChange={e => { setFilterEntite(e.target.value); setPage(1); }} className="audit-filter-select">
                    <option value="">Tous les types</option>
                    {['AdminUser', 'Service', 'FormDefinition', 'form', 'service', 'domain', 'revenue-group', 'user'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {(searchText || filterAction || filterEntite) && (
                    <button onClick={() => { setSearchText(''); setFilterAction(''); setFilterEntite(''); setPage(1); }} className="audit-clear-btn">
                      <X size={12} /> Effacer
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Acteur</th>
                      <th>Action</th>
                      <th>Type Entité</th>
                      <th>Route</th>
                      <th>Méthode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedActions.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
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
                          <td>
                            <span className="audit-date-cell">{dateStr}</span>
                          </td>
                          <td>
                            <div className="audit-actor-cell-name">{entry.acteurNom || '—'}</div>
                            <div className="audit-actor-cell-email">{entry.acteurEmail || ''}</div>
                          </td>
                          <td>
                            <span className="audit-action-badge" style={{
                              background: `${getActionColor(entry.action)}12`,
                              color: getActionColor(entry.action),
                            }}>
                              {entry.action || '—'}
                            </span>
                          </td>
                          <td className="audit-entity-cell">{entry.typeEntite || '—'}</td>
                          <td>
                            <code className="audit-route-code">{entry.cheminRoute || '—'}</code>
                          </td>
                          <td>
                            {entry.methodeHttp ? (
                              <span className="audit-method-badge" data-method={entry.methodeHttp}>
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
                <div className="audit-pagination">
                  <span>{startIdx + 1}–{endIdx} sur {formatEntier(filteredActions.length)} actions</span>
                  <div className="audit-pagination-controls">
                    <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="audit-filter-select">
                      <option value={30}>30 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                    <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} className="audit-page-btn">
                      ← Précédent
                    </button>
                    <span className="audit-page-indicator">Page {safePage}/{totalPages}</span>
                    <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} className="audit-page-btn">
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
