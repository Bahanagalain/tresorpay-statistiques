import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Search, Hash, TrendingUp, BarChart2, BarChart3, PieChart as PieChartIcon,
  Layers, Grid3x3, Filter, ChevronDown, ChevronRight, X, ArrowLeft, Zap,
} from 'lucide-react';
import {
  fetchExplorerDimensions, fetchExplorerExplore, fetchExplorerCrosstab,
  buildAnalyticsDateParams,
} from '../api/analyticsApi';
import { apiGet } from '../api/httpClient';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import ExportButtons from '../components/ui/ExportButtons';
import PivotTable from '../components/ui/PivotTable';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { formatMontant, formatEntier } from '../utils/format';

// ─── Constants ─────────────────────────────────────────
const COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

const PRESET_QUERIES = [
  { label: 'Soumissions par ministère', mesure: 'count', dims: ['ministere'], chart: 'bar_h' },
  { label: 'Revenus par service', mesure: 'sum', dims: ['service'], chart: 'bar_h' },
  { label: 'Évolution mensuelle', mesure: 'count', dims: ['mois'], chart: 'line' },
  { label: 'Répartition par statut', mesure: 'count', dims: ['statut'], chart: 'pie' },
  { label: 'Ministères × Statut', mesure: 'count', dims: ['ministere', 'statut'], chart: 'stacked' },
  { label: 'Top régions par montant', mesure: 'sum', dims: ['region'], chart: 'bar_h' },
];

const FIXED_DIMENSIONS = [
  { cle: 'ministere', libelle: 'Ministère' },
  { cle: 'service', libelle: 'Service' },
  { cle: 'domaine', libelle: 'Domaine' },
  { cle: 'region', libelle: 'Région' },
  { cle: 'statut', libelle: 'Statut' },
  { cle: 'mois', libelle: 'Mois' },
];

const MESURES = [
  { key: 'count', label: 'Nombre de soumissions', icon: Hash },
  { key: 'sum', label: 'Montant total', icon: TrendingUp },
  { key: 'avg', label: 'Montant moyen', icon: BarChart2 },
];

const CHART_TYPES = [
  { key: 'bar_h', icon: BarChart3, label: 'Barres horizontales' },
  { key: 'bar_v', icon: BarChart2, label: 'Barres verticales' },
  { key: 'line', icon: TrendingUp, label: 'Courbe' },
  { key: 'pie', icon: PieChartIcon, label: 'Camembert' },
  { key: 'stacked', icon: Layers, label: 'Barres empilées' },
  { key: 'pivot', icon: Grid3x3, label: 'Tableau croisé' },
];

function getSmartChartType(dims) {
  if (dims.includes('mois')) return 'line';
  if (dims.length === 1 && dims[0] === 'statut') return 'pie';
  if (dims.length >= 2) return 'stacked';
  return 'bar_h';
}

function getMesureLabel(mesure) {
  switch (mesure) {
    case 'count': return 'nombre';
    case 'sum': return 'montant total';
    case 'avg': return 'montant moyen';
    default: return mesure;
  }
}

