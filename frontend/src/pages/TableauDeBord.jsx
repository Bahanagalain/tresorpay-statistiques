import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle, Clock,
  AlertTriangle, Building2, Calendar, X,
  RotateCcw, FileSpreadsheet, FileDown, Maximize, RefreshCw,
  AlertCircle, MapPin, XCircle, ChevronRight, ChevronDown, ArrowLeft,
  LayoutDashboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { usePresentMode } from '../components/layout/MainLayout';
import { useAuth } from '../components/auth/AuthProvider';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import {
  fetchDashboard,
  fetchMinistereDetail,
  fetchServiceDetail,
  fetchRegionDetail,
  fetchMonPerimetre,
  fetchSoumissions,
  lancerSynchronisation,
} from '../api/analyticsApi';
import { fetchDashboards } from '../api/biApi';
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
  { id: 'soumissions', label: 'Soumissions' },
  { id: 'ministeres', label: 'Ministères & Services' },
  { id: 'comparaison', label: 'Comparaison' },
  { id: 'regions', label: 'Régions' },
  { id: 'dashboards', label: 'Mes Dashboards' },
  { id: 'perimetre', label: 'Mon périmètre', needsScope: true },
  { id: 'alertes', label: 'Alertes' },
];

const YEAR_COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#8B5CF6'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// Opérateurs de paiement — couleurs distinctes
const OPERATEURS = [
  { key: 'orangeMoney',  label: 'Orange Money',       color: '#FF6600' },
  { key: 'mtnMomo',      label: 'MTN Mobile Money',   color: '#FFCC00' },
  { key: 'expressPay',   label: 'Express Exchange',    color: '#E91E8C' },
  { key: 'bcPme',        label: 'BC-PME',              color: '#4CAF50' },
  { key: 'scb',          label: 'SCB Cameroun',        color: '#1A237E' },
  { key: 'ecobank',      label: 'Ecobank',             color: '#0288D1' },
  { key: 'autres',       label: 'Autres',              color: '#FF9800' },
];

