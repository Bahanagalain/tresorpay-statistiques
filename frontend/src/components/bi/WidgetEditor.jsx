import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Check, ChevronDown, Search, Building2, Landmark, Globe, MapPin, CreditCard, TrendingUp, HelpCircle, Layers } from 'lucide-react';
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
  { value: 'groupe_revenu', label: 'Par Groupe de revenus', icon: Layers },
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
  { value: 'SUM_PAYE', label: 'Montant payé' },
  { value: 'AVG', label: 'Montant moyen' },
  { value: 'ECART', label: 'Écart (en souffrance)' },
  { value: 'RATIO', label: 'Taux de paiement (%)' },
  { value: 'TAUX_COMPLETUDE', label: 'Taux de complétude (%)' },
];

function mesuresToApi(selected) {
  return selected.map(m => {
    if (m === 'SUM') return { type: 'SUM', colonne: 'montant' };
    if (m === 'SUM_PAYE') return { type: 'SUM_PAYE' };
    if (m === 'AVG') return { type: 'AVG', colonne: 'montant' };
    if (m === 'ECART') return { type: 'ECART' };
    if (m === 'RATIO') return { type: 'RATIO', filtreNum: { statut: 'PAID' } };
    if (m === 'TAUX_COMPLETUDE') return { type: 'TAUX_COMPLETUDE' };
    return { type: 'COUNT' };
  });
}

