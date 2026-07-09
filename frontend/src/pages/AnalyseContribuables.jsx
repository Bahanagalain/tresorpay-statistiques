import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserCheck, UserX, Shield, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import ExportButtons from '../components/ui/ExportButtons';
import CountUp from '../components/ui/CountUp';
import { fetchCitoyens } from '../api/analyticsApi';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatEntier } from '../utils/format';
import './AnalyseContribuables.css';

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
        <p key={i} style={{ margin: '2px 0', color: p.color }}>
          {p.name}: <strong>{formatEntier(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, suffix, color, sub }) {
  return (
    <div className="card" style={{
      padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
      borderLeft: `3px solid ${color}`,
    }}>
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
        <CountUp end={value} duration={1.4} separator=" " />{suffix || ''}
      </div>
      {sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

// ─── Gauge miniature ───────────────────────────────────────
function MiniGauge({ value }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 75 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="card" style={{
      padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '0.6rem', borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '10px',
          background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingUp size={17} style={{ color }} />
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Taux de vérification</span>
      </div>
      <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={90} height={90} viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={45} cy={45} r={36} fill="none" stroke="var(--glass-border)" strokeWidth={8} />
          <circle cx={45} cy={45} r={36} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${2 * Math.PI * 36 * pct / 100} ${2 * Math.PI * 36}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.2s ease' }}
          />
        </svg>
        <span style={{
          position: 'absolute', fontSize: '1.1rem', fontWeight: 800, color,
        }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ───────────────────────────────────────
export default function AnalyseContribuables() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getCurrentPeriodRange);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await fetchCitoyens(dateRange, controller.signal);
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
  const verifies = data?.verifies ?? 0;
  const actifs = data?.actifs ?? 0;
  const tauxVerification = data?.tauxVerification ?? 0;
  const evolution = data?.evolution ?? [];

  const getExportData = useCallback(() => ({
    headers: ['Période', 'Inscriptions', 'Vérifiés'],
    rows: evolution.map(e => [e.periode, formatEntier(e.inscriptions), formatEntier(e.verifies)]),
    sheetName: 'Citoyens',
    subtitle: `${formatEntier(total)} citoyens inscrits`,
  }), [evolution, total]);

  // ── Empty state ─────────────────────────────────────────
  const isEmpty = !loading && (!data || total === 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><Users size={24} /> Activité Citoyens</h1>
          <p className="page-subtitle">Inscriptions, vérification et activité des comptes citoyens</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Activité Citoyens" filenameBase="Citoyens" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="exec-loading"><WeaveSpinner size={80} message="Chargement des données citoyens..." /></div></div>
      ) : isEmpty ? (
        <div className="card" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4rem 2rem', gap: '1rem', textAlign: 'center',
        }}>
          <Users size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
          <h3 style={{ color: 'var(--text-secondary)', fontWeight: 700, margin: 0 }}>Aucune donnée citoyen synchronisée</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', margin: 0 }}>Lancez une synchronisation.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem', marginBottom: '1.5rem',
          }}>
            <KpiCard icon={Users} label="Total inscrits" value={total} color="#2563EB" />
            <KpiCard
              icon={UserCheck} label="Vérifiés" value={verifies} color="#059669"
              sub={total > 0 ? `${((verifies / total) * 100).toFixed(1)}% du total` : ''}
            />
            <KpiCard icon={Shield} label="Actifs" value={actifs} color="#8B5CF6" />
            <MiniGauge value={tauxVerification} />
          </div>

          {/* Evolution Chart */}
          {evolution.length > 0 && (
            <div className="card" style={{ padding: '1.2rem' }}>
              <h3 style={{
                fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)',
                margin: '0 0 1rem 0',
              }}>
                Évolution des inscriptions et vérifications
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={evolution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradInscriptions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradVerifies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => formatEntier(v)} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone" dataKey="inscriptions" name="Inscriptions"
                    stroke="#2563EB" fill="url(#gradInscriptions)" strokeWidth={2}
                    isAnimationActive animationDuration={1400}
                  />
                  <Area
                    type="monotone" dataKey="verifies" name="Vérifiés"
                    stroke="#059669" fill="url(#gradVerifies)" strokeWidth={2}
                    isAnimationActive animationDuration={1600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