// Générer données mock par jour avec opérateurs
function generateDailyOperatorData() {
  const data = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // 30 derniers jours
  for (let d = 29; d >= 0; d--) {
    const date = new Date(year, month, now.getDate() - d);
    const dayLabel = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const base = isWeekend ? 0.3 : 1;
    // Plus d'activité vers la fin du mois
    const trend = 0.5 + (30 - d) / 30;
    data.push({
      jour: dayLabel,
      orangeMoney:  Math.round((Math.random() * 25 + 5) * base * trend),
      mtnMomo:      Math.round((Math.random() * 20 + 3) * base * trend),
      expressPay:   Math.round((Math.random() * 6) * base * trend),
      bcPme:        Math.round((Math.random() * 4) * base * trend),
      scb:          Math.round((Math.random() * 3) * base * trend),
      ecobank:      Math.round((Math.random() * 5) * base * trend),
      autres:       Math.round((Math.random() * 4) * base * trend),
    });
  }
  return data;
}

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

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, numericValue, sub, variant = 'default', trend }) {
  const count = useCountUp(numericValue ?? 0);
  const displayVal = numericValue !== undefined
    ? (value.includes('FCFA') ? fmtEntier(count) + ' FCFA' : fmtEntier(count))
    : value;
  return (
    <div className={`kpi-card kpi-${variant}`}>
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
  const navigate = useNavigate();
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
  const [alerteFilter, setAlerteFilter] = useState('all');

  // Mes Dashboards
  const [pinnedDashboards, setPinnedDashboards] = useState([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);
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

  const [drillService, setDrillService] = useState(null);
  const [drillServiceData, setDrillServiceData] = useState(null);
  const [drillServiceLoading, setDrillServiceLoading] = useState(false);
  const [drillServiceError, setDrillServiceError] = useState('');

  // Soumissions tab state
  const [soumissions, setSoumissions] = useState([]);
  const [soumPagination, setSoumPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [soumLoading, setSoumLoading] = useState(false);
  const [soumSearch, setSoumSearch] = useState('');
  const [soumStatut, setSoumStatut] = useState('');
  const [soumPage, setSoumPage] = useState(1);
  const [selectedSoumission, setSelectedSoumission] = useState(null);
  const soumSearchTimer = useRef(null);

  // Overview: latest soumissions
  const [latestSoumissions, setLatestSoumissions] = useState([]);

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

  // ── Load service drill-down ──────────────────────────────
  useEffect(() => {
    if (!drillService) return;
    let isMounted = true;
    const controller = new AbortController();

    async function load() {
      setDrillServiceLoading(true);
      setDrillServiceError('');
      try {
        const data = await fetchServiceDetail(drillService.serviceId, dateRange, controller.signal);
        if (isMounted) setDrillServiceData(data);
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        setDrillServiceError(err?.message || 'Erreur');
      } finally {
        if (isMounted) setDrillServiceLoading(false);
      }
    }

    load();
    return () => { isMounted = false; controller.abort(); };
  }, [drillService, dateRange.startDate, dateRange.endDate]);

  // ── Load soumissions when tab active ──────────────────────
  useEffect(() => {
    if (activeTab !== 'soumissions') return;
    let isMounted = true;
    const controller = new AbortController();

    async function load() {
      setSoumLoading(true);
      try {
        const params = { page: soumPage, limit: 20 };
        if (soumSearch) params.search = soumSearch;
        if (soumStatut) params.statut = soumStatut;
        if (dateRange.startDate) params.startDate = dateRange.startDate;
        if (dateRange.endDate) params.endDate = dateRange.endDate;
        const res = await fetchSoumissions(params, controller.signal);
        if (!isMounted) return;
        setSoumissions(res.donnees || []);
        setSoumPagination(res.pagination || {});
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
      } finally {
        if (isMounted) setSoumLoading(false);
      }
    }
    load();
    return () => { isMounted = false; controller.abort(); };
  }, [activeTab, soumPage, soumSearch, soumStatut, dateRange.startDate, dateRange.endDate]);

  // ── Load latest soumissions for overview tab ─────────────
  useEffect(() => {
    if (activeTab !== 'overview') return;
    let isMounted = true;
    const controller = new AbortController();
    fetchSoumissions({ page: 1, limit: 5 }, controller.signal)
      .then(res => {
        if (!isMounted) return;
        const list = res.soumissions || res.donnees?.soumissions || res.datas?.soumissions || res.donnees || [];
        setLatestSoumissions(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => { isMounted = false; controller.abort(); };
  }, [activeTab, reloadNonce]);

  // ── Load pinned dashboards when tab active ────────────────
  useEffect(() => {
    if (activeTab !== 'dashboards') return;
    let isMounted = true;
    const controller = new AbortController();
    async function load() {
      setPinnedLoading(true);
      try {
        const res = await fetchDashboards(controller.signal);
        const list = res.datas || res || [];
        if (isMounted) setPinnedDashboards(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
      } finally {
        if (isMounted) setPinnedLoading(false);
      }
    }
    load();
    return () => { isMounted = false; controller.abort(); };
  }, [activeTab]);

  // ── Derived data ──────────────────────────────────────────
  const top10Ministeres = useMemo(
    () => [...ministeres].sort((a, b) => b.montant - a.montant).slice(0, 10),
    [ministeres],
  );

  const top10Services = useMemo(
    () => [...services].sort((a, b) => b.montant - a.montant).slice(0, 10),
    [services],
  );

  // ── Handlers ──────────────────────────────────────────────
  const handleMinistereClick = useCallback((data) => {
    if (!data?.activePayload) return;
    const entry = data.activePayload[0]?.payload;
    if (!entry?.ministereId) return;
    setDrillMinistere(entry);
    setDrillMinistereData(null);
  }, []);

  const handleServiceClick = useCallback((data) => {
    if (!data?.activePayload) return;
    const entry = data.activePayload[0]?.payload;
    if (!entry?.serviceId) return;
    setDrillService(entry);
    setDrillServiceData(null);
  }, []);

  const handleRegionClick = useCallback((region) => {
    const regionId = region.orgUnitId || region.code || region.nom;
    if (drillRegion && (drillRegion.orgUnitId || drillRegion.code || drillRegion.nom) === regionId) {
      // Collapse if same region clicked
      setDrillRegion(null);
      setDrillRegionData(null);
    } else {
      setDrillRegion(region);
      setDrillRegionData(null);
    }
  }, [drillRegion]);

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

  // ── Données journalières par opérateur (mock pour démo) ───
  const dailyOperatorData = useMemo(() => generateDailyOperatorData(), []);

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

  // ── Render helper: Service detail panel content ───────────
  const renderServiceDetail = () => {
    const d = drillServiceData;
    if (!d) return null;
    const detailKpi = d.kpi || d;
    const revenus = detailKpi.totalRevenus || detailKpi.montant || 0;
    const soumissionsCount = detailKpi.totalSoumissions || detailKpi.nombreSoumissions || 0;
    const taux = detailKpi.tauxPaiement || 0;
    const soumissionsList = Array.isArray(d.soumissions) ? d.soumissions : [];

    return (
      <>
        <div className="ddm-kpis">
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Revenus</span>
            <span className="ddm-kpi__value" style={{ color: '#059669' }}>{fmtFull(revenus)} FCFA</span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Soumissions</span>
            <span className="ddm-kpi__value">{fmtEntier(soumissionsCount)}</span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Taux paiement</span>
            <span className="ddm-kpi__value" style={{ color: taux >= 75 ? '#059669' : taux >= 50 ? '#D97706' : '#DC2626' }}>
              {taux}%
            </span>
          </div>
        </div>

        {soumissionsList.length > 0 && (
          <div style={{ padding: '1rem 1.25rem' }}>
            <h3 className="ddm-section-title">Dernieres soumissions ({soumissionsList.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {soumissionsList.slice(0, 10).map((sub, i) => (
                <div key={sub.uniqueCode || i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 0.8rem',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {sub.uniqueCode || sub.soumetteurNom || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                      {sub.soumetteurNom} · {new Date(sub.dateSoumission).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669' }}>
                      {fmt(sub.montant || 0)} FCFA
                    </div>
                    <div style={{
                      fontSize: '0.62rem', fontWeight: 700,
                      color: sub.statutPaiement === 'PAID' ? '#059669' : sub.statutPaiement === 'PENDING' ? '#D97706' : '#DC2626',
                    }}>
                      {STATUT_CONFIG[sub.statutPaiement]?.label || sub.statutPaiement}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Render helper: Region expanded row (inline accordion) ─

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

      {/* ── Drill-down service panel ── */}
      {drillService && (
        <DrillDownPanel
          title={drillService.nom}
          subtitle="Detail du service — soumissions et revenus"
          onClose={() => { setDrillService(null); setDrillServiceData(null); }}
          loading={drillServiceLoading}
          error={drillServiceError}
          onRetry={() => { setDrillServiceData(null); setDrillService({ ...drillService }); }}
        >
          {drillServiceData && renderServiceDetail()}
        </DrillDownPanel>
      )}

      {/* Region drill-down is now inline accordion in the table */}

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
              label="Soumissions Payees"
              value={fmtEntier(kpi.soumissionsPayees)}
              numericValue={kpi.soumissionsPayees}
              sub={fmtFull(kpi.totalRevenus)}
              variant="success"
            />
            <KpiCard
              icon={TrendingUp}
              label="Taux de Paiement"
              value={`${kpi.tauxPaiement}%`}
              numericValue={kpi.tauxPaiement}
              sub="Objectif : 90%"
              variant="info"
            />
          </div>

          {/* Tendance journalière par opérateur de paiement */}
          <div className="chart-card" style={{ flex: 1, minHeight: 0 }}>
            <div className="chart-card__header">
              <div>
                <h2 className="chart-title">Tendance des Paiements par Opérateur</h2>
                <span className="chart-sub">30 derniers jours — ventilé par moyen de paiement</span>
              </div>
              <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyOperatorData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                <XAxis dataKey="jour" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip/>} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: '0.72rem' }} />
                {OPERATEURS.map((op, i) => (
                  <Bar
                    key={op.key}
                    dataKey={op.key}
                    name={op.label}
                    stackId="ops"
                    fill={op.color}
                    radius={i === OPERATEURS.length - 1 ? [2, 2, 0, 0] : undefined}
                    isAnimationActive
                    animationDuration={800}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 5 dernières soumissions */}
          <div className="chart-card" style={{ flexShrink: 0 }}>
            <div className="chart-card__header">
              <h2 className="chart-title">Dernières soumissions</h2>
              <button className="preset-btn" onClick={() => setActiveTab('soumissions')} style={{ color: 'var(--accent-dgi)', fontWeight: 700 }}>
                Voir tout →
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Contribuable</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Montant</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Statut</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {latestSoumissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                      Aucune soumission récente.
                    </td>
                  </tr>
                ) : latestSoumissions.map((s, i) => {
                  const cfg = STATUT_CONFIG[s.statutPaiement] || STATUT_CONFIG.PENDING;
                  const dateFmt = s.dateSoumission
                    ? s.dateSoumission.split('-').reverse().join('/')
                    : '\u2014';
                  return (
                    <tr
                      key={s.uniqueCode || s.id || i}
                      style={{
                        borderBottom: '1px solid var(--glass-border)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface-elevated)',
                      }}
                    >
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-primary)' }}>
                        {s.uniqueCode || '\u2014'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {s.soumetteurNom || '\u2014'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {fmtFull(s.montant)}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>
                        <span style={{
                          display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: 20,
                          fontSize: '0.66rem', fontWeight: 700,
                          background: cfg.color + '18', color: cfg.color,
                        }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                        {dateFmt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ TAB: SOUMISSIONS ═══════════ */}
      {activeTab === 'soumissions' && (
        <div className="tdb-tab-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Filters bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0,
            padding: '0.6rem 0.8rem',
            background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
            borderRadius: 10, marginBottom: '0.5rem', flexWrap: 'wrap',
          }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
              <input
                type="text"
                placeholder="Rechercher par code, nom, email..."
                defaultValue={soumSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  if (soumSearchTimer.current) clearTimeout(soumSearchTimer.current);
                  soumSearchTimer.current = setTimeout(() => {
                    setSoumSearch(val);
                    setSoumPage(1);
                  }, 500);
                }}
                style={{
                  width: '100%', padding: '0.45rem 0.7rem', fontSize: '0.78rem',
                  border: '1px solid var(--glass-border)', borderRadius: 8,
                  background: 'var(--bg-surface-elevated)', color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {[
                { value: '', label: 'Tous' },
                { value: 'PAID', label: 'Paye' },
                { value: 'PENDING', label: 'En attente' },
                { value: 'PARTIAL', label: 'Partiel' },
                { value: 'FAILED', label: 'Echoue' },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => { setSoumStatut(btn.value); setSoumPage(1); }}
                  style={{
                    padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: 600,
                    border: '1px solid var(--glass-border)', borderRadius: 6, cursor: 'pointer',
                    background: soumStatut === btn.value ? 'var(--primary)' : 'transparent',
                    color: soumStatut === btn.value ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
              {fmtEntier(soumPagination.total || 0)} resultats
            </span>
          </div>

          {/* Table */}
          {soumLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <WeaveSpinner size={60} message="Chargement des soumissions..." />
            </div>
          ) : soumissions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <FileText size={32} style={{ opacity: 0.4 }} />
                <p style={{ marginTop: '0.5rem' }}>Aucune soumission trouvee.</p>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: 10, border: '1px solid var(--glass-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{
                    position: 'sticky', top: 0, zIndex: 2,
                    background: 'var(--bg-surface)', borderBottom: '2px solid var(--glass-border)',
                  }}>
                    {['Code Unique', 'Contribuable', 'Service', 'Ministere', 'Montant', 'Paye', 'Statut', 'Date'].map((col, i) => (
                      <th key={col} style={{
                        padding: '0.6rem 0.7rem', fontWeight: 700, fontSize: '0.7rem',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        color: 'var(--text-tertiary)', textAlign: i >= 4 && i <= 5 ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {soumissions.map((s, idx) => {
                    const cfg = STATUT_CONFIG[s.statutPaiement] || STATUT_CONFIG.PENDING;
                    const dateFmt = s.dateSoumission
                      ? s.dateSoumission.split('-').reverse().join('/')
                      : '\u2014';
                    return (
                      <tr
                        key={s.uniqueCode || s.id || idx}
                        onClick={() => setSelectedSoumission(s)}
                        style={{
                          cursor: 'pointer',
                          background: idx % 2 === 0 ? 'transparent' : 'var(--bg-surface-elevated)',
                          borderBottom: '1px solid var(--glass-border)',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(5,150,105,0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg-surface-elevated)'; }}
                      >
                        <td style={{ padding: '0.55rem 0.7rem', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-primary)' }}>
                          {s.uniqueCode || '\u2014'}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.soumetteurNom || '\u2014'}</div>
                          {s.soumetteurEmail && (
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>{s.soumetteurEmail}</div>
                          )}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.service || '\u2014'}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.ministere || '\u2014'}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {fmtFull(s.montant)}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', textAlign: 'right', fontWeight: 600, color: '#059669', whiteSpace: 'nowrap' }}>
                          {fmtFull(s.montantPaye)}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem' }}>
                          <span style={{
                            display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: 20,
                            fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.02em',
                            background: cfg.color + '18', color: cfg.color,
                          }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                          {dateFmt}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {soumPagination.totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.5rem 0.8rem', flexShrink: 0, marginTop: '0.4rem',
              background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
              borderRadius: 10, fontSize: '0.75rem',
            }}>
              <span style={{ color: 'var(--text-tertiary)' }}>
                {fmtEntier(soumPagination.total)} soumissions au total
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setSoumPage((p) => Math.max(1, p - 1))}
                  disabled={soumPage <= 1}
                  style={{
                    padding: '0.3rem 0.7rem', border: '1px solid var(--glass-border)',
                    borderRadius: 6, cursor: soumPage <= 1 ? 'default' : 'pointer',
                    background: 'transparent', color: soumPage <= 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    fontSize: '0.75rem', fontWeight: 600, opacity: soumPage <= 1 ? 0.4 : 1,
                  }}
                >
                  Precedent
                </button>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  Page {soumPage} sur {soumPagination.totalPages}
                </span>
                <button
                  onClick={() => setSoumPage((p) => Math.min(soumPagination.totalPages, p + 1))}
                  disabled={soumPage >= soumPagination.totalPages}
                  style={{
                    padding: '0.3rem 0.7rem', border: '1px solid var(--glass-border)',
                    borderRadius: 6, cursor: soumPage >= soumPagination.totalPages ? 'default' : 'pointer',
                    background: 'transparent', color: soumPage >= soumPagination.totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    fontSize: '0.75rem', fontWeight: 600, opacity: soumPage >= soumPagination.totalPages ? 0.4 : 1,
                  }}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}

          {/* Detail panel */}
          {selectedSoumission && (
            <DrillDownPanel
              title={selectedSoumission.uniqueCode || 'Detail soumission'}
              subtitle={(() => {
                const c = STATUT_CONFIG[selectedSoumission.statutPaiement] || STATUT_CONFIG.PENDING;
                return c.label;
              })()}
              onClose={() => setSelectedSoumission(null)}
              loading={false}
            >
              <div style={{ padding: '1rem 1.25rem' }}>
                {/* Status badge */}
                <div style={{ marginBottom: '1rem' }}>
                  {(() => {
                    const c = STATUT_CONFIG[selectedSoumission.statutPaiement] || STATUT_CONFIG.PENDING;
                    return (
                      <span style={{
                        display: 'inline-block', padding: '0.3rem 0.8rem', borderRadius: 20,
                        fontSize: '0.75rem', fontWeight: 700,
                        background: c.color + '18', color: c.color,
                      }}>
                        {c.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  {[
                    { label: 'Contribuable', value: selectedSoumission.soumetteurNom || '\u2014' },
                    { label: 'Email', value: selectedSoumission.soumetteurEmail || '\u2014' },
                    { label: 'Telephone', value: selectedSoumission.soumetteurTelephone || '\u2014' },
                    { label: 'Service', value: selectedSoumission.service || '\u2014' },
                    { label: 'Ministere', value: selectedSoumission.ministere || '\u2014' },
                    { label: 'Formulaire', value: selectedSoumission.formulaireNom || '\u2014' },
                    { label: 'Montant soumis', value: fmtFull(selectedSoumission.montant) + ' FCFA', highlight: true },
                    { label: 'Montant paye', value: fmtFull(selectedSoumission.montantPaye) + ' FCFA', highlight: true, color: '#059669' },
                    { label: 'Date soumission', value: selectedSoumission.dateSoumission ? selectedSoumission.dateSoumission.split('-').reverse().join('/') : '\u2014' },
                    { label: 'Date paiement', value: selectedSoumission.datePaiement ? selectedSoumission.datePaiement.split('-').reverse().join('/') : '\u2014' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      padding: '0.6rem 0.8rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 8,
                    }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: item.highlight ? '0.88rem' : '0.8rem',
                        fontWeight: item.highlight ? 800 : 600,
                        color: item.color || 'var(--text-primary)',
                        wordBreak: 'break-word',
                      }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DrillDownPanel>
          )}
        </div>
      )}

      {/* ═══════════ TAB 2: MINISTERES & SERVICES ═══════════ */}
      {activeTab === 'ministeres' && (
        <div className="tdb-tab-content" style={{ overflow: 'auto' }}>
          {/* Bandeau KPI compact */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', flexShrink: 0 }}>
            <div className="tdb-mini-kpi-card">
              <div className="tdb-mini-kpi-card__label">Montant Encaissé</div>
              <div className="tdb-mini-kpi-card__value" style={{ color: '#059669' }}>{fmt(kpi.totalRevenus)} FCFA</div>
            </div>
            <div className="tdb-mini-kpi-card">
              <div className="tdb-mini-kpi-card__label">Soumissions Payées</div>
              <div className="tdb-mini-kpi-card__value">{fmtEntier(kpi.soumissionsPayees)}</div>
            </div>
            <div className="tdb-mini-kpi-card">
              <div className="tdb-mini-kpi-card__label">En Attente</div>
              <div className="tdb-mini-kpi-card__value" style={{ color: '#D97706' }}>{fmtEntier(kpi.soumissionsEnAttente)}</div>
            </div>
            <div className="tdb-mini-kpi-card">
              <div className="tdb-mini-kpi-card__label">Échouées</div>
              <div className="tdb-mini-kpi-card__value" style={{ color: '#DC2626' }}>{fmtEntier(kpi.soumissionsEchouees)}</div>
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
                  <span className="chart-sub">Cliquez une barre pour le detail</span>
                </div>
                <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(220, top10Services.length * 30)}>
                <BarChart data={top10Services} layout="vertical" margin={{ left: 10, right: 20 }} onClick={handleServiceClick} style={{ cursor: 'pointer' }}>
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
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div className="ddm-table-wrapper">
                <table className="ddm-table" style={{ tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Region</th>
                      <th style={{ textAlign: 'right' }}>Revenus</th>
                      <th style={{ textAlign: 'right' }}>Soumissions</th>
                      <th style={{ textAlign: 'right' }}>Objectif</th>
                      <th style={{ textAlign: 'center' }}>Statut</th>
                      <th style={{ width: '5rem', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...regions].sort((a, b) => (b.valeur || 0) - (a.valeur || 0)).map((region) => {
                      const regionId = region.orgUnitId || region.code || region.nom;
                      const isExpanded = drillRegion && (drillRegion.orgUnitId || drillRegion.code || drillRegion.nom) === regionId;
                      const statutRaw = (region.statut || 'normal').toLowerCase();
                      const statutColor = statutRaw === 'critical' || statutRaw === 'critique' ? '#DC2626'
                        : statutRaw === 'warning' || statutRaw === 'attention' ? '#D97706'
                        : '#059669';
                      const statutLabel = statutRaw === 'critical' || statutRaw === 'critique' ? 'Critique'
                        : statutRaw === 'warning' || statutRaw === 'attention' ? 'Attention'
                        : 'Bon';
                      const objectifPct = region.objectif > 0 ? Math.round((region.valeur / region.objectif) * 100) : null;

                      return (
                        <React.Fragment key={regionId}>
                          <tr
                            className="ddm-row"
                            style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                            onClick={() => handleRegionClick(region)}
                          >
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPin size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                {region.nom}
                              </div>
                            </td>
                            <td className="text-right" style={{ fontWeight: 800, color: '#059669', whiteSpace: 'nowrap' }}>
                              {fmt(region.valeur || 0)} FCFA
                            </td>
                            <td className="text-right" style={{ fontWeight: 600 }}>
                              {fmtEntier(region.nombreSoumissions || 0)}
                            </td>
                            <td className="text-right" style={{ whiteSpace: 'nowrap', color: objectifPct !== null ? (objectifPct >= 80 ? '#059669' : objectifPct >= 50 ? '#D97706' : '#DC2626') : 'var(--text-tertiary)' }}>
                              {objectifPct !== null ? `${objectifPct}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                fontSize: '0.7rem', fontWeight: 700, color: statutColor,
                              }}>
                                <span style={{
                                  width: '8px', height: '8px', borderRadius: '50%',
                                  background: statutColor, display: 'inline-block', flexShrink: 0,
                                }} />
                                {statutLabel}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                fontSize: '0.72rem', fontWeight: 700,
                                color: isExpanded ? 'var(--accent-dgi)' : 'var(--text-tertiary)',
                                transition: 'color 0.15s',
                              }}>
                                {isExpanded ? 'Fermer' : 'Voir'}
                                <ChevronDown size={14} style={{
                                  transition: 'transform 0.25s',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                }} />
                              </span>
                            </td>
                          </tr>

                          {/* ── Expanded accordion row ── */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} style={{ padding: 0, borderBottom: '2px solid var(--accent-dgi)' }}>
                                <div style={{
                                  background: 'var(--bg-surface-elevated)',
                                  padding: '1rem 1.25rem',
                                  animation: 'fadeIn 0.25s ease',
                                }}>
                                  {/* Region KPI summary */}
                                  {drillRegionLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                                      <WeaveSpinner size={40} message="Chargement..." />
                                    </div>
                                  ) : drillRegionError ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#DC2626', fontSize: '0.78rem', padding: '0.5rem 0' }}>
                                      <AlertTriangle size={14} />
                                      {drillRegionError}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDrillRegionData(null); setDrillRegion({ ...drillRegion }); }}
                                        style={{ marginLeft: '0.5rem', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                      >
                                        <RotateCcw size={10} /> Reessayer
                                      </button>
                                    </div>
                                  ) : drillRegionData ? (() => {
                                    const d = drillRegionData;
                                    const departments = Array.isArray(d.departements) ? d.departements : (Array.isArray(d.children) ? d.children : []);
                                    const regKpi = d.kpi || d;
                                    const revenus = regKpi.valeur || regKpi.totalRevenus || regKpi.montant || 0;
                                    const soumissions = regKpi.nombreSoumissions || regKpi.totalSoumissions || 0;
                                    const statut = drillRegion?.statut || 'Normal';

                                    return (
                                      <>
                                        {/* KPI horizontal strip */}
                                        <div style={{
                                          display: 'flex', gap: '2rem', flexWrap: 'wrap',
                                          padding: '0.6rem 0', marginBottom: '0.75rem',
                                          borderBottom: '1px solid var(--glass-border)',
                                        }}>
                                          <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '0.15rem' }}>Revenus</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>{fmtFull(revenus)} FCFA</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '0.15rem' }}>Soumissions</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmtEntier(soumissions)}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '0.15rem' }}>Statut</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: statutColor }}>{statut}</div>
                                          </div>
                                        </div>

                                        {/* Departments sub-table */}
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                          Departements ({departments.length})
                                        </div>
                                        {departments.length === 0 ? (
                                          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Aucun departement disponible.</p>
                                        ) : (
                                          <div className="ddm-table-wrapper" style={{ borderRadius: '8px' }}>
                                            <table className="ddm-table">
                                              <thead>
                                                <tr>
                                                  <th>Departement</th>
                                                  <th style={{ textAlign: 'right' }}>Revenus</th>
                                                  <th style={{ textAlign: 'right' }}>Soumissions</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {departments.map((dep, i) => {
                                                  const depMontant = dep.valeur || dep.montant || 0;
                                                  const depSoum = dep.nombreSoumissions || 0;
                                                  return (
                                                    <tr key={dep.orgUnitId || dep.code || i} className="ddm-row">
                                                      <td style={{ fontWeight: 600 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                          <MapPin size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                                          {dep.nom}
                                                        </div>
                                                      </td>
                                                      <td className="text-right" style={{ fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                                                        {fmt(depMontant)} FCFA
                                                      </td>
                                                      <td className="text-right" style={{ fontWeight: 600 }}>
                                                        {fmtEntier(depSoum)}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })() : null}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: MES DASHBOARDS ═══════════ */}
      {activeTab === 'dashboards' && (
        <div className="tdb-tab-content">
          {pinnedLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <WeaveSpinner size={60} message="Chargement des dashboards..." />
            </div>
          ) : pinnedDashboards.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '1rem', color: 'var(--text-secondary)' }}>
              <LayoutDashboard size={48} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Aucun dashboard personnalisé</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Créez votre premier dashboard depuis la page "Mes Dashboards"</p>
              <button className="action-btn primary" onClick={() => navigate('/bi/dashboards')}>
                Créer un dashboard
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', flex: 1, overflowY: 'auto', alignContent: 'start' }}>
              {pinnedDashboards.map(db => (
                <div key={db.id} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                  borderRadius: 10, padding: '1rem', cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onClick={() => navigate(`/bi/dashboards/${db.id}`)}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                    {db.titre || 'Sans titre'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    {db.widgets?.length || 0} widgets · Modifié le {new Date(db.updatedAt || db.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {(db.widgets || []).slice(0, 3).map((w, i) => (
                      <span key={i} style={{
                        fontSize: '0.62rem', padding: '0.15rem 0.4rem',
                        background: 'var(--bg-surface-elevated)', borderRadius: 4,
                        color: 'var(--text-tertiary)',
                      }}>
                        {w.titre || w.type}
                      </span>
                    ))}
                    {(db.widgets?.length || 0) > 3 && (
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>
                        +{db.widgets.length - 3} autres
                      </span>
                    )}
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

            // Données de démo pour années précédentes si une seule année existe
            const realYears = Object.keys(yearMap);
            const isDemoData = realYears.length <= 1;
            if (isDemoData) {
              const base2024 = [12000, 18000, 15000, 22000, 28000, 35000, 42000, 38000, 45000, 50000, 55000, 48000];
              const base2025 = [25000, 32000, 28000, 40000, 52000, 68000, 85000, 78000, 92000, 105000, 110000, 95000];
              base2024.forEach((v, i) => {
                if (!yearMap['2024']) yearMap['2024'] = {};
                yearMap['2024'][i] = { total: Math.round(v * 1.3), paye: v };
              });
              base2025.forEach((v, i) => {
                if (!yearMap['2025']) yearMap['2025'] = {};
                yearMap['2025'][i] = { total: Math.round(v * 1.2), paye: v };
              });
            }

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
            // KPI par année avec variation
            const yearKpis = years.map((y, idx) => {
              const vals = Object.values(yearMap[y] || {});
              const totalRevenus = vals.reduce((s, v) => s + v.paye, 0);
              const totalSoumis = vals.reduce((s, v) => s + v.total, 0);
              const prevYear = idx > 0 ? years[idx - 1] : null;
              let variation = null;
              if (prevYear) {
                const prevVals = Object.values(yearMap[prevYear] || {});
                const prevRevenus = prevVals.reduce((s, v) => s + v.paye, 0);
                if (prevRevenus > 0) {
                  variation = ((totalRevenus - prevRevenus) / prevRevenus) * 100;
                }
              }
              return { year: y, totalRevenus, totalSoumis, mois: vals.length, variation, prevYear };
            });

            const lastYear = years.length >= 1 ? years[years.length - 1] : null;
            const prevLastYear = years.length >= 2 ? years[years.length - 2] : null;

            return (
              <>
                {/* Badge données de démonstration */}
                {isDemoData && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0.8rem', background: 'rgba(37,99,235,0.06)',
                    border: '1px solid rgba(37,99,235,0.15)', borderRadius: '8px',
                    fontSize: '0.72rem', color: '#2563EB', flexShrink: 0,
                  }}>
                    <AlertCircle size={14}/> Les annees 2024 et 2025 contiennent des donnees de demonstration
                  </div>
                )}

                {/* KPI par année avec variation */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(years.length, 4)}, 1fr)`, gap: '0.75rem', flexShrink: 0 }}>
                  {yearKpis.map((yk, i) => (
                    <div key={yk.year} style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                      borderRadius: 10, padding: '0.8rem 1rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: YEAR_COLORS[i % YEAR_COLORS.length], textTransform: 'uppercase', letterSpacing: '0.04em' }}>{yk.year}</div>
                        {yk.variation !== null && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                            fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem',
                            borderRadius: 6,
                            background: yk.variation >= 0 ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
                            color: yk.variation >= 0 ? '#059669' : '#DC2626',
                          }}>
                            {yk.variation >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                            {yk.variation >= 0 ? '+' : ''}{yk.variation.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmtFull(yk.totalRevenus)} FCFA</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                        {yk.variation !== null
                          ? `${yk.variation >= 0 ? '\u2191' : '\u2193'} ${Math.abs(yk.variation).toFixed(1)}% vs ${yk.prevYear} \u00b7 ${yk.mois} mois`
                          : `${yk.mois} mois de donnees`
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart comparaison — barres groupees */}
                <div className="chart-card" style={{ flex: 1, minHeight: 0 }}>
                  <div className="chart-card__header">
                    <div>
                      <h2 className="chart-title">Comparaison annuelle — Revenus payes</h2>
                      <span className="chart-sub">Barres groupees par mois — une couleur par annee</span>
                    </div>
                    <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir"><Maximize size={16}/></button>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                      <XAxis dataKey="mois" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {years.map((y, i) => (
                        <Bar key={y} dataKey={`paye_${y}`} name={y} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={1000} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tableau recapitulatif mois par mois */}
                <div className="chart-card" style={{ flexShrink: 0, maxHeight: 250, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="chart-card__header" style={{ flexShrink: 0 }}>
                    <h2 className="chart-title">Recapitulatif mensuel</h2>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)' }}>
                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', borderBottom: '2px solid var(--glass-border)' }}>Mois</th>
                          {years.map((y, i) => (
                            <th key={y} style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: YEAR_COLORS[i % YEAR_COLORS.length], borderBottom: '2px solid var(--glass-border)' }}>{y}</th>
                          ))}
                          {lastYear && prevLastYear && (
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', borderBottom: '2px solid var(--glass-border)' }}>Var. {prevLastYear}&rarr;{lastYear}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {compData.map((row, idx) => {
                          const curVal = lastYear ? (row[`paye_${lastYear}`] || 0) : 0;
                          const prevVal = prevLastYear ? (row[`paye_${prevLastYear}`] || 0) : 0;
                          let varColor = 'var(--text-tertiary)';
                          let varLabel = '\u2014';
                          if (prevVal > 0 && curVal > 0) {
                            const varPct = ((curVal - prevVal) / prevVal) * 100;
                            varColor = varPct >= 0 ? '#059669' : '#DC2626';
                            varLabel = `${varPct >= 0 ? '+' : ''}${varPct.toFixed(0)}% ${varPct >= 0 ? '\u2191' : '\u2193'}`;
                          } else if (prevVal > 0 && curVal === 0) {
                            varColor = '#DC2626';
                            varLabel = '-100% \u2193';
                          } else if (prevVal === 0 && curVal > 0) {
                            varColor = '#059669';
                            varLabel = 'Nouveau \u2191';
                          }
                          return (
                            <tr key={row.mois} style={{ borderBottom: '1px solid var(--glass-border)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-surface-elevated)' }}>
                              <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, color: 'var(--text-primary)' }}>{row.mois}</td>
                              {years.map(y => (
                                <td key={y} style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                  {row[`paye_${y}`] > 0 ? fmt(row[`paye_${y}`]) : '\u2014'}
                                </td>
                              ))}
                              {lastYear && prevLastYear && (
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, color: varColor, whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                                  {varLabel}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {/* Ligne total */}
                        <tr style={{ borderTop: '2px solid var(--glass-border)', background: 'var(--bg-surface-elevated)' }}>
                          <td style={{ padding: '0.5rem 0.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Total</td>
                          {years.map((y, i) => {
                            const total = compData.reduce((s, r) => s + (r[`paye_${y}`] || 0), 0);
                            return (
                              <td key={y} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 800, color: YEAR_COLORS[i % YEAR_COLORS.length], whiteSpace: 'nowrap' }}>
                                {fmt(total)}
                              </td>
                            );
                          })}
                          {lastYear && prevLastYear && (() => {
                            const totalCur = compData.reduce((s, r) => s + (r[`paye_${lastYear}`] || 0), 0);
                            const totalPrev = compData.reduce((s, r) => s + (r[`paye_${prevLastYear}`] || 0), 0);
                            let tColor = 'var(--text-tertiary)';
                            let tLabel = '\u2014';
                            if (totalPrev > 0) {
                              const tPct = ((totalCur - totalPrev) / totalPrev) * 100;
                              tColor = tPct >= 0 ? '#059669' : '#DC2626';
                              tLabel = `${tPct >= 0 ? '+' : ''}${tPct.toFixed(1)}% ${tPct >= 0 ? '\u2191' : '\u2193'}`;
                            }
                            return (
                              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 800, color: tColor, whiteSpace: 'nowrap' }}>
                                {tLabel}
                              </td>
                            );
                          })()}
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
                <div className="chart-card" style={{ flex: 1, minHeight: 0 }}>
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
      {activeTab === 'alertes' && (() => {
        const countCritical = alertes.filter(a => { const t = (a.type || a.severite || 'info').toLowerCase(); return t === 'danger' || t === 'critical' || t === 'error'; }).length;
        const countWarning = alertes.filter(a => { const t = (a.type || a.severite || 'info').toLowerCase(); return t === 'attention' || t === 'warning'; }).length;
        const countInfo = alertes.filter(a => { const t = (a.type || a.severite || 'info').toLowerCase(); return t === 'info'; }).length;
        const filteredAlertes = alerteFilter === 'all' ? alertes : alertes.filter(a => {
          const type = (a.type || a.severite || 'info').toLowerCase();
          if (alerteFilter === 'critical') return type === 'danger' || type === 'critical' || type === 'error';
          if (alerteFilter === 'warning') return type === 'attention' || type === 'warning';
          if (alerteFilter === 'info') return type === 'info';
          return true;
        });

        return (
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
                  <div className="tdb-mini-kpi-card" style={{ flex: 1 }}>
                    <div className="tdb-mini-kpi-card__label">Alertes Critiques</div>
                    <div className="tdb-mini-kpi-card__value" style={{ color: '#DC2626' }}>
                      {countCritical}
                    </div>
                  </div>
                  <div className="tdb-mini-kpi-card" style={{ flex: 1 }}>
                    <div className="tdb-mini-kpi-card__label">Avertissements</div>
                    <div className="tdb-mini-kpi-card__value" style={{ color: '#D97706' }}>
                      {countWarning}
                    </div>
                  </div>
                  <div className="tdb-mini-kpi-card" style={{ flex: 1 }}>
                    <div className="tdb-mini-kpi-card__label">Total</div>
                    <div className="tdb-mini-kpi-card__value">{alertes.length}</div>
                  </div>
                </div>

                {/* Filter buttons */}
                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                  {[
                    { key: 'all', label: 'Toutes', count: alertes.length },
                    { key: 'critical', label: 'Critiques', count: countCritical },
                    { key: 'warning', label: 'Avertissements', count: countWarning },
                    { key: 'info', label: 'Informations', count: countInfo },
                  ].map(f => (
                    <button key={f.key}
                      className={`preset-btn ${alerteFilter === f.key ? 'active' : ''}`}
                      onClick={() => setAlerteFilter(f.key)}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>

                {/* Alert list */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {filteredAlertes.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                      Aucune alerte dans cette categorie.
                    </div>
                  ) : filteredAlertes.map((alerte, i) => {
                    const type = (alerte.type || alerte.severite || 'info').toLowerCase();
                    const isCritical = type === 'danger' || type === 'critical' || type === 'error';
                    const isWarning = type === 'attention' || type === 'warning';
                    const color = isCritical ? '#DC2626' : isWarning ? '#D97706' : '#2563EB';
                    const bgColor = isCritical ? 'rgba(220,38,38,0.04)' : isWarning ? 'rgba(217,119,6,0.04)' : 'rgba(37,99,235,0.04)';
                    const label = isCritical ? 'CRITIQUE' : isWarning ? 'ATTENTION' : 'INFO';

                    return (
                      <div key={i} style={{
                        padding: '0.75rem 1rem', background: bgColor,
                        borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.3rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              fontSize: '0.58rem', fontWeight: 800, padding: '0.15rem 0.4rem',
                              borderRadius: 4, background: color, color: '#fff', letterSpacing: '0.05em',
                            }}>{label}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {alerte.titre || alerte.title}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                            {alerte.date || alerte.createdAt ? new Date(alerte.date || alerte.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {alerte.message || alerte.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
