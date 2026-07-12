import React from 'react';
import { ChevronRight, X, Filter } from 'lucide-react';

export default function DrillDownStack({ stack, onNavigate, onReset }) {
  if (!stack || stack.length === 0) return null;

  return (
    <div className="bi-drilldown-bar">
      <Filter size={13} style={{ opacity: 0.6, flexShrink: 0 }} />

      <button
        className="bi-drilldown-item"
        onClick={() => onNavigate(-1)}
        title="Revenir au niveau racine"
      >
        Tous
      </button>

      {stack.map((level, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
          <button
            className={`bi-drilldown-item ${idx === stack.length - 1 ? 'active' : ''}`}
            onClick={() => onNavigate(idx)}
            title={`Revenir à ${level.nom || level.valeur}`}
          >
            {level.nom || level.valeur}
          </button>
        </React.Fragment>
      ))}

      <button
        className="bi-drilldown-reset"
        onClick={onReset}
        title="Réinitialiser la navigation"
      >
        <X size={13} />
      </button>
    </div>
  );
}
