import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle, Clock,
  AlertTriangle, Building2, Calendar, X,
  RotateCcw, FileSpreadsheet, FileDown, Maximize, RefreshCw,
  AlertCircle, MapPin, XCircle, ChevronRight, ArrowLeft,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { usePresentMode } from '../components/layout/MainLayout';
import { useAuth } from '../components/auth/AuthProvider';
import GaugeChart from '../components/ui/GaugeChart';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import {
  fetchDashboard,
  fetchMinistereDetail,
  fetchRegionDetail,
  fetchMonPerimetre,
  lancerSynchronisation,
} from '../api/analyticsApi';
import { invalidateCache } from '../api/cache';
import { getDateRangeFromPreset } from '../utils/dateUtils';
import { usePeriodFilter, setPeriodState } from '../hooks/usePeriodFilter';
import { formatEntier, formatMontant } from '../utils/format';
import './TableauDeBord.css';

// ─── Profils utilisateur ────────────────────────────────────
function getUserProfile(user) {
  if (!user) return 'VISITEUR';
  if (user.est_super_admin) return 'DIRECTEUR';
  const niveau = (user.niveau || '').toUpperCase();
  if (niveau === 'CENTRAL') return 'SUPERVISEUR';
  if (niveau === 'REGIONAL') return 'MINISTRE';
  if (niveau === 'DEPARTEMENTAL' || niveau === 'CDI') return 'REGIONAL';
  return 'AGENT';
}

function getProfileLabel(profile) {
  const labels = {
    DIRECTEUR: 'Direction Generale',
    SUPERVISEUR: 'Supervision Nationale',
    MINISTRE: 'Perimetre Ministeriel',
    REGIONAL: 'Perimetre Regional',
    AGENT: 'Agent',
    VISITEUR: 'Visiteur',
  };
  return labels[profile] || profile;
}

const TAB_DEFS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'ministeres', label: 'Ministères & Services' },
  { id: 'comparaison', label: 'Comparaison' },
  { id: 'regions', label: 'Régions' },
  { id: 'perimetre', label: 'Mon périmètre', needsScope: true },
  { id: 'alertes', label: 'Alertes' },
];

