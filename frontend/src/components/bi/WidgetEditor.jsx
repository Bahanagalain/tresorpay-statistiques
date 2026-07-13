import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Check, ChevronDown, Search, Building2, Landmark, Globe, MapPin, CreditCard, TrendingUp } from 'lucide-react';
import { fetchDatasets, fetchDimensions, biQueryPreview } from '../../api/biApi';
import { apiFetch } from '../../api/httpClient';
import WeaveSpinner from '../ui/WeaveSpinner';
import ChartTypeSelector from './ChartTypeSelector';
import WidgetRenderer from './WidgetRenderer';

// ─────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────

const SUJETS = [
  { value: 'ministere', label: 'Par Ministère', icon: Building2 },
  { value: 'service', label: 'Par Service', icon: Landmark },
  { value: 'domaine', label: 'Par Domaine', icon: Globe },
  { value: 'region', label: 'Par Région', icon: MapPin },
  { value: 'statut', label: 'Par Statut de paiement', icon: CreditCard },
  { value: 'temporel', label: 'Évolution temporelle', icon: TrendingUp },
];

const GRANULARITES = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'annee', label: 'Année' },
];

const MESURE_OPTIONS = [
  { value: 'COUNT', label: 'Nombre de soumissions', checked: true },
  { value: 'SUM', label: 'Montant total' },
  { value: 'AVG', label: 'Montant moyen' },
  { value: 'RATIO', label: 'Taux de paiement (%)' },
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

// ─────────────────────────────────────────────────────────────────────
// SearchableSelect — Dropdown recherchable inline
// ─────────────────────────────────────────────────────────────────────

function SearchableSelect({ options, value, onChange, placeholder, loading, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find(o => o.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => (o.nom || o.libelle || '').toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="bi-searchable-select" ref={containerRef}>
      <div
        className={`bi-searchable-select-trigger bi-input ${disabled ? 'disabled' : ''}`}
        onClick={() => { if (!disabled) { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); } }}
      >
        {loading ? (
          <span className="bi-searchable-select-placeholder">Chargement...</span>
        ) : selectedOption ? (
          <span className="bi-searchable-select-value">{selectedOption.nom || selectedOption.libelle}</span>
        ) : (
          <span className="bi-searchable-select-placeholder">{placeholder || 'Sélectionner...'}</span>
        )}
        <ChevronDown size={14} className="bi-searchable-select-chevron" />
      </div>

      {open && !disabled && (
        <div className="bi-searchable-select-dropdown">
          <div className="bi-searchable-select-search">
            <Search size={13} />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              autoFocus
            />
          </div>
          <ul className="bi-searchable-select-list">
            {filtered.length === 0 && (
              <li className="bi-searchable-select-empty">Aucun résultat</li>
            )}
            {filtered.map(opt => (
              <li
                key={opt.id}
                className={`bi-searchable-select-option ${opt.id === value ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.id)}
              >
                {opt.nom || opt.libelle}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// WidgetEditor — Composant principal
// ─────────────────────────────────────────────────────────────────────

export default function WidgetEditor({ widget, dashboardId, onSave, onClose }) {
  // --- State: étapes ---
  const [typeWidget, setTypeWidget] = useState(widget?.typeWidget || 'CHART_BAR');
  const [sujet, setSujet] = useState(null);
  const [granularite, setGranularite] = useState('mois');

  // --- State: entités sélectionnées ---
  const [selectedMinistere, setSelectedMinistere] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDomaine, setSelectedDomaine] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);

  // --- State: dimensions additionnelles (champs formulaire) ---
  const [serviceDimensions, setServiceDimensions] = useState([]);
  const [selectedDynDims, setSelectedDynDims] = useState([]);

  // --- State: mesures ---
  const [selectedMesures, setSelectedMesures] = useState(['COUNT']);

  // --- State: titre ---
  const [titre, setTitre] = useState(widget?.titre || '');
  const [titreEdited, setTitreEdited] = useState(false);

  // --- State: référentiels ---
  const [ministeres, setMinisteres] = useState([]);
  const [services, setServices] = useState([]);
  const [domaines, setDomaines] = useState([]);
  const [regions, setRegions] = useState([]);
  const [datasets, setDatasets] = useState([]);

  // --- State: loading ---
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingMinisteres, setLoadingMinisteres] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingDomaines, setLoadingDomaines] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingDimensions, setLoadingDimensions] = useState(false);

  // --- State: preview ---
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ═══════════════════════════════════════════════════════════════
  // Chargement initial (datasets)
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    fetchDatasets()
      .then(res => setDatasets(res?.datas || []))
      .finally(() => setLoadingInit(false));
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Chargement des référentiels selon le sujet
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (sujet === 'ministere' || sujet === 'service') {
      if (ministeres.length === 0) {
        setLoadingMinisteres(true);
        apiFetch('/referentiel/ministeres')
          .then(res => {
            const raw = res?.datas || res || [];
            const list = raw.map(m => ({ id: m.id, nom: m.nomFr || m.nom || m.shortName || m.id }));
            setMinisteres([{ id: '__all__', nom: 'Tous les ministères' }, ...list]);
          })
          .catch(() => setMinisteres([]))
          .finally(() => setLoadingMinisteres(false));
      }
    }
    if (sujet === 'domaine' && domaines.length === 0) {
      setLoadingDomaines(true);
      apiFetch('/referentiel/domaines')
        .then(res => {
          const raw = res?.datas || res || [];
          setDomaines(raw.map(d => ({ id: d.id, nom: d.nomFr || d.nom || d.id })));
        })
        .catch(() => setDomaines([]))
        .finally(() => setLoadingDomaines(false));
    }
    if (sujet === 'region' && regions.length === 0) {
      setLoadingRegions(true);
      apiFetch('/referentiel/orgUnits')
        .then(res => {
          const raw = res?.datas || res || [];
          setRegions(raw.map(o => ({ id: o.id, nom: o.nomFr || o.nom || o.code || o.id })));
        })
        .catch(() => setRegions([]))
        .finally(() => setLoadingRegions(false));
    }
  }, [sujet]);

  // ═══════════════════════════════════════════════════════════════
  // Chargement des services quand un ministère est choisi
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (sujet === 'service' && selectedMinistere && selectedMinistere !== '__all__') {
      setLoadingServices(true);
      setServices([]);
      setSelectedService(null);
      setServiceDimensions([]);
      setSelectedDynDims([]);
      apiFetch('/referentiel/services', { params: { ministere_id: selectedMinistere } })
        .then(res => {
          const raw = res?.datas || res || [];
          setServices(raw.map(s => ({ id: s.id, nom: s.nomFr || s.nom || s.nameFr || s.id })));
        })
        .catch(() => setServices([]))
        .finally(() => setLoadingServices(false));
    }
  }, [sujet, selectedMinistere]);

  // ═══════════════════════════════════════════════════════════════
  // Chargement des dimensions du service sélectionné
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (selectedService) {
      setLoadingDimensions(true);
      setServiceDimensions([]);
      setSelectedDynDims([]);
      fetchDimensions('soumissions', { service_id: selectedService })
        .then(res => {
          const data = res?.datas || res || {};
          setServiceDimensions(data.dynamiques || []);
        })
        .catch(() => setServiceDimensions([]))
        .finally(() => setLoadingDimensions(false));
    }
  }, [selectedService]);

  // ═══════════════════════════════════════════════════════════════
  // Auto-génération du titre
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (titreEdited) return;
    const parts = [];

    if (sujet === 'ministere') {
      if (selectedMinistere && selectedMinistere !== '__all__') {
        const m = ministeres.find(x => x.id === selectedMinistere);
        parts.push(m?.nom || 'Ministère');
      } else {
        parts.push('Tous ministères');
      }
    } else if (sujet === 'service') {
      if (selectedService) {
        const s = services.find(x => x.id === selectedService);
        parts.push(s?.nom || 'Service');
      } else if (selectedMinistere && selectedMinistere !== '__all__') {
        const m = ministeres.find(x => x.id === selectedMinistere);
        parts.push(m?.nom || 'Ministère');
      }
    } else if (sujet === 'domaine') {
      if (selectedDomaine) {
        const d = domaines.find(x => x.id === selectedDomaine);
        parts.push(d?.nom || d?.libelle || 'Domaine');
      } else {
        parts.push('Par domaine');
      }
    } else if (sujet === 'region') {
      if (selectedRegion) {
        const r = regions.find(x => x.id === selectedRegion);
        parts.push(r?.nom || r?.libelle || 'Région');
      } else {
        parts.push('Par région');
      }
    } else if (sujet === 'statut') {
      parts.push('Par statut de paiement');
    } else if (sujet === 'temporel') {
      parts.push(`Évolution (${granularite})`);
    }

    if (selectedDynDims.length > 0) {
      const dimLabels = selectedDynDims.map(cle => {
        const dim = serviceDimensions.find(d => d.cle === cle);
        return dim?.libelle || cle;
      });
      parts.push(dimLabels.join(', '));
    }

    setTitre(parts.length > 0 ? parts.join(' — ') : '');
  }, [sujet, selectedMinistere, selectedService, selectedDomaine, selectedRegion, granularite, selectedDynDims, titreEdited, ministeres, services, domaines, regions, serviceDimensions]);

  // ═══════════════════════════════════════════════════════════════
  // Construction des paramètres de requête
  // ═══════════════════════════════════════════════════════════════

  const buildQueryParams = useCallback(() => {
    const dimensions = [];
    const filtres = {};

    if (sujet === 'ministere') {
      dimensions.push('ministere');
      if (selectedMinistere && selectedMinistere !== '__all__') {
        filtres.ministere_id = selectedMinistere;
      }
    } else if (sujet === 'service') {
      dimensions.push('service');
      if (selectedMinistere && selectedMinistere !== '__all__') {
        filtres.ministere_id = selectedMinistere;
      }
      if (selectedService) {
        filtres.service_id = selectedService;
      }
    } else if (sujet === 'domaine') {
      dimensions.push('domaine');
      if (selectedDomaine) {
        filtres.domaine_id = selectedDomaine;
      }
    } else if (sujet === 'region') {
      dimensions.push('region');
      if (selectedRegion) {
        filtres.region_id = selectedRegion;
      }
    } else if (sujet === 'statut') {
      dimensions.push('statut_paiement');
    } else if (sujet === 'temporel') {
      dimensions.push(`date_${granularite}`);
    }

    // Ajouter les dimensions dynamiques
    dimensions.push(...selectedDynDims);

    return { dimensions, filtres };
  }, [sujet, selectedMinistere, selectedService, selectedDomaine, selectedRegion, granularite, selectedDynDims]);

  // ═══════════════════════════════════════════════════════════════
  // Preview
  // ═══════════════════════════════════════════════════════════════

  const runPreview = useCallback(async () => {
    const { dimensions, filtres } = buildQueryParams();
    if (dimensions.length === 0) { setPreviewData(null); return; }

    setPreviewLoading(true);
    try {
      const res = await biQueryPreview({
        dataset: 'soumissions',
        dimensions,
        mesures: mesuresToApi(selectedMesures),
        filtres,
        limite: 10,
      });
      setPreviewData(res?.datas || res);
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [buildQueryParams, selectedMesures]);

  useEffect(() => {
    const t = setTimeout(runPreview, 600);
    return () => clearTimeout(t);
  }, [runPreview]);

  // ═══════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════

  const handleSujetChange = (val) => {
    setSujet(val);
    setSelectedMinistere(null);
    setSelectedService(null);
    setSelectedDomaine(null);
    setSelectedRegion(null);
    setServiceDimensions([]);
    setSelectedDynDims([]);
    setTitreEdited(false);
  };

  const toggleDynDim = (cle) => {
    setSelectedDynDims(prev =>
      prev.includes(cle) ? prev.filter(d => d !== cle) : [...prev, cle]
    );
  };

  const toggleMesure = (val) => {
    setSelectedMesures(prev => {
      if (prev.includes(val)) {
        return prev.length > 1 ? prev.filter(m => m !== val) : prev;
      }
      return [...prev, val];
    });
  };

  const handleSave = () => {
    const { dimensions, filtres } = buildQueryParams();
    const ds = datasets.find(d => d.code === 'soumissions') || datasets[0];

    onSave({
      id: widget?.id,
      dashboardId,
      titre: titre || 'Sans titre',
      typeWidget,
      datasetId: ds?.id || null,
      dimensions,
      chartConfig: {
        mesures: mesuresToApi(selectedMesures),
        tri: { colonne: mesureDataKey(selectedMesures[0]), direction: 'desc' },
      },
      filtresLocaux: filtres,
      gridW: typeWidget === 'KPI_CARD' ? 3 : 6,
      gridH: typeWidget === 'KPI_CARD' ? 2 : 4,
    });
  };

  const { dimensions: currentDims } = buildQueryParams();
  const canSave = titre.trim() && sujet && currentDims.length > 0;

  // ═══════════════════════════════════════════════════════════════
  // Données preview pour le renderer
  // ═══════════════════════════════════════════════════════════════

  const previewRows = previewData?.rows || [];
  const rendererData = previewRows.map(row => {
    const entry = {};
    const dimEntries = Object.entries(row.dimensions || {});
    if (dimEntries.length > 0) {
      const [, v] = dimEntries[0];
      entry.nom = v?.nom || v?.id || v || '(non défini)';
    }
    entry.nombre = row.nombre || 0;
    entry.montant_total = row.montant_total || 0;
    entry.montant_moyen = row.montant_moyen || 0;
    entry.ratio = row.ratio || 0;
    return entry;
  });

  // ═══════════════════════════════════════════════════════════════
  // Rendu
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="bi-editor-overlay" onClick={onClose}>
      <div className="bi-editor-panel" onClick={e => e.stopPropagation()}>
        <div className="bi-editor-panel-header">
          <h2>{widget?.id ? 'Modifier le widget' : 'Nouveau widget'}</h2>
          <button className="bi-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="bi-editor-panel-body">
          <div className="bi-editor-config">
            {loadingInit ? <WeaveSpinner size={60} message="Chargement..." /> : (
              <>
                {/* ─── Étape 1: Type de visualisation ─── */}
                <div className="bi-editor-step">
                  <label className="bi-label">1. Type de visualisation</label>
                  <ChartTypeSelector value={typeWidget} onChange={setTypeWidget} />
                </div>

                {/* ─── Étape 2: Sujet d'étude ─── */}
                <div className="bi-editor-step">
                  <label className="bi-label">2. Sujet d'étude</label>
                  <div className="bi-sujet-grid">
                    {SUJETS.map(({ value: val, label, icon: Icon }) => (
                      <div
                        key={val}
                        className={`bi-sujet-item ${sujet === val ? 'selected' : ''}`}
                        onClick={() => handleSujetChange(val)}
                      >
                        <Icon size={18} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ─── Étape 3: Sélection entité ─── */}
                {sujet && (
                  <div className="bi-editor-step">
                    <label className="bi-label">3. Périmètre</label>

                    {/* Par Ministère */}
                    {sujet === 'ministere' && (
                      <SearchableSelect
                        options={ministeres}
                        value={selectedMinistere}
                        onChange={setSelectedMinistere}
                        placeholder="Choisir un ministère..."
                        loading={loadingMinisteres}
                      />
                    )}

                    {/* Par Service */}
                    {sujet === 'service' && (
                      <div className="bi-editor-sub-fields">
                        <div>
                          <span className="bi-hint" style={{ marginBottom: 4, display: 'block' }}>Ministère</span>
                          <SearchableSelect
                            options={ministeres}
                            value={selectedMinistere}
                            onChange={(id) => { setSelectedMinistere(id); setSelectedService(null); }}
                            placeholder="Filtrer par ministère..."
                            loading={loadingMinisteres}
                          />
                        </div>
                        {selectedMinistere && selectedMinistere !== '__all__' && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <span className="bi-hint" style={{ marginBottom: 4, display: 'block' }}>Service</span>
                            <SearchableSelect
                              options={services}
                              value={selectedService}
                              onChange={setSelectedService}
                              placeholder="Choisir un service..."
                              loading={loadingServices}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Par Domaine */}
                    {sujet === 'domaine' && (
                      <SearchableSelect
                        options={domaines}
                        value={selectedDomaine}
                        onChange={setSelectedDomaine}
                        placeholder="Choisir un domaine..."
                        loading={loadingDomaines}
                      />
                    )}

                    {/* Par Région */}
                    {sujet === 'region' && (
                      <SearchableSelect
                        options={regions}
                        value={selectedRegion}
                        onChange={setSelectedRegion}
                        placeholder="Choisir une région..."
                        loading={loadingRegions}
                      />
                    )}

                    {/* Par Statut */}
                    {sujet === 'statut' && (
                      <p className="bi-hint">Les données seront groupées par statut de paiement (payé, en attente, expiré).</p>
                    )}

                    {/* Évolution temporelle */}
                    {sujet === 'temporel' && (
                      <div className="bi-granularite-grid">
                        {GRANULARITES.map(g => (
                          <div
                            key={g.value}
                            className={`bi-pill ${granularite === g.value ? 'active' : ''}`}
                            onClick={() => setGranularite(g.value)}
                          >
                            {g.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Étape 4: Dimensions additionnelles ─── */}
                {selectedService && (
                  <div className="bi-editor-step">
                    <label className="bi-label">4. Ventilation par champ formulaire (optionnel)</label>
                    {loadingDimensions ? (
                      <WeaveSpinner size={30} />
                    ) : serviceDimensions.length > 0 ? (
                      <>
                        <p className="bi-hint" style={{ marginBottom: '0.4rem' }}>
                          Champs spécifiques à ce service. Cochez pour ventiler l'analyse.
                        </p>
                        <div className="bi-pills">
                          {serviceDimensions.map(d => (
                            <span
                              key={d.cle}
                              className={`bi-pill ${selectedDynDims.includes(d.cle) ? 'active' : ''}`}
                              onClick={() => toggleDynDim(d.cle)}
                            >
                              {d.libelle}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="bi-hint">Aucun champ formulaire disponible pour ce service.</p>
                    )}
                  </div>
                )}

                {/* ─── Étape 5: Mesures ─── */}
                {sujet && (
                  <div className="bi-editor-step">
                    <label className="bi-label">{selectedService ? '5' : '4'}. Indicateurs / Mesures</label>
                    <div className="bi-mesures-list">
                      {MESURE_OPTIONS.map(m => (
                        <label key={m.value} className="bi-mesure-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedMesures.includes(m.value)}
                            onChange={() => toggleMesure(m.value)}
                          />
                          <span>{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── Étape 6: Titre ─── */}
                {sujet && (
                  <div className="bi-editor-step">
                    <label className="bi-label">{selectedService ? '6' : '5'}. Titre du widget</label>
                    <input
                      type="text"
                      value={titre}
                      onChange={e => { setTitre(e.target.value); setTitreEdited(true); }}
                      placeholder="Ex: Certificats médicaux — Centre — Femmes concours"
                      className="bi-input"
                    />
                    {!titreEdited && titre && (
                      <p className="bi-hint" style={{ marginTop: 4 }}>Auto-généré. Modifiez si besoin.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── Preview (colonne droite) ─── */}
          <div className="bi-editor-preview">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Aperçu</h3>
            {previewLoading && <WeaveSpinner size={50} />}
            {!previewLoading && rendererData.length > 0 && (
              <div style={{ height: 280 }}>
                <WidgetRenderer
                  type={typeWidget}
                  data={rendererData}
                  config={{ dataKey: mesureDataKey(selectedMesures[0]) }}
                />
              </div>
            )}
            {!previewLoading && rendererData.length === 0 && !sujet && (
              <div className="bi-editor-preview-empty">
                <p className="bi-hint">Choisissez un sujet d'étude pour voir l'aperçu.</p>
              </div>
            )}
            {!previewLoading && rendererData.length === 0 && sujet && (
              <div className="bi-editor-preview-empty">
                <p className="bi-hint">Complétez la configuration pour voir l'aperçu en temps réel.</p>
              </div>
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
