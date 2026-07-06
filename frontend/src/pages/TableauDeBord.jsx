import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Treemap, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import CountUp from 'react-countup';
// motion remplacé par des div + CSS pour compatibilité React 19
import {
  TrendingUp, TrendingDown, Banknote, FileText, CheckCircle,
  Clock, AlertTriangle, Download, Maximize2, RefreshCw,
  Calendar, ChevronDown, Building2, Layers, MapPin,
} from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { fetchDashboard } from '../api/statistiquesApi';
import { usePeriodFilter, setPeriodState } from '../hooks/usePeriodFilter';
import { formatMontant, formatMontantCompact, formatPourcentage, formatNombre } from '../utils/format';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import './TableauDeBord.css';

// ─── Constantes ─────────────────────────────────────────────

const CHART_COLORS = [
  '#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444',
  '#ec4899', '#14b8a6', '#6366f1', '#d97706', '#10b981',
];

const DATE_PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Ce mois',     value: 'month' },
  { label: 'Tout',        value: 'all'   },
  { label: 'Personnalise', value: 'custom' },
];

const STATUT_CONFIG = {
  PAID:    { label: 'Paye',        cls: 'status-badge--paid',    icon: CheckCircle },
  PENDING: { label: 'En attente',  cls: 'status-badge--pending', icon: Clock       },
  FAILED:  { label: 'Echoue',      cls: 'status-badge--failed',  icon: AlertTriangle },
  PARTIAL: { label: 'Partiel',     cls: 'status-badge--partial', icon: Clock       },
};

const TAB_ITEMS = [
  { key: 'overview',   label: 'Vue d\'ensemble', icon: Layers },
  { key: 'ministeres', label: 'Ministeres',      icon: Building2 },
  { key: 'services',   label: 'Services',        icon: FileText },
  { key: 'domaines',   label: 'Domaines',        icon: MapPin },
];

const EMPTY_DASHBOARD = {
  kpi: {
    totalRevenus: 0,
    totalSoumissions: 0,
    soumissionsPayees: 0,
    soumissionsEnAttente: 0,
    soumissionsEchouees: 0,
    tauxPaiement: 0,
    progressionMoisPrecedent: undefined,
  },
  evolution: [],
  ministeres: [],
  services: [],
  domaines: [],
  regions: [],
};

const SPARKLINE_SEEDS = {
  gold:  [{ v: 320 }, { v: 450 }, { v: 380 }, { v: 510 }, { v: 490 }, { v: 620 }, { v: 580 }, { v: 710 }],
  blue:  [{ v: 10 },  { v: 18 },  { v: 14 },  { v: 22 },  { v: 20 },  { v: 28 },  { v: 25 },  { v: 32 }],
  green: [{ v: 60 },  { v: 65 },  { v: 70 },  { v: 68 },  { v: 72 },  { v: 75 },  { v: 74 },  { v: 78 }],
  red:   [{ v: 5 },   { v: 7 },   { v: 9 },   { v: 6 },   { v: 8 },   { v: 11 },  { v: 10 },  { v: 9 }],
};

const fmtCompact = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)} K`
  : String(n);

// ─── Sparkline ──────────────────────────────────────────────

function Sparkline({ data, color }) {
  const gradId = `spark-${color.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive
          animationDuration={1200}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────

function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard-tooltip">
      <p className="dashboard-tooltip__label">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="dashboard-tooltip__item">
          <span className="dashboard-tooltip__dot" style={{ background: p.color }} />
          <span>{p.name} : <strong>{formatMontant(p.value)}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ─── Treemap Cell ───────────────────────────────────────────

function TreemapCell({ x, y, width, height, name, value, color }) {
  if (width < 20 || height < 20) return null;
  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        fill={color || CHART_COLORS[0]}
        stroke="var(--bg-surface)"
        strokeWidth={2}
        rx={6}
        className="treemap-cell"
      />
      {width > 65 && height > 36 && (
        <>
          <text
            x={x + width / 2} y={y + height / 2 - 7}
            textAnchor="middle" fill="white"
            fontSize={Math.min(11, width / 8)}
            fontWeight={600} fontFamily="Inter, sans-serif"
          >
            {name?.length > 18 ? name.slice(0, 18) + '...' : name}
          </text>
          <text
            x={x + width / 2} y={y + height / 2 + 9}
            textAnchor="middle" fill="rgba(255,255,255,0.75)"
            fontSize={Math.min(9.5, width / 10)}
            fontFamily="Inter, sans-serif"
          >
            {fmtCompact(value)} FCFA
          </text>
        </>
      )}
    </g>
  );
}

