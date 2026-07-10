import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Search, X, Plus, BarChart3, Table2, Grid3X3, Download, Filter,
  ChevronDown, Loader2,
} from 'lucide-react';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import PivotTable from '../components/ui/PivotTable';
import ExportButtons from '../components/ui/ExportButtons';
import {
  fetchExplorerDimensions,
  fetchExplorerExplore,
  fetchExplorerCrosstab,
  buildAnalyticsDateParams,
} from '../api/analyticsApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';

const COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#10B981'];

function formatMontant(val) {
  return (val || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA';
}

function formatNombre(val) {
  return (val || 0).toLocaleString('fr-FR');
}

export default function ExplorateurDonnees() {
  const { dateRange, setDateRange } = usePeriodFilter();
  const [dimensions, setDimensions] = useState({ fixes: [], dynamiques: [] });
  const [serviceFilter, setServiceFilter] = useState('');
  const [services, setServices] = useState([]);

  // Exploration state
  const [groupBy, setGroupBy] = useState([]);
  const [filtresActifs, setFiltresActifs] = useState({});
  const [mesure, setMesure] = useState('count');
  const [viewMode, setViewMode] = useState('chart'); // chart | table | pivot

  // Pivot state
  const [pivotLigne, setPivotLigne] = useState('');
  const [pivotColonne, setPivotColonne] = useState('');

  // Results
  const [resultats, setResultats] = useState(null);
  const [pivotData, setPivotData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Charger les services de reference
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/referentiel/services');
        if (res.ok) {
          const data = await res.json();
          setServices(Array.isArray(data) ? data : data?.data || []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Charger les dimensions disponibles
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const params = {};
        if (serviceFilter) params.service_id = serviceFilter;
        const data = await fetchExplorerDimensions(params, ctrl.signal);
        if (data) setDimensions(data);
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Erreur chargement dimensions:', err);
      }
    })();
    return () => ctrl.abort();
  }, [serviceFilter]);

  // Lancer l'exploration
  const lancer = useCallback(async () => {
    if (viewMode === 'pivot') {
      if (!pivotLigne || !pivotColonne) return;
    } else {
      if (groupBy.length === 0) return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const filtres = {
        ...buildAnalyticsDateParams(dateRange),
        ...filtresActifs,
      };
      if (serviceFilter) filtres.service_id = serviceFilter;

      if (viewMode === 'pivot') {
        const data = await fetchExplorerCrosstab({
          dim_ligne: pivotLigne,
          dim_colonne: pivotColonne,
          mesure: mesure === 'avg' ? 'count' : mesure,
          filtres,
        }, ctrl.signal);
        setPivotData(data);
        setResultats(null);
      } else {
        const data = await fetchExplorerExplore({
          group_by: groupBy,
          mesure,
          filtres,
          limite: 50,
          tri: 'desc',
        }, ctrl.signal);
        setResultats(data?.resultats || data || []);
        setPivotData(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Erreur lors de l\'exploration: ' + (err.message || 'Erreur inconnue'));
      }
    } finally {
      setLoading(false);
    }
  }, [groupBy, mesure, dateRange, filtresActifs, serviceFilter, viewMode, pivotLigne, pivotColonne]);

  // Auto-refresh on param change
  useEffect(() => {
    const timer = setTimeout(() => { lancer(); }, 300);
    return () => clearTimeout(timer);
  }, [lancer]);

  const toutesLesDimensions = [
    ...dimensions.fixes.map(d => ({ ...d, categorie: 'Fixe' })),
    ...dimensions.dynamiques.map(d => ({ ...d, categorie: 'Formulaire' })),
  ];

  const addGroupBy = (cle) => {
    if (groupBy.length >= 3 || groupBy.includes(cle)) return;
    setGroupBy([...groupBy, cle]);
  };

  const removeGroupBy = (cle) => {
    setGroupBy(groupBy.filter(g => g !== cle));
  };

  const getDimLabel = (cle) => {
    const dim = toutesLesDimensions.find(d => d.cle === cle);
    return dim?.libelle || cle;
  };

  // Préparer les données pour le graphique
  const chartData = (resultats || []).map((r, i) => {
    const label = Object.values(r.dimensions || {}).map(d => d.nom).join(' / ');
    return {
      name: label.length > 40 ? label.substring(0, 37) + '...' : label,
      fullName: label,
      valeur: mesure === 'count' ? r.nombre : r.montant,
      nombre: r.nombre,
      montant: r.montant,
    };
  }).slice(0, 20);

  // Export data
  const exportData = (resultats || []).map(r => {
    const row = {};
    for (const [key, dim] of Object.entries(r.dimensions || {})) {
      row[getDimLabel(key)] = dim.nom;
    }
    row['Nombre'] = r.nombre;
    row['Montant (FCFA)'] = r.montant;
    return row;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Explorateur de Données</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Analyse multi-dimensionnelle des recettes et soumissions
          </p>
        </div>
        <DatePresetFilter value={dateRange} onChange={setDateRange} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Panel gauche : configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Filtre par service */}
          <div style={cardStyle}>
            <label style={labelStyle}>Service</label>
            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">Tous les services</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.nomFr || s.nom_fr}</option>
              ))}
            </select>
          </div>

          {/* Mode de vue */}
          <div style={cardStyle}>
            <label style={labelStyle}>Mode de vue</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {[
                { key: 'chart', icon: BarChart3, label: 'Graphique' },
                { key: 'table', icon: Table2, label: 'Tableau' },
                { key: 'pivot', icon: Grid3X3, label: 'Croisé' },
              ].map(v => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  style={{
                    ...btnToggleStyle,
                    background: viewMode === v.key ? 'var(--accent-color, #2563EB)' : 'var(--bg-secondary)',
                    color: viewMode === v.key ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  <v.icon size={14} />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mesure */}
          <div style={cardStyle}>
            <label style={labelStyle}>Mesure</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {[
                { key: 'count', label: 'Nombre' },
                { key: 'sum', label: 'Montant' },
                { key: 'avg', label: 'Moyenne' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setMesure(m.key)}
                  style={{
                    ...btnToggleStyle,
                    background: mesure === m.key ? 'var(--accent-color, #2563EB)' : 'var(--bg-secondary)',
                    color: mesure === m.key ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions pour groupBy (mode chart/table) */}
          {viewMode !== 'pivot' && (
            <div style={cardStyle}>
              <label style={labelStyle}>
                Dimensions ({groupBy.length}/3)
              </label>
              {/* Chips actifs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                {groupBy.map(cle => (
                  <span key={cle} style={chipActiveStyle}>
                    {getDimLabel(cle)}
                    <button onClick={() => removeGroupBy(cle)} style={chipRemoveStyle}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              {/* Dimensions disponibles */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {toutesLesDimensions
                  .filter(d => !groupBy.includes(d.cle))
                  .map(d => (
                    <button
                      key={d.cle}
                      onClick={() => addGroupBy(d.cle)}
                      disabled={groupBy.length >= 3}
                      style={dimBtnStyle}
                    >
                      <Plus size={12} style={{ opacity: 0.5 }} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{d.libelle}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{d.categorie}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Dimensions pour pivot */}
          {viewMode === 'pivot' && (
            <div style={cardStyle}>
              <label style={labelStyle}>Dimension en ligne</label>
              <select value={pivotLigne} onChange={e => setPivotLigne(e.target.value)} style={selectStyle}>
                <option value="">Choisir...</option>
                {toutesLesDimensions.map(d => (
                  <option key={d.cle} value={d.cle}>{d.libelle}</option>
                ))}
              </select>
              <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Dimension en colonne</label>
              <select value={pivotColonne} onChange={e => setPivotColonne(e.target.value)} style={selectStyle}>
                <option value="">Choisir...</option>
                {toutesLesDimensions.map(d => (
                  <option key={d.cle} value={d.cle}>{d.libelle}</option>
                ))}
              </select>
            </div>
          )}

          {/* Export */}
          {(resultats?.length > 0 || pivotData?.lignes?.length > 0) && (
            <ExportButtons
              data={exportData}
              filename="exploration"
              title="Exploration des données"
            />
          )}
        </div>

        {/* Panel droit : résultats */}
        <div style={cardStyle}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              Chargement...
            </div>
          )}

          {error && (
            <div style={{ padding: '1rem', color: '#DC2626', background: '#FEF2F2', borderRadius: '0.5rem' }}>
              {error}
            </div>
          )}

          {!loading && !error && viewMode === 'pivot' && pivotData && (
            <PivotTable
              data={pivotData}
              mesure={mesure}
              dimLigneLabel={getDimLabel(pivotLigne)}
              dimColonneLabel={getDimLabel(pivotColonne)}
            />
          )}

          {!loading && !error && viewMode !== 'pivot' && resultats && resultats.length > 0 && (
            <>
              {viewMode === 'chart' && (
                <div>
                  {/* Bar chart */}
                  <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 35)}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" tickFormatter={mesure === 'count' ? formatNombre : formatMontant} />
                      <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(val) => mesure === 'count' ? formatNombre(val) : formatMontant(val)}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                      />
                      <Bar dataKey="valeur" name={mesure === 'count' ? 'Nombre' : 'Montant'} radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {viewMode === 'table' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>#</th>
                        {groupBy.map(cle => (
                          <th key={cle} style={thStyle}>{getDimLabel(cle)}</th>
                        ))}
                        <th style={{ ...thStyle, textAlign: 'right' }}>Nombre</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultats.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                          <td style={tdStyle}>{i + 1}</td>
                          {groupBy.map(cle => (
                            <td key={cle} style={tdStyle}>{r.dimensions?.[cle]?.nom || '-'}</td>
                          ))}
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatNombre(r.nombre)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatMontant(r.montant)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!loading && !error && !resultats?.length && !pivotData?.lignes?.length && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <Search size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0 }}>
                {viewMode === 'pivot'
                  ? 'Sélectionnez les dimensions en ligne et en colonne pour générer le tableau croisé.'
                  : 'Ajoutez des dimensions pour explorer les données.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────

const cardStyle = {
  background: 'var(--bg-card, #fff)',
  borderRadius: '0.75rem',
  padding: '1rem',
  border: '1px solid var(--border-color, #e5e7eb)',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
};

const selectStyle = {
  width: '100%',
  padding: '0.5rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--border-color, #d1d5db)',
  background: 'var(--bg-primary, #fff)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

const btnToggleStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
  padding: '0.4rem 0.5rem',
  borderRadius: '0.375rem',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
  transition: 'all 0.15s',
};

const chipActiveStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.25rem 0.5rem',
  borderRadius: '999px',
  background: 'var(--accent-color, #2563EB)',
  color: '#fff',
  fontSize: '0.78rem',
  fontWeight: 500,
};

const chipRemoveStyle = {
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: '0 0 0 2px',
  opacity: 0.8,
};

const dimBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.35rem 0.5rem',
  borderRadius: '0.375rem',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.82rem',
  color: 'var(--text-primary)',
  width: '100%',
  transition: 'background 0.1s',
};

const thStyle = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  borderBottom: '2px solid var(--border-color)',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border-color, #f3f4f6)',
};
