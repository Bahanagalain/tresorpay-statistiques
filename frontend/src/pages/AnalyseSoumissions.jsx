import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, Clock } from 'lucide-react';
import { fetchSoumissions } from '../api/statistiquesApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { formatMontant, formatMontantCompact } from '../utils/format';

const STATUTS = [
  { key: '', label: 'Tous', color: 'var(--text-secondary)' },
  { key: 'PAID', label: 'PAID', color: 'var(--accent-dgi)' },
  { key: 'PENDING', label: 'PENDING', color: '#F59E0B' },
  { key: 'PARTIAL', label: 'PARTIAL', color: 'var(--accent-dgd)' },
  { key: 'FAILED', label: 'FAILED', color: '#ef4444' },
];

function getStatutStyle(statut) {
  const s = STATUTS.find((st) => st.key === statut);
  const color = s?.color || 'var(--text-tertiary)';
  return {
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: `${color}18`, color, textTransform: 'uppercase', letterSpacing: '0.04em',
  };
}

function formatDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function AnalyseSoumissions() {
  const { range } = usePeriodFilter();
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ totalItems: 0, totalPages: 1, currentPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSoumissions({ range, page, pageSize, statut: statut || undefined, search: search.trim() || undefined });
      setData(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [range, page, statut, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statut, search, range]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <div className="card-layer" style={{ padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>
          <button className="btn-primary" onClick={loadData}>Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <h2 className="text-headline" style={{ margin: 0 }}>Analyse des Soumissions</h2>
        <p className="text-body" style={{ margin: '4px 0 0' }}>Recherche et suivi des soumissions de paiement</p>
      </motion.div>

      {/* Search & Filters */}
      <motion.div className="card-layer glass-panel" variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              className="ghost-input"
              placeholder="Rechercher par reference, contribuable..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>
            <Filter size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Filtrer
          </button>
        </form>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatut(s.key)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: '1px solid',
                borderColor: statut === s.key ? s.color : 'var(--glass-border)',
                background: statut === s.key ? `${s.color}15` : 'transparent',
                color: statut === s.key ? s.color : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Results info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, color: 'var(--text-tertiary)', fontSize: 13 }}>
        <span>{meta.totalItems.toLocaleString('fr-FR')} soumission{meta.totalItems > 1 ? 's' : ''} trouvee{meta.totalItems > 1 ? 's' : ''}</span>
        <span>Page {meta.currentPage} / {meta.totalPages}</span>
      </div>

      {/* Table */}
      <motion.div className="card-layer glass-panel" variants={fadeUp} initial="hidden" animate="visible">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Chargement des soumissions...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                  {['', 'Code', 'Soumetteur', 'Service', 'Ministere', 'Montant', 'Statut', 'Date'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <AnimatePresence key={item.id}>
                    <tr
                      onClick={() => toggleExpand(item.id)}
                      style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 8px', width: 30 }}>
                        {expandedId === item.id
                          ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} />
                          : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />
                        }
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent-gold)', fontFamily: 'monospace', fontSize: 13 }}>{item.reference || item.id}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{item.contribuable || '-'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.service || '-'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.ministere || '-'}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatMontant(item.montant)}</td>
                      <td style={{ padding: '12px' }}><span style={getStatutStyle(item.statut)}>{item.statut}</span></td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(item.dateSoumission)}</td>
                    </tr>

                    {expandedId === item.id && (
                      <motion.tr
                        key={`detail-${item.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <td colSpan={8} style={{ padding: 0 }}>
                          <div style={{ padding: '16px 24px', background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                              <div>
                                <div className="text-label" style={{ marginBottom: 4 }}>Reference</div>
                                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{item.reference || '-'}</div>
                              </div>
                              <div>
                                <div className="text-label" style={{ marginBottom: 4 }}>Domaine</div>
                                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.domaine || '-'}</div>
                              </div>
                              <div>
                                <div className="text-label" style={{ marginBottom: 4 }}>Date de paiement</div>
                                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{formatDate(item.datePaiement)}</div>
                              </div>
                              <div>
                                <div className="text-label" style={{ marginBottom: 4 }}>Montant</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>{formatMontant(item.montant)}</div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                ))}

                {data.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                      <div>Aucune soumission trouvee</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '16px 0', borderTop: '1px solid var(--glass-border)' }}>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--glass-border)', background: 'transparent', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                color: page <= 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={16} /> Precedent
            </button>

            {Array.from({ length: Math.min(meta.totalPages, 7) }, (_, i) => {
              let pageNum;
              if (meta.totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= meta.totalPages - 3) {
                pageNum = meta.totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: pageNum === page ? 'var(--accent-gold)' : 'transparent',
                    color: pageNum === page ? '#fff' : 'var(--text-secondary)',
                    fontWeight: pageNum === page ? 700 : 500, fontSize: 13,
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
              disabled={page >= meta.totalPages}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--glass-border)', background: 'transparent', cursor: page >= meta.totalPages ? 'not-allowed' : 'pointer',
                color: page >= meta.totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                opacity: page >= meta.totalPages ? 0.5 : 1,
              }}
            >
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
