import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveGridLayout } from 'react-grid-layout';
import { Plus, Save, ArrowLeft, LayoutDashboard, BookOpen, Maximize2, X, Sun, Moon } from 'lucide-react';
import {
  fetchDashboard, updateDashboard,
  addWidget, updateWidget, deleteWidget,
} from '../../api/biApi';
import WeaveSpinner from '../../components/ui/WeaveSpinner';
import WidgetCard from '../../components/bi/WidgetCard';
import WidgetEditor from '../../components/bi/WidgetEditor';
import FilterBar from '../../components/bi/FilterBar';
import WidgetLibrary from '../../components/bi/WidgetLibrary';
import ExportDashboard from '../../components/bi/ExportDashboard';
import { CrossFilterProvider, useCrossFilter } from '../../components/bi/CrossFilterContext';
import DrillDownStack from '../../components/bi/DrillDownStack';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './bi.css';

function DashboardBuilderInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [editingWidget, setEditingWidget] = useState(null);
  const [titre, setTitre] = useState('');
  const [drillDownStack, setDrillDownStack] = useState([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const [debouncedFilters, setDebouncedFilters] = useState({});
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('bi-dark-mode');
    return saved === 'true';
  });
  const titleTimeout = useRef(null);
  const filterTimeout = useRef(null);
  const lastClickRef = useRef(null);
  const gridRef = useRef(null);
  const builderRef = useRef(null);

  const { setCrossFilter } = useCrossFilter();

  useEffect(() => {
    const el = builderRef.current;
    if (!el) return;
    if (darkMode) {
      el.classList.add('bi-dark');
    } else {
      el.classList.remove('bi-dark');
    }
    localStorage.setItem('bi-dark-mode', String(darkMode));
    return () => el?.classList.remove('bi-dark');
  }, [darkMode]);

  // Debounce filters (500ms) pour éviter de relancer toutes les requêtes à chaque frappe
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    if (filterTimeout.current) clearTimeout(filterTimeout.current);
    filterTimeout.current = setTimeout(() => setDebouncedFilters(newFilters), 500);
  }, []);

  // Load dashboard
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDashboard(id)
      .then(res => {
        if (cancelled) return;
        const data = res?.datas || res;
        setDashboard(data);
        setTitre(data?.titre || '');
      })
      .catch(err => setError(err.message))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Auto-save title
  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitre(val);
    if (titleTimeout.current) clearTimeout(titleTimeout.current);
    titleTimeout.current = setTimeout(() => {
      updateDashboard(id, { titre: val })
        .then(() => {
          setTitleSaved(true);
          setTimeout(() => setTitleSaved(false), 2000);
        })
        .catch(() => {});
    }, 1000);
  };

  // Build layouts from widgets
  // Les positions sont stockées en base via gridX/gridY/gridW/gridH
  const getLayouts = useCallback(() => {
    if (!dashboard?.widgets) return { lg: [], md: [], sm: [] };
    const widgets = dashboard.widgets;

    // Vérifier si les positions sont valides (pas tous à 0,0)
    const hasValidPositions = widgets.some(w => (w.gridX > 0 || w.gridY > 0));

    const buildLg = () => {
      if (hasValidPositions) {
        // Utiliser les positions sauvegardées en base
        return widgets.map(w => ({
          i: String(w.id),
          x: w.gridX ?? 0,
          y: w.gridY ?? 0,
          w: w.gridW || 6,
          h: w.gridH || 4,
          minW: 2,
          minH: 2,
        }));
      }
      // Aucune position valide : calculer un placement automatique
      const colHeights = new Array(12).fill(0);
      return widgets.map(w => {
        const wW = w.gridW || 6;
        const wH = w.gridH || 4;
        let bestX = 0, bestY = Infinity;
        for (let x = 0; x <= 12 - wW; x++) {
          let maxH = 0;
          for (let c = x; c < x + wW; c++) maxH = Math.max(maxH, colHeights[c]);
          if (maxH < bestY) { bestY = maxH; bestX = x; }
        }
        for (let c = bestX; c < bestX + wW; c++) colHeights[c] = bestY + wH;
        return { i: String(w.id), x: bestX, y: bestY, w: wW, h: wH, minW: 2, minH: 2 };
      });
    };

    return {
      lg: buildLg(),
      md: widgets.map((w, i) => ({
        i: String(w.id),
        x: (i % 2) * 3,
        y: Math.floor(i / 2) * (w.gridH || 4),
        w: Math.min(w.gridW || 6, 6),
        h: w.gridH || 4,
        minW: 2,
        minH: 2,
      })),
      sm: widgets.map((w, i) => ({
        i: String(w.id),
        x: 0,
        y: i * (w.gridH || 4),
        w: 1,
        h: w.gridH || 4,
        minW: 1,
        minH: 2,
      })),
    };
  }, [dashboard]);

  // Layout change -> save positions en base (gridX/gridY/gridW/gridH)
  const handleLayoutChange = useCallback((layout) => {
    if (!dashboard?.widgets) return;
    const positions = {};
    layout.forEach(item => {
      positions[item.i] = { gridX: item.x, gridY: item.y, gridW: item.w, gridH: item.h };
    });

    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => ({
        ...w,
        ...(positions[String(w.id)] || {}),
      })),
    }));

    // Sauvegarder chaque widget en base
    Object.entries(positions).forEach(([widgetId, pos]) => {
      updateWidget(widgetId, pos).catch(() => {});
    });
  }, [dashboard]);

  // Save dashboard global
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDashboard(id, { titre, description: dashboard?.description });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Calculer la position Y la plus basse de la grille (pour placer un nouveau widget en dessous)
  const getNextY = useCallback(() => {
    if (!dashboard?.widgets?.length) return 0;
    let maxBottom = 0;
    for (const w of dashboard.widgets) {
      const bottom = (w.gridY || 0) + (w.gridH || 4);
      if (bottom > maxBottom) maxBottom = bottom;
    }
    return maxBottom;
  }, [dashboard]);

  // Widget CRUD
  const handleWidgetSave = async (widgetData) => {
    try {
      if (widgetData.id) {
        const res = await updateWidget(widgetData.id, widgetData);
        const updated = res?.datas || res;
        setDashboard(prev => ({
          ...prev,
          widgets: prev.widgets.map(w => w.id === widgetData.id ? { ...w, ...updated } : w),
        }));
      } else {
        // Nouveau widget : le placer en bas de la grille
        const newY = getNextY();
        const dataWithPos = {
          ...widgetData,
          gridX: 0,
          gridY: newY,
          gridW: widgetData.gridW || 6,
          gridH: widgetData.gridH || 4,
        };
        const res = await addWidget(id, dataWithPos);
        const created = res?.datas || res;
        setDashboard(prev => ({
          ...prev,
          widgets: [...(prev.widgets || []), created],
        }));
      }
      setEditingWidget(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleWidgetDelete = (widgetId) => {
    setDeleteConfirm(widgetId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteWidget(deleteConfirm);
      setDashboard(prev => ({
        ...prev,
        widgets: prev.widgets.filter(w => w.id !== deleteConfirm),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDuplicateWidget = async (widget) => {
    try {
      const { id: _id, dashboardId: _dashId, creeLe: _, modifieLe: _m, dataset: _d, indicateurs: _ind, ...config } = widget;
      const newY = getNextY();
      const res = await addWidget(dashboard.id, {
        ...config,
        titre: (widget.titre || 'Widget') + ' (copie)',
        gridX: 0,
        gridY: newY,
      });
      const newWidget = res?.datas || res;
      setDashboard(prev => ({
        ...prev,
        widgets: [...(prev.widgets || []), newWidget],
      }));
    } catch (err) {
      console.error('Erreur duplication:', err);
    }
  };

  // Single click on chart -> cross-filter
  const handleChartClick = useCallback((widgetId, dimension, valeur, nom) => {
    lastClickRef.current = { widgetId, dimension, valeur, nom };
    setCrossFilter(String(widgetId), dimension, valeur, nom);
  }, [setCrossFilter]);

  // Double click on widget body -> drill-down
  const handleChartDoubleClick = useCallback((widgetId) => {
    const last = lastClickRef.current;
    if (last && last.widgetId === widgetId) {
      setDrillDownStack(prev => [...prev, {
        dimension: last.dimension,
        valeur: last.valeur,
        nom: last.nom,
      }]);
    }
  }, []);

  // Drill-down navigation
  const handleDrillNavigate = useCallback((index) => {
    if (index < 0) {
      setDrillDownStack([]);
    } else {
      setDrillDownStack(prev => prev.slice(0, index + 1));
    }
  }, []);

  const handleDrillReset = useCallback(() => {
    setDrillDownStack([]);
  }, []);

  // Drill-down filters to pass to widgets
  const drillDownFilters = React.useMemo(() => {
    const df = {};
    drillDownStack.forEach(level => {
      if (level.dimension && level.valeur) {
        df[level.dimension] = level.valeur;
      }
    });
    return df;
  }, [drillDownStack]);

  // Combined filters: global + drill-down
  const combinedFilters = React.useMemo(() => ({
    ...debouncedFilters,
    ...drillDownFilters,
  }), [debouncedFilters, drillDownFilters]);

  // Escape pour quitter le mode présentation
  useEffect(() => {
    if (!presentationMode) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setPresentationMode(false); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [presentationMode]);

  if (loading) return <WeaveSpinner size={80} message="Chargement du dashboard..." />;
  if (error && !dashboard) return <p style={{ padding: '2rem', color: '#dc2626' }}>{error}</p>;

  const widgets = dashboard?.widgets || [];
  const layouts = getLayouts();

  return (
    <div className="bi-builder" ref={builderRef}>
      {/* Header */}
      <div className="bi-builder-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="bi-btn-secondary" onClick={() => navigate('/bi/dashboards')} title="Retour">
            <ArrowLeft size={16} />
          </button>
          <input
            type="text"
            className="bi-builder-title"
            value={titre}
            onChange={handleTitleChange}
            placeholder="Titre du dashboard"
          />
          {titleSaved && <span className="bi-save-indicator">&#10003;</span>}
        </div>
        <div className="bi-builder-actions">
          <button className="bi-btn-secondary" onClick={() => setLibraryOpen(true)}>
            <BookOpen size={15} />
            Bibliothèque
          </button>
          <button className="bi-btn-secondary" onClick={() => setEditingWidget({})}>
            <Plus size={15} />
            Ajouter widget
          </button>
          <ExportDashboard
            dashboardId={id}
            titre={titre}
            widgets={widgets}
            gridRef={gridRef}
          />
          <button
            className="bi-btn-secondary"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="bi-btn-secondary" onClick={() => setPresentationMode(true)} title="Mode présentation">
            <Maximize2 size={15} />
          </button>
          <button className="bi-btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={15} />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        datasetCode={dashboard?.datasetCode}
        onFiltersChange={handleFiltersChange}
      />

      {/* Drill-Down Breadcrumb */}
      <DrillDownStack
        stack={drillDownStack}
        onNavigate={handleDrillNavigate}
        onReset={handleDrillReset}
      />

      {/* Grid */}
      <div className="bi-builder-body" ref={gridRef}>
        {error && <p style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}

        {widgets.length === 0 ? (
          <div className="bi-grid-empty">
            <LayoutDashboard size={48} />
            <p>Aucun widget. Cliquez sur "Ajouter widget" pour commencer.</p>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="bi-grid-layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 768, sm: 0 }}
            cols={{ lg: 12, md: 6, sm: 1 }}
            rowHeight={80}
            compactType="vertical"
            preventCollision={false}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".bi-widget-card-header"
            isResizable
            isDraggable
          >
            {widgets.map((widget, idx) => (
              <div key={String(widget.id)}>
                <WidgetCard
                  widget={widget}
                  index={idx}
                  filters={combinedFilters}
                  onEdit={(w) => setEditingWidget(w)}
                  onDelete={handleWidgetDelete}
                  onDuplicate={handleDuplicateWidget}
                  onChartClick={handleChartClick}
                  onChartDoubleClick={handleChartDoubleClick}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Widget Editor */}
      {editingWidget !== null && (
        <WidgetEditor
          widget={editingWidget.id ? editingWidget : null}
          dashboardId={id}
          onSave={handleWidgetSave}
          onClose={() => setEditingWidget(null)}
        />
      )}

      {/* Widget Library */}
      <WidgetLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(config) => {
          setLibraryOpen(false);
          handleWidgetSave(config);
        }}
        onApplyTemplate={async (widgetConfigs) => {
          setLibraryOpen(false);
          for (const config of widgetConfigs) {
            await handleWidgetSave(config);
          }
        }}
      />

      {/* Confirmation suppression widget */}
      {deleteConfirm && (
        <div className="bi-confirm-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="bi-confirm-dialog" onClick={e => e.stopPropagation()}>
            <p>Supprimer ce widget ?</p>
            <span className="bi-hint">Cette action est irréversible.</span>
            <div className="bi-confirm-actions">
              <button className="bi-btn-secondary" onClick={() => setDeleteConfirm(null)}>Annuler</button>
              <button className="bi-btn-danger" onClick={confirmDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Présentation */}
      {presentationMode && (
        <div className="bi-presentation-overlay">
          <div className="bi-presentation-header">
            <h1>{titre || 'Dashboard'}</h1>
            <div className="bi-presentation-meta">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <button className="bi-presentation-close" onClick={() => setPresentationMode(false)} title="Quitter la présentation">
              <X size={20} />
            </button>
          </div>
          <div className="bi-presentation-body">
            <ResponsiveGridLayout
              className="bi-grid-layout"
              layouts={getLayouts()}
              breakpoints={{ lg: 1200, md: 768, sm: 0 }}
              cols={{ lg: 12, md: 6, sm: 1 }}
              rowHeight={90}
              isDraggable={false}
              isResizable={false}
            >
              {widgets.map((widget, idx) => (
                <div key={String(widget.id)}>
                  <WidgetCard
                    widget={widget}
                    index={idx}
                    filters={combinedFilters}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </div>
              ))}
            </ResponsiveGridLayout>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardBuilder() {
  return (
    <CrossFilterProvider>
      <DashboardBuilderInner />
    </CrossFilterProvider>
  );
}