// ─── Component ─────────────────────────────────────────
export default function ExplorateurDonnees() {
  const { range: dateRange, setState: setDateState, state: periodState } = usePeriodFilter();

  // Reference data
  const [ministeres, setMinisteres] = useState([]);
  const [services, setServices] = useState([]);
  const [dynamicDimensions, setDynamicDimensions] = useState([]);

  // Builder state
  const [mesure, setMesure] = useState('count');
  const [groupBy, setGroupBy] = useState([]);
  const [chartType, setChartType] = useState('bar_h');

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ministereFilter, setMinistereFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  // Pivot state
  const [pivotLigne, setPivotLigne] = useState('');
  const [pivotColonne, setPivotColonne] = useState('');
  const [pivotDisplayMode, setPivotDisplayMode] = useState('raw');

  // Drill-down
  const [drillStack, setDrillStack] = useState([]);
  const [openServiceAccordions, setOpenServiceAccordions] = useState({});

  // Results
  const [resultats, setResultats] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pivotData, setPivotData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // Load reference data (via apiGet for auth headers)
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet('/referentiel/ministeres');
        const list = Array.isArray(data) ? data : data?.datas || data?.data || [];
        setMinisteres(list);
      } catch { /* ignore */ }
    })();
    (async () => {
      try {
        const data = await apiGet('/referentiel/services');
        const list = Array.isArray(data) ? data : data?.datas || data?.data || [];
        setServices(list);
      } catch { /* ignore */ }
    })();
  }, []);

  // Load dynamic dimensions
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const params = {};
        if (serviceFilter) params.service_id = serviceFilter;
        const data = await fetchExplorerDimensions(params, ctrl.signal);
        if (data?.dynamiques) setDynamicDimensions(data.dynamiques);
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Erreur chargement dimensions:', err);
      }
    })();
    return () => ctrl.abort();
  }, [serviceFilter]);

  const allDimensions = useMemo(() => [
    ...FIXED_DIMENSIONS,
    ...dynamicDimensions.map(d => ({ cle: d.cle, libelle: d.libelle, categorie: 'formulaire' })),
  ], [dynamicDimensions]);

  const getDimLabel = useCallback((cle) => {
    const dim = allDimensions.find(d => d.cle === cle);
    return dim?.libelle || cle;
  }, [allDimensions]);

  // Group dynamic dimensions by service
  const dimsByService = useMemo(() => {
    const map = {};
    dynamicDimensions.forEach(d => {
      const sId = d.serviceId || '__sans_service__';
      if (!map[sId]) map[sId] = [];
      map[sId].push(d);
    });
    // Build array with service name
    return Object.entries(map).map(([sId, champs]) => {
      const svc = services.find(s => String(s.id) === String(sId));
      return {
        serviceId: sId,
        serviceName: svc?.nomFr || svc?.nom_fr || svc?.nom || 'Service inconnu',
        champs,
      };
    });
  }, [dynamicDimensions, services]);

  const toggleServiceAccordion = useCallback((sId) => {
    setOpenServiceAccordions(prev => ({ ...prev, [sId]: !prev[sId] }));
  }, []);

  // Execute query
  const executeQuery = useCallback(async () => {
    if (chartType === 'pivot') {
      if (!pivotLigne || !pivotColonne) return;
    } else {
      if (groupBy.length === 0) return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const filtres = { ...buildAnalyticsDateParams(dateRange) };
      if (ministereFilter) filtres.ministere_id = ministereFilter;
      if (serviceFilter) filtres.service_id = serviceFilter;
      if (statutFilter) filtres.statut = statutFilter;

      // Apply drill-down filters (using correct backend filter keys)
      drillStack.forEach(d => {
        if (d.filterKey) filtres[d.filterKey] = d.value;
      });

      if (chartType === 'pivot') {
        const data = await fetchExplorerCrosstab({
          dim_ligne: pivotLigne,
          dim_colonne: pivotColonne,
          mesure: mesure === 'avg' ? 'count' : mesure,
          filtres,
        }, ctrl.signal);
        setPivotData(data);
        setResultats(null);
        setTotalCount(0);
      } else {
        const data = await fetchExplorerExplore({
          group_by: groupBy,
          mesure,
          filtres,
          limite: 50,
          tri: 'desc',
        }, ctrl.signal);
        const res = data?.resultats || data || [];
        setResultats(res);
        setTotalCount(data?.total || res.length);
        setPivotData(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Erreur lors de l\'exploration : ' + (err.message || 'Erreur inconnue'));
      }
    } finally {
      setLoading(false);
    }
  }, [groupBy, mesure, dateRange, ministereFilter, serviceFilter, statutFilter, chartType, pivotLigne, pivotColonne, drillStack]);

  // Debounced auto-query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { executeQuery(); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [executeQuery]);

  // Preset click handler
  const applyPreset = (preset) => {
    setMesure(preset.mesure);
    setGroupBy(preset.dims);
    setChartType(preset.chart);
    setDrillStack([]);
  };

  // Group by management
  const toggleGroupBy = (cle) => {
    if (groupBy.includes(cle)) {
      setGroupBy(groupBy.filter(g => g !== cle));
    } else {
      setGroupBy([...groupBy, cle]);
    }
  };

  const removeGroupBy = (cle) => {
    setGroupBy(groupBy.filter(g => g !== cle));
  };

  // Drill-down — map dimension keys to backend filter keys
  const DRILL_FILTER_MAP = {
    ministere: 'ministere_id',
    service: 'service_id',
    domaine: 'domaine_id',
    region: 'orgunit_id',
    statut: 'statut',
    mois: 'mois',
  };

  const DRILL_CHAIN = ['ministere', 'service', 'domaine', 'region', 'statut', 'mois'];
  const originalGroupByRef = useRef([]);

  const handleDrill = (dimensionId, dimensionLabel, dimensionKey) => {
    const currentIdx = DRILL_CHAIN.indexOf(dimensionKey || groupBy[0]);
    const nextDim = DRILL_CHAIN[currentIdx + 1];
    if (!nextDim) return;

    // Save original groupBy on first drill
    if (drillStack.length === 0) {
      originalGroupByRef.current = [...groupBy];
    }

    setDrillStack([...drillStack, {
      dimension: dimensionKey || groupBy[0],
      filterKey: DRILL_FILTER_MAP[dimensionKey || groupBy[0]],
      value: dimensionId,
      label: dimensionLabel,
    }]);
    setGroupBy([nextDim]);
  };

  const handleDrillBack = () => {
    if (drillStack.length === 0) return;
    const newStack = [...drillStack];
    newStack.pop();
    setDrillStack(newStack);
    if (newStack.length > 0) {
      const lastDim = newStack[newStack.length - 1].dimension;
      const idx = DRILL_CHAIN.indexOf(lastDim);
      if (idx >= 0 && DRILL_CHAIN[idx + 1]) setGroupBy([DRILL_CHAIN[idx + 1]]);
    } else {
      // Restore original groupBy
      setGroupBy(originalGroupByRef.current.length > 0 ? originalGroupByRef.current : ['ministere']);
    }
  };

  const resetDrill = () => {
    setDrillStack([]);
    if (originalGroupByRef.current.length > 0) {
      setGroupBy(originalGroupByRef.current);
    }
  };

  // Sort table
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!resultats || resultats.length === 0) return [];
    const primaryDimKey = groupBy[0];
    return resultats.map((r) => {
      const shortLabel = Object.values(r.dimensions || {}).map(d => d.shortName || d.nom).join(' / ');
      const fullLabel = Object.values(r.dimensions || {}).map(d => d.nom).join(' / ');
      // Get the ID of the primary dimension for drill-down
      const primaryDim = r.dimensions?.[primaryDimKey];
      return {
        name: shortLabel.length > 35 ? shortLabel.substring(0, 32) + '...' : shortLabel,
        fullName: fullLabel,
        dimId: primaryDim?.id || primaryDim?.nom || fullLabel,
        dimLabel: primaryDim?.shortName || primaryDim?.nom || fullLabel,
        valeur: mesure === 'count' ? r.nombre : (mesure === 'avg' ? (r.moyenne != null ? r.moyenne : (r.nombre > 0 ? r.montant / r.nombre : 0)) : r.montant),
        nombre: r.nombre,
        montant: r.montant,
      };
    }).slice(0, 20);
  }, [resultats, mesure, groupBy]);

  // Prepare stacked data (for 2+ dimensions)
  const stackedData = useMemo(() => {
    if (!resultats || groupBy.length < 2) return { data: [], series: [] };
    const dim1Key = groupBy[0];
    const dim2Key = groupBy[1];
    const seriesSet = new Set();
    const grouped = {};

    resultats.forEach(r => {
      const d1 = r.dimensions?.[dim1Key]?.shortName || r.dimensions?.[dim1Key]?.nom || 'Autre';
      const d2 = r.dimensions?.[dim2Key]?.shortName || r.dimensions?.[dim2Key]?.nom || 'Autre';
      seriesSet.add(d2);
      if (!grouped[d1]) grouped[d1] = { name: d1 };
      grouped[d1][d2] = (grouped[d1][d2] || 0) + (mesure === 'count' ? r.nombre : r.montant);
    });

    return { data: Object.values(grouped), series: [...seriesSet] };
  }, [resultats, groupBy, mesure]);

  // Sorted table data
  const sortedTableData = useMemo(() => {
    if (!resultats) return [];
    const arr = [...resultats];
    if (sortCol) {
      arr.sort((a, b) => {
        let va, vb;
        if (sortCol === 'nombre') { va = a.nombre; vb = b.nombre; }
        else if (sortCol === 'montant') { va = a.montant; vb = b.montant; }
        else {
          va = a.dimensions?.[sortCol]?.shortName || a.dimensions?.[sortCol]?.nom || '';
          vb = b.dimensions?.[sortCol]?.shortName || b.dimensions?.[sortCol]?.nom || '';
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }
    return arr;
  }, [resultats, sortCol, sortDir]);

  // Export data
  const exportData = useMemo(() => {
    return (resultats || []).map(r => {
      const row = {};
      for (const [key, dim] of Object.entries(r.dimensions || {})) {
        row[getDimLabel(key)] = dim.nom;
      }
      row['Nombre'] = r.nombre;
      row['Montant (FCFA)'] = r.montant;
      return row;
    });
  }, [resultats, getDimLabel]);

  // Summary sentence
  const summaryText = useMemo(() => {
    if (!resultats || resultats.length === 0) return '';
    const dims = groupBy.map(getDimLabel).join(', ');
    const totalSoumissions = resultats.reduce((s, r) => s + (r.nombre || 0), 0);
    const totalMontant = resultats.reduce((s, r) => s + (r.montant || 0), 0);
    const groupCount = resultats.length;
    const parts = [`${formatEntier(totalSoumissions)} soumissions`, `${groupCount} groupes par ${dims}`];
    if (mesure === 'sum' || mesure === 'avg') parts.push(`total : ${formatMontant(totalMontant)}`);
    return parts.join(' — ');
  }, [resultats, groupBy, mesure, getDimLabel]);

  // Tooltip formatter
  const tooltipFormatter = (val) => {
    if (mesure === 'count') return formatEntier(val);
    return formatMontant(val);
  };

  const hasResults = resultats && resultats.length > 0;
  const hasPivot = pivotData && pivotData.lignes?.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Explorateur de Données</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Analyse multi-dimensionnelle des recettes et soumissions
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <DatePresetFilter value={dateRange} onChange={(v) => setDateState(v)} />
          {(hasResults || hasPivot) && (
            <ExportButtons data={exportData} filename="exploration" title="Exploration des données" />
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* ─── Left Panel ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Preset Queries */}
          <div style={cardStyle}>
            <label style={labelStyle}>Requêtes prédéfinies</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {PRESET_QUERIES.map((pq, i) => (
                <button
                  key={i}
                  onClick={() => applyPreset(pq)}
                  style={presetBtnStyle}
                >
                  {i % 2 === 0 ? <Search size={13} style={{ opacity: 0.6 }} /> : <Zap size={13} style={{ opacity: 0.6 }} />}
                  <span>{pq.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 1: Measure */}
          <div style={cardStyle}>
            <label style={labelStyle}>1. Mesure</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {MESURES.map(m => {
                const Icon = m.icon;
                const active = mesure === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMesure(m.key)}
                    style={{
                      ...mesureBtnStyle,
                      background: active ? '#059669' : 'var(--bg-secondary, #f3f4f6)',
                      color: active ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    <Icon size={14} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Group By */}
          <div style={cardStyle}>
            <label style={labelStyle}>2. Regrouper par</label>
            {/* Selected chips */}
            {groupBy.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                {groupBy.map(cle => (
                  <span key={cle} style={chipActiveStyle}>
                    {getDimLabel(cle)}
                    <button onClick={() => removeGroupBy(cle)} style={chipRemoveStyle}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Main dimensions */}
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Dimensions principales
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '0.5rem' }}>
              {FIXED_DIMENSIONS.map(d => (
                <label key={d.cle} style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={groupBy.includes(d.cle)}
                    onChange={() => toggleGroupBy(d.cle)}
                    style={{ accentColor: '#059669' }}
                  />
                  <span style={{ fontSize: '0.83rem' }}>{d.libelle}</span>
                </label>
              ))}
            </div>
            {/* Dynamic dimensions grouped by service */}
            {dimsByService.length > 0 && (
              <>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px', marginTop: '0.5rem' }}>
                  Champs par service
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', maxHeight: '280px', overflowY: 'auto' }}>
                  {dimsByService.map(({ serviceId, serviceName, champs }) => {
                    const isOpen = openServiceAccordions[serviceId];
                    const selectedCount = champs.filter(d => groupBy.includes(d.cle)).length;
                    return (
                      <div key={serviceId}>
                        <button
                          onClick={() => toggleServiceAccordion(serviceId)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px', width: '100%',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
                            fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)',
                            textAlign: 'left',
                          }}
                        >
                          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {serviceName}
                          </span>
                          {selectedCount > 0 && (
                            <span style={{ fontSize: '0.65rem', background: '#059669', color: '#fff', borderRadius: '8px', padding: '0 5px', minWidth: '16px', textAlign: 'center' }}>
                              {selectedCount}
                            </span>
                          )}
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{champs.length}</span>
                        </button>
                        {isOpen && (
                          <div style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {champs.map(d => (
                              <label key={d.cle} style={checkboxRowStyle}>
                                <input
                                  type="checkbox"
                                  checked={groupBy.includes(d.cle)}
                                  onChange={() => toggleGroupBy(d.cle)}
                                  style={{ accentColor: '#059669' }}
                                />
                                <span style={{ fontSize: '0.8rem' }}>{d.libelle}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Step 3: Filters (collapsible) */}
          <div style={cardStyle}>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}
            >
              {filtersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ ...labelStyle, margin: 0 }}>3. Filtres avancés</span>
              <Filter size={12} style={{ opacity: 0.5, marginLeft: 'auto' }} />
            </button>
            {filtersOpen && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select value={ministereFilter} onChange={e => setMinistereFilter(e.target.value)} style={selectStyle}>
                  <option value="">Tous les ministères</option>
                  {ministeres.map(m => (
                    <option key={m.id} value={m.id}>{m.nomFr || m.nom_fr || m.nom}</option>
                  ))}
                </select>
                <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={selectStyle}>
                  <option value="">Tous les services</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.nomFr || s.nom_fr || s.nom}</option>
                  ))}
                </select>
                <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)} style={selectStyle}>
                  <option value="">Tous les statuts</option>
                  <option value="PAID">Payé</option>
                  <option value="PENDING">En attente</option>
                  <option value="PARTIAL">Partiel</option>
                  <option value="FAILED">Échoué</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right Panel ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Drill breadcrumb */}
          {drillStack.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
              <button onClick={resetDrill} style={linkBtnStyle}>
                <ArrowLeft size={13} /> Tout
              </button>
              {drillStack.map((d, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ChevronRight size={12} />
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Results card */}
          <div style={cardStyle}>
            {/* Summary + chart type selector */}
            {(hasResults || hasPivot) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {summaryText}
                </p>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {CHART_TYPES.map(ct => {
                    const Icon = ct.icon;
                    const active = chartType === ct.key;
                    return (
                      <button
                        key={ct.key}
                        onClick={() => setChartType(ct.key)}
                        title={ct.label}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 30, height: 28, borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
                          background: active ? '#059669' : 'transparent',
                          color: active ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        <Icon size={15} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
                <WeaveSpinner size={60} message="Chargement..." />
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div style={{ padding: '1rem', color: '#DC2626', background: '#FEF2F2', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            {/* Pivot mode */}
            {!loading && !error && chartType === 'pivot' && (
              <>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Lignes :</span>
                    <select value={pivotLigne} onChange={e => setPivotLigne(e.target.value)} style={{ ...selectStyle, width: 'auto' }}>
                      <option value="">Choisir...</option>
                      {allDimensions.map(d => <option key={d.cle} value={d.cle}>{d.libelle}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Colonnes :</span>
                    <select value={pivotColonne} onChange={e => setPivotColonne(e.target.value)} style={{ ...selectStyle, width: 'auto' }}>
                      <option value="">Choisir...</option>
                      {allDimensions.map(d => <option key={d.cle} value={d.cle}>{d.libelle}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[
                      { key: 'raw', label: 'Valeurs' },
                      { key: 'pctRow', label: '% Ligne' },
                      { key: 'pctCol', label: '% Colonne' },
                      { key: 'pctTotal', label: '% Total' },
                    ].map(m => (
                      <button
                        key={m.key}
                        onClick={() => setPivotDisplayMode(m.key)}
                        style={{
                          padding: '0.3rem 0.6rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
                          fontSize: '0.75rem', fontWeight: 500,
                          background: pivotDisplayMode === m.key ? '#059669' : 'var(--bg-secondary, #f3f4f6)',
                          color: pivotDisplayMode === m.key ? '#fff' : 'var(--text-primary)',
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {hasPivot ? (
                  <PivotTable
                    data={pivotData}
                    mesure={mesure}
                    dimLigneLabel={getDimLabel(pivotLigne)}
                    dimColonneLabel={getDimLabel(pivotColonne)}
                    displayMode={pivotDisplayMode}
                  />
                ) : (
                  <EmptyState message="Sélectionnez les dimensions en ligne et en colonne pour générer le tableau croisé." />
                )}
              </>
            )}

            {/* Chart modes */}
            {!loading && !error && chartType !== 'pivot' && hasResults && (
              <>
                {/* Chart */}
                <div style={{ marginBottom: '1.5rem' }}>
                  {chartType === 'bar_h' && (
                    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 34)}>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" tickFormatter={tooltipFormatter} />
                        <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={tooltipFormatter} labelFormatter={(_, p) => p?.[0]?.payload?.fullName || _} />
                        <Bar dataKey="valeur" name={mesure === 'count' ? 'Nombre' : 'Montant'} radius={[0, 4, 4, 0]}
                          onClick={(data) => handleDrill(data.dimId, data.dimLabel || data.name, groupBy[0])}
                          style={{ cursor: 'pointer' }}
                        >
                          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {chartType === 'bar_v' && (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartData} margin={{ left: 10, right: 30, top: 5, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={tooltipFormatter} />
                        <Tooltip formatter={tooltipFormatter} labelFormatter={(_, p) => p?.[0]?.payload?.fullName || _} />
                        <Bar dataKey="valeur" name={mesure === 'count' ? 'Nombre' : 'Montant'} radius={[4, 4, 0, 0]}
                          onClick={(data) => handleDrill(data.dimId, data.dimLabel || data.name, groupBy[0])}
                          style={{ cursor: 'pointer' }}
                        >
                          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {chartType === 'line' && (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={chartData} margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={tooltipFormatter} />
                        <Tooltip formatter={tooltipFormatter} />
                        <Line type="monotone" dataKey="valeur" stroke="#059669" strokeWidth={2} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {chartType === 'pie' && (
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="valeur"
                          nameKey="name"
                          cx="50%" cy="45%"
                          outerRadius={120}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                          labelLine={{ strokeWidth: 1 }}
                          onClick={(data) => handleDrill(data.dimId, data.dimLabel || data.name, groupBy[0])}
                          style={{ cursor: 'pointer' }}
                        >
                          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}

                  {chartType === 'stacked' && stackedData.data.length > 0 && (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={stackedData.data} margin={{ left: 10, right: 30, top: 5, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={tooltipFormatter} />
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend />
                        {stackedData.series.map((s, i) => (
                          <Bar key={s} dataKey={s} stackId="stack" fill={COLORS[i % COLORS.length]} radius={i === stackedData.series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {chartType === 'stacked' && stackedData.data.length === 0 && groupBy.length < 2 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Sélectionnez au moins 2 dimensions pour le mode empilé.
                    </div>
                  )}
                </div>

                {/* Data table */}
                <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>#</th>
                        {groupBy.map(cle => (
                          <th key={cle} style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort(cle)}>
                            {getDimLabel(cle)} {sortCol === cle ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                        ))}
                        <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('nombre')}>
                          Nombre {sortCol === 'nombre' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('montant')}>
                          Montant {sortCol === 'montant' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTableData.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary, #f9fafb)' }}>
                          <td style={tdStyle}>{i + 1}</td>
                          {groupBy.map(cle => (
                            <td key={cle} style={tdStyle}>{r.dimensions?.[cle]?.shortName || r.dimensions?.[cle]?.nom || '-'}</td>
                          ))}
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatEntier(r.nombre)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatMontant(r.montant)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sortedTableData.length > 50 && (
                    <div style={{ padding: '0.5rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                      Affichage limité aux 50 premiers résultats
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Empty state */}
            {!loading && !error && !hasResults && chartType !== 'pivot' && (
              <EmptyState message="Ajoutez des dimensions pour explorer les données." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state component ─────────────────────────────
function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
      <Search size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{message}</p>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────
const cardStyle = {
  background: 'var(--bg-card, #fff)',
  borderRadius: '0.75rem',
  padding: '1rem',
  border: '1px solid var(--border-color, #e5e7eb)',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
};

const selectStyle = {
  width: '100%',
  padding: '0.45rem 0.5rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--border-color, #d1d5db)',
  background: 'var(--bg-primary, #fff)',
  color: 'var(--text-primary)',
  fontSize: '0.83rem',
};

const presetBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.4rem 0.6rem',
  borderRadius: '0.375rem',
  border: 'none',
  background: 'var(--bg-secondary, #f3f4f6)',
  cursor: 'pointer',
  fontSize: '0.82rem',
  color: 'var(--text-primary)',
  width: '100%',
  textAlign: 'left',
  transition: 'background 0.15s',
};

const mesureBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.45rem 0.6rem',
  borderRadius: '0.375rem',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.83rem',
  fontWeight: 500,
  width: '100%',
  textAlign: 'left',
  transition: 'all 0.15s',
};

const chipActiveStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.2rem 0.5rem',
  borderRadius: '999px',
  background: '#059669',
  color: '#fff',
  fontSize: '0.76rem',
  fontWeight: 500,
};

const chipRemoveStyle = {
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: '0 0 0 2px',
  opacity: 0.8,
};

const checkboxRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.25rem 0',
  cursor: 'pointer',
};

const linkBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.83rem',
  color: '#059669',
  fontWeight: 500,
  padding: 0,
};

const thStyle = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  borderBottom: '2px solid var(--border-color, #e5e7eb)',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--bg-card, #fff)',
};

const tdStyle = {
  padding: '0.45rem 0.75rem',
  borderBottom: '1px solid var(--border-color, #f3f4f6)',
  fontSize: '0.83rem',
};
