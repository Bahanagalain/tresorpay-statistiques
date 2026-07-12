import React, { useState, useEffect } from 'react';
import { Edit, Trash2, BarChart3 } from 'lucide-react';
import { executeWidget } from '../../api/biApi';
import WeaveSpinner from '../ui/WeaveSpinner';
import WidgetRenderer from './WidgetRenderer';

export default function WidgetCard({ widget, filters, onEdit, onDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    executeWidget(widget.id, { filtres: filters || {} })
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
  }, [widget.id, filters]);

  return (
    <div className="bi-widget-card">
      <div className="bi-widget-card-header">
        <h4>
          <BarChart3 size={13} style={{ marginRight: 4, opacity: 0.5 }} />
          {widget.titre || 'Widget'}
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
      <div className="bi-widget-card-body">
        {loading && <WeaveSpinner size={50} />}
        {error && <p style={{ fontSize: '0.78rem', color: '#dc2626' }}>{error}</p>}
        {!loading && !error && (
          <WidgetRenderer
            type={widget.typeWidget}
            data={data}
            config={widget.config || {}}
          />
        )}
      </div>
    </div>
  );
}