const YEAR_COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#8B5CF6'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// ─── Utilitaires ────────────────────────────────────────────
const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)} K`
  : n.toString();
const fmtFull = (n) => formatMontant(n);
const fmtEntier = (n) => formatEntier(n);

const STATUT_CONFIG = {
  PAID:    { label: 'Paye',       color: '#059669', cls: 'orb-paid'    },
  PENDING: { label: 'En attente', color: '#D97706', cls: 'orb-pending' },
  PARTIAL: { label: 'Partiel',    color: '#2563EB', cls: 'orb-partial' },
  FAILED:  { label: 'Echoue',     color: '#DC2626', cls: 'orb-failed'  },
};

const DATE_PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Ce mois',     value: 'month' },
  { label: 'Tout',        value: 'all'   },
  { label: 'Periode...',  value: 'custom' },
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
function KpiCard({ icon: Icon, label, value, numericValue, sub, variant = 'default', trend, sparklineData }) {
  const count = useCountUp(numericValue ?? 0);
  const sparkData  = sparklineData?.length ? sparklineData : (SPARKLINE_SEEDS[variant] || SPARKLINE_SEEDS.default);
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

// ─── Drill-Down Panel (slide-in from right) ──────────────────
function DrillDownPanel({ title, subtitle, onClose, loading, error, onRetry, children }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="ddm-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="ddm-panel animate-slide-from-right">
        <div className="ddm-header">
          <div className="ddm-header-left">
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', padding: '2px', display: 'flex',
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="ddm-title">{title}</h2>
              {subtitle && <p className="ddm-sub">{subtitle}</p>}
            </div>
          </div>
          <button className="ddm-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && (
          <div className="active-filters-bar" style={{ margin: '1rem 1.25rem 0', borderColor: 'rgba(220,38,38,0.2)', color: '#DC2626' }}>
            <span className="af-label" style={{ color: '#DC2626' }}>
              <AlertTriangle size={12} /> {error}
            </span>
            {onRetry && (
              <button className="af-reset" onClick={onRetry}>
                <RotateCcw size={12} /> Reessayer
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem' }}>
            <WeaveSpinner size={60} message="Chargement..." />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ─────────────────────────────────────────
export default function TableauDeBord() {
  const { slideshowActive, slideshowDateRange } = usePresentMode();
  const { user } = useAuth();
  const userProfile = useMemo(() => getUserProfile(user), [user]);
  const hasScope = user?.ministere || user?.orgUnit;

  const { state: periodState } = usePeriodFilter();
  const datePreset      = periodState.preset;
  const customStartDate = periodState.customStart;
  const customEndDate   = periodState.customEnd;
  const setDatePreset      = (v) => setPeriodState({ preset: v });
  const setCustomStartDate = (v) => setPeriodState({ preset: 'custom', customStart: v });
  const setCustomEndDate   = (v) => setPeriodState({ preset: 'custom', customEnd: v });

  const [activeTab, setActiveTab] = useState('overview');
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

  // Mon perimetre
  const [perimetreData, setPerimetreData] = useState(null);
  const [perimetreLoading, setPerimetreLoading] = useState(false);

  // Drill-down state
  const [drillMinistere, setDrillMinistere] = useState(null);
  const [drillMinistereData, setDrillMinistereData] = useState(null);
  const [drillMinistereLoading, setDrillMinistereLoading] = useState(false);
  const [drillMinistereError, setDrillMinistereError] = useState('');

  const [drillRegion, setDrillRegion] = useState(null);
  const [drillRegionData, setDrillRegionData] = useState(null);
  const [drillRegionLoading, setDrillRegionLoading] = useState(false);
  const [drillRegionError, setDrillRegionError] = useState('');

  // Tabs visibles selon le profil
  const visibleTabs = useMemo(() => {
    return TAB_DEFS.filter(t => {
      if (t.needsScope && !hasScope) return false;
      return true;
    });
  }, [hasScope]);

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
          : `${slideshowDateRange.startDate} -> ${slideshowDateRange.endDate}`;
      }
      return 'Toutes les donnees';
    }
    if (datePreset === 'custom') {
      if (customStartDate && customEndDate) return `${customStartDate} -> ${customEndDate}`;
      return 'Periode personnalisee';
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

  // ── Load "Mon perimetre" data ────────────────────────────
  useEffect(() => {
    if (activeTab !== 'perimetre' || !hasScope) return;
    let isMounted = true;
    const controller = new AbortController();

    async function loadPerimetre() {
      setPerimetreLoading(true);
      try {
        const data = await fetchMonPerimetre(dateRange, controller.signal);
        if (isMounted) setPerimetreData(data);
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
      } finally {
        if (isMounted) setPerimetreLoading(false);
      }
    }

    loadPerimetre();
    return () => { isMounted = false; controller.abort(); };
  }, [activeTab, hasScope, dateRange.endDate, dateRange.startDate]);

  // ── Load ministere drill-down ─────────────────────────────
  useEffect(() => {
    if (!drillMinistere) return;
    let isMounted = true;
    const controller = new AbortController();

    async function loadDetail() {
      setDrillMinistereLoading(true);
      setDrillMinistereError('');
      try {
        const data = await fetchMinistereDetail(
          drillMinistere.ministereId,
          dateRange,
          controller.signal,
        );
        if (isMounted) setDrillMinistereData(data);
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        setDrillMinistereError(err?.message || 'Impossible de charger le detail.');
      } finally {
        if (isMounted) setDrillMinistereLoading(false);
      }
    }

    loadDetail();
    return () => { isMounted = false; controller.abort(); };
  }, [drillMinistere, dateRange.startDate, dateRange.endDate]);

  // ── Load region drill-down ────────────────────────────────
  useEffect(() => {
    if (!drillRegion) return;
    let isMounted = true;
    const controller = new AbortController();

    async function loadDetail() {
      setDrillRegionLoading(true);
      setDrillRegionError('');
      try {
        const data = await fetchRegionDetail(
          drillRegion.code || drillRegion.orgUnitId,
          dateRange,
          controller.signal,
        );
        if (isMounted) setDrillRegionData(data);
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        setDrillRegionError(err?.message || 'Impossible de charger le detail.');
      } finally {
        if (isMounted) setDrillRegionLoading(false);
      }
    }

    loadDetail();
    return () => { isMounted = false; controller.abort(); };
  }, [drillRegion, dateRange.startDate, dateRange.endDate]);

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
    setDrillMinistereData(null);
  }, []);

  const handleRegionClick = useCallback((region) => {
    setDrillRegion(region);
    setDrillRegionData(null);
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
    const toastId = toast.loading('Synchronisation des donnees en cours...');
    try {
      const res = await lancerSynchronisation();
      if (res?.skipped) {
        toast.success('Une synchronisation est deja en cours, reessayez dans un instant.', { id: toastId });
        return;
      }
      if (res?.success === false) {
        toast.error(`Echec de la synchronisation : ${res.error || 'erreur inconnue'}`, { id: toastId });
        return;
      }
      invalidateCache();
      setReloadNonce((v) => v + 1);
      toast.success('Donnees actualisees avec succes.', { id: toastId });
    } catch (error) {
      toast.error(error?.message || 'Echec de la synchronisation des donnees.', { id: toastId });
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
    const toastId = toast.loading('Generation du rapport PDF...');
    try {
      const dataForPdf = {
        title: 'Tableau de Bord — Recettes Publiques',
        kpi,
        avisList: [],
      };
      await exportToPDF(dataForPdf, getExportFilename('pdf'));
      toast.success('Rapport PDF exporte avec succes !', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export PDF", { id: toastId });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    const toastId = toast.loading("Preparation de l'export Excel...");
    const headers = ['Ministere', 'Montant', 'Soumissions', 'Taux Paiement'];
    try {
      const data = ministeres.map((m) => [m.nom, m.montant, m.nombreSoumissions, `${m.tauxPaiement}%`]);
      exportToExcel(data, headers, 'Ministeres', getExportFilename('xlsx'));
      toast.success('Export Excel telecharge !', { id: toastId });
    } catch (error) {
      toast.error(error?.message || "Erreur lors de l'export Excel", { id: toastId });
    }
  };

  // ── Build sparkline data from evolution ───────────────────
  const sparkPaye = useMemo(() => chartEvol.map(e => ({ v: e.paye || 0 })), [chartEvol]);
  const sparkTotal = useMemo(() => chartEvol.map(e => ({ v: (e.paye || 0) + (e.enAttente || 0) + (e.echoue || 0) + (e.partiel || 0) })), [chartEvol]);
  const sparkAttente = useMemo(() => chartEvol.map(e => ({ v: e.enAttente || 0 })), [chartEvol]);

  // ── Render helper: Ministere detail panel content ─────────
  const renderMinistereDetail = () => {
    const d = drillMinistereData;
    if (!d) return null;
    const detailServices = Array.isArray(d.services) ? d.services : [];
    const detailKpi = d.kpi || d;
    const revenus = detailKpi.totalRevenus || detailKpi.montant || 0;
    const soumissions = detailKpi.totalSoumissions || detailKpi.nombreSoumissions || 0;
    const taux = detailKpi.tauxPaiement || 0;

    return (
      <>
        <div className="ddm-kpis">
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Revenus</span>
            <span className="ddm-kpi__value" style={{ color: '#059669' }}>{fmtFull(revenus)} FCFA</span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Soumissions</span>
            <span className="ddm-kpi__value">{fmtEntier(soumissions)}</span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Taux paiement</span>
            <span className="ddm-kpi__value" style={{ color: taux >= 75 ? '#059669' : taux >= 50 ? '#D97706' : '#DC2626' }}>
              {taux}%
            </span>
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <h3 className="ddm-section-title">Services ({detailServices.length})</h3>
          {detailServices.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Aucun service disponible.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {detailServices.map((svc, i) => {
                const svcMontant = svc.montant || 0;
                const svcSoum = svc.nombreSoumissions || 0;
                const svcTaux = svc.tauxPaiement || 0;
                return (
                  <div
                    key={svc.serviceId || i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.8rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {svc.nom}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                        {fmtEntier(svcSoum)} soumissions
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669' }}>
                        {fmt(svcMontant)} FCFA
                      </div>
                      <div style={{ fontSize: '0.62rem', color: svcTaux >= 75 ? '#059669' : svcTaux >= 50 ? '#D97706' : '#DC2626', fontWeight: 700 }}>
                        {svcTaux}% paye
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  // ── Render helper: Region detail panel content ────────────
  const renderRegionDetail = () => {
    const d = drillRegionData;
    if (!d) return null;
    const departments = Array.isArray(d.departements) ? d.departements : (Array.isArray(d.children) ? d.children : []);
    const regKpi = d.kpi || d;
    const revenus = regKpi.valeur || regKpi.totalRevenus || regKpi.montant || 0;
    const soumissions = regKpi.nombreSoumissions || regKpi.totalSoumissions || 0;

    return (
      <>
        <div className="ddm-kpis">
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Revenus</span>
            <span className="ddm-kpi__value" style={{ color: '#059669' }}>{fmtFull(revenus)} FCFA</span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Soumissions</span>
            <span className="ddm-kpi__value">{fmtEntier(soumissions)}</span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Statut</span>
            <span className="ddm-kpi__value">{drillRegion?.statut || 'Normal'}</span>
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <h3 className="ddm-section-title">Departements ({departments.length})</h3>
          {departments.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Aucun departement disponible.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {departments.map((dep, i) => {
                const depMontant = dep.valeur || dep.montant || 0;
                const depSoum = dep.nombreSoumissions || 0;
                return (
                  <div
                    key={dep.orgUnitId || dep.code || i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.8rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                  >
                    <MapPin size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {dep.nom}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                        {fmtEntier(depSoum)} soumissions
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669' }}>
                        {fmt(depMontant)} FCFA
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
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
    <div className="dgi-page dgi-page--no-scroll animate-fade-in" id="tdb-report-content">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }}/>

      {/* ── Drill-down ministere panel ── */}
      {drillMinistere && (
        <DrillDownPanel
          title={drillMinistere.nom || drillMinistere.shortName}
          subtitle="Detail du ministere — services et revenus"
          onClose={() => { setDrillMinistere(null); setDrillMinistereData(null); }}
          loading={drillMinistereLoading}
          error={drillMinistereError}
          onRetry={() => { setDrillMinistereData(null); setDrillMinistere({ ...drillMinistere }); }}
        >
          {renderMinistereDetail()}
        </DrillDownPanel>
      )}

      {/* ── Drill-down region panel ── */}
      {drillRegion && (
        <DrillDownPanel
          title={drillRegion.nom}
          subtitle="Detail regional — departements"
          onClose={() => { setDrillRegion(null); setDrillRegionData(null); }}
          loading={drillRegionLoading}
          error={drillRegionError}
          onRetry={() => { setDrillRegionData(null); setDrillRegion({ ...drillRegion }); }}
        >
          {renderRegionDetail()}
        </DrillDownPanel>
      )}

      {/* ── Header ── */}
      <div className="dgi-page__header">
        <div className="header-left">
          <div>
            <h1 className="dgi-page__title">Tableau de Bord</h1>
            <p className="dgi-page__sub">
              Plateforme de recettes non fiscales — {getProfileLabel(userProfile)}
              {user?.ministere?.nomFr && <> · {user.ministere.nomFr}</>}
              {user?.orgUnit?.nomFr && !user?.ministere && <> · {user.orgUnit.nomFr}</>}
            </p>
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
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>a</span>
                <input
                  type="date"
                  className="preset-btn"
                  style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
                <button
                  onClick={() => toast.success('Periode appliquee avec succes')}
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
            title="Actualiser les donnees depuis les systemes sources"
          >
            <RefreshCw size={14} className={syncing ? 'dgi-sync-spin' : ''}/>
            {syncing ? 'Synchronisation...' : 'Actualiser les donnees'}
          </button>
          <button className="action-btn outline" onClick={handleExportExcel}>
            <FileSpreadsheet size={14}/> Excel
          </button>
          <button className="action-btn primary" onClick={handleExportPDF} disabled={exportLoading}>
            <FileDown size={14}/> {exportLoading ? 'Export...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="tdb-tab-bar">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            className={`tdb-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Error banner ── */}
      {analyticsError && (
        <div className="active-filters-bar" style={{ borderColor: 'rgba(220,38,38,0.2)', color: '#DC2626' }}>
          <span className="af-label" style={{ color: '#DC2626' }}>
            <AlertTriangle size={12}/> {analyticsError}
          </span>
          <button className="af-reset" onClick={() => setReloadNonce((v) => v + 1)}>
            <RotateCcw size={12}/> Reessayer
          </button>
        </div>
      )}

      {/* ═══════════ TAB 1: VUE D'ENSEMBLE ═══════════ */}
      {activeTab === 'overview' && (
        <div className="tdb-tab-content">
          {/* KPI row: 4 cards */}
          <div className="kpi-grid kpi-grid--4">
            <KpiCard
              icon={TrendingUp}
              label="Montant Encaisse"
              value={fmtFull(kpi.totalRevenus)}
              numericValue={kpi.totalRevenus}
              sub={analyticsLoading ? 'Chargement...' : `Soumis : ${fmtFull(kpi.montantTotalSoumis || 0)}`}
              variant="primary"
              trend={kpi.progressionMoisPrecedent}
              sparklineData={sparkPaye}
            />
            <KpiCard
              icon={FileText}
              label="Total Soumissions"
              value={fmtEntier(kpi.totalSoumissions)}
              numericValue={kpi.totalSoumissions}
              sub={analyticsLoading ? 'Chargement...' : periodLabel}
              variant="default"
              sparklineData={sparkTotal}
            />
            <KpiCard
              icon={CheckCircle}
              label="Soumissions Payees"
              value={fmtEntier(kpi.soumissionsPayees)}
              numericValue={kpi.soumissionsPayees}
              sub={fmtFull(kpi.totalRevenus)}
              variant="success"
              sparklineData={sparkPaye}
            />
            <KpiCard
              icon={TrendingUp}
              label="Taux de Paiement"
              value={`${kpi.tauxPaiement}%`}
              numericValue={kpi.tauxPaiement}
              sub="Objectif : 90%"
              variant="info"
              sparklineData={sparkAttente}
            />
          </div>

          {/* Evolution chart (3/4) + Gauge (1/4) */}
          <div className="charts-row charts-row--3-1 charts-row--fill">
            <div className="chart-card" data-glow="blue">
              <div className="chart-card__header">
                <div>
                  <h2 className="chart-title">Evolution Mensuelle des Recettes</h2>
                  <span className="chart-sub">{evolutionLabel}</span>
                </div>
                <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartEvol} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                  <XAxis dataKey="periode" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip/>} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Legend />
                  <Bar dataKey="echoue" name="Échoué" stackId="stack" fill="#DC2626" isAnimationActive animationDuration={1000} />
                  <Bar dataKey="enAttente" name="En attente" stackId="stack" fill="#D97706" isAnimationActive animationDuration={1000} />
                  <Bar dataKey="paye" name="Payé" stackId="stack" fill="#059669" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card gauge-card" data-glow="green">
              <div className="chart-card__header">
                <h2 className="chart-title">Taux de Paiement</h2>
                <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
              </div>
              <div className="gauge-center">
                <GaugeChart value={kpi.tauxPaiement} max={100} label="Paiement" color="#059669" size={180} thickness={16}/>
              </div>
              <div className="gauge-legend">
                <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#DC2626' }}/> &lt;50% Critique</div>
                <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#D97706' }}/> 50–74% Attention</div>
                <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#059669' }}/> &ge;75% Objectif</div>
              </div>
              <div className="gauge-target">
                Objectif : 90% — Ecart :{' '}
                <strong style={{ color: paymentGap > 0 ? '#D97706' : '#059669' }}>
                  {paymentGap > 0 ? `+${paymentGap.toFixed(1)} pts necessaires` : 'Objectif atteint'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ TAB 2: MINISTERES & SERVICES ═══════════ */}
      {activeTab === 'ministeres' && (
        <div className="tdb-tab-content" style={{ overflow: 'auto' }}>
          {/* Bandeau KPI compact */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', flexShrink: 0 }}>
            <div className="tdb-mini-kpi-card" style={{ borderLeft: '3px solid #059669' }}>
              <div className="tdb-mini-kpi-card__label">Montant Encaissé</div>
              <div className="tdb-mini-kpi-card__value" style={{ color: '#059669' }}>{fmt(kpi.totalRevenus)} FCFA</div>
            </div>
            <div className="tdb-mini-kpi-card" style={{ borderLeft: '3px solid #6366F1' }}>
              <div className="tdb-mini-kpi-card__label">Soumissions Payées</div>
              <div className="tdb-mini-kpi-card__value">{fmtEntier(kpi.soumissionsPayees)}</div>
            </div>
            <div className="tdb-mini-kpi-card" style={{ borderLeft: '3px solid #D97706' }}>
              <div className="tdb-mini-kpi-card__label">En Attente</div>
              <div className="tdb-mini-kpi-card__value" style={{ color: '#D97706' }}>{fmtEntier(kpi.soumissionsEnAttente)}</div>
            </div>
            <div className="tdb-mini-kpi-card" style={{ borderLeft: '3px solid #DC2626' }}>
              <div className="tdb-mini-kpi-card__label">Échouées</div>
              <div className="tdb-mini-kpi-card__value" style={{ color: '#DC2626' }}>{fmtEntier(kpi.soumissionsEchouees)}</div>
            </div>
          </div>

          {/* Pie répartition statut — compact */}
          <div className="chart-card" style={{ flexShrink: 0, padding: '0.5rem 0.9rem' }}>
            <div className="chart-card__header" style={{ marginBottom: '0.2rem' }}>
              <h2 className="chart-title">Répartition par Statut</h2>
              <span className="chart-sub">{fmtEntier(kpi.totalSoumissions)} soumissions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 120 }}>
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={statutPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none" isAnimationActive animationDuration={1200}>
                    {statutPieData.map((entry, index) => <Cell key={index} fill={entry.fill}/>)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${fmtEntier(value)} soumissions`, '']}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem', flex: 1 }}>
                {Object.entries(STATUT_CONFIG).map(([key, cfg]) => {
                  const count = key === 'PAID' ? kpi.soumissionsPayees
                    : key === 'PENDING' ? kpi.soumissionsEnAttente
                    : key === 'PARTIAL' ? kpi.soumissionsPartielles
                    : kpi.soumissionsEchouees;
                  if (!count) return null;
                  return (
                    <div className="pie-legend-item" key={key} style={{ margin: 0 }}>
                      <span className="dot" style={{ background: cfg.color }}/> {cfg.label}: <strong>{fmtEntier(count)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top 10 Ministères */}
          <div className="chart-card" style={{ flexShrink: 0 }}>
            <div className="chart-card__header">
              <div>
                <h2 className="chart-title"><Building2 size={16}/> Top 10 Ministères</h2>
                <span className="chart-sub">Cliquez une barre pour le détail</span>
              </div>
              <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(220, top10Ministeres.length * 30)}>
              <BarChart data={top10Ministeres} layout="vertical" margin={{ left: 10, right: 20 }} onClick={handleMinistereClick} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                <XAxis type="number" tickFormatter={fmtFull} tick={{ fontSize: 10 }}/>
                <YAxis type="category" dataKey="shortName" width={120} tick={{ fontSize: 10 }}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="montant" name="Revenus" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1200}>
                  {top10Ministeres.map((entry, i) => (
                    <Cell key={entry.ministereId || i} fill={entry.couleur || `hsl(${160 + i * 14}, 65%, ${40 + i * 2}%)`}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Services */}
          {top10Services.length > 0 && (
            <div className="chart-card" style={{ flexShrink: 0 }}>
              <div className="chart-card__header">
                <div>
                  <h2 className="chart-title">Top 10 Services</h2>
                  <span className="chart-sub">Revenus par service</span>
                </div>
                <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(220, top10Services.length * 30)}>
                <BarChart data={top10Services} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                  <XAxis type="number" tickFormatter={fmtFull} tick={{ fontSize: 10 }}/>
                  <YAxis type="category" dataKey="nom" width={140} tick={{ fontSize: 10 }}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="montant" name="Revenus" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1400}>
                    {top10Services.map((item, index) => (
                      <Cell key={item.serviceId || index} fill={item.couleur || `hsl(${190 + index * 10}, 60%, 45%)`}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB 3: REGIONS ═══════════ */}
      {activeTab === 'regions' && (
        <div className="tdb-tab-content">
          {regions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <MapPin size={32} style={{ opacity: 0.4 }}/>
                <p style={{ marginTop: '0.5rem' }}>Aucune donnee regionale disponible.</p>
              </div>
            </div>
          ) : (
            <div className="tdb-regions-grid tdb-regions-grid--full">
              {regions.map((region) => (
                <div
                  className="tdb-region-card tdb-region-card--clickable"
                  key={region.orgUnitId || region.nom}
                  onClick={() => handleRegionClick(region)}
                >
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
                  <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-tertiary)', fontSize: '0.6rem' }}>
                    <ChevronRight size={10} /> Voir les departements
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: COMPARAISON ANNUELLE ═══════════ */}
      {activeTab === 'comparaison' && (
        <div className="tdb-tab-content">
          {(() => {
            // Construire les données de comparaison par année depuis chartEvol
            // chartEvol = [{ periode: "Avr 2026", paye: X, enAttente: Y, echoue: Z }, ...]
            const yearMap = {};
            chartEvol.forEach(item => {
              const parts = (item.periode || '').split(' ');
              const monthStr = parts[0];
              const year = parts[1] || '2026';
              const monthIdx = MONTH_LABELS.indexOf(monthStr);
              const month = monthIdx >= 0 ? monthIdx : parseInt(monthStr) - 1;
              if (!yearMap[year]) yearMap[year] = {};
              const total = (item.paye || 0) + (item.enAttente || 0) + (item.echoue || 0) + (item.partiel || 0);
              yearMap[year][month] = { total, paye: item.paye || 0 };
            });
            const years = Object.keys(yearMap).sort();
            // Construire les données mensuelles (Jan-Déc)
            const compData = MONTH_LABELS.map((label, idx) => {
              const entry = { mois: label };
              years.forEach(y => {
                entry[`total_${y}`] = yearMap[y]?.[idx]?.total || 0;
                entry[`paye_${y}`] = yearMap[y]?.[idx]?.paye || 0;
              });
              return entry;
            });
            // KPI par année
            const yearKpis = years.map(y => {
              const vals = Object.values(yearMap[y] || {});
              const totalRevenus = vals.reduce((s, v) => s + v.paye, 0);
              const totalSoumis = vals.reduce((s, v) => s + v.total, 0);
              return { year: y, totalRevenus, totalSoumis, mois: vals.length };
            });

            return (
              <>
                {/* KPI par année */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(years.length, 4)}, 1fr)`, gap: '0.75rem', marginBottom: '1rem' }}>
                  {yearKpis.map((yk, i) => (
                    <div key={yk.year} style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                      borderRadius: 10, padding: '0.8rem 1rem', borderLeft: `4px solid ${YEAR_COLORS[i % YEAR_COLORS.length]}`,
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: YEAR_COLORS[i % YEAR_COLORS.length], textTransform: 'uppercase', letterSpacing: '0.04em' }}>{yk.year}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmtFull(yk.totalRevenus)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        Total soumis : {fmtFull(yk.totalSoumis)} · {yk.mois} mois
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart comparaison — revenus payés */}
                <div className="chart-card" style={{ flex: 1, minHeight: 0 }}>
                  <div className="chart-card__header">
                    <div>
                      <h2 className="chart-title">Comparaison annuelle — Revenus payés</h2>
                      <span className="chart-sub">Chaque ligne représente une année</span>
                    </div>
                    <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={compData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                      <XAxis dataKey="mois" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {years.map((y, i) => (
                        <Line
                          key={y}
                          type="monotone"
                          dataKey={`paye_${y}`}
                          name={y}
                          stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: YEAR_COLORS[i % YEAR_COLORS.length] }}
                          activeDot={{ r: 6 }}
                          isAnimationActive
                          animationDuration={1200}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ═══════════ TAB: MON PERIMETRE ═══════════ */}
      {activeTab === 'perimetre' && hasScope && (
        <div className="tdb-tab-content">
          {perimetreLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <WeaveSpinner size={60} message="Chargement de votre perimetre..." />
            </div>
          ) : perimetreData ? (
            <>
              <div className="tdb-perimetre-header" style={{ flexShrink: 0 }}>
                <Building2 size={20} />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {perimetreData.perimetre?.ministereNom || perimetreData.perimetre?.orgUnitNom || 'Mon perimetre'}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Niveau : {perimetreData.perimetre?.niveau || user?.niveau}
                  </p>
                </div>
              </div>

              <div className="kpi-grid kpi-grid--4" style={{ flexShrink: 0 }}>
                <KpiCard icon={TrendingUp} label="Montant Encaisse" value={fmtFull(perimetreData.kpi?.totalRevenus || 0)} numericValue={perimetreData.kpi?.totalRevenus || 0} sub={`Soumis : ${fmtFull(perimetreData.kpi?.montantTotalSoumis || 0)}`} variant="primary" trend={perimetreData.kpi?.progressionMoisPrecedent} />
                <KpiCard icon={FileText} label="Soumissions" value={fmtEntier(perimetreData.kpi?.totalSoumissions || 0)} numericValue={perimetreData.kpi?.totalSoumissions || 0} variant="default" />
                <KpiCard icon={CheckCircle} label="Payees" value={fmtEntier(perimetreData.kpi?.soumissionsPayees || 0)} numericValue={perimetreData.kpi?.soumissionsPayees || 0} variant="success" />
                <KpiCard icon={Clock} label="En Attente" value={fmtEntier(perimetreData.kpi?.soumissionsEnAttente || 0)} numericValue={perimetreData.kpi?.soumissionsEnAttente || 0} variant="warning" />
              </div>

              {perimetreData.evolution?.length > 0 && (
                <div className="chart-card" data-glow="blue" style={{ flex: 1, minHeight: 0 }}>
                  <div className="chart-card__header">
                    <h2 className="chart-title">Evolution — Mon perimetre</h2>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={perimetreData.evolution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gpPaye" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="periode" tick={{ fontSize: 12 }}/>
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Legend/>
                      <Area type="monotone" dataKey="paye" name="Paye" stroke="#059669" fill="url(#gpPaye)" strokeWidth={2} />
                      <Area type="monotone" dataKey="enAttente" name="En attente" stroke="#D97706" fill="none" strokeWidth={2} />
                      <Area type="monotone" dataKey="echoue" name="Echoue" stroke="#DC2626" fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <Building2 size={32} style={{ opacity: 0.4 }}/>
                <p style={{ marginTop: '0.5rem' }}>Aucune donnee disponible pour votre perimetre.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB 4: ALERTES ═══════════ */}
      {activeTab === 'alertes' && (
        <div className="tdb-tab-content">
          {alertes.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <CheckCircle size={32} style={{ color: '#059669', opacity: 0.6 }}/>
                <p style={{ marginTop: '0.5rem' }}>Aucune alerte active. Tous les indicateurs sont normaux.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Alert summary cards */}
              <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
                <div className="tdb-mini-kpi-card" style={{ flex: 1, borderLeft: '3px solid #DC2626' }}>
                  <div className="tdb-mini-kpi-card__label">Alertes Critiques</div>
                  <div className="tdb-mini-kpi-card__value" style={{ color: '#DC2626' }}>
                    {alertes.filter(a => a.type === 'danger' || a.severite === 'critical').length}
                  </div>
                </div>
                <div className="tdb-mini-kpi-card" style={{ flex: 1, borderLeft: '3px solid #D97706' }}>
                  <div className="tdb-mini-kpi-card__label">Avertissements</div>
                  <div className="tdb-mini-kpi-card__value" style={{ color: '#D97706' }}>
                    {alertes.filter(a => a.type === 'attention' || a.severite === 'warning').length}
                  </div>
                </div>
                <div className="tdb-mini-kpi-card" style={{ flex: 1, borderLeft: '3px solid #2563EB' }}>
                  <div className="tdb-mini-kpi-card__label">Total</div>
                  <div className="tdb-mini-kpi-card__value">{alertes.length}</div>
                </div>
              </div>

              {/* Alert list */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {alertes.map((alerte, i) => (
                  <div className={`tdb-alert-item tdb-alert--${(alerte.type || alerte.severite || 'info').toLowerCase()}`} key={i}>
                    <AlertTriangle size={14}/>
                    <div className="tdb-alert-item__body">
                      <span className="tdb-alert-item__title">{alerte.titre || alerte.title}</span>
                      <span className="tdb-alert-item__desc">{alerte.message || alerte.description}</span>
                    </div>
                    <span className="tdb-alert-item__time">{alerte.date || alerte.createdAt}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
