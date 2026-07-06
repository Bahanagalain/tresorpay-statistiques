import { useState, useEffect, useCallback, useRef } from 'react';

import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, CheckCircle, Clock, XCircle, TrendingUp, RefreshCw, CreditCard } from 'lucide-react';
import { fetchMonitoring } from '../api/statistiquesApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { formatMontant, formatMontantCompact, formatPourcentage } from '../utils/format';

const STATUT_COLORS = {
  reussi: 'var(--accent-dgi)',
  echoue: '#ef4444',
  enAttente: '#F59E0B',
};

const METHODE_COLORS = ['#B8860B', '#059669', '#2563EB', '#8B5CF6', '#EC4899', '#14B8A6'];

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

function formatTime(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function getTransactionStatutStyle(statut) {
  const s = statut?.toLowerCase();
  if (s === 'success' || s === 'reussi' || s === 'paid') return { bg: 'rgba(5,150,105,0.12)', color: 'var(--accent-dgi)' };
  if (s === 'failed' || s === 'echoue') return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
  return { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' };
}

export default function MonitoringPaiements() {
  const { range } = usePeriodFilter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const result = await fetchMonitoring(range);
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    loadData();

    // Auto-refresh every 30s
    intervalRef.current = setInterval(loadData, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [loadData]);

  const resume = data?.resume || {};
  const totalReussi = (data?.evolutionJournaliere || []).reduce((s, d) => s + d.reussi, 0);
  const totalEchoue = (data?.evolutionJournaliere || []).reduce((s, d) => s + d.echoue, 0);
  const totalEnAttente = (data?.evolutionJournaliere || []).reduce((s, d) => s + d.enAttente, 0);

  const donutData = [
    { name: 'Reussi', value: totalReussi, color: STATUT_COLORS.reussi },
    { name: 'Echoue', value: totalEchoue, color: STATUT_COLORS.echoue },
    { name: 'En attente', value: totalEnAttente, color: STATUT_COLORS.enAttente },
  ].filter((d) => d.value > 0);

  if (loading && !data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400, color: 'var(--text-tertiary)' }}>
        Chargement du monitoring...
      </div>
    );
  }

  if (error && !data) {
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
          <h2 className="text-headline" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            Monitoring Paiements
            <span style={{
              width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-dgi)',
              display: 'inline-block', animation: 'pulseGlow 2s infinite',
            }} />
          </h2>
          <p className="text-body" style={{ margin: '4px 0 0' }}>Suivi en temps reel — Actualisation automatique toutes les 30s</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {lastRefresh.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button className="btn-secondary-outline" onClick={loadData} style={{ padding: '6px 14px', fontSize: 13 }}>
            <RefreshCw size={14} style={{ marginRight: 6 }} /> Actualiser
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Paiements reussis', value: totalReussi.toLocaleString('fr-FR'), icon: CheckCircle, color: 'var(--accent-dgi)' },
          { label: 'En attente', value: totalEnAttente.toLocaleString('fr-FR'), icon: Clock, color: '#F59E0B' },
          { label: 'Echoues', value: totalEchoue.toLocaleString('fr-FR'), icon: XCircle, color: '#ef4444' },
          { label: 'Taux de succes', value: formatPourcentage(resume.tauxReussite), icon: TrendingUp, color: resume.tauxReussite >= 80 ? 'var(--accent-dgi)' : resume.tauxReussite >= 50 ? '#F59E0B' : '#ef4444' },
        ].map((kpi, i) => (
          <div key={kpi.label} className="card-layer" custom={i} variants={fadeUp} initial="hidden" animate="visible" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${kpi.color}15`, display: 'grid', placeItems: 'center' }}>
              <kpi.icon size={22} style={{ color: kpi.color }} />
            </div>
            <div>
              <div className="text-label" style={{ marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Status Distribution Donut */}
        <div className="card-layer glass-panel" custom={4} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Repartition par statut</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine>
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Activity Chart */}
        <div className="card-layer glass-panel" custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Activite journaliere</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.evolutionJournaliere || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="reussi" name="Reussi" fill={STATUT_COLORS.reussi} stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="enAttente" name="En attente" fill={STATUT_COLORS.enAttente} stackId="a" />
              <Bar dataKey="echoue" name="Echoue" fill={STATUT_COLORS.echoue} stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment methods */}
      {data?.parMethode?.length > 0 && (
        <div className="card-layer glass-panel" custom={6} variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 24 }}>
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Methodes de paiement</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {data.parMethode.map((m, i) => (
              <div key={m.methode} className="card-layer" style={{ display: 'flex', alignItems: 'center', gap: 14, borderLeft: `4px solid ${METHODE_COLORS[i % METHODE_COLORS.length]}` }}>
                <CreditCard size={20} style={{ color: METHODE_COLORS[i % METHODE_COLORS.length], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{m.methode}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.transactions} transactions</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{formatMontantCompact(m.montant)}</div>
                  <div style={{ fontSize: 11, color: m.tauxReussite >= 80 ? 'var(--accent-dgi)' : '#F59E0B' }}>{formatPourcentage(m.tauxReussite)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions Feed */}
      <div className="card-layer glass-panel" custom={7} variants={fadeUp} initial="hidden" animate="visible">
        <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} /> Dernieres transactions
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                {['Reference', 'Montant', 'Methode', 'Statut', 'Date'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.dernieresTransactions || []).map((tx) => {
                const sty = getTransactionStatutStyle(tx.statut);
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-gold)', fontWeight: 600 }}>{tx.reference || tx.id}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatMontant(tx.montant)}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{tx.methode || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sty.bg, color: sty.color, textTransform: 'uppercase' }}>
                        {tx.statut}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatTime(tx.date)}</td>
                  </tr>
                );
              })}
              {(!data?.dernieresTransactions || data.dernieresTransactions.length === 0) && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Aucune transaction recente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
