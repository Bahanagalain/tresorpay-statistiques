import React, { useState, useEffect, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import { fetchDatasets, fetchDimensions, biQueryPreview } from '../../api/biApi';
import WeaveSpinner from '../ui/WeaveSpinner';
import ChartTypeSelector from './ChartTypeSelector';
import WidgetRenderer from './WidgetRenderer';

const MESURE_TYPES = [
  { value: 'COUNT', label: 'Nombre (COUNT)' },
  { value: 'SUM_MONTANT', label: 'Somme montant (SUM)' },
  { value: 'AVG_MONTANT', label: 'Moyenne montant (AVG)' },
  { value: 'RATIO', label: 'Ratio (%)' },
];

export default function WidgetEditor({ widget, dashboardId, onSave, onClose }) {
  // Config state
  const [typeWidget, setTypeWidget] = useState(widget?.typeWidget || 'CHART_BAR');
  const [datasetCode, setDatasetCode] = useState(widget?.config?.datasetCode || '');
  const [selectedDimensions, setSelectedDimensions] = useState(widget?.config?.dimensions || []);
  const [mesure, setMesure] = useState(widget?.config?.mesure || 'COUNT');
  const [titre, setTitre] = useState(widget?.titre || '');
  const [filtresLocaux, setFiltresLocaux] = useState(widget?.config?.filtresLocaux || {});

  // Data state
  const [datasets, setDatasets] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load datasets on mount
  useEffect(() => {
    let cancelled = false;
    fetchDatasets()
      .then(res => { if (!cancelled) setDatasets(res?.datas || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Load dimensions when dataset changes
  useEffect(() => {
    if (!datasetCode) { setDimensions([]); return; }
    let cancelled = false;
    fetchDimensions(datasetCode)
      .then(res => { if (!cancelled) setDimensions(res?.datas || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [datasetCode]);

  // Auto-preview
  const runPreview = useCallback(async () => {
    if (!datasetCode || selectedDimensions.length === 0) {
      setPreviewData(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await biQueryPreview({
        datasetCode,
        dimensions: selectedDimensions,
        mesure,
        filtres: filtresLocaux,
        limit: 20,
      });
      setPreviewData(res?.datas || res);
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [datasetCode, selectedDimensions, mesure, filtresLocaux]);

  useEffect(() => {
    const timer = setTimeout(runPreview, 500);
    return () => clearTimeout(timer);
  }, [runPreview]);

  const toggleDimension = (dim) => {
    setSelectedDimensions(prev =>
      prev.includes(dim) ? prev.filter(d => d !== dim) : [...prev, dim]
    );
  };

  const handleSave = () => {
    onSave({
      id: widget?.id,
      dashboardId,
      titre,
      typeWidget,
      config: {
        datasetCode,
        dimensions: selectedDimensions,
        mesure,
        filtresLocaux,
        dimension: selectedDimensions[0],
      },
    });
  };

  return (
    <div className="bi-editor-overlay" onClick={onClose}>
      <div className="bi-editor-panel" onClick={e => e.stopPropagation()}>
        <div className="bi-editor-panel-header">
          <h2>{widget?.id ? 'Modifier le widget' : 'Nouveau widget'}</h2>
          <button className="bi-btn-secondary" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="bi-editor-panel-body">
          {/* Configuration */}
          <div className="bi-editor-config">
            {loading ? (
              <WeaveSpinner size={60} message="Chargement..." />
            ) : (
              <>
                {/* Titre */}
                <div className="bi-editor-step">
                  <h3>Titre du widget</h3>
                  <input
                    type="text"
                    value={titre}
                    onChange={e => setTitre(e.target.value)}
                    placeholder="Ex: Recettes par ministère"
                    style={{
                      width: '100%', padding: '0.45rem 0.7rem',
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 6, fontSize: '0.85rem',
                    }}
                  />
                </div>

                {/* Étape 1 : Type */}
                <div className="bi-editor-step">
                  <h3>1. Type de visualisation</h3>
                  <ChartTypeSelector value={typeWidget} onChange={setTypeWidget} />
                </div>

                {/* Étape 2 : Dataset + Dimensions */}
                <div className="bi-editor-step">
                  <h3>2. Source de données</h3>
                  <select
                    value={datasetCode}
                    onChange={e => { setDatasetCode(e.target.value); setSelectedDimensions([]); }}
                    style={{
                      width: '100%', padding: '0.45rem 0.7rem',
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 6, fontSize: '0.85rem', marginBottom: '0.75rem',
                    }}
                  >
                    <option value="">-- Choisir un dataset --</option>
                    {datasets.map(ds => (
                      <option key={ds.code} value={ds.code}>{ds.libelle || ds.code}</option>
                    ))}
                  </select>

                  {dimensions.length > 0 && (
                    <>
                      <h3 style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>Dimensions</h3>
                      <div className="bi-pills">
                        {dimensions.map(dim => (
                          <span
                            key={dim.code || dim}
                            className={`bi-pill ${selectedDimensions.includes(dim.code || dim) ? 'active' : ''}`}
                            onClick={() => toggleDimension(dim.code || dim)}
                          >
                            {dim.libelle || dim.code || dim}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Étape 3 : Mesure */}
                <div className="bi-editor-step">
                  <h3>3. Mesure</h3>
                  <div className="bi-pills">
                    {MESURE_TYPES.map(m => (
                      <span
                        key={m.value}
                        className={`bi-pill ${mesure === m.value ? 'active' : ''}`}
                        onClick={() => setMesure(m.value)}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Étape 4 : Filtres locaux */}
                <div className="bi-editor-step">
                  <h3>4. Filtres locaux (optionnel)</h3>
                  <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                    Les filtres globaux du dashboard s'appliquent automatiquement.
                    Ajoutez ici des filtres spécifiques à ce widget si nécessaire.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="bi-editor-preview">
            <h3>Aperçu</h3>
            {previewLoading && <WeaveSpinner size={50} />}
            {!previewLoading && previewData && (
              <div style={{ height: 220 }}>
                <WidgetRenderer
                  type={typeWidget}
                  data={previewData}
                  config={{ dimension: selectedDimensions[0], mesure: getMesureDataKey(mesure) }}
                />
              </div>
            )}
            {!previewLoading && !previewData && (
              <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Sélectionnez un dataset et des dimensions pour voir l'aperçu.
              </p>
            )}
          </div>
        </div>

        <div className="bi-editor-panel-footer">
          <button className="bi-btn-secondary" onClick={onClose}>Annuler</button>
          <button
            className="bi-btn-primary"
            onClick={handleSave}
            disabled={!titre || !datasetCode || selectedDimensions.length === 0}
          >
            <Check size={15} />
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}

function getMesureDataKey(mesure) {
  switch (mesure) {
    case 'SUM_MONTANT': return 'montant_total';
    case 'AVG_MONTANT': return 'montant_moyen';
    case 'RATIO': return 'ratio';
    case 'COUNT':
    default: return 'nombre';
  }
}
