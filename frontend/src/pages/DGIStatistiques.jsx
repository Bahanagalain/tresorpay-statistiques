import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle, Clock,
  AlertTriangle, Building2, ChevronDown, ChevronUp,
  Search, Filter, Calendar, X, ArrowUpDown,
  ArrowUp, ArrowDown, RotateCcw, FileSpreadsheet, FileDown, Maximize, Wallet, RefreshCw
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from '../i18n/LanguageProvider';
import { usePresentMode } from '../components/layout/MainLayout';
import logoDGI from '../assets/Logo_DGI_Cameroun (1).png';
import GaugeChart    from '../components/ui/GaugeChart';
import DrillDownModal from '../components/ui/DrillDownModal';
import CommandPalette from '../components/ui/CommandPalette';
import VirtualizedTable from '../components/ui/VirtualizedTable';
import DGICartographie from '../components/dgi/DGICartographie';
import DGIFluxOTP from '../components/dgi/DGIFluxOTP';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import {
  fetchDashboard,
  fetchDgiAvis,
  lancerSynchronisation,
} from '../api/dgiAnalyticsApi';
import { invalidateCache } from '../api/cache';
import { getDateRangeFromPreset } from '../utils/dgiAnalytics';
import { usePeriodFilter, setPeriodState } from '../hooks/usePeriodFilter';
import { formatEntier, formatMontant } from '../utils/format';
import './DGIStatistiques.css';

