import React, { useState, useEffect, useCallback } from 'react';
import { Filter, XCircle } from 'lucide-react';
import DatePresetFilter from '../ui/DatePresetFilter';
import { fetchFiltreValeurs } from '../../api/biApi';
import { useCrossFilter } from './CrossFilterContext';

export default function FilterBar({ datasetCode, onFiltersChange }) {
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
      </div>
    </div>
  );
}