function mesureDataKey(m) {
  if (m === 'SUM') return 'montant_total';
  if (m === 'SUM_PAYE') return 'montant_paye';
  if (m === 'AVG') return 'montant_moyen';
  if (m === 'ECART') return 'ecart';
  if (m === 'RATIO') return 'ratio';
  if (m === 'TAUX_COMPLETUDE') return 'taux_completude';
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

const STEP_TOOLTIPS = {
  1: 'Choisissez comment afficher vos données',
  2: 'Le sujet détermine l\'axe principal de votre analyse',
  3: 'Filtrez pour cibler un périmètre précis',
  4: 'Ventiler par champ formulaire permet une analyse plus fine',
  5: 'Choisissez les valeurs à calculer',
};

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
  const [champFiltres, setChampFiltres] = useState({}); // { [champId]: valeur }

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

  // --- Ref: évite le reset des valeurs pré-remplies au premier montage en mode édition ---
  const editInitRef = useRef(!!widget?.id);

  // ═══════════════════════════════════════════════════════════════
  // Escape pour fermer
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // ═══════════════════════════════════════════════════════════════
  // Stepper visuel
  // ═══════════════════════════════════════════════════════════════

  const stepperSteps = useMemo(() => {
    const hasEntity = (sujet === 'ministere' && selectedMinistere)
      || (sujet === 'service' && (selectedMinistere || selectedService))
      || (sujet === 'domaine' && selectedDomaine)
      || (sujet === 'region' && selectedRegion)
      || sujet === 'statut'
      || sujet === 'temporel';

    const base = [
      { num: 1, label: 'Visualisation', completed: true, active: true },
      { num: 2, label: 'Sujet', completed: !!sujet, active: true },
      { num: 3, label: 'Périmètre', completed: !!hasEntity, active: !!sujet },
    ];

    if (selectedService) {
      base.push({ num: 4, label: 'Ventilation', completed: selectedDynDims.length > 0, active: true });
    }

    const mesureNum = selectedService ? 5 : 4;
    const titreNum = selectedService ? 6 : 5;
    base.push(
      { num: mesureNum, label: 'Mesures', completed: selectedMesures.length > 0, active: !!sujet },
      { num: titreNum, label: 'Titre', completed: !!titre.trim(), active: !!sujet },
    );
    return base;
  }, [sujet, selectedMinistere, selectedService, selectedDomaine, selectedRegion, selectedDynDims, selectedMesures, titre]);

  // ═══════════════════════════════════════════════════════════════
  // Recommandation intelligente du type de chart
  // ═══════════════════════════════════════════════════════════════

  const getRecommendedChart = useCallback(() => {
    if (sujet === 'temporel') return { type: 'CHART_LINE', reason: 'Recommandé pour les évolutions temporelles' };
    if (sujet === 'statut') return { type: 'CHART_PIE', reason: 'Idéal pour visualiser les proportions' };
    if (selectedDynDims.length >= 2) return { type: 'TABLE', reason: 'Recommandé pour les analyses multi-dimensions' };
    if (typeWidget === 'KPI_CARD' && selectedMesures.length > 1) return { type: 'CHART_BAR', reason: 'Un KPI ne peut afficher qu\'une mesure' };
    return null;
  }, [sujet, selectedDynDims, typeWidget, selectedMesures]);

  const recommendation = getRecommendedChart();

  // ═══════════════════════════════════════════════════════════════
  // Chargement initial (datasets)
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    fetchDatasets()
      .then(res => setDatasets(res?.datas || []))
      .finally(() => setLoadingInit(false));
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Pré-remplissage en mode édition
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!widget) return;
    const fl = widget.filtresLocaux || {};
    const dims = widget.dimensions || [];

    // Pré-remplir typeWidget (déjà fait via useState initial)

    // Pré-remplir le sujet
    if (fl.service_id) {
      setSujet('service');
    } else if (fl.ministere_id && !fl.service_id) {
      setSujet('ministere');
    } else if (fl.domaine_id) {
      setSujet('domaine');
    } else if (fl.org_unit_id || fl.region_id) {
      setSujet('region');
    } else if (dims.includes('statut_paiement') || dims.includes('statut')) {
      setSujet('statut');
    } else if (dims.some(d => d.startsWith('periode_'))) {
      setSujet('temporel');
      const periDim = dims.find(d => d.startsWith('periode_'));
      if (periDim) setGranularite(periDim.replace('periode_', ''));
    } else if (dims.includes('ministere')) {
      setSujet('ministere');
    } else if (dims.includes('service')) {
      setSujet('service');
    } else if (dims.includes('domaine')) {
      setSujet('domaine');
    } else if (dims.includes('region')) {
      setSujet('region');
    } else if (dims.includes('groupe_revenu')) {
      setSujet('groupe_revenu');
    }

    // Pré-remplir les sélections d'entités
    if (fl.ministere_id) setSelectedMinistere(fl.ministere_id);
    if (fl.service_id) setSelectedService(fl.service_id);
    if (fl.domaine_id) setSelectedDomaine(fl.domaine_id);
    if (fl.org_unit_id) setSelectedRegion(fl.org_unit_id);
    if (fl.region_id) setSelectedRegion(fl.region_id);

    // Pré-remplir les dimensions dynamiques (champ_N)
    const dynDims = dims.filter(d => d.startsWith('champ_'));
    if (dynDims.length > 0) setSelectedDynDims(dynDims);

    // Pré-remplir les mesures depuis chartConfig
    if (widget.chartConfig?.mesures?.length > 0) {
      const mesureKeys = widget.chartConfig.mesures.map(m => {
        if (m.type === 'SUM') return 'SUM';
        if (m.type === 'SUM_PAYE') return 'SUM_PAYE';
        if (m.type === 'AVG') return 'AVG';
        if (m.type === 'ECART') return 'ECART';
        if (m.type === 'RATIO') return 'RATIO';
        if (m.type === 'TAUX_COMPLETUDE') return 'TAUX_COMPLETUDE';
        return 'COUNT';
      });
      setSelectedMesures(mesureKeys);
    }

    // Pré-remplir le titre
    if (widget.titre) {
      setTitre(widget.titre);
      setTitreEdited(true);
    }

    // Pré-remplir les filtres de champs formulaire
    if (fl.champs && Object.keys(fl.champs).length > 0) {
      setChampFiltres(fl.champs);
    }
  }, [widget]);

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
      const isInit = editInitRef.current;
      if (!isInit) {
        setServices([]);
        setSelectedService(null);
        setServiceDimensions([]);
        setSelectedDynDims([]);
      }
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
      const isInit = editInitRef.current;
      if (!isInit) {
        setServiceDimensions([]);
        setSelectedDynDims([]);
        setChampFiltres({});
      }
      // Désactiver le flag après le premier chargement en mode édition
      if (isInit) editInitRef.current = false;
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
    } else if (sujet === 'groupe_revenu') {
      parts.push('Par groupe de revenus');
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
    } else if (sujet === 'groupe_revenu') {
      dimensions.push('groupe_revenu');
    } else if (sujet === 'statut') {
      dimensions.push('statut_paiement');
    } else if (sujet === 'temporel') {
      dimensions.push(`periode_${granularite}`);
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
        filtres: {
          ...filtres,
          ...(Object.keys(champFiltres).length > 0 ? { champs: champFiltres } : {}),
        },
        limite: 10,
      });
      setPreviewData(res?.datas || res);
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [buildQueryParams, selectedMesures, champFiltres]);

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
    setChampFiltres({});
    setTitreEdited(false);
  };

  const toggleDynDim = (cle) => {
    setSelectedDynDims(prev =>
      prev.includes(cle) ? prev.filter(d => d !== cle) : [...prev, cle]
    );
    // Clear filter for this field when unchecking
    setChampFiltres(prev => {
      if (prev[cle]) {
        const next = { ...prev };
        delete next[cle];
        return next;
      }
      return prev;
    });
  };

  const toggleChampFiltre = (cle, valeur) => {
    // Backend attend l'ID numérique (ex: "210"), pas la clé "champ_210"
    const champId = cle.replace('champ_', '');
    setChampFiltres(prev => {
      if (prev[champId] === valeur) {
        const next = { ...prev };
        delete next[champId];
        return next;
      }
      return { ...prev, [champId]: valeur };
    });
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
      filtresLocaux: {
        ...filtres,
        ...(Object.keys(champFiltres).length > 0 ? { champs: champFiltres } : {}),
      },
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
  const previewMeta = previewData?.meta || {};
  // Clés de mesures effectivement sélectionnées
  const activeMesureKeys = selectedMesures.map(m => mesureDataKey(m));

  const rendererData = (() => {
    if (typeWidget === 'TABLE') {
      const dimLabels = previewMeta.dimensions || {};
      const labelMap = (key) => {
        if (dimLabels[key]) return dimLabels[key];
        const dim = serviceDimensions.find(d => d.cle === key);
        if (dim) return dim.libelle;
        return key;
      };
      return previewRows.map(row => {
        const entry = {};
        for (const [dimKey, dimVal] of Object.entries(row.dimensions || {})) {
          entry[labelMap(dimKey)] = dimVal?.nom || dimVal?.id || '?';
        }
        for (const k of activeMesureKeys) {
          entry[k] = row[k] ?? 0;
        }
        return entry;
      });
    }
    return previewRows.map(row => {
      const entry = {};
      const dims = Object.entries(row.dimensions || {});
      entry.nom = dims.length === 1
        ? (dims[0][1]?.nom || dims[0][1]?.id || dims[0][1] || '(non défini)')
        : dims.map(([, v]) => v?.nom || v?.id || '?').join(' — ');
      for (const k of activeMesureKeys) {
        entry[k] = row[k] ?? 0;
      }
      return entry;
    });
  })();

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
                {/* ─── Stepper visuel ─── */}
                <div className="bi-stepper">
                  {stepperSteps.map((step, i) => {
                    const status = step.completed ? 'completed' : step.active ? 'active' : 'disabled';
                    return (
                      <div key={step.num} className={`bi-stepper-item ${status}`}>
                        <div className="bi-stepper-circle">
                          {step.completed ? <Check size={14} /> : step.num}
                        </div>
                        <span className="bi-stepper-label">{step.label}</span>
                        {i < stepperSteps.length - 1 && <div className="bi-stepper-line" />}
                      </div>
                    );
                  })}
                </div>

                {/* ─── Étape 1: Type de visualisation ─── */}
                <div className="bi-editor-step">
                  <label className="bi-label">
                    1. Type de visualisation
                    <HelpCircle size={13} className="bi-help-icon" title={STEP_TOOLTIPS[1]} />
                  </label>
                  <ChartTypeSelector value={typeWidget} onChange={setTypeWidget} />
                  {recommendation && typeWidget !== recommendation.type && (
                    <div className="bi-chart-recommendation" onClick={() => setTypeWidget(recommendation.type)}>
                      💡 {recommendation.reason}
                    </div>
                  )}
                </div>

                {/* ─── Étape 2: Sujet d'étude ─── */}
                <div className="bi-editor-step">
                  <label className="bi-label">
                    2. Sujet d'étude
                    <HelpCircle size={13} className="bi-help-icon" title={STEP_TOOLTIPS[2]} />
                  </label>
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
                    <label className="bi-label">
                      3. Périmètre
                      <HelpCircle size={13} className="bi-help-icon" title={STEP_TOOLTIPS[3]} />
                    </label>

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

                    {/* Par Groupe de revenus */}
                    {sujet === 'groupe_revenu' && (
                      <p className="bi-hint">Les données seront ventilées par groupe de revenus MINFI.</p>
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
                    <label className="bi-label">
                      4. Ventilation par champ formulaire (optionnel)
                      <HelpCircle size={13} className="bi-help-icon" title={STEP_TOOLTIPS[4]} />
                    </label>
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
                        {/* Filtres par valeur de champ */}
                        {serviceDimensions
                          .filter(d => selectedDynDims.includes(d.cle) && d.options && d.options.length > 0)
                          .map(d => (
                            <div key={`filtre-${d.cle}`} style={{ marginTop: '0.4rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border, #e5e7eb)' }}>
                              <span className="bi-hint" style={{ fontSize: '0.72rem', display: 'block', marginBottom: '0.25rem' }}>
                                Filtrer « {d.libelle} » sur une valeur :
                              </span>
                              <div className="bi-pills" style={{ gap: '0.25rem' }}>
                                {d.options.map(opt => {
                                  const val = typeof opt === 'string' ? opt : (opt.label || opt.value || opt);
                                  return (
                                    <span
                                      key={val}
                                      className={`bi-pill small ${champFiltres[d.cle.replace('champ_', '')] === val ? 'active' : ''}`}
                                      onClick={() => toggleChampFiltre(d.cle, val)}
                                      style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                                    >
                                      {val}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </>
                    ) : (
                      <p className="bi-hint">Aucun champ formulaire disponible pour ce service.</p>
                    )}
                  </div>
                )}

                {/* ─── Étape 5: Mesures ─── */}
                {sujet && (
                  <div className="bi-editor-step">
                    <label className="bi-label">
                      {selectedService ? '5' : '4'}. Indicateurs / Mesures
                      <HelpCircle size={13} className="bi-help-icon" title={STEP_TOOLTIPS[5]} />
                    </label>
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
              <div style={{ height: 350 }}>
                <WidgetRenderer
                  type={typeWidget}
                  data={rendererData}
                  config={{
                    mesure: mesureDataKey(selectedMesures[0]),
                    dimension: 'nom',
                  }}
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
