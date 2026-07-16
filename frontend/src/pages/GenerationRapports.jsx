import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileBarChart, FileText, Table as TableIcon, Download, Search, X,
  Building2, Map, Target, Users, Clock, Trash2,
  CheckSquare, Square, PieChart, Filter, ChevronRight, ChevronLeft,
  BarChart3, Eye, EyeOff, Plus, Image,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n/LanguageProvider';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import ChartBuilder, { ChartPreview } from '../components/ui/ChartBuilder';
import { REPORT_SUBJECTS, FORMAT_OPTIONS } from '../utils/reportTemplates';
import { buildReport, buildStandardReport, fetchSubjectData, captureCharts } from '../utils/reportBuilder';
import { formatEntier, formatMontant } from '../utils/format';
import './GenerationRapports.css';

const ICON_MAP = { Building2, Map, Users, Target, FileText, PieChart };
const FORMAT_ICON = { pdf: FileText, excel: TableIcon, charts: Image };

const fmtVal = (v, type) => {
  if (v == null) return '—';
  if (type === 'amount') return formatMontant(v);
  if (type === 'percent') return v + '%';
  if (type === 'number') return formatEntier(v);
  return String(v);
};

// ─── Step definitions per format (function, uses t()) ────────
const getStepsByFormat = (t) => ({
  pdf: [
    { id: 1, label: t('reports.steps.data'), desc: t('reports.steps.dataDesc'), icon: Filter },
    { id: 2, label: t('reports.steps.layout'), desc: t('reports.steps.previewDescPdf'), icon: FileText },
    { id: 3, label: t('reports.steps.preview'), desc: t('reports.steps.exportOptionsDesc'), icon: Download },
  ],
  excel: [
    { id: 1, label: t('reports.steps.data'), desc: t('reports.steps.dataDesc'), icon: Filter },
    { id: 2, label: t('reports.steps.excelOptions'), desc: t('reports.steps.excelOptionsDesc'), icon: TableIcon },
    { id: 3, label: t('reports.steps.preview'), desc: t('reports.steps.previewDescExcel'), icon: Download },
  ],
  charts: [
    { id: 1, label: t('reports.steps.data'), desc: t('reports.steps.dataDesc'), icon: Filter },
    { id: 2, label: t('reports.steps.charts'), desc: t('reports.steps.chartsDesc'), icon: BarChart3 },
    { id: 3, label: t('reports.steps.exportOptions'), desc: t('reports.steps.exportOptionsDesc'), icon: Download },
  ],
});

// ─── Period presets (function, uses t()) ─────────────────────
const getPeriodPresets = (t) => [
  { id: 'today', label: t('today'), get: () => { const d = new Date().toISOString().slice(0, 10); return [d, d]; } },
  { id: 'month', label: t('thisMonth'), get: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10), n.toISOString().slice(0, 10)]; } },
  { id: 'all', label: t('all'), get: () => ['', ''] },
  { id: 'custom', label: t('custom'), get: () => null },
];