// ─── KPI Card ───────────────────────────────────────────────

function KpiCard({ icon: Icon, label, endValue, suffix, prefix, decimals, variant, trend, sparkData, sparkColor, index }) {
  return (
    <div
      className={`kpi-card kpi-card--${variant} animate-fade-in`}
      style={{ animationDelay: `${(index || 0) * 100}ms` }}
    >
      <div className="kpi-card__top">
        <div className="kpi-card__icon">
          <Icon size={18} />
        </div>
        {trend !== undefined && trend !== null && (
          <div className={`kpi-card__trend ${trend >= 0 ? 'kpi-card__trend--up' : 'kpi-card__trend--down'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        <div className="kpi-card__value">
          {prefix}
          <CountUp
            end={endValue}
            duration={1.8}
            separator=" "
            decimals={decimals || 0}
            suffix={suffix || ''}
            preserveValue
          />
        </div>
      </div>
      <div className="kpi-card__sparkline">
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────

export default function TableauDeBord() {
  const { user } = useAuth();

  // Period filter
  const { state: periodState, range } = usePeriodFilter();
  const datePreset = periodState.preset;
  const customStartDate = periodState.customStart;
  const customEndDate = periodState.customEnd;
  const setDatePreset = (v) => setPeriodState({ preset: v });
  const setCustomStartDate = (v) => setPeriodState({ preset: 'custom', customStart: v });
  const setCustomEndDate = (v) => setPeriodState({ preset: 'custom', customEnd: v });

  // Dashboard data
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // ── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchDashboard(range, controller.signal);
        if (!mounted) return;
        setDashboard(data);
      } catch (err) {
        if (!mounted || err?.name === 'AbortError') return;
        setError(err?.message || 'Impossible de charger les donnees du tableau de bord.');
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [range.startDate, range.endDate, reloadNonce]);

  // ── Actions ────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadNonce((n) => n + 1);
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = document.getElementById('dashboard-content');
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleExpandChart = useCallback((e) => {
    const card = e.currentTarget.closest('.dashboard-chart-card');
    if (!card) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      card.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    try {
      const dataForPdf = {
        title: 'TRESORPAY STATISTIQUES — Tableau de Bord',
        kpi: dashboard.kpi,
        tableTitle: 'Repartition par Ministere',
        headers: ['N.', 'Ministere', 'Montant (FCFA)', 'Soumissions', 'Taux Paiement'],
        rows: dashboard.ministeres.map((m, i) => [
          String(i + 1),
          m.nom,
          formatNombre(m.montant),
          String(m.nombreSoumissions),
          `${m.tauxPaiement}%`,
        ]),
      };
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const filename = `TresorPay_Dashboard_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.pdf`;
      await exportToPDF(dataForPdf, filename);
    } catch (err) {
      console.error('Export PDF error:', err);
    }
  }, [dashboard]);

  const handleExportExcel = useCallback(() => {
    try {
      const headers = ['Ministere', 'Montant', 'Soumissions', 'Taux Paiement (%)'];
      const rows = dashboard.ministeres.map((m) => [
        m.nom,
        m.montant,
        m.nombreSoumissions,
        m.tauxPaiement,
      ]);
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const filename = `TresorPay_Dashboard_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.xlsx`;
      exportToExcel(rows, headers, 'Tableau de Bord', filename);
    } catch (err) {
      console.error('Export Excel error:', err);
    }
  }, [dashboard]);

  // ── Derived data ───────────────────────────────────────────

  const kpi = dashboard.kpi;
  const progression = kpi.progressionMoisPrecedent;
  const progressionPositive = progression != null && progression >= 0;

  const topServices = useMemo(() => {
    const sorted = [...dashboard.services].sort((a, b) => b.montant - a.montant);
    return sorted.slice(0, 8);
  }, [dashboard.services]);

  const treemapData = useMemo(() => {
    return dashboard.ministeres.map((m, i) => ({
      name: m.nom,
      size: m.montant,
      value: m.montant,
      color: m.couleur || CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [dashboard.ministeres]);

  const domainesBarData = useMemo(() => {
    return [...dashboard.domaines]
      .sort((a, b) => b.montant - a.montant)
      .map((d, i) => ({
        ...d,
        couleur: d.couleur || CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [dashboard.domaines]);

  const recentSoumissions = useMemo(() => {
    // Use services data or empty array as placeholder
    // In a full implementation this would come from dashboard.recentSoumissions
    return [];
  }, []);

  // ── Render helpers ─────────────────────────────────────────

  const renderStatusBadge = (statut) => {
    const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.PENDING;
    const Icon = cfg.icon;
    return (
      <span className={`status-badge ${cfg.cls}`}>
        <Icon size={11} />
        {cfg.label}
      </span>
    );
  };

  const regionStatusClass = (status) => {
    switch (status) {
      case 'vert':      return 'region-chip--vert';
      case 'critique':  return 'region-chip--critique';
      default:          return 'region-chip--attention';
    }
  };

  // ── Loading state ──────────────────────────────────────────

  if (loading && !dashboard.kpi.totalSoumissions) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loading__spinner" />
          <span>Chargement du tableau de bord...</span>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────

  return (
    <div className="dashboard-page animate-fade-in" id="dashboard-content">

      {/* ─── Header ──────────────────────────────────────── */}
      <div className="dashboard-header">
        <div className="dashboard-header__left">
          <h1 className="dashboard-header__title">Tableau de Bord</h1>
          <p className="dashboard-header__sub">Vue d'ensemble des recettes gouvernementales</p>
        </div>

        <div className="dashboard-header__right">
          <div className="date-presets">
            <Calendar size={14} className="date-presets__icon" />
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={`date-preset-btn ${datePreset === p.value ? 'date-preset-btn--active' : ''}`}
              >
                {p.label}
              </button>
            ))}
            {datePreset === 'custom' && (
              <div className="date-presets__custom animate-fade-in">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span className="date-presets__separator">a</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <button
            className="dashboard-action-btn dashboard-action-btn--outline"
            onClick={handleExportExcel}
            title="Exporter en Excel"
          >
            <Download size={14} /> Excel
          </button>
          <button
            className="dashboard-action-btn dashboard-action-btn--primary"
            onClick={handleExportPDF}
            title="Exporter en PDF"
          >
            <Download size={14} /> PDF
          </button>
          <button
            className="dashboard-action-btn dashboard-action-btn--outline"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Rafraichir les donnees"
          >
            <RefreshCw size={14} className={refreshing ? 'dashboard-spin' : ''} />
          </button>
          <button
            className="dashboard-action-btn dashboard-action-btn--outline"
            onClick={handleFullscreen}
            title="Plein ecran"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* ─── Error banner ────────────────────────────────── */}
      {error && (
        <div className="dashboard-error">
          <AlertTriangle size={14} />
          <span>{error}</span>
          <button onClick={handleRefresh}>Reessayer</button>
        </div>
      )}

      {/* ─── KPI Cards ───────────────────────────────────── */}
      <div className="dashboard-kpi-grid">
        <KpiCard
          icon={Banknote}
          label="Total Revenus"
          endValue={kpi.totalRevenus}
          suffix=" FCFA"
          variant="gold"
          sparkData={SPARKLINE_SEEDS.gold}
          sparkColor="#B8860B"
          index={0}
        />
        <KpiCard
          icon={FileText}
          label="Total Soumissions"
          endValue={kpi.totalSoumissions}
          variant="blue"
          sparkData={SPARKLINE_SEEDS.blue}
          sparkColor="#0ea5e9"
          index={1}
        />
        <KpiCard
          icon={CheckCircle}
          label="Taux de Paiement"
          endValue={kpi.tauxPaiement}
          suffix="%"
          decimals={1}
          variant="green"
          sparkData={SPARKLINE_SEEDS.green}
          sparkColor="#059669"
          index={2}
        />
        <KpiCard
          icon={progressionPositive ? TrendingUp : TrendingDown}
          label="Progression vs mois precedent"
          endValue={progression != null ? Math.abs(progression) : 0}
          suffix="%"
          prefix={progression != null && progression < 0 ? '-' : '+'}
          decimals={1}
          variant={progressionPositive ? 'trend-up' : 'trend-down'}
          trend={progression}
          sparkData={progressionPositive ? SPARKLINE_SEEDS.green : SPARKLINE_SEEDS.red}
          sparkColor={progressionPositive ? '#059669' : '#ef4444'}
          index={3}
        />
      </div>

      {/* ─── Tab Navigation ──────────────────────────────── */}
      <div className="dashboard-tabs">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            className={`dashboard-tab ${activeTab === tab.key ? 'dashboard-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div
          className="animate-fade-in"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {/* Row 1: Evolution + Treemap */}
          <div className="dashboard-charts-row dashboard-charts-row--60-40">
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">Evolution temporelle</h2>
                  <p className="dashboard-chart-card__subtitle">
                    Recettes par statut sur la periode
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 320 }}>
                {dashboard.evolution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.evolution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradPaye" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#059669" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradAttente" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradEchoue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
                      <Tooltip content={<DashboardTooltip />} />
                      <Legend />
                      <Area
                        type="monotone" dataKey="paye" name="Paye"
                        stroke="#059669" fill="url(#gradPaye)" strokeWidth={2}
                        stackId="1" isAnimationActive animationDuration={1400}
                      />
                      <Area
                        type="monotone" dataKey="enAttente" name="En attente"
                        stroke="#f59e0b" fill="url(#gradAttente)" strokeWidth={2}
                        stackId="1" isAnimationActive animationDuration={1600}
                      />
                      <Area
                        type="monotone" dataKey="echoue" name="Echoue"
                        stroke="#ef4444" fill="url(#gradEchoue)" strokeWidth={2}
                        stackId="1" isAnimationActive animationDuration={1800}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <Clock size={28} />
                    <p>Aucune donnee d'evolution disponible pour cette periode.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">
                    <Building2 size={16} /> Repartition par Ministere
                  </h2>
                  <p className="dashboard-chart-card__subtitle">
                    Surface proportionnelle au montant
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 320 }}>
                {treemapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={treemapData}
                      dataKey="size"
                      aspectRatio={4 / 3}
                      stroke="var(--bg-surface)"
                      content={<TreemapCell />}
                      animationDuration={1500}
                    >
                      <Tooltip
                        formatter={(value, _, entry) => [
                          formatMontant(value),
                          entry?.payload?.name || 'Ministere',
                        ]}
                      />
                    </Treemap>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <Building2 size={28} />
                    <p>Aucune donnee ministerielle disponible.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: PieChart Services + BarChart Domaines + Telemetrie */}
          <div className="dashboard-charts-row dashboard-charts-row--thirds">
            {/* Top Services */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">Top Services</h2>
                  <p className="dashboard-chart-card__subtitle">
                    {topServices.length} services par montant
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 280 }}>
                {topServices.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topServices}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        dataKey="montant"
                        nameKey="nom"
                        stroke="none"
                        isAnimationActive
                        animationDuration={1200}
                        animationBegin={300}
                      >
                        {topServices.map((entry, i) => (
                          <Cell
                            key={entry.id || i}
                            fill={entry.couleur || CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [formatMontant(value), '']}
                      />
                      <Legend
                        formatter={(value) => value.length > 22 ? value.slice(0, 22) + '...' : value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <FileText size={28} />
                    <p>Aucun service disponible.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Domaines */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">
                    <Layers size={16} /> Repartition Domaines
                  </h2>
                  <p className="dashboard-chart-card__subtitle">
                    Montant par domaine
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 280 }}>
                {domainesBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={domainesBarData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category" dataKey="nom"
                        width={130} tick={{ fontSize: 10 }}
                      />
                      <Tooltip content={<DashboardTooltip />} />
                      <Bar
                        dataKey="montant" name="Montant"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive animationDuration={1400}
                        animationBegin={200}
                      >
                        {domainesBarData.map((entry, i) => (
                          <Cell key={entry.id || i} fill={entry.couleur} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <Layers size={28} />
                    <p>Aucun domaine disponible.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Telemetrie Regionale */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">
                    <MapPin size={16} /> Telemetrie Regionale
                  </h2>
                  <p className="dashboard-chart-card__subtitle">
                    {dashboard.regions.length} regions
                  </p>
                </div>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 280, overflowY: 'auto' }}>
                {dashboard.regions.length > 0 ? (
                  <div className="region-chips">
                    {dashboard.regions.map((region) => (
                      <div
                        key={region.id}
                        className={`region-chip ${regionStatusClass(region.status)}`}
                      >
                        <span className="region-chip__dot" />
                        <span>{region.name}</span>
                        <span style={{ fontWeight: 700, marginLeft: '0.2rem' }}>
                          {formatMontantCompact(region.value)}
                        </span>
                        {region.target > 0 && (
                          <span style={{ opacity: 0.7, fontSize: '0.65rem', marginLeft: '0.1rem' }}>
                            / {formatMontantCompact(region.target)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty">
                    <MapPin size={28} />
                    <p>Aucune donnee regionale disponible.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Ministeres Tab ──────────────────────────────── */}
      {activeTab === 'ministeres' && (
        <div
          className="animate-fade-in"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div className="dashboard-charts-row dashboard-charts-row--60-40">
            {/* Treemap full */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">
                    <Building2 size={16} /> Contribution par Ministere
                  </h2>
                  <p className="dashboard-chart-card__subtitle">
                    Surface proportionnelle au montant total
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 380 }}>
                {treemapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={treemapData}
                      dataKey="size"
                      aspectRatio={4 / 3}
                      stroke="var(--bg-surface)"
                      content={<TreemapCell />}
                      animationDuration={1500}
                    >
                      <Tooltip
                        formatter={(value, _, entry) => [
                          formatMontant(value),
                          entry?.payload?.name || 'Ministere',
                        ]}
                      />
                    </Treemap>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <Building2 size={28} />
                    <p>Aucune donnee ministerielle.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal bar by ministere */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">Classement Ministeres</h2>
                  <p className="dashboard-chart-card__subtitle">
                    Par montant total des recettes
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 380 }}>
                {dashboard.ministeres.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboard.ministeres}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category" dataKey="nom"
                        width={160} tick={{ fontSize: 10 }}
                      />
                      <Tooltip content={<DashboardTooltip />} />
                      <Bar
                        dataKey="montant" name="Montant"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive animationDuration={1200}
                        animationBegin={200}
                      >
                        {dashboard.ministeres.map((entry, i) => (
                          <Cell
                            key={entry.id || i}
                            fill={entry.couleur || CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <Building2 size={28} />
                    <p>Aucune donnee ministerielle.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ministeres table */}
          <div className="dashboard-table-wrapper">
            <div className="dashboard-table-header">
              <h3 className="dashboard-table-title">Detail par Ministere</h3>
              <span className="dashboard-table-count">{dashboard.ministeres.length} ministeres</span>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>N.</th>
                  <th>Ministere</th>
                  <th>Montant</th>
                  <th>Soumissions</th>
                  <th style={{ textAlign: 'right' }}>Taux Paiement</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.ministeres.length > 0 ? (
                  dashboard.ministeres.map((m, i) => (
                    <tr key={m.id || i}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{m.nom}</td>
                      <td className="table-montant">{formatMontant(m.montant)}</td>
                      <td>{formatNombre(m.nombreSoumissions)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          color: m.tauxPaiement >= 70 ? '#059669' : m.tauxPaiement >= 40 ? '#d97706' : '#ef4444',
                          fontWeight: 700,
                        }}>
                          {formatPourcentage(m.tauxPaiement)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                      Aucun ministere disponible pour cette periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Services Tab ────────────────────────────────── */}
      {activeTab === 'services' && (
        <div
          className="animate-fade-in"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div className="dashboard-charts-row dashboard-charts-row--60-40">
            {/* Pie chart */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">Repartition par Service</h2>
                  <p className="dashboard-chart-card__subtitle">
                    Top {topServices.length} services par montant
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 380 }}>
                {topServices.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topServices}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={120}
                        dataKey="montant"
                        nameKey="nom"
                        stroke="none"
                        isAnimationActive
                        animationDuration={1200}
                        animationBegin={200}
                        label={({ name, percent }) =>
                          `${name?.length > 15 ? name.slice(0, 15) + '...' : name} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={{ stroke: 'var(--text-tertiary)', strokeWidth: 1 }}
                      >
                        {topServices.map((entry, i) => (
                          <Cell
                            key={entry.id || i}
                            fill={entry.couleur || CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatMontant(value), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <FileText size={28} />
                    <p>Aucun service disponible.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bar chart horizontal */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">Classement Services</h2>
                  <p className="dashboard-chart-card__subtitle">
                    Par volume de recettes
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 380 }}>
                {topServices.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topServices}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category" dataKey="nom"
                        width={140} tick={{ fontSize: 10 }}
                      />
                      <Tooltip content={<DashboardTooltip />} />
                      <Bar
                        dataKey="montant" name="Montant"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive animationDuration={1200}
                      >
                        {topServices.map((entry, i) => (
                          <Cell
                            key={entry.id || i}
                            fill={entry.couleur || CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <FileText size={28} />
                    <p>Aucun service disponible.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Services table */}
          <div className="dashboard-table-wrapper">
            <div className="dashboard-table-header">
              <h3 className="dashboard-table-title">Detail par Service</h3>
              <span className="dashboard-table-count">{dashboard.services.length} services</span>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>N.</th>
                  <th>Service</th>
                  <th>Ministere</th>
                  <th>Montant</th>
                  <th style={{ textAlign: 'right' }}>Soumissions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.services.length > 0 ? (
                  dashboard.services.map((s, i) => (
                    <tr key={s.id || i}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{s.nom}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{s.ministereName || '--'}</td>
                      <td className="table-montant">{formatMontant(s.montant)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNombre(s.nombreSoumissions)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                      Aucun service disponible pour cette periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Domaines Tab ────────────────────────────────── */}
      {activeTab === 'domaines' && (
        <div
          className="animate-fade-in"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div className="dashboard-charts-row dashboard-charts-row--60-40">
            {/* Full bar chart */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">
                    <Layers size={16} /> Recettes par Domaine
                  </h2>
                  <p className="dashboard-chart-card__subtitle">
                    Ventilation horizontale par montant
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 380 }}>
                {domainesBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={domainesBarData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category" dataKey="nom"
                        width={160} tick={{ fontSize: 10 }}
                      />
                      <Tooltip content={<DashboardTooltip />} />
                      <Bar
                        dataKey="montant" name="Montant"
                        radius={[0, 6, 6, 0]}
                        isAnimationActive animationDuration={1400}
                        animationBegin={200}
                      >
                        {domainesBarData.map((entry, i) => (
                          <Cell key={entry.id || i} fill={entry.couleur} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <Layers size={28} />
                    <p>Aucun domaine disponible.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pie chart domaines */}
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-card__header">
                <div>
                  <h2 className="dashboard-chart-card__title">Part relative</h2>
                  <p className="dashboard-chart-card__subtitle">
                    Contribution de chaque domaine
                  </p>
                </div>
                <button className="expand-btn" onClick={handleExpandChart} title="Agrandir">
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="dashboard-chart-card__body" style={{ height: 380 }}>
                {domainesBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={domainesBarData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        dataKey="montant"
                        nameKey="nom"
                        stroke="none"
                        isAnimationActive
                        animationDuration={1200}
                      >
                        {domainesBarData.map((entry, i) => (
                          <Cell key={entry.id || i} fill={entry.couleur} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatMontant(value), '']} />
                      <Legend
                        formatter={(value) => value.length > 20 ? value.slice(0, 20) + '...' : value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">
                    <Layers size={28} />
                    <p>Aucun domaine disponible.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Domaines table */}
          <div className="dashboard-table-wrapper">
            <div className="dashboard-table-header">
              <h3 className="dashboard-table-title">Detail par Domaine</h3>
              <span className="dashboard-table-count">{dashboard.domaines.length} domaines</span>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>N.</th>
                  <th>Domaine</th>
                  <th>Montant</th>
                  <th style={{ textAlign: 'right' }}>Soumissions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.domaines.length > 0 ? (
                  dashboard.domaines.map((d, i) => (
                    <tr key={d.id || i}>
                      <td>{i + 1}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                              background: d.couleur || CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>{d.nom}</span>
                        </span>
                      </td>
                      <td className="table-montant">{formatMontant(d.montant)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNombre(d.nombreSoumissions)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                      Aucun domaine disponible pour cette periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
