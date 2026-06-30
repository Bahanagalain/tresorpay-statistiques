import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Target, FileText, TrendingUp, X } from 'lucide-react';
import { fetchRegionTelemetry, fetchRegionDetail } from '../api/statistiquesApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { formatMontant, formatMontantCompact, formatPourcentage } from '../utils/format';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

function getStatusColor(value, target) {
  if (!target || target === 0) return { bg: 'var(--accent-dgd-dim)', border: 'var(--accent-dgd)', text: 'var(--accent-dgd)', label: 'N/A' };
  const pct = (value / target) * 100;
  if (pct >= 80) return { bg: 'rgba(5,150,105,0.08)', border: 'var(--accent-dgi)', text: 'var(--accent-dgi)', label: 'Excellent' };
  if (pct >= 50) return { bg: 'rgba(245,158,11,0.08)', border: '#F59E0B', text: '#F59E0B', label: 'En cours' };
  return { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', text: '#ef4444', label: 'Critique' };
}

function GaugeBar({ value, target }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const status = getStatusColor(value, target);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
        <span>{formatPourcentage(pct)} atteint</span>
        <span>Obj: {formatMontantCompact(target)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--gauge-track)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: status.border, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

export default function CartographieRegionale() {
  const { state: periodState, setState: setPeriodState, range } = usePeriodFilter();
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRegionTelemetry(range);
      setRegions(data);
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  const openDetail = useCallback(async (region) => {
    setSelectedRegion(region);
    setDetailLoading(true);
    try {
      const d = await fetchRegionDetail(region.id, range);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [range]);

  const totalValue = regions.reduce((s, r) => s + r.value, 0);
  const totalTarget = regions.reduce((s, r) => s + r.target, 0);
  const totalSoumissions = regions.reduce((s, r) => s + r.nombreSoumissions, 0);
  const globalPct = totalTarget > 0 ? (totalValue / totalTarget) * 100 : 0;

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400, color: 'var(--text-tertiary)' }}>
        Chargement de la cartographie...
      </div>
    );
  }

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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h2 className="text-headline" style={{ margin: 0 }}>Cartographie Regionale</h2>
          <p className="text-body" style={{ margin: '4px 0 0' }}>Performance des 10 regions du Cameroun</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[
            { key: 'all', label: 'Tout' },
            { key: 'month', label: 'Ce mois' },
            { key: 'custom', label: 'Personnalise' },
          ].map((p) => (
            <button key={p.key} onClick={() => setPeriodState({ preset: p.key })} className={periodState.preset === p.key ? 'btn-primary' : 'btn-secondary-outline'} style={{ padding: '6px 14px', fontSize: 13 }}>
              {p.label}
            </button>
          ))}
          {periodState.preset === 'custom' && (
            <>
              <input type="date" className="ghost-input" style={{ width: 150, padding: '6px 10px' }} value={periodState.customStart} onChange={(e) => setPeriodState({ customStart: e.target.value })} />
              <input type="date" className="ghost-input" style={{ width: 150, padding: '6px 10px' }} value={periodState.customEnd} onChange={(e) => setPeriodState({ customEnd: e.target.value })} />
            </>
          )}
        </div>
      </motion.div>

      {/* Summary KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Revenus Totaux', value: formatMontantCompact(totalValue), icon: TrendingUp, color: 'var(--accent-gold)' },
          { label: 'Objectif Global', value: formatMontantCompact(totalTarget), icon: Target, color: 'var(--accent-dgi)' },
          { label: 'Taux Atteinte', value: formatPourcentage(globalPct), icon: MapPin, color: globalPct >= 80 ? 'var(--accent-dgi)' : globalPct >= 50 ? '#F59E0B' : '#ef4444' },
          { label: 'Soumissions', value: totalSoumissions.toLocaleString('fr-FR'), icon: FileText, color: 'var(--accent-dgd)' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} className="card-layer" custom={i} variants={fadeUp} initial="hidden" animate="visible" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${kpi.color}15`, display: 'grid', placeItems: 'center' }}>
              <kpi.icon size={20} style={{ color: kpi.color }} />
            </div>
            <div>
              <div className="text-label" style={{ marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-dgi)' }} /> &gt;80% : Excellent
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#F59E0B' }} /> 50-80% : En cours
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444' }} /> &lt;50% : Critique
        </span>
      </div>

      {/* Region Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {regions.map((region, i) => {
          const status = getStatusColor(region.value, region.target);
          const pct = region.target > 0 ? (region.value / region.target) * 100 : 0;
          return (
            <motion.div
              key={region.id}
              className="card-layer"
              custom={i + 4}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              onClick={() => openDetail(region)}
              style={{
                cursor: 'pointer',
                borderLeft: `4px solid ${status.border}`,
                background: status.bg,
                transition: 'all 0.3s ease',
              }}
              whileHover={{ y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 2 }}>{region.name}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: `${status.border}20`, color: status.text,
                  }}>
                    {status.label}
                  </span>
                </div>
                <MapPin size={20} style={{ color: status.border, flexShrink: 0 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div>
                  <div className="text-label" style={{ fontSize: 10 }}>Recettes</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{formatMontantCompact(region.value)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-label" style={{ fontSize: 10 }}>Soumissions</div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>{region.nombreSoumissions.toLocaleString('fr-FR')}</div>
                </div>
              </div>

              <GaugeBar value={region.value} target={region.target} />
            </motion.div>
          );
        })}

        {regions.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            Aucune donnee regionale disponible
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRegion && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 24 }}
            onClick={() => setSelectedRegion(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="card-layer glass-panel"
              style={{ maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 className="text-headline" style={{ margin: 0 }}>{selectedRegion.name}</h2>
                <button onClick={() => setSelectedRegion(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={24} /></button>
              </div>

              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Chargement...</div>
              ) : detail ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Recettes</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-gold)', marginTop: 4 }}>{formatMontantCompact(detail.value)}</div>
                    </div>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Objectif</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-dgi)', marginTop: 4 }}>{formatMontantCompact(detail.target)}</div>
                    </div>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Soumissions</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-dgd)', marginTop: 4 }}>{detail.nombreSoumissions}</div>
                    </div>
                  </div>

                  {/* Departments */}
                  {detail.departements?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 className="text-title" style={{ marginBottom: 12 }}>Departements</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Departement</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Recettes</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Soumissions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.departements.map((d) => (
                            <tr key={d.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{d.name}</td>
                              <td style={{ padding: '10px 12px' }}>{formatMontant(d.value)}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{d.nombreSoumissions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Evolution */}
                  {detail.evolution?.length > 0 && (
                    <div>
                      <h3 className="text-title" style={{ marginBottom: 12 }}>Tendance</h3>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {detail.evolution.map((e) => (
                          <div key={e.mois} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                            <span>{e.mois}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatMontantCompact(e.paye)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Aucune donnee disponible</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