// ─── StepBar ─────────────────────────────────────────────────
function StepBar({ steps, step, onStep }) {
  return (
    <div className="rg-stepbar">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isActive = step === s.id;
        const isDone = step > s.id;
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <div className={`rg-step-line ${isDone ? 'done' : ''}`} />}
            <button
              className={`rg-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              onClick={() => isDone && onStep(s.id)}
            >
              <span className="rg-step-num">{isDone ? '✓' : s.id}</span>
              <Icon size={13} />
              <span className="rg-step-label">{s.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Step Breadcrumb ─────────────────────────────────────────
function StepBreadcrumb({ steps, step, stepWord }) {
  const current = steps.find(s => s.id === step);
  if (!current) return null;
  return (
    <div className="rg-breadcrumb">
      <span className="rg-bc-step">{stepWord} {step} / {steps.length}</span>
      <span className="rg-bc-sep">—</span>
      <span className="rg-bc-desc">{current.desc}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
// ─── Standard Report Templates ──────────────────────────────
const STANDARD_TEMPLATES = [
  { id: 'ministeres', icon: Building2, titleKey: 'reports.templates.cdiPerf', descKey: 'reports.templates.cdiPerfDesc', color: '#2563EB', hasEntities: true, entityLabel: 'Ministères' },
  { id: 'regions', icon: Map, titleKey: 'reports.templates.regionalSummary', descKey: 'reports.templates.regionalSummaryDesc', color: '#14B8A6', hasEntities: true, entityLabel: 'Régions' },
  { id: 'services', icon: PieChart, titleKey: 'reports.templates.fiscalDist', descKey: 'reports.templates.fiscalDistDesc', color: '#8B5CF6' },
  { id: 'domaines', icon: Target, titleKey: 'reports.templates.taxpayerAnalysis', descKey: 'reports.templates.taxpayerAnalysisDesc', color: '#EC4899' },
  { id: 'soumissions', icon: FileText, titleKey: 'reports.templates.noticeRegistry', descKey: 'reports.templates.noticeRegistryDesc', color: '#059669' },
  { id: 'partenaires', icon: Users, titleKey: 'reports.templates.taxCollection', descKey: 'reports.templates.taxCollectionDesc', color: '#D97706' },
];

function computePeriod(id) {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  switch (id) {
    case 'today': return { startDate: fmt(now), endDate: fmt(now) };
    case 'month': return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) };
    default: return {};
  }
}

function StandardReportsTab({ t, history, setHistory }) {
  const [modalTemplate, setModalTemplate] = useState(null);
  const [modalStep, setModalStep] = useState('entity'); // 'entity' | 'period'
  const [entityMode, setEntityMode] = useState('all'); // 'all' | 'select'
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [entityList, setEntityList] = useState([]);
  const [entitySearch, setEntitySearch] = useState('');
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [periodType, setPeriodType] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [generating, setGenerating] = useState(false);

  const openModal = async (tpl) => {
    setModalTemplate(tpl);
    setEntityMode('all');
    setSelectedEntities([]);
    setEntitySearch('');
    setPeriodType('today');
    setCustomStart('');
    setCustomEnd('');

    if (tpl.hasEntities) {
      setModalStep('entity');
      setLoadingEntities(true);
      try {
        const data = await fetchSubjectData(tpl.id, {});
        const nameField = REPORT_SUBJECTS.find(s => s.id === tpl.id)?.columns.find(c => c.required && c.id !== 'index')?.id;
        const names = nameField ? [...new Set(data.map(r => r[nameField]).filter(Boolean))].sort() : [];
        setEntityList(names);
      } catch { setEntityList([]); }
      finally { setLoadingEntities(false); }
    } else {
      setModalStep('period');
    }
  };

  const closeModal = () => { setModalTemplate(null); setModalStep('entity'); };

  const toggleEntity = (name) => {
    setSelectedEntities(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const dateRange = periodType === 'custom'
    ? { startDate: customStart || undefined, endDate: customEnd || undefined }
    : computePeriod(periodType);

  const handleDownload = async () => {
    if (!modalTemplate) return;
    setGenerating(true);
    const tid = toast.loading(t('reports.generating.fetching'));
    try {
      const entities = entityMode === 'select' && selectedEntities.length > 0 ? selectedEntities : null;
      const meta = await buildStandardReport(modalTemplate.id, dateRange, entities);
      const updated = [meta, ...history].slice(0, 50);
      setHistory(updated);
      localStorage.setItem('report_history', JSON.stringify(updated));
      toast.success(`${t('reports.exported')} — ${meta.nbRows} ${t('reports.rows')}`, { id: tid });
      closeModal();
    } catch (e) {
      console.error(e);
      if (e?.message === 'NO_DATA') {
        toast.error('Aucune donnée disponible pour cette sélection. Impossible de générer le rapport.', { id: tid, duration: 4000 });
      } else {
        toast.error(t('reports.generateError'), { id: tid });
      }
    } finally {
      setGenerating(false);
    }
  };

  const filteredEntities = entitySearch
    ? entityList.filter(n => n.toLowerCase().includes(entitySearch.toLowerCase()))
    : entityList;

  return (
    <div className="rg-standard">
      <p className="rg-standard-desc">{t('reports.standardDesc')}</p>

      {/* Template card grid */}
      <div className="rg-std-grid">
        {STANDARD_TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
          return (
            <div key={tpl.id} className="rg-std-card" data-glow="green" onClick={() => openModal(tpl)}>
              <div className="rg-std-card__icon" style={{ background: `${tpl.color}14`, color: tpl.color }}>
                <Icon size={26} />
              </div>
              <strong className="rg-std-card__title">{t(tpl.titleKey)}</strong>
              <span className="rg-std-card__desc">{t(tpl.descKey)}</span>
              <span className="rg-std-card__badge">PDF</span>
            </div>
          );
        })}
      </div>

      {/* ── Modal popup ── */}
      {modalTemplate && (
        <div className="rg-modal-overlay" onClick={closeModal}>
          <div className="rg-modal" onClick={e => e.stopPropagation()}>
            <div className="rg-modal__header">
              <h3>{t(modalTemplate.titleKey)}</h3>
              <button className="rg-modal__close" onClick={closeModal}><X size={18} /></button>
            </div>

            {/* Step: Entity selection */}
            {modalStep === 'entity' && modalTemplate.hasEntities && (
              <div className="rg-modal__body">
                <p className="rg-modal__question">Souhaitez-vous inclure tous les {modalTemplate.entityLabel} ou en sélectionner ?</p>
                <div className="rg-modal__entity-choice">
                  <button className={`rg-modal__choice-btn ${entityMode === 'all' ? 'active' : ''}`} onClick={() => setEntityMode('all')}>
                    Tous les {modalTemplate.entityLabel}
                  </button>
                  <button className={`rg-modal__choice-btn ${entityMode === 'select' ? 'active' : ''}`} onClick={() => setEntityMode('select')}>
                    Sélectionner
                  </button>
                </div>

                {entityMode === 'select' && (
                  <div className="rg-modal__entity-list">
                    {loadingEntities ? (
                      <div style={{ textAlign: 'center', padding: '1rem' }}><WeaveSpinner size={30} /></div>
                    ) : (
                      <>
                        <div className="rg-modal__search">
                          <Search size={13} />
                          <input placeholder="Rechercher..." value={entitySearch} onChange={e => setEntitySearch(e.target.value)} />
                        </div>
                        <div className="rg-modal__entities">
                          {filteredEntities.map(name => (
                            <label key={name} className="rg-modal__entity" onClick={() => toggleEntity(name)}>
                              {selectedEntities.includes(name) ? <CheckSquare size={14} className="rg-chk-on" /> : <Square size={14} />}
                              <span>{name}</span>
                            </label>
                          ))}
                        </div>
                        {selectedEntities.length > 0 && (
                          <div className="rg-modal__sel-count">{selectedEntities.length} sélectionné(s)</div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="rg-modal__actions">
                  <button className="rg-modal__btn secondary" onClick={closeModal}>{t('cancel')}</button>
                  <button className="rg-modal__btn primary" onClick={() => setModalStep('period')} disabled={entityMode === 'select' && selectedEntities.length === 0}>
                    Suivant <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Step: Period selection */}
            {modalStep === 'period' && (
              <div className="rg-modal__body">
                <p className="rg-modal__question">{t('reports.periodSelect')}</p>
                <div className="rg-segmented-control" style={{ marginBottom: '0.75rem' }}>
                  {[
                    { id: 'today', label: t('today') },
                    { id: 'month', label: t('thisMonth') },
                    { id: 'custom', label: t('custom') },
                  ].map(p => (
                    <button key={p.id} className={`rg-seg-btn ${periodType === p.id ? 'active' : ''}`} onClick={() => setPeriodType(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {periodType === 'custom' && (
                  <div className="rg-date-range">
                    <div className="rg-date-field">
                      <label>{t('reports.startDate')}</label>
                      <input type="date" className="rg-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                    </div>
                    <span className="rg-date-arrow">→</span>
                    <div className="rg-date-field">
                      <label>{t('reports.endDate')}</label>
                      <input type="date" className="rg-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="rg-modal__actions">
                  {modalTemplate.hasEntities && (
                    <button className="rg-modal__btn secondary" onClick={() => setModalStep('entity')}>
                      <ChevronLeft size={14} /> Retour
                    </button>
                  )}
                  {!modalTemplate.hasEntities && (
                    <button className="rg-modal__btn secondary" onClick={closeModal}>{t('cancel')}</button>
                  )}
                  <button className="rg-modal__btn primary" onClick={handleDownload} disabled={generating}>
                    {generating ? <WeaveSpinner size={16} /> : <><Download size={14} /> {t('reports.download')}</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GenerationRapports() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('standard');

  // Translated data structures
  const STEPS_BY_FORMAT = useMemo(() => getStepsByFormat(t), [t]);
  const PERIOD_PRESETS = useMemo(() => getPeriodPresets(t), [t]);

  // Format choice (before wizard)
  const [exportFormat, setExportFormat] = useState(null);
  const [step, setStep] = useState(0);

  // Data config
  const [subjectId, setSubjectId] = useState(null);
  const [selectedColumns, setSelectedColumns] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodPreset, setPeriodPreset] = useState('all');
  const [statutFilter, setStatutFilter] = useState('TOUS');
  const [entityFilter, setEntityFilter] = useState([]);
  const [entityFilterEnabled, setEntityFilterEnabled] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');

  // Charts (for "charts" format only)
  const [charts, setCharts] = useState([]);

  // PDF options
  const [orientation, setOrientation] = useState('landscape');
  const [institutional, setInstitutional] = useState(true);
  const [title, setTitle] = useState('');
  const [pdfSections, setPdfSections] = useState({});

  // Excel options
  const [excelSheets, setExcelSheets] = useState({ raw: true, recap: true, pivot: false });
  const [excelFormulas, setExcelFormulas] = useState(true);

  // Charts-only export options
  const [chartsExportFormat, setChartsExportFormat] = useState('pdf');
  const [chartsBgDark, setChartsBgDark] = useState(false);
  const [chartsIncludeTitle, setChartsIncludeTitle] = useState(true);
  const [chartsSize, setChartsSize] = useState('a4');

  // Data & state
  const [allRows, setAllRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');
  const [previewVisible, setPreviewVisible] = useState(true);

  // History
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('report_history') || '[]'); } catch { return []; }
  });

  const subject = REPORT_SUBJECTS.find(s => s.id === subjectId);
  const steps = exportFormat ? STEPS_BY_FORMAT[exportFormat] : [];

  // Init columns/sections when subject changes
  useEffect(() => {
    if (!subject) return;
    const cols = {};
    subject.columns.forEach(c => { cols[c.id] = c.required || c.default || false; });
    setSelectedColumns(cols);
    const secs = {};
    (subject.pdfSections || []).forEach(s => { secs[s.id] = s.default || false; });
    setPdfSections(secs);
    setCharts([]);
    setTitle(subject.name);
    setEntityFilter([]);
    setEntityFilterEnabled(false);
  }, [subjectId]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!subject) return;
    setDataLoading(true);
    try {
      const rows = await fetchSubjectData(subject.id, { startDate, endDate, statutFilter });
      setAllRows(rows);
    } catch { setAllRows([]); }
    finally { setDataLoading(false); }
  }, [subject, startDate, endDate, statutFilter]);

  useEffect(() => { if (subject) fetchData(); }, [fetchData]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!entityFilterEnabled || entityFilter.length === 0) return allRows;
    const nf = subject?.columns?.find(c => c.required && c.id !== 'index')?.id;
    return nf ? allRows.filter(r => entityFilter.includes(r[nf])) : allRows;
  }, [allRows, entityFilterEnabled, entityFilter, subject]);

  // Entity names
  const entityNames = useMemo(() => {
    if (!subject || !allRows.length) return [];
    const nf = subject.columns.find(c => c.required && c.id !== 'index')?.id;
    if (!nf) return [];
    const names = [...new Set(allRows.map(r => r[nf]).filter(Boolean))].sort();
    return entitySearch ? names.filter(n => n.toLowerCase().includes(entitySearch.toLowerCase())) : names;
  }, [subject, allRows, entitySearch]);

  const activeCols = subject ? subject.columns.filter(c => c.required || selectedColumns[c.id]) : [];
  const activeSections = Object.entries(pdfSections).filter(([_, v]) => v).map(([k]) => k);
  const validCharts = charts.filter(c => c.type && (c.type === 'kpi_cards' || (c.xKey && c.yKey)));

  const toggleCol = (id) => setSelectedColumns(p => ({ ...p, [id]: !p[id] }));
  const toggleSection = (id) => setPdfSections(p => ({ ...p, [id]: !p[id] }));
  const toggleEntity = (name) => setEntityFilter(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]);

  const handlePeriodPreset = (preset) => {
    setPeriodPreset(preset.id);
    if (preset.id !== 'custom') {
      const [s, e] = preset.get();
      setStartDate(s);
      setEndDate(e);
    }
  };

  const handleSelectFormat = (fmtId) => {
    setExportFormat(fmtId);
    setStep(1);
    setSubjectId(null);
    setCharts([]);
    setAllRows([]);
  };

  // Navigation
  const canNext = () => {
    if (step === 1) return !!subjectId && (filteredRows.length > 0 || dataLoading) && activeCols.length > 0;
    if (step === 2 && exportFormat === 'charts') return validCharts.length > 0;
    return true;
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // Generate
  const handleGenerate = async () => {
    if (!subject) return;
    setGenerating(true);
    setGenerateProgress(t('reports.generating.fetching'));
    const tid = toast.loading(t('reports.generating.building'));
    try {
      let chartImages = [];
      if (exportFormat === 'charts' && validCharts.length > 0) {
        setGenerateProgress(t('reports.generating.building'));
        chartImages = await captureCharts(validCharts.map((_, i) => `report-chart-${i}`));
      }
      setGenerateProgress(t('reports.generating.finalizing'));
      const meta = await buildReport({
        format: exportFormat,
        title,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        orientation,
        institutional,
        statutFilter,
        selectedColumns: Object.entries(selectedColumns).filter(([_, v]) => v).map(([k]) => k),
        pdfSections: activeSections,
        chartsExportFormat,
        chartsBgDark,
        chartsIncludeTitle,
        chartsSize,
        excelSheets,
        excelFormulas,
      }, subject, filteredRows, chartImages);
      const updated = [meta, ...history].slice(0, 50);
      setHistory(updated);
      localStorage.setItem('report_history', JSON.stringify(updated));
      toast.success(`${t('reports.exported')} — ${meta.nbRows} ${t('reports.rows')}${meta.nbCharts ? `, ${meta.nbCharts} ${t('reports.chartCount')}` : ''}`, { id: tid });
    } catch (e) {
      console.error(e);
      toast.error(t('reports.generateError'), { id: tid });
    } finally {
      setGenerating(false);
      setGenerateProgress('');
    }
  };

  const resetAll = () => {
    setStep(0); setExportFormat(null); setSubjectId(null);
    setCharts([]); setAllRows([]);
    setStartDate(''); setEndDate(''); setPeriodPreset('all');
  };

  // Next button label per format
  const nextLabel = () => {
    if (step === 1) return steps[1]?.label || t('reports.steps.data');
    if (step === 2) return steps[2]?.label || t('reports.steps.data');
    return t('reports.steps.data');
  };

  return (
    <div className="page-container report-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title"><FileBarChart size={24} /> {t('reports.title')}</h1>
        <p className="page-subtitle">{t('reports.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="cdi-tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`cdi-tab ${activeTab === 'standard' ? 'active' : ''}`} onClick={() => setActiveTab('standard')}>
          <FileText size={14} /> {t('reports.standardReports')}
        </button>
        <button className={`cdi-tab ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}>
          <FileBarChart size={14} /> {t('reports.createReport')}
        </button>
        <button className={`cdi-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <Clock size={14} /> {t('reports.history')} {history.length > 0 && <span className="tab-badge">{history.length}</span>}
        </button>
      </div>

      {/* ═══════════ STANDARD REPORTS ═══════════ */}
      {activeTab === 'standard' && (
        <StandardReportsTab t={t} history={history} setHistory={setHistory} />
      )}

      {/* ═══════════ BUILDER ═══════════ */}
      {activeTab === 'builder' && (
        <div className="rg-wizard">
          {/* ── Step 0: Format ── */}
          {step === 0 && (
            <div className="rg-wiz-step rg-slide-in">
              <h2 className="rg-wiz-question">{t('reports.formatQuestion')}</h2>
              <div className="rg-std-grid" style={{ maxWidth: '650px' }}>
                {FORMAT_OPTIONS.map(f => {
                  const Icon = FORMAT_ICON[f.id] || FileText;
                  return (
                    <div key={f.id} className="rg-std-card" data-glow="green" onClick={() => { setExportFormat(f.id); setStep(1); }}>
                      <div className="rg-std-card__icon" style={{ background: 'var(--accent-dgi-dim)', color: 'var(--accent-dgi)' }}><Icon size={26} /></div>
                      <strong className="rg-std-card__title">{f.label}</strong>
                      <span className="rg-std-card__desc">{f.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 1: Subject ── */}
          {step === 1 && (
            <div className="rg-wiz-step rg-slide-in">
              <h2 className="rg-wiz-question">{t('reports.subject')}</h2>
              <p className="rg-wiz-hint">Choisissez les données à inclure dans votre rapport {exportFormat?.toUpperCase()}</p>
              <div className="rg-std-grid" style={{ maxWidth: '700px' }}>
                {REPORT_SUBJECTS.map(s => {
                  const Icon = ICON_MAP[s.icon] || FileText;
                  return (
                    <div key={s.id} className={`rg-std-card ${subjectId === s.id ? 'rg-std-card--selected' : ''}`} onClick={() => { setSubjectId(s.id); setStep(2); }}>
                      <div className="rg-std-card__icon" style={{ background: 'var(--accent-dgi-dim)', color: 'var(--accent-dgi)' }}><Icon size={24} /></div>
                      <strong className="rg-std-card__title">{s.name}</strong>
                      <span className="rg-std-card__desc">{s.description}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rg-wiz-nav">
                <button className="rg-nav-btn secondary" onClick={() => { setStep(0); setExportFormat(null); }}><ChevronLeft size={14} /> Format</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Period ── */}
          {step === 2 && subject && (
            <div className="rg-wiz-step rg-slide-in">
              <h2 className="rg-wiz-question">{t('reports.periodSelect')}</h2>
              <p className="rg-wiz-hint">{subject.name} — {exportFormat?.toUpperCase()}</p>
              <div className="rg-wiz-center">
                <div className="rg-segmented-control" style={{ marginBottom: '1rem' }}>
                  {PERIOD_PRESETS.map(p => (
                    <button key={p.id} className={`rg-seg-btn ${periodPreset === p.id ? 'active' : ''}`} onClick={() => handlePeriodPreset(p)}>{p.label}</button>
                  ))}
                </div>
                {periodPreset === 'custom' && (
                  <div className="rg-date-range">
                    <div className="rg-date-field"><label>{t('reports.startDate')}</label><input type="date" className="rg-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                    <span className="rg-date-arrow">→</span>
                    <div className="rg-date-field"><label>{t('reports.endDate')}</label><input type="date" className="rg-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                  </div>
                )}
                {subject.filters?.some(f => f.id === 'statut') && (
                  <div className="rg-segmented-control" style={{ marginTop: '0.75rem' }}>
                    {['TOUS', 'PAID', 'PENDING', 'OVERDUE'].map(s => (
                      <button key={s} className={`rg-seg-btn sm ${statutFilter === s ? 'active' : ''}`} onClick={() => setStatutFilter(s)}>
                        {s === 'TOUS' ? t('reports.statusAll') : s === 'PAID' ? t('reports.statusPaid') : s === 'PENDING' ? t('reports.statusPending') : t('reports.statusOverdue')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="rg-wiz-nav">
                <button className="rg-nav-btn secondary" onClick={() => setStep(1)}><ChevronLeft size={14} /> Sujet</button>
                <button className="rg-nav-btn primary" onClick={() => setStep(3)}>Options <ChevronRight size={14} /></button>
              </div>
            </div>
          )}

          {/* ── Step 3: Options ── */}
          {step === 3 && subject && (
            <div className="rg-wiz-step rg-slide-in">
              <h2 className="rg-wiz-question">Options du rapport</h2>
              <p className="rg-wiz-hint">Personnalisez le contenu — {subject.name}</p>
              <div className="rg-wiz-center">
                {/* Columns */}
                <div style={{ marginBottom: '1rem' }}>
                  <h3 className="rg-card-title-sm">{t('reports.columnsLabel')} <span className="rg-badge">{activeCols.length}</span></h3>
                  <div className="rg-chips-grid">
                    {subject.columns.filter(c => c.id !== 'index').map(col => {
                      const active = col.required || selectedColumns[col.id];
                      return (
                        <button key={col.id} className={`rg-chip ${active ? 'active' : ''} ${col.required ? 'locked' : ''}`} onClick={col.required ? undefined : () => toggleCol(col.id)} disabled={col.required}>{col.label}</button>
                      );
                    })}
                  </div>
                </div>

                {/* PDF sections */}
                {exportFormat === 'pdf' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 className="rg-card-title-sm">{t('reports.sections')}</h3>
                    <div className="rg-checks-col">
                      {(subject.pdfSections || []).map(sec => (
                        <label key={sec.id} className="rg-check-item" onClick={() => toggleSection(sec.id)}>
                          {pdfSections[sec.id] ? <CheckSquare size={14} className="rg-chk on" /> : <Square size={14} className="rg-chk" />}
                          <span>{sec.label}</span>
                        </label>
                      ))}
                      <label className="rg-check-item" onClick={() => setInstitutional(v => !v)}>
                        {institutional ? <CheckSquare size={14} className="rg-chk on" /> : <Square size={14} className="rg-chk" />}
                        <span>{t('reports.institutional')}</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Excel sheets */}
                {exportFormat === 'excel' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 className="rg-card-title-sm">{t('reports.sheetsInclude')}</h3>
                    <div className="rg-checks-col">
                      <label className="rg-check-item" onClick={() => setExcelSheets(p => ({ ...p, raw: !p.raw }))}>{excelSheets.raw ? <CheckSquare size={14} className="rg-chk on" /> : <Square size={14} className="rg-chk" />}<span>{t('reports.rawData')}</span></label>
                      <label className="rg-check-item" onClick={() => setExcelSheets(p => ({ ...p, recap: !p.recap }))}>{excelSheets.recap ? <CheckSquare size={14} className="rg-chk on" /> : <Square size={14} className="rg-chk" />}<span>{t('reports.summary')}</span></label>
                      <label className="rg-check-item" onClick={() => setExcelSheets(p => ({ ...p, pivot: !p.pivot }))}>{excelSheets.pivot ? <CheckSquare size={14} className="rg-chk on" /> : <Square size={14} className="rg-chk" />}<span>{t('reports.pivotCdi')}</span></label>
                    </div>
                  </div>
                )}

                {/* Charts config */}
                {exportFormat === 'charts' && (
                  <ChartBuilder subject={subject} previewData={filteredRows} charts={charts} onChange={setCharts} chartIdPrefix="report-chart" />
                )}

                {/* Title */}
                <div>
                  <h3 className="rg-card-title-sm">{t('reports.reportTitle')}</h3>
                  <input className="rg-input full" value={title} onChange={e => setTitle(e.target.value)} placeholder={subject.name} />
                </div>
              </div>
              <div className="rg-wiz-nav">
                <button className="rg-nav-btn secondary" onClick={() => setStep(2)}><ChevronLeft size={14} /> {t('reports.periodLabel')}</button>
                <button className="rg-nav-btn primary" onClick={() => setStep(4)}>{t('reports.generateReport')} <ChevronRight size={14} /></button>
              </div>
            </div>
          )}

          {/* ── Step 4: Summary + Generate ── */}
          {step === 4 && subject && (
            <div className="rg-wiz-step rg-slide-in">
              <h2 className="rg-wiz-question">{t('reports.generateReport')}</h2>
              <div className="rg-wiz-center">
                <div className="rg-summary-card">
                  <div className="rg-summary-grid">
                    <div className="rg-summary-item"><span className="rg-sum-label">Format</span><span className="rg-sum-val">{exportFormat?.toUpperCase()}</span></div>
                    <div className="rg-summary-item"><span className="rg-sum-label">Sujet</span><span className="rg-sum-val">{subject.name}</span></div>
                    <div className="rg-summary-item"><span className="rg-sum-label">{t('reports.periodLabel')}</span><span className="rg-sum-val">{startDate && endDate ? `${startDate} → ${endDate}` : t('all')}</span></div>
                    <div className="rg-summary-item"><span className="rg-sum-label">{t('reports.columnsLabel')}</span><span className="rg-sum-val">{activeCols.length}</span></div>
                  </div>
                </div>

                {dataLoading && <div style={{ textAlign: 'center', padding: '1rem' }}><WeaveSpinner size={40} message={t('reports.loading')} /></div>}

                <button className="rg-generate-btn" onClick={handleGenerate} disabled={generating || dataLoading || filteredRows.length === 0} style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                  {generating ? (
                    <><WeaveSpinner size={18} /><span className="rg-gen-text">{generateProgress}</span></>
                  ) : (
                    <><Download size={18} /><span>{t('reports.download')} {exportFormat?.toUpperCase()}</span></>
                  )}
                </button>

                {!dataLoading && filteredRows.length === 0 && (
                  <p className="rg-wiz-warning">Aucune donnée disponible pour cette sélection.</p>
                )}
              </div>
              <div className="rg-wiz-nav">
                <button className="rg-nav-btn secondary" onClick={() => setStep(3)}><ChevronLeft size={14} /> Options</button>
                <button className="rg-nav-btn secondary sm" onClick={resetAll}>{t('reports.newReport')}</button>
              </div>

              {/* Hidden capture zone for charts */}
              {exportFormat === 'charts' && validCharts.length > 0 && (
                <div className="rg-capture-offscreen" aria-hidden="true">
                  {validCharts.map((chart, i) => (
                    <div key={i} id={`report-chart-${i}`} className="rg-capture-item">
                      <ChartPreview chart={chart} previewData={filteredRows} subject={subject} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ HISTORY ═══════════ */}
      {activeTab === 'history' && (
        <div>
          {history.length > 0 && (
            <div className="rg-history-toolbar">
              <span className="rg-history-count">{history.length} {t('reports.reportCount')}</span>
              <button className="rg-nav-btn secondary sm" onClick={() => { setHistory([]); localStorage.removeItem('report_history'); }}>
                <Trash2 size={13} /> {t('reports.clearHistory')}
              </button>
            </div>
          )}
          {history.length === 0 ? (
            <div className="rg-empty-history">
              <Clock size={48} />
              <h3>{t('reports.historyEmpty')}</h3>
              <p>{t('reports.historyEmptyMsg')}</p>
            </div>
          ) : (
            <div className="rg-history-grid">
              {history.map((h, i) => (
                <div key={i} className="rg-history-card">
                  <div className="rg-hc-top">
                    <span className={`rg-hc-badge ${h.format}`}>{(h.format || 'pdf').toUpperCase()}</span>
                    <span className="rg-hc-date">{new Date(h.date).toLocaleString('fr-FR')}</span>
                  </div>
                  <h4 className="rg-hc-title">{h.title}</h4>
                  <div className="rg-hc-meta">
                    <span>{h.nbRows} {t('reports.rows')}</span>
                    {h.nbCharts > 0 && <span>{h.nbCharts} {t('reports.chartCount')}</span>}
                    <span>{h.nbColumns} {t('reports.columns')}</span>
                  </div>
                  <div className="rg-hc-file">{h.filename}</div>
                  {h.config && h.subjectId && (
                    <button className="rg-hc-reexport" onClick={() => {
                      const sub = REPORT_SUBJECTS.find(s => s.id === h.subjectId);
                      if (sub) {
                        const tid = toast.loading(t('reports.generating.fetching'));
                        buildReport(h.config, sub, null, [])
                          .then(meta => {
                            const updated = [meta, ...history].slice(0, 50);
                            setHistory(updated);
                            localStorage.setItem('report_history', JSON.stringify(updated));
                            toast.success(t('reports.exported'), { id: tid });
                          })
                          .catch(() => toast.error(t('reports.generateError'), { id: tid }));
                      }
                    }}>
                      <Download size={12} /> {t('reports.reExport')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
