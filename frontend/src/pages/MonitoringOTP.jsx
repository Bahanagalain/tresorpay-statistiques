import React, { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchMonitoring } from '../api/analyticsApi';
import { formatMontant } from '../utils/format';
import WeaveSpinner from '../components/ui/WeaveSpinner';

const STATUT = {
  PAID:    { label: 'Payé',       color: '#059669' },
  PENDING: { label: 'En attente', color: '#D97706' },
  PARTIAL: { label: 'Partiel',    color: '#2563EB' },
  FAILED:  { label: 'Échoué',     color: '#DC2626' },
};

const styles = {
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12, marginBottom: 24,
  },
  refreshBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 8,
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#334155',
    transition: 'background .15s',
  },
  kpiRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16, marginBottom: 24,
  },
  kpiCard: {
    background: '#fff', borderRadius: 12, padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 4,
  },
  kpiLabel: { fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 },
  kpiValue: { fontSize: 28, fontWeight: 700, color: '#0f172a' },
  kpiSub: { fontSize: 12, color: '#94a3b8' },
  chartsRow: {
    display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginBottom: 24,
  },
  chartCard: {
    background: '#fff', borderRadius: 12, padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  },
  chartTitle: { fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0',
    color: '#64748b', fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155' },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 12, fontWeight: 600, color: '#fff',
  },
  syncBar: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
    background: '#f8fafc', borderRadius: 10, fontSize: 12, color: '#64748b',
    marginTop: 24,
  },
  ministereBadge: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 6,
    fontSize: 11, fontWeight: 600, color: '#fff',
  },
};

function formatHeure(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function MonitoringOTP() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await fetchMonitoring();
      setData(result);
    } catch (err) {
      console.error('Monitoring fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="exec-loading"><WeaveSpinner message="Chargement du monitoring..." /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
          Impossible de charger les données de monitoring.
        </p>
      </div>
    );
  }

  const rep = data.repartitionStatuts || {};
  const totalCount = Object.values(rep).reduce((s, v) => s + (v?.nombre || 0), 0);
  const totalMontant = Object.values(rep).reduce((s, v) => s + (v?.montant || 0), 0);

  const pieData = Object.entries(STATUT)
    .filter(([key]) => rep[key]?.nombre)
    .map(([key, cfg]) => ({
      name: cfg.label,
      value: rep[key].nombre,
      color: cfg.color,
    }));

  const timeline = data.timeline || [];
  const recentes = (data.recentes || []).slice(0, 20);
  const sync = data.derniereSync;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 className="page-title"><Activity size={24} /> Monitoring Paiements</h1>
          <p className="page-subtitle">
            Suivi en temps réel des flux de paiement — dernières 24h
          </p>
        </div>
        <button
          style={{ ...styles.refreshBtn, opacity: refreshing ? 0.6 : 1 }}
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {/* KPI Row */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}><Zap size={14} /> Total transactions</span>
          <span style={styles.kpiValue}>{totalCount}</span>
          <span style={styles.kpiSub}>{formatMontant(totalMontant)}</span>
        </div>
        <div style={{ ...styles.kpiCard, borderLeft: `4px solid ${STATUT.PAID.color}` }}>
          <span style={styles.kpiLabel}><CheckCircle size={14} color={STATUT.PAID.color} /> Payées</span>
          <span style={styles.kpiValue}>{rep.PAID?.nombre || 0}</span>
          <span style={styles.kpiSub}>{formatMontant(rep.PAID?.montant || 0)}</span>
        </div>
        <div style={{ ...styles.kpiCard, borderLeft: `4px solid ${STATUT.PENDING.color}` }}>
          <span style={styles.kpiLabel}><Clock size={14} color={STATUT.PENDING.color} /> En attente</span>
          <span style={styles.kpiValue}>{rep.PENDING?.nombre || 0}</span>
          <span style={styles.kpiSub}>{formatMontant(rep.PENDING?.montant || 0)}</span>
        </div>
        <div style={{ ...styles.kpiCard, borderLeft: `4px solid ${STATUT.FAILED.color}` }}>
          <span style={styles.kpiLabel}><XCircle size={14} color={STATUT.FAILED.color} /> Échouées</span>
          <span style={styles.kpiValue}>{rep.FAILED?.nombre || 0}</span>
          <span style={styles.kpiSub}>{formatMontant(rep.FAILED?.montant || 0)}</span>
        </div>
      </div>

      {/* Charts Row */}
      <div style={styles.chartsRow}>
        {/* Donut chart */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Répartition des statuts</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  dataKey="value"
                  paddingAngle={3}
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} transactions`, name]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
              Aucune donnée
            </p>
          )}
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 }}>
            {pieData.map((entry) => (
              <span key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
                {entry.name}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline bar chart */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Timeline horaire (24h)</div>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="heure" tick={{ fontSize: 11 }} tickFormatter={formatHeure} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={formatHeure}
                  formatter={(value, name) => {
                    const labels = { nombre: 'Transactions', montant: 'Montant', echoues: 'Échouées' };
                    if (name === 'montant') return [formatMontant(value), labels[name]];
                    return [value, labels[name] || name];
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="nombre" fill="#059669" radius={[4, 4, 0, 0]} name="nombre" />
                <Bar dataKey="echoues" fill="#DC2626" radius={[4, 4, 0, 0]} name="echoues" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
              Aucune donnée de timeline
            </p>
          )}
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div style={styles.chartCard}>
        <div style={styles.chartTitle}>Transactions récentes</div>
        {recentes.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Heure</th>
                  <th style={styles.th}>Service</th>
                  <th style={styles.th}>Ministère</th>
                  <th style={styles.th}>Soumetteur</th>
                  <th style={styles.th}>Montant</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((tx) => {
                  const st = STATUT[tx.statutPaiement] || { label: tx.statutPaiement, color: '#94a3b8' };
                  return (
                    <tr key={tx.id || tx.uniqueCode}>
                      <td style={styles.td}>{formatDateTime(tx.dateSoumission)}</td>
                      <td style={styles.td}>{tx.serviceNom || '—'}</td>
                      <td style={styles.td}>
                        {tx.ministereNom ? (
                          <span style={{ ...styles.ministereBadge, background: tx.ministereCouleur || '#64748b' }}>
                            {tx.ministereNom}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={styles.td}>{tx.soumetteurNom || '—'}</td>
                      <td style={{ ...styles.td, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatMontant(tx.montant)}
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, background: st.color }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
            Aucune transaction récente
          </p>
        )}
      </div>

      {/* Sync Footer */}
      {sync && (
        <div style={styles.syncBar}>
          <AlertTriangle size={14} />
          <span>
            Dernière synchronisation : <strong>{sync.endpoint}</strong>
            {' — '}
            {sync.statut === 'OK' ? (
              <span style={{ color: '#059669' }}>OK</span>
            ) : (
              <span style={{ color: '#DC2626' }}>{sync.statut}</span>
            )}
            {sync.executeLe && ` — ${formatDateTime(sync.executeLe)}`}
            {sync.dureeMs != null && ` — ${sync.dureeMs}ms`}
          </span>
        </div>
      )}
    </div>
  );
}
