import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Edit, Trash2, BarChart3, Filter, Copy } from 'lucide-react';
import { executeWidget } from '../../api/biApi';
import WeaveSpinner from '../ui/WeaveSpinner';
import WidgetRenderer from './WidgetRenderer';
import { useCrossFilter } from './CrossFilterContext';

function timeAgo(loadTime) {
  const elapsed = Date.now() - loadTime;
  if (elapsed < 60000) return "à l'instant";
  if (elapsed < 3600000) return Math.floor(elapsed / 60000) + ' min';
  return Math.floor(elapsed / 3600000) + 'h';
}

export default function WidgetCard({ widget, filters, onEdit, onDelete, onDuplicate, onChartClick, onChartDoubleClick, index = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadTime, setLoadTime] = useState(null);
  const [freshness, setFreshness] = useState('');

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
          const result = res?.datas || res;
          const rows = result?.rows || [];
          const meta = result?.meta || {};
          let transformed;

          // Déterminer les clés de mesures réellement calculées
          const mesureKeys = (meta.mesures || []).map(m => m.cle);
          if (mesureKeys.length === 0) {
            // Fallback : déduire des clés présentes dans la première ligne
            const sample = rows[0] || {};
            for (const k of ['nombre', 'montant_total', 'montant_moyen', 'ratio']) {
              if (sample[k] !== undefined) mesureKeys.push(k);
            }
          }

          if (widget.typeWidget === 'TABLE') {
            const dimLabels = meta.dimensions || {};
            transformed = rows.map(row => {
              const entry = {};
              for (const [dimKey, dimVal] of Object.entries(row.dimensions || {})) {
                const label = dimLabels[dimKey] || dimKey;
                entry[label] = dimVal?.nom || dimVal?.id || '?';
              }
              for (const k of mesureKeys) {
                entry[k] = row[k] ?? 0;
              }
              return entry;
            });
          } else {
            transformed = rows.map(row => {
              const dims = Object.entries(row.dimensions || {});
              const nom = dims.length === 1
                ? (dims[0][1]?.nom || dims[0][1]?.id || '?')
                : dims.map(([, v]) => v?.nom || v?.id).join(' — ');
              const entry = { nom };
              for (const k of mesureKeys) {
                entry[k] = row[k] ?? 0;
              }
              return entry;
            });
          }
          setData(transformed);
          setLoadTime(Date.now());
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

  // Refresh freshness label every 30s
  useEffect(() => {
    if (!loadTime) return;
    setFreshness(timeAgo(loadTime));
    const interval = setInterval(() => setFreshness(timeAgo(loadTime)), 30000);
    return () => clearInterval(interval);
  }, [loadTime]);

  const handleChartClick = useCallback((dimension, valeur, nom) => {
    if (onChartClick) {
      onChartClick(widget.id, dimension, valeur, nom);
    }
  }, [onChartClick, widget.id]);

  const handleDoubleClick = useCallback((e) => {
    if (onChartDoubleClick) {
      onChartDoubleClick(widget.id);
    }
  }, [onChartDoubleClick, widget.id]);

  return (
    <div
      className={`bi-widget-card bi-widget-animate-in ${isFilterSource ? 'bi-widget-filter-source' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="bi-widget-card-header">
        <h4 title={widget.titre}>
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
          {onDuplicate && (
            <button onClick={() => onDuplicate(widget)} title="Dupliquer">
              <Copy size={13} />
            </button>
          )}
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
            config={{
              dataKey: widget.chartConfig?.tri?.colonne || 'nombre',
              mesure: widget.chartConfig?.tri?.colonne || 'nombre',
              dimension: 'nom',
            }}
            onChartClick={handleChartClick}
          />
        )}
      </div>
      {!loading && !error && freshness && (
        <span className="bi-widget-freshness">Mis à jour {freshness}</span>
      )}
    </div>
  );
}
