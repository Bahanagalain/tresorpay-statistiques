import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Filter, XCircle, X } from 'lucide-react';
import DatePresetFilter from '../ui/DatePresetFilter';
import { fetchFiltreValeurs } from '../../api/biApi';
import { useCrossFilter } from './CrossFilterContext';

export default function FilterBar({ datasetCode, onFiltersChange, resultCount }) {
  const [periode, setPeriode] = useState(null);
  const [ministere, setMinistere] = useState('');
  const [region, setRegion] = useState('');
  const [statut, setStatut] = useState('');

  const [ministeres, setMinisteres] = useState([]);
  const [regions, setRegions] = useState([]);
  const [statuts, setStatuts] = useState([]);

  const { crossFilters, clearAllCrossFilters } = useCrossFilter();

  const crossFilterCount = Object.keys(crossFilters).length;

  useEffect(() => {
    if (!datasetCode) return;
    let cancelled = false;

    Promise.allSettled([
      fetchFiltreValeurs(datasetCode, 'ministere'),
      fetchFiltreValeurs(datasetCode, 'region'),
      fetchFiltreValeurs(datasetCode, 'statut'),
    ]).then(([m, r, s]) => {
      if (cancelled) return;
      if (m.status === 'fulfilled') setMinisteres(m.value?.datas || []);
      if (r.status === 'fulfilled') setRegions(r.value?.datas || []);
      if (s.status === 'fulfilled') setStatuts(s.value?.datas || []);
    });

    return () => { cancelled = true; };
  }, [datasetCode]);

  useEffect(() => {
    const filtres = {};
    if (periode?.startDate) filtres.dateDebut = periode.startDate;
    if (periode?.endDate) filtres.dateFin = periode.endDate;
    if (ministere) filtres.ministere = ministere;
    if (region) filtres.region = region;
    if (statut) filtres.statut = statut;
    onFiltersChange(filtres);
  }, [periode, ministere, region, statut]);

  const handleResetAll = useCallback(() => {
    setPeriode(null);
    setMinistere('');
    setRegion('');
    setStatut('');
    clearAllCrossFilters();
  }, [clearAllCrossFilters]);

  const hasAnyFilter = !!(ministere || region || statut || periode?.startDate || crossFilterCount > 0);

  const activeFilters = useMemo(() => {
    const list = [];
    if (periode?.startDate) list.push({ key: 'dateDebut', label: `Depuis ${periode.startDate}` });
    if (periode?.endDate) list.push({ key: 'dateFin', label: `Jusqu'au ${periode.endDate}` });
    if (ministere) {
      const m = ministeres.find(x => (x.code || x) === ministere);
      list.push({ key: 'ministere', label: m?.libelle || ministere });
    }
    if (region) {
      const r = regions.find(x => (x.code || x) === region);
      list.push({ key: 'region', label: r?.libelle || region });
    }
    if (statut) {
      const s = statuts.find(x => (x.code || x) === statut);
      list.push({ key: 'statut', label: `Statut: ${s?.libelle || statut}` });
    }
    return list;
  }, [periode, ministere, region, statut, ministeres, regions, statuts]);

  const removeFilter = useCallback((key) => {
    if (key === 'dateDebut' || key === 'dateFin') setPeriode(null);
    else if (key === 'ministere') setMinistere('');
    else if (key === 'region') setRegion('');
    else if (key === 'statut') setStatut('');
  }, []);

  return (
    <div className="bi-filter-bar">
      <div className="bi-filter-bar-row">
        <Filter size={14} style={{ opacity: 0.5, flexShrink: 0 }} />

        <DatePresetFilter onChange={setPeriode} />

        {ministeres.length > 0 && (
          <select value={ministere} onChange={e => setMinistere(e.target.value)}>
            <option value="">Tous les ministères</option>
            {ministeres.map(m => (
              <option key={m.code || m} value={m.code || m}>{m.libelle || m}</option>
            ))}
          </select>
        )}

        {regions.length > 0 && (
          <select value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">Toutes les régions</option>
            {regions.map(r => (
              <option key={r.code || r} value={r.code || r}>{r.libelle || r}</option>
            ))}
          </select>
        )}

        {statuts.length > 0 && (
          <select value={statut} onChange={e => setStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            {statuts.map(s => (
              <option key={s.code || s} value={s.code || s}>{s.libelle || s}</option>
            ))}
          </select>
        )}

        {crossFilterCount > 0 && (
          <span className="bi-filter-cross-badge">
            <Filter size={11} />
            {crossFilterCount} filtre{crossFilterCount > 1 ? 's' : ''} croisé{crossFilterCount > 1 ? 's' : ''}
          </span>
        )}

        {hasAnyFilter && (
          <button
            className="bi-filter-reset-btn"
            onClick={handleResetAll}
            title="Réinitialiser tous les filtres"
          >
            <XCircle size={13} />
            Réinitialiser
          </button>
        )}

        {resultCount !== undefined && (
          <span className="bi-result-count">{resultCount.toLocaleString('fr-FR')} résultats</span>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="bi-filter-badges">
          {activeFilters.map(f => (
            <span key={f.key} className="bi-filter-badge">
              {f.label}
              <X size={12} onClick={() => removeFilter(f.key)} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
