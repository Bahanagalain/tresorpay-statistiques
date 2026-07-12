import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import DatePresetFilter from '../ui/DatePresetFilter';
import { fetchFiltreValeurs } from '../../api/biApi';

export default function FilterBar({ datasetCode, onFiltersChange }) {
  const [periode, setPeriode] = useState(null);
  const [ministere, setMinistere] = useState('');
  const [region, setRegion] = useState('');
  const [statut, setStatut] = useState('');

  const [ministeres, setMinisteres] = useState([]);
  const [regions, setRegions] = useState([]);
  const [statuts, setStatuts] = useState([]);

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

  return (
    <div className="bi-filter-bar">
      <Filter size={14} style={{ opacity: 0.5 }} />

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
    </div>
  );
}
