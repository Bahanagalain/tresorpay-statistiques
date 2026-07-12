import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveGridLayout } from 'react-grid-layout';
import { Plus, Save, ArrowLeft, LayoutDashboard } from 'lucide-react';
import {
  fetchDashboard, updateDashboard,
  addWidget, updateWidget, deleteWidget,
} from '../../api/biApi';
import WeaveSpinner from '../../components/ui/WeaveSpinner';
import WidgetCard from '../../components/bi/WidgetCard';
import WidgetEditor from '../../components/bi/WidgetEditor';
import FilterBar from '../../components/bi/FilterBar';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './bi.css';

export default function DashboardBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [editingWidget, setEditingWidget] = useState(null); // null = fermé, {} = nouveau, widget = edition
  const [titre, setTitre] = useState('');
  const titleTimeout = useRef(null);

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
      updateDashboard(id, { titre: val }).catch(() => {});
    }, 1000);
  };

  // Build layouts from widgets
  const getLayouts = useCallback(() => {
    if (!dashboard?.widgets) return { lg: [], md: [], sm: [] };
    const widgets = dashboard.widgets;
    return {
      lg: widgets.map((w, i) => ({
        i: String(w.id),
        x: w.posX ?? (i % 3) * 4,
        y: w.posY ?? Math.floor(i / 3) * 4,
        w: w.largeur || 4,
        h: w.hauteur || 3,
        minW: 2,
        minH: 2,
      })),
      md: widgets.map((w, i) => ({
        i: String(w.id),
        x: w.posX ?? (i % 2) * 6,
        y: w.posY ?? Math.floor(i / 2) * 4,
        w: Math.min(w.largeur || 4, 6),
        h: w.hauteur || 3,
        minW: 2,
        minH: 2,
      })),
      sm: widgets.map((w, i) => ({
        i: String(w.id),
        x: 0,
        y: i * 4,
        w: 12,
        h: w.hauteur || 3,
        minW: 12,
        minH: 2,
      })),
    };
  }, [dashboard]);

  // Layout change → save positions
  const handleLayoutChange = useCallback((layout) => {
    if (!dashboard?.widgets) return;
    const positions = {};
    layout.forEach(item => {
      positions[item.i] = { posX: item.x, posY: item.y, largeur: item.w, hauteur: item.h };
    });

    // Update local state
    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => ({
        ...w,
        ...(positions[String(w.id)] || {}),
      })),
    }));

    // Persist each widget position
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
        // Update existing
        const res = await updateWidget(widgetData.id, widgetData);
        const updated = res?.datas || res;
        setDashboard(prev => ({
          ...prev,
          widgets: prev.widgets.map(w => w.id === widgetData.id ? { ...w, ...updated } : w),
        }));
      } else {
        // Create new
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

  const handleWidgetDelete = async (widgetId) => {
    if (!confirm('Supprimer ce widget ?')) return;
    try {
      await deleteWidget(widgetId);
      setDashboard(prev => ({
        ...prev,
        widgets: prev.widgets.filter(w => w.id !== widgetId),
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <WeaveSpinner size={80} message="Chargement du dashboard..." />;
  if (error && !dashboard) return <p style={{ padding: '2rem', color: '#dc2626' }}>{error}</p>;

  const widgets = dashboard?.widgets || [];
  const layouts = getLayouts();

  return (
    <div className="bi-builder">
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
        </div>
        <div className="bi-builder-actions">
          <button className="bi-btn-secondary" onClick={() => setEditingWidget({})}>
            <Plus size={15} />
            Ajouter widget
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
        onFiltersChange={setFilters}
      />

      {/* Grid */}
      <div className="bi-builder-body">
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
            onLayoutChange={handleLayoutChange}
            draggableHandle=".bi-widget-card-header"
            isResizable
            isDraggable
          >
            {widgets.map(widget => (
              <div key={String(widget.id)}>
                <WidgetCard
                  widget={widget}
                  filters={filters}
                  onEdit={(w) => setEditingWidget(w)}
                  onDelete={handleWidgetDelete}
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
    </div>
  );
}
