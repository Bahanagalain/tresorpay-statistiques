import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle, Clock,
  AlertTriangle, Building2, Calendar, X,
  RotateCcw, FileSpreadsheet, FileDown, Maximize, RefreshCw,
  AlertCircle, MapPin, XCircle,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { usePresentMode } from '../components/layout/MainLayout';
import GaugeChart from '../components/ui/GaugeChart';
import DrillDownModal from '../components/ui/DrillDownModal';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import {
  fetchDashboard,
  fetchMinistereDetail,
  lancerSynchronisation,
} from '../api/analyticsApi';
import { invalidateCache } from '../api/cache';
import { getDateRangeFromPreset } from '../utils/dateUtils';
import { usePeriodFilter, setPeriodState } from '../hooks/usePeriodFilter';
import { formatEntier, formatMontant } from '../utils/format';
import './TableauDeBord.css';

// ─── Utilitaires ────────────────────────────────────────────
const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)} K`
  : n.toString();
const fmtFull = (n) => formatMontant(n);
const fmtEntier = (n) => formatEntier(n);

const STATUT_CONFIG = {
  PAID:    { label: 'Payé',       color: '#059669', cls: 'orb-paid'    },
  PENDING: { label: 'En attente', color: '#D97706', cls: 'orb-pending' },
  PARTIAL: { label: 'Partiel',    color: '#2563EB', cls: 'orb-partial' },
  FAILED:  { label: 'Échoué',     color: '#DC2626', cls: 'orb-failed'  },
};

const DATE_PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Ce mois',     value: 'month' },
  { label: 'Tout',        value: 'all'   },
  { label: 'Période...',  value: 'custom' },
];

const EMPTY_KPI = {
  totalRevenus: 0,
  totalSoumissions: 0,
  soumissionsPayees: 0,
  soumissionsEnAttente: 0,
  soumissionsPartielles: 0,
  soumissionsEchouees: 0,
  tauxPaiement: 0,
  progressionMoisPrecedent: undefined,
};

// ─── CountUp Hook ────────────────────────────────────────────
function useCountUp(target, duration = 1500) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

// ─── Sparkline ───────────────────────────────────────────────
const SPARKLINE_SEEDS = {
  primary: [{ v:320 },{ v:450 },{ v:380 },{ v:510 },{ v:490 },{ v:620 },{ v:580 },{ v:710 }],
  success: [{ v:10 },{ v:18 },{ v:14 },{ v:22 },{ v:20 },{ v:28 },{ v:25 },{ v:32 }],
  warning: [{ v:8 },{ v:12 },{ v:9 },{ v:14 },{ v:11 },{ v:7 },{ v:10 },{ v:8 }],
  danger:  [{ v:5 },{ v:7 },{ v:9 },{ v:6 },{ v:8 },{ v:11 },{ v:10 },{ v:9 }],
  info:    [{ v:15 },{ v:20 },{ v:18 },{ v:25 },{ v:22 },{ v:30 },{ v:27 },{ v:35 }],
  default: [{ v:60 },{ v:65 },{ v:70 },{ v:68 },{ v:72 },{ v:75 },{ v:74 },{ v:78 }],
};
const SPARKLINE_COLORS = {
  primary: '#059669', success: '#059669', warning: '#D97706',
  danger: '#DC2626', info: '#2563EB', default: '#6366F1',
};

function Sparkline({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sp${color.replace('#','')})`} dot={false} isAnimationActive animationDuration={1200}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, numericValue, sub, variant = 'default', trend }) {
  const count = useCountUp(numericValue ?? 0);
  const sparkData  = SPARKLINE_SEEDS[variant] || SPARKLINE_SEEDS.default;
  const sparkColor = SPARKLINE_COLORS[variant] || '#6366F1';
  const displayVal = numericValue !== undefined
    ? (value.includes('FCFA') ? fmtEntier(count) + ' FCFA' : fmtEntier(count))
    : value;
  return (
    <div className={`kpi-card kpi-${variant}`} data-glow="green">
      <div className="kpi-card__top">
        <div className="kpi-card__icon"><Icon size={18}/></div>
        {trend !== undefined && (
          <div className={`kpi-card__trend ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
            {trend >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        <div className="kpi-card__value">{displayVal}</div>
        {sub && <span className="kpi-card__sub">{sub}</span>}
      </div>
      <div className="kpi-card__sparkline">
        <Sparkline data={sparkData} color={sparkColor}/>
      </div>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dgi-tooltip">
      <p className="dgi-tooltip__label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{fmtFull(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── PAGE PRINCIPALE ─────────────────────────────────────────
export default function TableauDeBord() {
  const { slideshowActive, slideshowDateRange } = usePresentMode();

  const { state: periodState } = usePeriodFilter();
  const datePreset      = periodState.preset;
  const customStartDate = periodState.customStart;
  const customEndDate   = periodState.customEnd;
  const setDatePreset      = (v) => setPeriodState({ preset: v });
  const setCustomStartDate = (v) => setPeriodState({ preset: 'custom', customStart: v });
  const setCustomEndDate   = (v) => setPeriodState({ preset: 'custom', customEnd: v });

  const [syncing, setSyncing]             = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [reloadNonce, setReloadNonce]     = useState(0);

  const [kpi, setKpi]                 = useState(EMPTY_KPI);
  const [chartEvol, setChartEvol]     = useState([]);
  const [ministeres, setMinisteres]   = useState([]);
  const [services, setServices]       = useState([]);
  const [regions, setRegions]         = useState([]);
  const [alertes, setAlertes]         = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError]     = useState('');

  const [drillMinistere, setDrillMinistere] = useState(null);

  // ── Date range ────────────────────────────────────────────
  const manualDateRange = useMemo(
    () => getDateRangeFromPreset(datePreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, datePreset],
  );

  const dateRange = useMemo(
    () => (slideshowActive ? (slideshowDateRange || {}) : manualDateRange),
    [manualDateRange, slideshowActive, slideshowDateRange],
  );

  const periodLabel = useMemo(() => {
    if (slideshowActive) {
      if (slideshowDateRange?.startDate && slideshowDateRange?.endDate) {
        return slideshowDateRange.startDate === slideshowDateRange.endDate
          ? slideshowDateRange.startDate
          : `${slideshowDateRange.startDate} → ${slideshowDateRange.endDate}`;
      }
      return 'Toutes les données';
    }
    if (datePreset === 'custom') {
      if (customStartDate && customEndDate) return `${customStartDate} → ${customEndDate}`;
      return 'Période personnalisée';
    }
    return DATE_PRESETS.find((p) => p.value === datePreset)?.label || 'Tout';
  }, [customEndDate, customStartDate, datePreset, slideshowActive, slideshowDateRange]);

  const evolutionLabel = useMemo(() => {
    if (chartEvol.length >= 2) {
      return `${chartEvol[0].periode} – ${chartEvol[chartEvol.length - 1].periode}`;
    }
    return periodLabel;
  }, [chartEvol, periodLabel]);

  // ── Load dashboard data ───────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError('');

      try {
        const dashboard = await fetchDashboard(dateRange, controller.signal);

        if (!isMounted) return;

        setKpi(dashboard.kpi);
        setChartEvol(dashboard.evolution);
        setMinisteres(dashboard.ministeres);
        setServices(dashboard.services);
        setRegions(dashboard.regions);
        setAlertes(dashboard.alertes);
      } catch (error) {
        if (!isMounted || error?.name === 'AbortError') return;
        setAnalyticsError(error?.message || 'Impossible de charger le tableau de bord.');
      } finally {
        if (isMounted) setAnalyticsLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [dateRange.endDate, dateRange.startDate, reloadNonce]);

  // ── Derived data ──────────────────────────────────────────
  const top10Ministeres = useMemo(
    () => [...ministeres].sort((a, b) => b.montant - a.montant).slice(0, 10),
    [ministeres],
  );

  const top10Services = useMemo(
    () => [...services].sort((a, b) => b.montant - a.montant).slice(0, 10),
    [services],
  );

  const statutPieData = useMemo(() => {
    const entries = [
      { name: STATUT_CONFIG.PAID.label,    value: kpi.soumissionsPayees,     fill: STATUT_CONFIG.PAID.color    },
      { name: STATUT_CONFIG.PENDING.label, value: kpi.soumissionsEnAttente,  fill: STATUT_CONFIG.PENDING.color },
      { name: STATUT_CONFIG.PARTIAL.label, value: kpi.soumissionsPartielles, fill: STATUT_CONFIG.PARTIAL.color },
      { name: STATUT_CONFIG.FAILED.label,  value: kpi.soumissionsEchouees,   fill: STATUT_CONFIG.FAILED.color  },
    ];
    return entries.filter((e) => e.value > 0);
  }, [kpi]);

  const paymentGap = useMemo(
    () => Math.max(0, 90 - Number(kpi.tauxPaiement || 0)),
    [kpi.tauxPaiement],
  );

  // ── Handlers ──────────────────────────────────────────────
  const handleMinistereClick = useCallback((data) => {
    if (!data?.activePayload) return;
    const entry = data.activePayload[0]?.payload;
    if (!entry?.ministereId) return;
    setDrillMinistere(entry);
  }, []);

  const handleExpand = (e) => {
    const card = e.currentTarget.closest('.chart-card');
    if (!card) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      card.requestFullscreen().catch(() => {});
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading('Synchronisation des données en cours...');
    try {
      const res = await lancerSynchronisation();
      if (res?.skipped) {
        toast.success('Une synchronisation est déjà en cours, réessayez dans un instant.', { id: toastId });
        return;
      }
      if (res?.success === false) {
        toast.error(`Échec de la synchronisation : ${res.error || 'erreur inconnue'}`, { id: toastId });
        return;
      }
      invalidateCache();
      setReloadNonce((v) => v + 1);
      toast.success('Données actualisées avec succès.', { id: toastId });
    } catch (error) {
      toast.error(error?.message || 'Échec de la synchronisation des données.', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const getExportFilename = (ext) => {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
    let periodStr = datePreset;
    if (datePreset === 'custom') {
      periodStr = `${customStartDate || 'debut'}_au_${customEndDate || 'fin'}`;
    } else {
      const preset = DATE_PRESETS.find((p) => p.value === datePreset);
      if (preset) periodStr = preset.label.replace(/[' ]/g, '_');
    }
    return `TresorPay_TableauDeBord_${periodStr}_${dateStr}.${ext}`;
  };

  const handleExportPDF = async () => {
    setExportLoading(true);
    const toastId = toast.loading('Génération du rapport PDF...');
    try {
      const dataForPdf = {
        title: 'Tableau de Bord — Recettes Publiques',
        kpi,
        avisList: [],
      };
      await exportToPDF(dataForPdf, getExportFilename('pdf'));
      toast.success('Rapport PDF exporté avec succès !', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export PDF", { id: toastId });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    const toastId = toast.loading("Préparation de l'export Excel...");
    const headers = ['Ministère', 'Montant', 'Soumissions', 'Taux Paiement'];
    try {
      const data = ministeres.map((m) => [m.nom, m.montant, m.nombreSoumissions, `${m.tauxPaiement}%`]);
      exportToExcel(data, headers, 'Ministères', getExportFilename('xlsx'));
      toast.success('Export Excel téléchargé !', { id: toastId });
    } catch (error) {
      toast.error(error?.message || "Erreur lors de l'export Excel", { id: toastId });
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (analyticsLoading && !kpi.totalSoumissions) {
    return (
      <div className="dgi-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <WeaveSpinner size={100} message="Chargement du tableau de bord..." />
      </div>
    );
  }

  return (
    <div className="dgi-page animate-fade-in" id="tdb-report-content">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }}/>

      {/* ── Drill-down ministère ── */}
      {drillMinistere && (
        <DrillDownModal
          cdi={drillMinistere.nom}
          dateRange={dateRange}
          onClose={() => setDrillMinistere(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="dgi-page__header">
        <div className="header-left">
          <div>
            <h1 className="dgi-page__title">Tableau de Bord</h1>
            <p className="dgi-page__sub">Plateforme de recettes publiques — Statistiques & Analytiques</p>
          </div>
        </div>
        <div className="header-right">
          <div className="date-presets">
            <Calendar size={14}/>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={`preset-btn ${datePreset === p.value ? 'active' : ''}`}
              >
                {p.label}
              </button>
            ))}
            {datePreset === 'custom' && (
              <div className="custom-date-picker animate-fade-in" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginLeft: '0.5rem' }}>
                <input
                  type="date"
                  className="preset-btn"
                  style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>à</span>
                <input
                  type="date"
                  className="preset-btn"
                  style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
                <button
                  onClick={() => toast.success('Période appliquée avec succès')}
                  className="preset-btn"
                  style={{ background: '#3b82f6', color: 'white', border: 'none', marginLeft: '0.2rem', padding: '0.3rem 0.6rem' }}
                >
                  Appliquer
                </button>
              </div>
            )}
          </div>
          <button
            className="action-btn outline"
            onClick={handleSync}
            disabled={syncing}
            title="Actualiser les données depuis les systèmes sources"
          >
            <RefreshCw size={14} className={syncing ? 'dgi-sync-spin' : ''}/>
            {syncing ? 'Synchronisation...' : 'Actualiser les données'}
          </button>
          <button className="action-btn outline" onClick={handleExportExcel}>
            <FileSpreadsheet size={14}/> Excel
          </button>
          <button className="action-btn primary" onClick={handleExportPDF} disabled={exportLoading}>
            <FileDown size={14}/> {exportLoading ? 'Export...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {analyticsError && (
        <div className="active-filters-bar" style={{ borderColor: 'rgba(220,38,38,0.2)', color: '#DC2626' }}>
          <span className="af-label" style={{ color: '#DC2626' }}>
            <AlertTriangle size={12}/> {analyticsError}
          </span>
          <button className="af-reset" onClick={() => setReloadNonce((v) => v + 1)}>
            <RotateCcw size={12}/> Réessayer
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="kpi-grid" style={{ flexShrink: 0 }}>
        <KpiCard
          icon={TrendingUp}
          label="Total Revenus"
          value={fmtFull(kpi.totalRevenus)}
          numericValue={kpi.totalRevenus}
          sub={analyticsLoading ? 'Chargement...' : periodLabel}
          variant="primary"
          trend={kpi.progressionMoisPrecedent}
        />
        <KpiCard
          icon={FileText}
          label="Total Soumissions"
          value={fmtEntier(kpi.totalSoumissions)}
          numericValue={kpi.totalSoumissions}
          sub={analyticsLoading ? 'Chargement...' : periodLabel}
          variant="default"
        />
        <KpiCard
          icon={CheckCircle}
          label="Soumissions Payées"
          value={fmtEntier(kpi.soumissionsPayees)}
          numericValue={kpi.soumissionsPayees}
          sub={fmtFull(kpi.totalRevenus)}
          variant="success"
        />
        <KpiCard
          icon={Clock}
          label="En Attente"
          value={fmtEntier(kpi.soumissionsEnAttente)}
          numericValue={kpi.soumissionsEnAttente}
          sub={periodLabel}
          variant="warning"
        />
        <KpiCard
          icon={XCircle}
          label="Échouées"
          value={fmtEntier(kpi.soumissionsEchouees)}
          numericValue={kpi.soumissionsEchouees}
          sub={periodLabel}
          variant="danger"
        />
        <KpiCard
          icon={TrendingUp}
          label="Taux de Paiement"
          value={`${kpi.tauxPaiement}%`}
          numericValue={kpi.tauxPaiement}
          sub="Objectif : 90%"
          variant="default"
        />
      </div>

      {/* ── Charts: Evolution + Gauge ── */}
      <div className="charts-row charts-row--3-1">
        <div className="chart-card" data-glow="blue">
          <div className="chart-card__header">
            <div>
              <h2 className="chart-title">Évolution Mensuelle des Recettes</h2>
              <span className="chart-sub">{evolutionLabel}</span>
            </div>
            <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartEvol} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gpaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gattente" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gechoue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periode" tick={{ fontSize: 12 }}/>
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend/>
              <Area type="monotone" dataKey="paye" name="Payé" stroke="#059669" fill="url(#gpaid)" strokeWidth={2} isAnimationActive animationDuration={1400}/>
              <Area type="monotone" dataKey="enAttente" name="En attente" stroke="#D97706" fill="url(#gattente)" strokeWidth={2} isAnimationActive animationDuration={1600}/>
              <Area type="monotone" dataKey="echoue" name="Échoué" stroke="#DC2626" fill="url(#gechoue)" strokeWidth={2} isAnimationActive animationDuration={1800}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card gauge-card" data-glow="green">
          <div className="chart-card__header">
            <h2 className="chart-title">Taux de Paiement</h2>
            <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
          </div>
          <div className="gauge-center">
            <GaugeChart value={kpi.tauxPaiement} max={100} label="Paiement" color="#059669" size={200} thickness={18}/>
          </div>
          <div className="gauge-legend">
            <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#DC2626' }}/> &lt;50% Critique</div>
            <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#D97706' }}/> 50–74% Attention</div>
            <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#059669' }}/> ≥75% Objectif</div>
          </div>
          <div className="gauge-target">
            Objectif : 90% — Écart :{' '}
            <strong style={{ color: paymentGap > 0 ? '#D97706' : '#059669' }}>
              {paymentGap > 0 ? `+${paymentGap.toFixed(1)} pts nécessaires` : 'Objectif atteint'}
            </strong>
          </div>
        </div>
      </div>

      {/* ── Charts: Ministères + Services ── */}
      <div className="charts-row">
        <div className="chart-card chart-card--large" data-glow="blue">
          <div className="chart-card__header">
            <div>
              <h2 className="chart-title"><Building2 size={16}/> Top 10 Ministères</h2>
              <span className="chart-sub">Revenus par ministère — cliquez pour le détail</span>
            </div>
            <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(300, top10Ministeres.length * 36)}>
            <BarChart data={top10Ministeres} layout="vertical" margin={{ left: 20, right: 20 }} onClick={handleMinistereClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" tickFormatter={fmtFull} tick={{ fontSize: 10 }}/>
              <YAxis type="category" dataKey="shortName" width={160} tick={{ fontSize: 10 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="montant" name="Revenus" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1200} animationBegin={200}>
                {top10Ministeres.map((entry, i) => (
                  <Cell key={entry.ministereId || i} fill={entry.couleur || `hsl(${160 + i * 14}, 65%, ${40 + i * 2}%)`}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card" data-glow="blue">
          <div className="chart-card__header">
            <div>
              <h2 className="chart-title">Répartition par Statut</h2>
              <span className="chart-sub">{fmtEntier(kpi.totalSoumissions)} soumissions au total</span>
            </div>
            <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statutPieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                stroke="none"
                isAnimationActive
                animationDuration={1200}
                animationBegin={300}
              >
                {statutPieData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill}/>
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${fmtEntier(value)} soumissions`, '']}/>
              <Legend/>
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {Object.entries(STATUT_CONFIG).map(([key, cfg]) => {
              const count = key === 'PAID' ? kpi.soumissionsPayees
                : key === 'PENDING' ? kpi.soumissionsEnAttente
                : key === 'PARTIAL' ? kpi.soumissionsPartielles
                : kpi.soumissionsEchouees;
              if (!count) return null;
              return (
                <div className="pie-legend-item" key={key}>
                  <span className="dot" style={{ background: cfg.color }}/> {cfg.label}: <strong>{fmtEntier(count)}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Top 10 Services ── */}
      {top10Services.length > 0 && (
        <div className="charts-row" style={{ gridTemplateColumns: '1fr' }}>
          <div className="chart-card" data-glow="blue">
            <div className="chart-card__header">
              <div>
                <h2 className="chart-title">Top 10 Services</h2>
                <span className="chart-sub">Revenus par service</span>
              </div>
              <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(280, top10Services.length * 34)}>
              <BarChart data={top10Services} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                <XAxis type="number" tickFormatter={fmtFull} tick={{ fontSize: 10 }}/>
                <YAxis type="category" dataKey="nom" width={220} tick={{ fontSize: 10 }}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="montant" name="Revenus" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1400} animationBegin={400}>
                  {top10Services.map((item, index) => (
                    <Cell key={item.serviceId || index} fill={item.couleur || `hsl(${190 + index * 10}, 60%, 45%)`}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Bottom section: Regions + Alerts ── */}
      <div className="tdb-bottom-section">
        {/* Regional overview */}
        {regions.length > 0 && (
          <div className="tdb-regions-overview">
            <h2 className="chart-title"><MapPin size={16}/> Aperçu Régional</h2>
            <div className="tdb-regions-grid">
              {regions.slice(0, 10).map((region) => (
                <div className="tdb-region-card" key={region.orgUnitId || region.nom}>
                  <div className="tdb-region-card__header">
                    <span className="tdb-region-card__name">{region.nom}</span>
                    <span className={`tdb-region-card__status tdb-status--${(region.statut || 'normal').toLowerCase()}`}>
                      {region.statut || 'Normal'}
                    </span>
                  </div>
                  <div className="tdb-region-card__value">{fmt(region.valeur)} FCFA</div>
                  <div className="tdb-region-card__meta">
                    {fmtEntier(region.nombreSoumissions)} soumissions
                    {region.objectif > 0 && (
                      <> — {Math.round((region.valeur / region.objectif) * 100)}% objectif</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active alerts */}
        {alertes.length > 0 && (
          <div className="tdb-alerts-preview">
            <h2 className="chart-title"><AlertCircle size={16}/> Alertes Actives</h2>
            <div className="tdb-alerts-list">
              {alertes.slice(0, 3).map((alerte, i) => (
                <div className={`tdb-alert-item tdb-alert--${(alerte.severite || alerte.severity || 'info').toLowerCase()}`} key={i}>
                  <AlertTriangle size={14}/>
                  <div className="tdb-alert-item__body">
                    <span className="tdb-alert-item__title">{alerte.titre || alerte.title}</span>
                    <span className="tdb-alert-item__desc">{alerte.message || alerte.description}</span>
                  </div>
                  <span className="tdb-alert-item__time">{alerte.date || alerte.createdAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
