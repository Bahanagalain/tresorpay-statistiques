import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, FileText, CheckCircle, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { KPI_GLOBAL, EVOLUTION_MENSUELLE } from '../data/dgiData';
import './Dashboard.css';

// ── Données par période ─────────────────────────────────────
const PERIODES = {
  '7j': {
    label: '7 derniers jours',
    data: [
      { t: 'Lun', paye: 980000,  enAttente: 210000, enRetard: 45000 },
      { t: 'Mar', paye: 1240000, enAttente: 180000, enRetard: 60000 },
      { t: 'Mer', paye: 870000,  enAttente: 320000, enRetard: 30000 },
      { t: 'Jeu', paye: 1560000, enAttente: 140000, enRetard: 80000 },
      { t: 'Ven', paye: 2100000, enAttente: 290000, enRetard: 55000 },
      { t: 'Sam', paye: 640000,  enAttente: 95000,  enRetard: 20000 },
      { t: 'Dim', paye: 380000,  enAttente: 60000,  enRetard: 10000 },
    ],
    kpi: { recouvre: 7770000, avis: 312, tauxRecouvrement: 86.1 },
  },
  '30j': {
    label: '30 derniers jours',
    data: EVOLUTION_MENSUELLE.map(m => ({ t: m.mois, ...m })),
    kpi: KPI_GLOBAL,
  },
  '3m': {
    label: '3 derniers mois',
    data: [
      { t: 'Jan 2026', paye: 4820000, enAttente: 1240000, enRetard: 380000 },
      { t: 'Fév 2026', paye: 5630000, enAttente: 980000,  enRetard: 290000 },
      { t: 'Mar 2026', paye: 6120000, enAttente: 1580000, enRetard: 620000 },
    ],
    kpi: { recouvre: 16570000, avis: 2104, tauxRecouvrement: 82.7 },
  },
  '1an': {
    label: 'Année 2026',
    data: [
      { t: 'Jan', paye: 4820000, enAttente: 1240000, enRetard: 380000 },
      { t: 'Fév', paye: 5630000, enAttente: 980000,  enRetard: 290000 },
      { t: 'Mar', paye: 6120000, enAttente: 1580000, enRetard: 620000 },
      { t: 'Avr', paye: null,    enAttente: null,    enRetard: null   },
    ],
    kpi: { recouvre: 16570000, avis: 2104, tauxRecouvrement: 82.7 },
  },
};

const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)} K`
  : String(n ?? 0);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <p className="dash-tooltip__label">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{fmt(p.value)} FCFA</strong>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [periode, setPeriode] = useState('30j');
  const { data, kpi } = PERIODES[periode];

  const KPIS = [
    {
      icon: TrendingUp,
      label: 'Total Recouvré',
      value: `${fmt(kpi.recouvre)} FCFA`,
      color: '#059669',
      bg: 'rgba(5,150,105,0.08)',
    },
    {
      icon: FileText,
      label: 'Avis émis',
      value: (kpi.avis || KPI_GLOBAL.totalAvis).toLocaleString('fr-FR'),
      color: '#6366F1',
      bg: 'rgba(99,102,241,0.08)',
    },
    {
      icon: CheckCircle,
      label: 'Avis Payés',
      value: (KPI_GLOBAL.avisPayes).toLocaleString('fr-FR'),
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
    },
    {
      icon: Clock,
      label: 'En Attente',
      value: (KPI_GLOBAL.avisEnAttente).toLocaleString('fr-FR'),
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)',
    },
    {
      icon: AlertTriangle,
      label: 'En Retard',
      value: (KPI_GLOBAL.avisEnRetard).toLocaleString('fr-FR'),
      color: '#EF4444',
      bg: 'rgba(239,68,68,0.08)',
    },
    {
      icon: TrendingUp,
      label: 'Taux Recouvrement',
      value: `${kpi.tauxRecouvrement}%`,
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.08)',
    },
  ];

  return (
    <div className="dashboard-v2 animate-fade-in">

      {/* ── En-tête ─────────────────────────────────────── */}
      <div className="dash-header-v2">
        <div>
          <h1 className="dash-title">Tableau de Bord Global</h1>
          <p className="dash-sub">Vue consolidée — Direction Générale des Impôts (DGI)</p>
        </div>

        {/* Filtres par période */}
        <div className="periode-bar">
          <Calendar size={14} className="periode-icon" />
          {Object.entries(PERIODES).map(([key, { label }]) => (
            <button
              key={key}
              className={`periode-btn ${periode === key ? 'active' : ''}`}
              onClick={() => setPeriode(key)}
            >
              {key === '7j' ? '7J' : key === '30j' ? '30J' : key === '3m' ? '3M' : '1AN'}
            </button>
          ))}
          <span className="periode-label">{PERIODES[periode].label}</span>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────── */}
      <div className="dash-kpis">
        {KPIS.map((k, i) => (
          <div key={i} className="dash-kpi" style={{ '--kpi-color': k.color, '--kpi-bg': k.bg }}>
            <div className="dash-kpi__icon">
              <k.icon size={18} />
            </div>
            <div>
              <p className="dash-kpi__label">{k.label}</p>
              <p className="dash-kpi__value">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Graphique principal ──────────────────────────── */}
      <div className="dash-chart-card">
        <div className="dash-chart-card__header">
          <div>
            <h2 className="dash-chart-title">Dynamique du Recouvrement</h2>
            <p className="dash-chart-sub">{PERIODES[periode].label} — Montants en FCFA</p>
          </div>
          <div className="dash-chart-legend">
            <span className="legend-dot" style={{background:'#059669'}}/>Payé
            <span className="legend-dot" style={{background:'#F59E0B', marginLeft:'1rem'}}/>En attente
            <span className="legend-dot" style={{background:'#EF4444', marginLeft:'1rem'}}/>En retard
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#059669" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="t" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="paye"      name="Payé"       stroke="#059669" fill="url(#gp)" strokeWidth={2} connectNulls />
            <Area type="monotone" dataKey="enAttente" name="En attente" stroke="#F59E0B" fill="url(#ga)" strokeWidth={2} connectNulls />
            <Area type="monotone" dataKey="enRetard"  name="En retard"  stroke="#EF4444" fill="url(#gr)" strokeWidth={2} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Taux de recouvrement ─────────────────────────── */}
      <div className="dash-taux-card">
        <div className="dash-taux-header">
          <h3 className="dash-chart-title">Taux de Recouvrement</h3>
          <span className="dash-taux-val">{kpi.tauxRecouvrement}%</span>
        </div>
        <div className="dash-taux-track">
          <div
            className="dash-taux-fill"
            style={{ width: `${kpi.tauxRecouvrement}%` }}
          />
          <div className="dash-taux-target" style={{ left: '90%' }}>
            <span className="target-label">Objectif 90%</span>
          </div>
        </div>
        <div className="dash-taux-footer">
          <span>
            {kpi.tauxRecouvrement < 90
              ? `⚠️ À ${(90 - kpi.tauxRecouvrement).toFixed(1)}% de l'objectif`
              : '✅ Objectif atteint'}
          </span>
          <span className="text-muted">Source : DGI — TresorPay</span>
        </div>
      </div>

    </div>
  );
}
