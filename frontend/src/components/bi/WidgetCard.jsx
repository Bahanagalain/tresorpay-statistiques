import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Edit, Trash2, BarChart3, Filter } from 'lucide-react';
import { executeWidget } from '../../api/biApi';
import WeaveSpinner from '../ui/WeaveSpinner';
import WidgetRenderer from './WidgetRenderer';
import { useCrossFilter } from './CrossFilterContext';

export default function WidgetCard({ widget, filters, onEdit, onDelete, onChartClick, onChartDoubleClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { crossFilters, getCrossFiltersForWidget } = useCrossFilter();

  // Cross-filters from other widgets (not this one)
  const otherCrossFilters = useMemo(() => {
    return getCrossFiltersForWidget(widget.id);
  }, [getCrossFiltersForWidget, widget.id]);

  // Merge global filters + cross-filters into a single filter object
  const mergedFilters = useMemo(() => {
    const merged = { ...(filters || {}) };
    Object.values(otherCrossFilters).forEach(({ dimension, valeur }) => {
      if (dimension && valeur) {
        merged[dimension] = valeur;
      }
    });
    return merged;
  }, [filters, otherCrossFilters]);

  // Is this widget the source of an active cross-filter?
  const isFilterSource = useMemo(() => {
    return !!crossFilters[String(widget.id)];
  }, [crossFilters, widget.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    executeWidget(widget.id, { filtres: mergedFilters })
      .then(res => {
        if (!cancelled) {
          setData(res?.datas || res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Erreur');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [widget.id, mergedFilters]);

  const handleChartClick = useCallback((dimension, valeur, nom) => {
    if (onChartClick) {
      onChartClick(widget.id, dimension, valeur, nom);
    }
  }, [onChartClick, widget.id]);

  const handleDoubleClick = useCallback((e) => {
    // Double-click on the widget body triggers drill-down
    // Actual drill-down data comes from the last chart click stored in parent
    if (onChartDoubleClick) {
      onChartDoubleClick(widget.id);
    }
  }, [onChartDoubleClick, widget.id]);

  return (
    <div className={`bi-widget-card ${isFilterSource ? 'bi-widget-filter-source' : ''}`}>
      <div className="bi-widget-card-header">
        <h4>
          <BarChart3 size={13} style={{ marginRight: 4, opacity: 0.5 }} />
          {widget.titre || 'Widget'}
          {isFilterSource && (
            <span className="bi-widget-filter-badge" title="Ce widget filtre les autres">
              <Filter size={10} />
            </span>
          )}
        </h4>
        <div className="bi-widget-actions">
          <button onClick={() => onEdit(widget)} title="Modifier">
            <Edit size={13} />
          </button>
          <button className="danger" onClick={() => onDelete(widget.id)} title="Supprimer">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="bi-widget-card-body" onDoubleClick={handleDoubleClick}>
        {loading && <WeaveSpinner size={50} />}
        {error && <p style={{ fontSize: '0.78rem', color: '#dc2626' }}>{error}</p>}
        {!loading && !error && (
          <WidgetRenderer
            type={widget.typeWidget}
            data={data}
            config={widget.config || {}}
            onChartClick={handleChartClick}
          />
        )}
      </div>
    </div>
  );
}
