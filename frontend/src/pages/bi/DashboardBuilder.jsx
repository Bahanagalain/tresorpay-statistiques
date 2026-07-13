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

  // Build layouts from widgets — positionnement sans chevauchement
  const getLayouts = useCallback(() => {
    if (!dashboard?.widgets) return { lg: [], md: [], sm: [] };
    const widgets = dashboard.widgets;

    // Calculer les positions pour les widgets sans posX/posY sauvegardés
    // Utiliser un algorithme de placement en grille qui évite les chevauchements
    // Algorithme : placer chaque widget au premier emplacement libre
    // en respectant la largeur/hauteur configurée. Pas de chevauchement.
    const computeLayout = (cols) => {
      const colHeights = new Array(cols).fill(0);
      return widgets.map((w) => {
        const wWidth = Math.min(w.largeur || (w.gridW || 6), cols);
        const wHeight = w.hauteur || (w.gridH || 3);

        // Trouver la première position libre assez large
        let bestX = 0;
        let bestY = Infinity;
        for (let x = 0; x <= cols - wWidth; x++) {
          let maxH = 0;
          for (let c = x; c < x + wWidth; c++) {
            maxH = Math.max(maxH, colHeights[c]);
          }
          if (maxH < bestY) {
            bestY = maxH;
            bestX = x;
          }
        }

        for (let c = bestX; c < bestX + wWidth; c++) {
          colHeights[c] = bestY + wHeight;
        }

        return {
          i: String(w.id),
          x: bestX,
          y: bestY,
          w: wWidth,
          h: wHeight,
          minW: 2,
          minH: 2,
        };
      });
    };

    return {
      lg: computeLayout(12),
      md: computeLayout(6),
      sm: widgets.map((w, i) => ({
        i: String(w.id),
        x: 0,
        y: i * (w.hauteur || w.gridH || 3),
        w: 1,
        h: w.hauteur || w.gridH || 3,
        minW: 1,
        minH: 2,
      })),
    };
  }, [dashboard]);

  // Layout change -> save positions
  const handleLayoutChange = useCallback((layout) => {
    if (!dashboard?.widgets) return;
    const positions = {};
    layout.forEach(item => {
      positions[item.i] = { posX: item.x, posY: item.y, largeur: item.w, hauteur: item.h };
    });

    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => ({
        ...w,
        ...(positions[String(w.id)] || {}),
      })),
    }));

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
        const res = await addWidget(id, widgetData);
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
      const { id: _id, dashboardId: _dashId, ...config } = widget;
      const res = await addWidget(dashboard.id, {
        ...config,
        titre: (widget.titre || 'Widget') + ' (copie)',
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