// ─── Utilitaires ────────────────────────────────────────────
const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)} K`
  : n.toString();
const fmtFull = (n) => formatMontant(n);
const fmtEntier = (n) => formatEntier(n);

const STATUT_CONFIG = {
  PAID:    { label: 'Payé',       cls: 'orb-paid',    icon: CheckCircle   },
  PENDING: { label: 'En attente', cls: 'orb-pending',  icon: Clock         },
  OVERDUE: { label: 'En retard',  cls: 'orb-overdue',  icon: AlertTriangle },
};

const DATE_PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Ce mois',  value: 'month' },
  { label: 'Tout',     value: 'all'   },
  { label: 'Période...', value: 'custom' },
];

const EMPTY_KPI = {
  totalRecouvre: 0,
  totalAvis: 0,
  avisPayes: 0,
  avisEnAttente: 0,
  avisEnRetard: 0,
  tauxRecouvrement: 0,
  progressionMoisPrecedent: undefined,
  totalReversements: 0,
  nombreReversements: 0,
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
  default: [{ v:60 },{ v:65 },{ v:70 },{ v:68 },{ v:72 },{ v:75 },{ v:74 },{ v:78 }],
};
const SPARKLINE_COLORS = { primary:'#059669', success:'#059669', warning:'#D97706', danger:'#DC2626', default:'#6366F1' };

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
function KpiCard({ icon: Icon, label, value, numericValue, sub, variant = 'default', trend, objectif }) {
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
      {objectif !== undefined && (
        <div className="kpi-card__objectif">
          <div className="kpi-objectif__bar-track">
            <div className="kpi-objectif__bar-fill" style={{ width: `${Math.min(objectif, 100)}%`, background: sparkColor }}/>
          </div>
          <span className="kpi-objectif__label">{objectif}% objectif</span>
        </div>
      )}
      <div className="kpi-card__sparkline">
        <Sparkline data={sparkData} color={sparkColor}/>
      </div>
    </div>
  );
}

// ─── Treemap custom content ─────────────────────────────────
function TreemapCell({ x, y, width, height, name, value, color }) {
  if (width < 20 || height < 20) return null;
  return (
    <g>
      <rect x={x+1} y={y+1} width={width-2} height={height-2}
        fill={color || '#059669'}
        stroke="var(--bg-surface)"
        strokeWidth={2}
        rx={6}
        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
      />
      {width > 65 && height > 36 && (
        <>
          <text x={x+width/2} y={y+height/2-7} textAnchor="middle" fill="white" fontSize={Math.min(11, width/8)} fontWeight={600} fontFamily="Inter,sans-serif">
            {name?.length > 16 ? name.slice(0,16)+'…' : name}
          </text>
          <text x={x+width/2} y={y+height/2+9} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize={Math.min(9.5, width/10)} fontFamily="Inter,sans-serif">
            {fmt(value)} FCFA
          </text>
        </>
      )}
    </g>
  );
}

// ─── Sort icon ───────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={13} className="sort-icon neutral"/>;
  return sortDir === 'asc'
    ? <ArrowUp size={13} className="sort-icon active"/>
    : <ArrowDown size={13} className="sort-icon active"/>;
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
export default function DGIStatistiques() {
  const { t } = useTranslation();
  const { dgiTabOverride, slideshowActive, slideshowDateRange } = usePresentMode();
  const [search, setSearch]           = useState('');
  const [filterStatut, setFilter]     = useState('TOUS');
  const [filterCDI, setFilterCDI]     = useState('TOUS');
  const { state: periodState } = usePeriodFilter();
  const datePreset = periodState.preset;
  const customStartDate = periodState.customStart;
  const customEndDate = periodState.customEnd;
  const setDatePreset = (v) => setPeriodState({ preset: v });
  const setCustomStartDate = (v) => setPeriodState({ preset: 'custom', customStart: v });
  const setCustomEndDate = (v) => setPeriodState({ preset: 'custom', customEnd: v });
  const [sortCol, setSortCol]         = useState(null);
  const [sortDir, setSortDir]         = useState('asc');
  const [activeCDI, setActiveCDI]     = useState(null);
  const [drillCDI, setDrillCDI]       = useState(null);
  const [cmdOpen, setCmdOpen]         = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab]     = useState('overview');

  // Sync tab when presentation mode changes the DGI tab
  useEffect(() => {
    if (dgiTabOverride) setActiveTab(dgiTabOverride);
  }, [dgiTabOverride]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [kpiGlobal, setKpiGlobal]     = useState(EMPTY_KPI);
  const [chartEvol, setChartEvol]     = useState([]);
  const [chartCdi, setChartCdi]       = useState([]);
  const [chartCommune, setChartCommune] = useState([]);
  const [chartTree, setChartTree]     = useState([]);
  const [regionTelemetry, setRegionTelemetry] = useState([]);
  const [avisResponse, setAvisResponse] = useState({
    data: [],
    meta: { totalItems: 0, totalPages: 0, currentPage: 1 },
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const manualDateRange = useMemo(
    () => getDateRangeFromPreset(datePreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, datePreset],
  );

  const dateRange = useMemo(
    () => (slideshowActive ? (slideshowDateRange || {}) : manualDateRange),
    [manualDateRange, slideshowActive, slideshowDateRange],
  );

  const effectiveCdi = activeCDI || (filterCDI !== 'TOUS' ? filterCDI : undefined);

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
    return DATE_PRESETS.find((preset) => preset.value === datePreset)?.label || 'Tout';
  }, [customEndDate, customStartDate, datePreset, slideshowActive, slideshowDateRange]);

  const handleCDIClick = useCallback((data) => {
    if (!data?.activePayload) return;
    const cdi = data.activePayload[0]?.payload?.centre;
    if (!cdi) return;
    setDrillCDI(cdi);
    setActiveCDI(cdi);
  }, []);

  const handleExpand = (e) => {
    const card = e.currentTarget.closest('.chart-card, .dgd-chart-card');
    if (!card) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error(err));
    } else {
      card.requestFullscreen().catch(err => console.error(err));
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setFilter('TOUS');
    setFilterCDI('TOUS');
    setPeriodState({ preset: 'all', customStart: '', customEnd: '' });
    setActiveCDI(null);
    setDrillCDI(null);
    setSortCol(null);
    setSortDir('asc');
    toast.success('Tous les filtres réinitialisés');
  };

  const hasActiveFilters = search || filterStatut !== 'TOUS' || filterCDI !== 'TOUS' || activeCDI;

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const registreListRef = useRef(null);

  const toggleAvisRow = useCallback((index) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    if (registreListRef.current?.resetAfterIndex) {
      registreListRef.current.resetAfterIndex(index);
    }
  }, []);

  useEffect(() => {
    setExpandedRows(new Set());
    if (registreListRef.current?.resetAfterIndex) {
      registreListRef.current.resetAfterIndex(0);
    }
  }, [search, filterStatut, filterCDI, sortCol, sortDir, dateRange.startDate, dateRange.endDate]);


  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError('');

      try {
        const dashboard = await fetchDashboard(dateRange, controller.signal);

        if (!isMounted) return;

        setKpiGlobal(dashboard.kpi);
        setChartEvol(dashboard.evolution);
        setChartCdi(dashboard.cdi);
        setChartTree(dashboard.taxes);
        setChartCommune(dashboard.communes);
        setRegionTelemetry(dashboard.regions);
      } catch (error) {
        if (!isMounted || error?.name === 'AbortError') return;
        setAnalyticsError(error?.message || 'Impossible de charger les analytics DGI.');
      } finally {
        if (isMounted) {
          setAnalyticsLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [dateRange.endDate, dateRange.startDate, reloadNonce]);

  // Load ALL avis once per date range — filtering/sorting done client-side
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadAllAvis() {
      setTableLoading(true);
      try {
        const response = await fetchDgiAvis({
          ...dateRange,
          page: 1,
          limit: 0, // 0 = unlimited — single request for all data
        }, controller.signal);
        if (!isMounted) return;
        setAvisResponse({ data: response.data, meta: { totalItems: response.data.length, totalPages: 1, currentPage: 1 } });
      } catch (error) {
        if (!isMounted || error?.name === 'AbortError') return;
        toast.error(error?.message || 'Impossible de charger le registre DGI.');
        setAvisResponse({ data: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1 } });
      } finally {
        if (isMounted) setTableLoading(false);
      }
    }

    loadAllAvis();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [dateRange.endDate, dateRange.startDate, reloadNonce]);

  // Client-side filtering + sorting (no server round-trip per keystroke)
  const avisPage = useMemo(() => {
    let rows = [...avisResponse.data];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(a =>
        (a.numero || '').toLowerCase().includes(q) ||
        (a.contribuable || '').toLowerCase().includes(q) ||
        (a.nui || '').toLowerCase().includes(q)
      );
    }
    if (filterStatut !== 'TOUS') {
      rows = rows.filter(a => a.statut === filterStatut);
    }
    if (effectiveCdi) {
      rows = rows.filter(a => a.centre === effectiveCdi);
    }
    if (sortCol) {
      rows.sort((a, b) => {
        let va = a[sortCol];
        let vb = b[sortCol];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va === vb) return 0;
        return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
      });
    }
    return rows;
  }, [avisResponse.data, search, filterStatut, effectiveCdi, sortCol, sortDir]);

  const centreCDIs = useMemo(
    () => ['TOUS', ...new Set(chartCdi.map((item) => item.centre).filter(Boolean))],
    [chartCdi],
  );

  const evolutionLabel = useMemo(() => {
    if (chartEvol.length >= 2) {
      return `${chartEvol[0].mois} – ${chartEvol[chartEvol.length - 1].mois}`;
    }
    return periodLabel;
  }, [chartEvol, periodLabel]);

  const recoveryGap = useMemo(
    () => Math.max(0, 90 - Number(kpiGlobal.tauxRecouvrement || 0)),
    [kpiGlobal.tauxRecouvrement],
  );

  const getExportFilename = (ext) => {
    const d = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dateStr = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
    
    let periodStr = datePreset;
    if (datePreset === 'custom') {
      periodStr = `${customStartDate || 'debut'}_au_${customEndDate || 'fin'}`;
    } else {
      const preset = DATE_PRESETS.find(p => p.value === datePreset);
      if (preset) periodStr = preset.label.replace(/[' ]/g, '_');
    }
    
    return `TresorAnalytics_DGI_${periodStr}_${dateStr}.${ext}`;
  };

  // Data already loaded and filtered in avisPage — no extra fetch needed
  const loadAllAvisForExport = useCallback(async () => avisPage, [avisPage]);

  // Force une synchronisation des avis depuis le backend distant DGI, puis
  // vide le cache et recharge les données affichées (KPI, graphiques, registre).
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading('Synchronisation des données DGI en cours…');
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
      invalidateCache();                 // purge le cache analytics → refetch de données fraîches
      setReloadNonce((value) => value + 1); // déclenche le rechargement des effets de données
      const nb = res?.count ?? 0;
      toast.success(`Données actualisées — ${fmtEntier(nb)} avis synchronisés.`, { id: toastId });
    } catch (error) {
      toast.error(error?.message || 'Échec de la synchronisation des données.', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportPDF = async () => {
    setExportLoading(true);
    const toastId = toast.loading('Génération du rapport PDF structuré…');
    try {
      const avisList = await loadAllAvisForExport();
      const dataForPdf = {
        title: 'Rapport Analytique DGI',
        kpi: kpiGlobal,
        avisList,
      };
      await exportToPDF(dataForPdf, getExportFilename('pdf'));
      toast.success('Rapport PDF structuré exporté avec succès !', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de l\'export PDF', { id: toastId });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    const toastId = toast.loading('Préparation de l’export Excel…');
    const headers = ['N° Avis', 'Contribuable', 'NUI', 'Centre CDI', 'Montant Total', 'Statut', 'Date Création'];
    try {
      const avisList = await loadAllAvisForExport();
      const data = avisList.map(a => [a.numero, a.contribuable, a.nui, a.centre, a.montantTotal, a.statut, a.dateCreation]);
      exportToExcel(data, headers, 'DGI Avis', getExportFilename('xlsx'));
      toast.success('Export Excel téléchargé !', { id: toastId });
    } catch (error) {
      toast.error(error?.message || 'Erreur lors de l’export Excel', { id: toastId });
    }
  };

  return (
    <div className="dgi-page animate-fade-in" id="dgi-report-content">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }}/>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        avisItems={avisResponse.data}
        cdiItems={chartCdi}
      />

      {drillCDI && (
        <DrillDownModal
          cdi={drillCDI}
          dateRange={dateRange}
          onClose={() => { setDrillCDI(null); setActiveCDI(null); }}
        />
      )}

      <div className="dgi-page__header">
        <div className="header-left">
          <div>
            <h1 className="dgi-page__title">{t('dgi.title')}</h1>
            <p className="dgi-page__sub">{t('dgi.subtitle')}</p>
          </div>
        </div>
        <div className="header-right">
          <div className="date-presets">
            <Calendar size={14}/>
            {DATE_PRESETS.map(p => (
              <button key={p.value} onClick={() => setDatePreset(p.value)} className={`preset-btn ${datePreset === p.value ? 'active' : ''}`}>{p.label}</button>
            ))}
            {datePreset === 'custom' && (
              <div className="custom-date-picker animate-fade-in" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginLeft: '0.5rem' }}>
                <input type="date" className="preset-btn" style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>à</span>
                <input type="date" className="preset-btn" style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
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
            title="Récupérer immédiatement les derniers avis depuis le backend DGI (sans attendre la synchronisation automatique)"
          >
            <RefreshCw size={14} className={syncing ? 'dgi-sync-spin' : ''}/>
            {syncing ? 'Synchronisation…' : 'Actualiser les données'}
          </button>
          <button className="action-btn outline" onClick={handleExportExcel}>
            <FileSpreadsheet size={14}/> Excel
          </button>
          <button className="action-btn primary" onClick={handleExportPDF} disabled={exportLoading}>
            <FileDown size={14}/> {exportLoading ? 'Export…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {analyticsError && (
        <div className="active-filters-bar" style={{ borderColor: 'rgba(220,38,38,0.2)', color: '#DC2626' }}>
          <span className="af-label" style={{ color: '#DC2626' }}>
            <AlertTriangle size={12}/> {analyticsError}
          </span>
          <button className="af-reset" onClick={() => setReloadNonce((value) => value + 1)}>
            <RotateCcw size={12}/> Réessayer
          </button>
        </div>
      )}

      {hasActiveFilters && (
        <div className="active-filters-bar animate-slide-up">
          <span className="af-label"><Filter size={12}/> Filtres actifs :</span>
          {search      && <span className="af-chip">Recherche: &ldquo;{search}&rdquo; <button onClick={() => setSearch('')}><X size={10}/></button></span>}
          {filterStatut !== 'TOUS' && <span className="af-chip">Statut: {filterStatut} <button onClick={() => setFilter('TOUS')}><X size={10}/></button></span>}
          {filterCDI !== 'TOUS'    && <span className="af-chip">CDI: {filterCDI} <button onClick={() => setFilterCDI('TOUS')}><X size={10}/></button></span>}
          {activeCDI               && <span className="af-chip af-chip--cross">Graphique: {activeCDI} <button onClick={() => { setActiveCDI(null); setDrillCDI(null); }}><X size={10}/></button></span>}
          <button className="af-reset" onClick={resetAllFilters}><RotateCcw size={12}/> Tout effacer</button>
        </div>
      )}

      <div className="module-tabs-wrapper">
        <div className="module-tabs">
          <button className={`module-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>{t('dgi.tabs.overview')}</button>
          <button className={`module-tab ${activeTab === 'cdi' ? 'active' : ''}`} onClick={() => setActiveTab('cdi')}>{t('dgi.tabs.cdiAnalysis')}</button>
          <button className={`module-tab ${activeTab === 'taxes' ? 'active' : ''}`} onClick={() => setActiveTab('taxes')}>{t('dgi.tabs.taxDist')}</button>

          <button className={`module-tab ${activeTab === 'flux' ? 'active' : ''}`} onClick={() => setActiveTab('flux')}>{t('dgi.tabs.monitoringOtp')}</button>
          <button className={`module-tab ${activeTab === 'registre' ? 'active' : ''}`} onClick={() => setActiveTab('registre')}>{t('dgi.tabs.registry')}</button>
        </div>
      </div>

      <div className="tab-content-area">
        {activeTab === 'flux' && (
          <div className="tab-pane animate-fade-in">
            <DGIFluxOTP />
          </div>
        )}


        {activeTab === 'overview' && (
          <div className="tab-pane animate-fade-in">
            <div className="kpi-grid" style={{ flexShrink: 0 }}>
              <KpiCard icon={TrendingUp} label={t('dgi.kpi.totalRecovered')} value={fmtFull(kpiGlobal.totalRecouvre)} numericValue={kpiGlobal.totalRecouvre} sub={analyticsLoading ? t('loading') : t('dgi.kpi.selectedPeriod')} variant="primary" trend={kpiGlobal.progressionMoisPrecedent} objectif={Math.round((kpiGlobal.totalRecouvre / 1_500_000_000) * 100)} />
              <KpiCard icon={FileText} label={t('dgi.kpi.totalNotices')} value={fmtEntier(kpiGlobal.totalAvis)} numericValue={kpiGlobal.totalAvis} sub={analyticsLoading ? t('loading') : t('dgi.kpi.selectedPeriod')} variant="default" />
              <KpiCard icon={CheckCircle} label={t('dgi.kpi.paidNotices')} value={fmtEntier(kpiGlobal.avisPayes)} numericValue={kpiGlobal.avisPayes} sub={fmtFull(kpiGlobal.totalRecouvre)} variant="success" />
              <KpiCard icon={Clock} label={t('dgi.kpi.pending')} value={fmtEntier(kpiGlobal.avisEnAttente)} numericValue={kpiGlobal.avisEnAttente} sub={t('dgi.kpi.selectedPeriod')} variant="warning" />
              <KpiCard icon={Wallet} label={t('dgi.kpi.amountReversed')} value={fmtFull(kpiGlobal.totalReversements)} numericValue={kpiGlobal.totalReversements} sub={analyticsLoading ? t('loading') : `${fmtEntier(kpiGlobal.nombreReversements)} ${t('dgi.kpi.reversalsCount')}`} variant="success" />
              <KpiCard icon={TrendingUp} label={t('dgi.kpi.recoveryRate')} value={`${kpiGlobal.tauxRecouvrement}%`} numericValue={kpiGlobal.tauxRecouvrement} sub={t('dgi.kpi.objective90')} variant="default" objectif={Math.round(kpiGlobal.tauxRecouvrement)} />
            </div>

            <div className="charts-row charts-row--3-1">
              <div className="chart-card" data-glow="blue">
                <div className="chart-card__header">
                  <div>
                    <h2 className="chart-title">{t('dgi.charts.weeklyEvolution')}</h2>
                    <span className="chart-sub">{evolutionLabel}</span>
                  </div>
                  <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir ce graphique"><Maximize size={16}/></button>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartEvol} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gpaid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.3}/><stop offset="95%" stopColor="#059669" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gattente" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.3}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gretard" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/><stop offset="95%" stopColor="#DC2626" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }}/>
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Legend/>
                    <Area type="monotone" dataKey="paye" name="Payé" stroke="#059669" fill="url(#gpaid)" strokeWidth={2} isAnimationActive animationDuration={1400}/>
                    <Area type="monotone" dataKey="enAttente" name="En attente" stroke="#D97706" fill="url(#gattente)" strokeWidth={2} isAnimationActive animationDuration={1600}/>
                    <Area type="monotone" dataKey="enRetard" name="En retard" stroke="#DC2626" fill="url(#gretard)" strokeWidth={2} isAnimationActive animationDuration={1800}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card gauge-card" data-glow="green">
                <div className="chart-card__header">
                  <h2 className="chart-title">{t('dgi.charts.recoveryGauge')}</h2>
                  <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir ce graphique"><Maximize size={16}/></button>
                </div>
                <div className="gauge-center">
                  <GaugeChart value={kpiGlobal.tauxRecouvrement} max={100} label="Recouvrement" color="#059669" size={200} thickness={18}/>
                </div>
                <div className="gauge-legend">
                  <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#DC2626' }}/> &lt;50% Critique</div>
                  <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#D97706' }}/> 50–74% Attention</div>
                  <div className="gauge-legend-item"><span className="gauge-dot" style={{ background:'#059669' }}/> ≥75% Objectif</div>
                </div>
                <div className="gauge-target">
                  Objectif : 90% — Écart :{' '}
                  <strong style={{ color: recoveryGap > 0 ? '#D97706' : '#059669' }}>
                    {recoveryGap > 0 ? `+${recoveryGap.toFixed(1)} pts nécessaires` : 'Objectif atteint'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cdi' && (
          <div className="tab-pane animate-fade-in">
            <div className="charts-row">
              <div className={`chart-card chart-card--large ${activeCDI ? 'chart-card--filtered' : ''}`} data-glow="blue">
                <div className="chart-card__header">
                  <div>
                    <h2 className="chart-title">{t('dgi.charts.cdiRecovery')}</h2>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                      {activeCDI && (
                        <button className="cross-filter-badge" onClick={() => { setActiveCDI(null); setDrillCDI(null); }}>
                          <X size={10}/> {activeCDI}
                        </button>
                      )}
                      <span className="chart-sub">Cliquez pour voir le détail</span>
                    </div>
                  </div>
                  <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir ce graphique"><Maximize size={16}/></button>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(300, chartCdi.length * 32)}>
                  <BarChart data={chartCdi} layout="vertical" margin={{ left: 20, right: 20 }} onClick={handleCDIClick} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                    <XAxis type="number" tickFormatter={fmtFull} tick={{ fontSize: 10 }}/>
                    <YAxis type="category" dataKey="centre" width={160} tick={{ fontSize: 10 }}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="montant" name="Montant recouvré" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1200} animationBegin={200}>
                      {chartCdi.map((entry, i) => (
                        <Cell key={entry.centre || i} fill={activeCDI && activeCDI !== entry.centre ? 'var(--bg-surface-elevated)' : `hsl(${160 + i * 12}, 65%, ${40 + i * 2}%)`}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card" data-glow="blue">
                <div className="chart-card__header">
                  <div>
                    <h2 className="chart-title">{t('dgi.charts.statusDist')}</h2>
                    <span className="chart-sub">{kpiGlobal.totalAvis} avis au total</span>
                  </div>
                  <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir ce graphique"><Maximize size={16}/></button>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name:'Payé', value:kpiGlobal.avisPayes, fill:'#059669' },
                        { name:'En attente', value:kpiGlobal.avisEnAttente, fill:'#D97706' },
                        { name:'En retard', value:kpiGlobal.avisEnRetard, fill:'#DC2626' },
                      ]}
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
                      {[{fill:'#059669'},{fill:'#D97706'},{fill:'#DC2626'}].map((entry, index) => <Cell key={index} fill={entry.fill}/>)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} avis`, '']}/>
                    <Legend/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  <div className="pie-legend-item"><span className="dot dot-green"/> Payés: <strong>{kpiGlobal.avisPayes}</strong></div>
                  <div className="pie-legend-item"><span className="dot dot-yellow"/> En attente: <strong>{kpiGlobal.avisEnAttente}</strong></div>
                  <div className="pie-legend-item"><span className="dot dot-red"/> En retard: <strong>{kpiGlobal.avisEnRetard}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'taxes' && (
          <div className="tab-pane animate-fade-in">
            <div className="charts-row">
              <div className="chart-card chart-card--large" data-glow="blue">
                <div className="chart-card__header">
                  <div>
                    <h2 className="chart-title">Répartition par Type de Taxe — Treemap</h2>
                    <span className="chart-sub">Surface proportionnelle au montant</span>
                  </div>
                  <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir ce graphique"><Maximize size={16}/></button>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                  <Treemap
                    data={chartTree}
                    dataKey="size"
                    aspectRatio={4/3}
                    stroke="var(--bg-surface)"
                    content={<TreemapCell />}
                    animationDuration={1500}
                  >
                    <Tooltip formatter={(value, _, payload) => [`${fmtFull(value)} · ${payload?.payload?.count || 0} avis`, payload?.payload?.type || payload?.payload?.name]}/>
                  </Treemap>
                </ResponsiveContainer>
              </div>

              <div className="chart-card" data-glow="blue">
                <div className="chart-card__header">
                  <div>
                    <h2 className="chart-title"><Building2 size={16}/> Communes Bénéficiaires</h2>
                    <span className="chart-sub">Ventilation par commune</span>
                  </div>
                  <button className="expand-graph-btn" onClick={handleExpand} title="Agrandir ce graphique"><Maximize size={16}/></button>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(300, chartCommune.length * 30)}>
                  <BarChart data={chartCommune} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                    <XAxis type="number" tickFormatter={fmtFull} tick={{ fontSize: 10 }}/>
                    <YAxis type="category" dataKey="commune" width={220} tick={{ fontSize: 10 }}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="montant" name="Montant" radius={[0,4,4,0]} isAnimationActive animationDuration={1400} animationBegin={400}>
                      {chartCommune.map((item, index) => <Cell key={item.commune || index} fill={`hsl(${190 + index * 8},60%,45%)`}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'registre' && (
          <div className="tab-pane animate-fade-in">
            <div className="registre-section" data-glow="green">
              <div className="registre-header">
                <h2 className="chart-title">Registre des Avis d'Imposition</h2>
                <div className="registre-controls">
                  <div className="search-box">
                    <Search size={14}/>
                    <input className="search-input" placeholder="Rechercher numéro, nom, NUI..." value={search} onChange={(e) => setSearch(e.target.value)}/>
                    {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12}/></button>}
                  </div>
                  <div className="filter-group">
                    <Filter size={13}/>
                    <select className="filter-select" value={filterStatut} onChange={(e) => setFilter(e.target.value)}>
                      <option value="TOUS">Tous statuts</option>
                      <option value="PAID">Payé</option>
                      <option value="PENDING">En attente</option>
                      <option value="OVERDUE">En retard</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <Building2 size={13}/>
                    <select className="filter-select" value={filterCDI} onChange={(e) => setFilterCDI(e.target.value)}>
                      {centreCDIs.map((centre) => <option key={centre} value={centre}>{centre}</option>)}
                    </select>
                  </div>
                  {hasActiveFilters && <button className="action-btn outline reset-btn" onClick={resetAllFilters}><RotateCcw size={13}/> Reset</button>}
                </div>
              </div>

              <div className="table-wrapper">
                {tableLoading ? (
                  <div className="empty-state" style={{ padding: '2.5rem' }}>
                    <p>Chargement du registre…</p>
                  </div>
                ) : (
                  <VirtualizedTable
                    ref={registreListRef}
                    columns={[
                      { key: 'rowIndex', label: 'N°', width: '56px',
                        render: (_, i) => <span className="col-index">{i + 1}</span> },
                      { key: 'numero', label: 'N° Avis', width: '1.1fr', sortable: true,
                        render: (a) => <span className="avis-numero">{a.numero}</span> },
                      { key: 'contribuable', label: 'Contribuable', width: '1.6fr', sortable: true,
                        render: (a) => (
                          <div>
                            <div>{a.contribuable}</div>
                            <span className="avis-nui">{a.nui}</span>
                          </div>
                        ) },
                      { key: 'centre', label: 'Centre CDI', width: '1.2fr',
                        render: (a) => <span className="centre-badge">{a.centre}</span> },
                      { key: 'montantTotal', label: 'Montant', width: '1.1fr', sortable: true, align: 'right',
                        render: (a) => <span className="avis-montant">{fmtFull(a.montantTotal)}</span> },
                      { key: 'statut', label: 'Statut', width: '120px', sortable: true,
                        render: (a) => {
                          const cfg = STATUT_CONFIG[a.statut];
                          const Icon = cfg.icon;
                          return <span className={`statut-orb ${cfg.cls}`}><Icon size={11}/> {cfg.label}</span>;
                        } },
                      { key: 'dateCreation', label: 'Date', width: '1fr', sortable: true, align: 'right',
                        render: (a) => <span className="avis-date">{a.dateCreation}</span> },
                      { key: 'expand', label: '', width: '44px',
                        render: (_, i) => expandedRows.has(i)
                          ? <ChevronUp size={15}/>
                          : <ChevronDown size={15}/> },
                    ]}
                    rows={avisPage}
                    rowHeight={56}
                    height={Math.min(avisPage.length * 56 + 48, 640)}
                    onSort={handleSort}
                    sortCol={sortCol}
                    sortDir={sortDir}
                    isExpanded={(i) => expandedRows.has(i)}
                    onRowClick={(i) => toggleAvisRow(i)}
                    getItemHeight={(i) => {
                      if (!expandedRows.has(i)) return 56;
                      const imps = avisPage[i]?.imputations?.length || 0;
                      return 56 + 80 + Math.max(imps, 1) * 32;
                    }}
                    renderExpanded={(avis) => (
                      <div className="imputations-panel">
                        <p className="imputations-title">Imputations — {avis.imputations.length} ligne(s)</p>
                        <table className="imputations-table">
                          <thead><tr><th>Code</th><th>Libellé</th><th>Bénéficiaire</th><th className="text-right">Montant</th></tr></thead>
                          <tbody>
                            {avis.imputations.map((imp, i) => (
                              <tr key={i}>
                                <td><code className="code-fiscal">{imp.code}</code></td>
                                <td>{imp.libelle}</td>
                                <td className="beneficiaire-cell">{imp.beneficiaire}</td>
                                <td className="text-right imp-montant">{fmtFull(imp.montant)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    emptyMessage={
                      <div className="empty-state">
                        <Search size={32}/>
                        <p>Aucun avis ne correspond aux filtres sélectionnés.</p>
                        <button className="action-btn outline" onClick={resetAllFilters}><RotateCcw size={13}/> Effacer les filtres</button>
                      </div>
                    }
                  />
                )}
              </div>

              <div className="table-footer">
                <span>{avisResponse.data.length} {t('dgi.registry.totalDisplayed')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
