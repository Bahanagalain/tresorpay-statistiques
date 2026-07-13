import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Edit, Trash2, BarChart3, Filter, Copy } from 'lucide-react';
import { executeWidget, executeWidgetKpi } from '../../api/biApi';
import WidgetRenderer from './WidgetRenderer';
import { useCrossFilter } from './CrossFilterContext';

function WidgetSkeleton({ type }) {
  if (type === 'KPI_CARD') {
    return (
      <div className="bi-skeleton-kpi">
        <div className="bi-skeleton-line" style={{ width: '40%', height: 12 }} />
        <div className="bi-skeleton-line" style={{ width: '60%', height: 28, marginTop: 8 }} />
        <div className="bi-skeleton-line" style={{ width: '50%', height: 10, marginTop: 8 }} />
      </div>
    );
  }
  if (type === 'TABLE') {
    return (
      <div className="bi-skeleton-table">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bi-skeleton-row">
            <div className="bi-skeleton-line" style={{ width: '30%' }} />
            <div className="bi-skeleton-line" style={{ width: '20%' }} />
            <div className="bi-skeleton-line" style={{ width: '25%' }} />
          </div>
        ))}
      </div>
    );
  }
  // Charts
  return (
    <div className="bi-skeleton-chart">
      <div className="bi-skeleton-bars">
        {[60, 85, 45, 70, 55, 90, 40].map((h, i) => (
          <div key={i} className="bi-skeleton-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

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

  const otherCrossFilters = useMemo(() => {
    return getCrossFiltersForWidget(widget.id);
  }, [getCrossFiltersForWidget, widget.id]);

  const mergedFilters = useMemo(() => {
    const merged = { ...(filters || {}) };
    Object.values(otherCrossFilters).forEach(({ dimension, valeur }) => {
      if (dimension && valeur) {
        merged[dimension] = valeur;
      }
    });
    return merged;
  }, [filters, otherCrossFilters]);

  const isFilterSource = useMemo(() => {
    return !!crossFilters[String(widget.id)];
  }, [crossFilters, widget.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const apiCall = widget.typeWidget === 'KPI_CARD'
      ? executeWidgetKpi(widget.id, { filtres: mergedFilters })
          .catch(() => executeWidget(widget.id, { filtres: mergedFilters }))
      : executeWidget(widget.id, { filtres: mergedFilters });

    apiCall
      .then(res => {
        if (!cancelled) {
          const result = res?.datas || res;

          if (widget.typeWidget === 'KPI_CARD') {
            setData(result);
            setLoadTime(Date.now());
            setLoading(false);
            return;
          }

          const rows = result?.rows || [];
          const meta = result?.meta || {};
          let transformed;

          const mesureKeys = (meta.mesures || []).map(m => m.cle);
          if (mesureKeys.length === 0) {
            const sample = rows[0] || {};
            for (const k of ['nombre', 'montant_total', 'montant_paye', 'montant_moyen', 'ratio', 'ecart', 'taux_completude']) {
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
  }, [widget.id, widget.typeWidget, mergedFilters]);

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

  const handleDoubleClick = useCallback(() => {
    if (onChartDoubleClick) {
      onChartDoubleClick(widget.id);
    }
  }, [onChartDoubleClick, widget.id]);

  return (
    <div
      className={`bi-widget-card bi-widget-animate-in ${isFilterSource ? 'bi-widget-filter-source' : ''}`}
      style={{
        animationDelay: `${index * 0.05}s`,
        ...(widget.chartConfig?.couleur ? { borderLeft: `3px solid ${widget.chartConfig.couleur}` } : {}),
      }}
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
        {loading && <WidgetSkeleton type={widget.typeWidget} />}
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
