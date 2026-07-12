import React, { useState, useEffect, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import { fetchDatasets, fetchDimensions, biQueryPreview } from '../../api/biApi';
import WeaveSpinner from '../ui/WeaveSpinner';
import ChartTypeSelector from './ChartTypeSelector';
import WidgetRenderer from './WidgetRenderer';

const MESURE_OPTIONS = [
  { value: 'COUNT', label: 'Nombre (COUNT)' },
  { value: 'SUM', label: 'Somme montant (SUM)' },
  { value: 'AVG', label: 'Moyenne montant (AVG)' },
  { value: 'RATIO', label: 'Taux paiement (%)' },
];

function mesuresToApi(selected) {
  return selected.map(m => {
    if (m === 'SUM') return { type: 'SUM', colonne: 'montant' };
    if (m === 'AVG') return { type: 'AVG', colonne: 'montant' };
    if (m === 'RATIO') return { type: 'RATIO', filtreNum: { statut: 'PAID' } };
    return { type: 'COUNT' };
  });
}

function mesureDataKey(m) {
  if (m === 'SUM') return 'montant_total';
  if (m === 'AVG') return 'montant_moyen';
  if (m === 'RATIO') return 'ratio';
  return 'nombre';
}

export default function WidgetEditor({ widget, dashboardId, onSave, onClose }) {
  const [typeWidget, setTypeWidget] = useState(widget?.typeWidget || 'CHART_BAR');
  const [datasetCode, setDatasetCode] = useState('soumissions');
  const [datasetId, setDatasetId] = useState(widget?.datasetId || null);
  const [selectedDims, setSelectedDims] = useState(widget?.dimensions || []);
  const [selectedMesures, setSelectedMesures] = useState(['COUNT']);
  const [titre, setTitre] = useState(widget?.titre || '');

  const [datasets, setDatasets] = useState([]);
  const [allDimensions, setAllDimensions] = useState({ fixes: [], temporelles: [], dynamiques: [] });
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Init from existing widget
  useEffect(() => {
    if (widget?.dataset?.code) setDatasetCode(widget.dataset.code);
    if (widget?.datasetId) setDatasetId(widget.datasetId);
    if (widget?.dimensions) setSelectedDims(widget.dimensions);
    if (widget?.chartConfig?.mesures) {
      setSelectedMesures(widget.chartConfig.mesures.map(m => m.type));
    }
  }, [widget]);

  // Load datasets
  useEffect(() => {
    fetchDatasets()
      .then(res => {
        const ds = res?.datas || [];
        setDatasets(ds);
        if (!datasetId && ds.length > 0) {
          const first = ds.find(d => d.code === 'soumissions') || ds[0];
          setDatasetCode(first.code);
          setDatasetId(first.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Load dimensions when dataset changes
  useEffect(() => {
    if (!datasetCode) return;
    fetchDimensions(datasetCode)
      .then(res => {
        const data = res?.datas || res || {};
        setAllDimensions({
          fixes: data.fixes || [],
          temporelles: data.temporelles || [],
          dynamiques: data.dynamiques || [],
        });
      })
      .catch(() => setAllDimensions({ fixes: [], temporelles: [], dynamiques: [] }));
  }, [datasetCode]);

  // Preview
  const runPreview = useCallback(async () => {
    if (!datasetCode || selectedDims.length === 0) { setPreviewData(null); return; }
    setPreviewLoading(true);
    try {
      const res = await biQueryPreview({
        dataset: datasetCode,
        dimensions: selectedDims,
        mesures: mesuresToApi(selectedMesures),
        limite: 10,
      });
      setPreviewData(res?.datas || res);
    } catch { setPreviewData(null); }
    finally { setPreviewLoading(false); }
  }, [datasetCode, selectedDims, selectedMesures]);

  useEffect(() => {
    const t = setTimeout(runPreview, 600);
    return () => clearTimeout(t);
  }, [runPreview]);

  const toggleDim = (cle) => {
    setSelectedDims(prev => prev.includes(cle) ? prev.filter(d => d !== cle) : [...prev, cle]);
  };

  const toggleMesure = (val) => {
    setSelectedMesures(prev => {
      if (prev.includes(val)) {
        return prev.length > 1 ? prev.filter(m => m !== val) : prev; // au moins 1
      }
      return [...prev, val];
    });
  };

  const handleSave = () => {
    const ds = datasets.find(d => d.code === datasetCode);
    onSave({
      id: widget?.id,
      dashboardId,
      titre: titre || 'Sans titre',
      typeWidget,
      datasetId: ds?.id || datasetId,
      dimensions: selectedDims,
      chartConfig: {
        mesures: mesuresToApi(selectedMesures),
        tri: { colonne: mesureDataKey(selectedMesures[0]), direction: 'desc' },
      },
      gridW: typeWidget === 'KPI_CARD' ? 3 : 6,
      gridH: typeWidget === 'KPI_CARD' ? 2 : 4,
    });
  };

  const canSave = titre.trim() && datasetCode && selectedDims.length > 0;

  // Préparer les données preview pour le renderer
  const previewRows = previewData?.rows || [];
  const rendererData = previewRows.map(row => {
    const entry = {};
    for (const [k, v] of Object.entries(row.dimensions || {})) {
      entry.nom = v.nom || v.id || '(non défini)';
    }
    entry.nombre = row.nombre || 0;
    entry.montant_total = row.montant_total || 0;
    entry.montant_moyen = row.montant_moyen || 0;
    entry.ratio = row.ratio || 0;
    return entry;
  });

  return (
    <div className="bi-editor-overlay" onClick={onClose}>
      <div className="bi-editor-panel" onClick={e => e.stopPropagation()}>
        <div className="bi-editor-panel-header">
          <h2>{widget?.id ? 'Modifier le widget' : 'Nouveau widget'}</h2>
          <button className="bi-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="bi-editor-panel-body">
          <div className="bi-editor-config">
            {loading ? <WeaveSpinner size={60} message="Chargement..." /> : (
              <>
                {/* Titre */}
                <div className="bi-editor-step">
                  <label className="bi-label">Titre du widget</label>
                  <input
                    type="text" value={titre} onChange={e => setTitre(e.target.value)}
                    placeholder="Ex: Recettes par ministère"
                    className="bi-input"
                  />
                </div>

                {/* Type */}
                <div className="bi-editor-step">
                  <label className="bi-label">1. Type de visualisation</label>
                  <ChartTypeSelector value={typeWidget} onChange={setTypeWidget} />
                </div>

                {/* Dataset */}
                <div className="bi-editor-step">
                  <label className="bi-label">2. Source de données</label>
                  <select
                    value={datasetCode} className="bi-input"
                    onChange={e => {
                      const code = e.target.value;
                      setDatasetCode(code);
                      setDatasetId(datasets.find(d => d.code === code)?.id || null);
                      setSelectedDims([]);
                    }}
                  >
                    {datasets.map(ds => (
                      <option key={ds.code} value={ds.code}>{ds.libelle}</option>
                    ))}
                  </select>
                </div>

                {/* Dimensions */}
                <div className="bi-editor-step">
                  <label className="bi-label">3. Dimensions (axes d'analyse)</label>
                  {allDimensions.fixes.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span className="bi-dim-section-label">Fixes</span>
                      <div className="bi-pills">
                        {allDimensions.fixes.map(d => (
                          <span key={d.cle}
                            className={`bi-pill ${selectedDims.includes(d.cle) ? 'active' : ''}`}
                            onClick={() => toggleDim(d.cle)}
                          >{d.libelle}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {allDimensions.temporelles.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span className="bi-dim-section-label">Temporelles</span>
                      <div className="bi-pills">
                        {allDimensions.temporelles.map(d => (
                          <span key={d.cle}
                            className={`bi-pill ${selectedDims.includes(d.cle) ? 'active' : ''}`}
                            onClick={() => toggleDim(d.cle)}
                          >{d.libelle}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {allDimensions.dynamiques.length > 0 && (
                    <div>
                      <span className="bi-dim-section-label">Champs formulaire</span>
                      <div className="bi-pills">
                        {allDimensions.dynamiques.map(d => (
                          <span key={d.cle}
                            className={`bi-pill ${selectedDims.includes(d.cle) ? 'active' : ''}`}
                            onClick={() => toggleDim(d.cle)}
                          >{d.libelle}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedDims.length === 0 && (
                    <p className="bi-hint">Sélectionnez au moins une dimension pour l'analyse.</p>
                  )}
                </div>

                {/* Mesures */}
                <div className="bi-editor-step">
                  <label className="bi-label">4. Mesures (plusieurs possibles)</label>
                  <div className="bi-pills">
                    {MESURE_OPTIONS.map(m => (
                      <span key={m.value}
                        className={`bi-pill ${selectedMesures.includes(m.value) ? 'active' : ''}`}
                        onClick={() => toggleMesure(m.value)}
                      >{m.label}</span>
                    ))}
                  </div>
                </div>

                {/* Filtres placeholder */}
                <div className="bi-editor-step">
                  <label className="bi-label">5. Filtres locaux (optionnel)</label>
                  <p className="bi-hint">Les filtres globaux du dashboard s'appliquent automatiquement.</p>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="bi-editor-preview">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>APERCU</h3>
            {previewLoading && <WeaveSpinner size={50} />}
            {!previewLoading && rendererData.length > 0 && (
              <div style={{ height: 250 }}>
                <WidgetRenderer
                  type={typeWidget}
                  data={rendererData}
                  config={{ dataKey: mesureDataKey(selectedMesures[0]) }}
                />
              </div>
            )}
            {!previewLoading && rendererData.length === 0 && (
              <p className="bi-hint">Sélectionnez un dataset et des dimensions pour voir l'aperçu.</p>
            )}
          </div>
        </div>

        <div className="bi-editor-panel-footer">
          <button className="bi-btn-secondary" onClick={onClose}>Annuler</button>
          <button className="bi-btn-primary" onClick={handleSave} disabled={!canSave}>
            <Check size={15} /> Valider
          </button>
        </div>
      </div>
    </div>
  );
}
