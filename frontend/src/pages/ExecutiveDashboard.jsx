import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import CountUp from '../components/ui/CountUp';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle, Clock, AlertTriangle,
  DollarSign, Activity, ArrowUpRight, ArrowDownRight, Target, Building2,
} from 'lucide-react';
import { fetchDgiKpi, fetchDgiEvolution, fetchDgiCdi } from '../api/dgiAnalyticsApi';
import { useTranslation } from '../i18n/LanguageProvider';
import ExportButtons from '../components/ui/ExportButtons';
import './ExecutiveDashboard.css';

const fmt = (n) => n >= 1e9 ? `${(n/1e9).toFixed(2)} Mrd` : n >= 1e6 ? `${(n/1e6).toFixed(1)} M` : n >= 1e3 ? `${(n/1e3).toFixed(0)} K` : String(n ?? 0);
const fmtFull = (n) => (n ?? 0).toLocaleString('fr-FR') + ' FCFA';

const STATUT_COLORS = { paye: '#059669', enAttente: '#D97706', enRetard: '#DC2626' };

export default function ExecutiveDashboard() {
  const { t } = useTranslation();
  const [kpi, setKpi] = useState(null);
  const [evolution, setEvolution] = useState([]);
  const [topCdi, setTopCdi] = useState([]);
  const [bottomCdi, setBottomCdi] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [kpiData, evolData, cdiData] = await Promise.all([
        fetchDgiKpi(),
        fetchDgiEvolution(),
        fetchDgiCdi(),
      ]);
      setKpi(kpiData);
      setEvolution(evolData);

      const sorted = [...cdiData].sort((a, b) => b.montant - a.montant);
      setTopCdi(sorted.slice(0, 5));
      setBottomCdi(sorted.slice(-5).reverse());
    } catch (err) {
      console.error('Executive dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getExportData = useCallback(() => ({
    headers: ['Centre CDI', 'Montant Total', 'Position'],
    rows: [
      ...topCdi.map((c, i) => [c.centre, fmtFull(c.montant), `Top ${i + 1}`]),
      ...bottomCdi.map((c, i) => [c.centre, fmtFull(c.montant), `Bottom ${i + 1}`]),
    ],
    sheetName: 'Dashboard Exécutif',
    subtitle: `Top/Bottom CDIs — ${kpi ? fmtFull(kpi.totalRecouvre) + ' recouvrés' : ''}`,
  }), [topCdi, bottomCdi, kpi]);

  if (loading || !kpi) {
    return (
      <div className="exec-dashboard">
        <div className="exec-loading">
          <Activity size={32} className="spin" />
          <p>{t('executive.loadingDashboard')}</p>
        </div>
      </div>
    );
  }

  const kpiCards = [
    { label: t('executive.totalRecovered'), value: kpi.totalRecouvre, format: fmtFull, icon: DollarSign, color: '#059669', trend: kpi.progressionMoisPrecedent },
    { label: t('executive.totalNotices'), value: kpi.totalAvis, icon: FileText, color: '#6366F1' },
    { label: t('executive.paidNotices'), value: kpi.avisPayes, icon: CheckCircle, color: '#059669' },
    { label: t('executive.pendingNotices'), value: kpi.avisEnAttente, icon: Clock, color: '#D97706' },
    { label: t('executive.overdueNotices'), value: kpi.avisEnRetard, icon: AlertTriangle, color: '#DC2626' },
    { label: t('executive.recoveryRate'), value: kpi.tauxRecouvrement, suffix: '%', icon: Target, color: kpi.tauxRecouvrement >= 50 ? '#059669' : '#DC2626' },
  ];

  const pieData = [
    { name: t('status.paid'), value: kpi.avisPayes, color: '#059669' },
    { name: t('status.pending'), value: kpi.avisEnAttente, color: '#D97706' },
    { name: t('status.overdue'), value: kpi.avisEnRetard, color: '#DC2626' },
  ];

  return (
    <div className="exec-dashboard">
      <div className="exec-header">
        <div>
          <h1 className="exec-title">{t('executive.title')}</h1>
          <p className="exec-subtitle">{t('executive.subtitle')}</p>
        </div>
        <ExportButtons getData={getExportData} title="Dashboard Exécutif" filenameBase="Dashboard_Executif" />
      </div>

      {/* KPI Cards */}
      <div className="exec-kpi-grid">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="exec-kpi-card" data-glow="green" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="exec-kpi-header">
                <div className="exec-kpi-icon" style={{ color: card.color, backgroundColor: `${card.color}12` }}>
                  <Icon size={20} />
                </div>
                {card.trend != null && (
                  <span className={`exec-kpi-trend ${card.trend >= 0 ? 'positive' : 'negative'}`}>
                    {card.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(card.trend).toFixed(1)}%
                  </span>
                )}
              </div>
              <span className="exec-kpi-label">{card.label}</span>
              <span className="exec-kpi-value" style={{ color: card.color }}>
                {card.format ? card.format(card.value) : (
                  <><CountUp end={card.value} duration={1.5} separator=" " />{card.suffix || ''}</>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="exec-charts-row">
        {/* Evolution Chart */}
        <div data-glow="blue" className="exec-chart-card exec-chart-large">
          <h3 className="exec-chart-title">{t('executive.evolution')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={evolution}>
              <defs>
                <linearGradient id="gradPaye" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAttente" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D97706" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#D97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="mois" stroke="var(--chart-axis)" fontSize={11} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} tickFormatter={fmt} />
              <Tooltip formatter={(v) => fmtFull(v)} />
              <Area type="monotone" dataKey="paye" stroke="#059669" fill="url(#gradPaye)" name={t('status.paid')} />
              <Area type="monotone" dataKey="enAttente" stroke="#D97706" fill="url(#gradAttente)" name={t('status.pending')} />
              <Area type="monotone" dataKey="enRetard" stroke="#DC2626" fill="#DC262615" name={t('status.overdue')} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Statut Pie */}
        <div data-glow="blue" className="exec-chart-card exec-chart-small">
          <h3 className="exec-chart-title">{t('executive.statusDist')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => v.toLocaleString('fr-FR')} />
            </PieChart>
          </ResponsiveContainer>
          <div className="exec-pie-legend">
            {pieData.map((d, i) => (
              <div key={i} className="exec-pie-legend-item">
                <span className="legend-dot" style={{ background: d.color }} />
                <span>{d.name}</span>
                <strong>{d.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top/Bottom CDIs */}
      <div className="exec-charts-row">
        <div data-glow="blue" className="exec-chart-card">
          <h3 className="exec-chart-title">
            <TrendingUp size={16} className="text-success" /> {t('executive.topCdi')}
          </h3>
          <div className="exec-ranking">
            {topCdi.map((cdi, i) => (
              <div key={i} className="exec-rank-item">
                <span className="exec-rank-num">{i + 1}</span>
                <span className="exec-rank-name">{cdi.centre}</span>
                <div className="exec-rank-bar-container">
                  <div className="exec-rank-bar" style={{ width: `${(cdi.montant / (topCdi[0]?.montant || 1)) * 100}%`, background: '#059669' }} />
                </div>
                <span className="exec-rank-value">{fmt(cdi.montant)}</span>
              </div>
            ))}
          </div>
        </div>
        <div data-glow="blue" className="exec-chart-card">
          <h3 className="exec-chart-title">
            <TrendingDown size={16} className="text-danger" /> {t('executive.bottomCdi')}
          </h3>
          <div className="exec-ranking">
            {bottomCdi.map((cdi, i) => (
              <div key={i} className="exec-rank-item">
                <span className="exec-rank-num alert">{bottomCdi.length - i}</span>
                <span className="exec-rank-name">{cdi.centre}</span>
                <div className="exec-rank-bar-container">
                  <div className="exec-rank-bar" style={{ width: `${Math.max(10, (cdi.montant / (topCdi[0]?.montant || 1)) * 100)}%`, background: '#DC2626' }} />
                </div>
                <span className="exec-rank-value">{fmt(cdi.montant)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
