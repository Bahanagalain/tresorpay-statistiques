import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PieChart as PieIcon, Layers, X, TrendingUp, FileText } from 'lucide-react';
import { fetchServices, fetchServiceDetail, fetchDomaines } from '../api/statistiquesApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { formatMontant, formatMontantCompact, formatPourcentage } from '../utils/format';

const COLORS = ['#B8860B', '#059669', '#2563EB', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6366F1', '#F43F5E', '#06B6D4'];

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

function TreemapContent({ x, y, width, height, name, value }) {
  if (width < 50 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} style={{ fill: COLORS[Math.abs(name?.charCodeAt(0) || 0) % COLORS.length], fillOpacity: 0.85, stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={width < 80 ? 10 : 12} fontWeight={600}>
        {name?.length > 18 ? name.slice(0, 16) + '...' : name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}>
        {formatMontantCompact(value)}
      </text>
    </g>
  );
}

export default function RepartitionServices() {
  const { state: periodState, setState: setPeriodState, range } = usePeriodFilter();
  const [tab, setTab] = useState('services');
  const [services, setServices] = useState([]);
  const [domaines, setDomaines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [svc, dom] = await Promise.all([fetchServices(range), fetchDomaines(range)]);
      setServices(svc);
      setDomaines(dom);
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  const openDetail = useCallback(async (id) => {
    setSelectedServiceId(id);
    setDetailLoading(true);
    try {
      const d = await fetchServiceDetail(id, range);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [range]);

  const sortedServices = [...services].sort((a, b) => b.montant - a.montant);
  const totalRevenus = services.reduce((s, v) => s + v.montant, 0);
  const totalSoumissions = services.reduce((s, v) => s + v.nombreSoumissions, 0);

  const treemapData = sortedServices.map((s) => ({ name: s.nom, size: s.montant || 1 }));

  const pieDataDomaines = domaines.map((d, i) => ({ name: d.nom, value: d.montant, fill: COLORS[i % COLORS.length] }));

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400, color: 'var(--text-tertiary)' }}>
        Chargement des services...
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
          <h2 className="text-headline" style={{ margin: 0 }}>Repartition des Services</h2>
          <p className="text-body" style={{ margin: '4px 0 0' }}>Vue detaillee des services et domaines</p>
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
        </div>
      </motion.div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Revenus Totaux', value: formatMontantCompact(totalRevenus), icon: TrendingUp, color: 'var(--accent-gold)' },
          { label: 'Services', value: services.length, icon: PieIcon, color: 'var(--accent-dgi)' },
          { label: 'Soumissions', value: totalSoumissions.toLocaleString('fr-FR'), icon: FileText, color: 'var(--accent-dgd)' },
          { label: 'Domaines', value: domaines.length, icon: Layers, color: '#8B5CF6' },
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

      {/* Tab Switch */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--glass-border)' }}>
        {[
          { key: 'services', label: 'Par Service' },
          { key: 'domaines', label: 'Par Domaine' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: tab === t.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
              borderBottom: tab === t.key ? '2px solid var(--accent-gold)' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.2s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'services' ? (
        <>
          {/* Treemap */}
          <motion.div className="card-layer glass-panel" custom={4} variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 24 }}>
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Carte des services par revenus</h3>
            <ResponsiveContainer width="100%" height={350}>
              <Treemap data={treemapData} dataKey="size" nameKey="name" content={<TreemapContent />}>
                <Tooltip formatter={(v) => formatMontant(v)} />
              </Treemap>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Services Table */}
          <motion.div className="card-layer glass-panel" custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Top services</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                    {['#', 'Service', 'Ministere', 'Revenus', 'Soumissions'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedServices.map((s, idx) => (
                    <tr
                      key={s.id}
                      onClick={() => openDetail(s.id)}
                      style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 700, color: idx < 3 ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.nom}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{s.ministereName || '-'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{formatMontant(s.montant)}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{s.nombreSoumissions.toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Pie */}
          <motion.div className="card-layer glass-panel" custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Repartition par domaine</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={pieDataDomaines} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, percent }) => `${name.slice(0, 15)} ${(percent * 100).toFixed(0)}%`} labelLine>
                  {pieDataDomaines.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip formatter={(v) => formatMontant(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bar */}
          <motion.div className="card-layer glass-panel" custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Revenus par domaine</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={domaines.sort((a, b) => b.montant - a.montant)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nom" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatMontantCompact(v).replace(' FCFA', '')} />
                <Tooltip formatter={(v) => formatMontant(v)} />
                <Bar dataKey="montant" fill="var(--accent-dgd)" radius={[4, 4, 0, 0]}>
                  {domaines.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedServiceId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 24 }}
            onClick={() => setSelectedServiceId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="card-layer glass-panel"
              style={{ maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 className="text-headline" style={{ margin: 0 }}>{detail?.nom || 'Detail Service'}</h2>
                <button onClick={() => setSelectedServiceId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={24} /></button>
              </div>

              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Chargement...</div>
              ) : detail ? (
                <>
                  <div style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Ministere : {detail.ministereName || '-'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Revenus</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-gold)', marginTop: 4 }}>{formatMontantCompact(detail.montant)}</div>
                    </div>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Soumissions</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-dgi)', marginTop: 4 }}>{detail.nombreSoumissions}</div>
                    </div>
                    <div className="card-layer" style={{ textAlign: 'center' }}>
                      <div className="text-label">Taux</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-dgd)', marginTop: 4 }}>{formatPourcentage(detail.tauxPaiement)}</div>
                    </div>
                  </div>

                  {detail.evolution?.length > 0 && (
                    <div>
                      <h3 className="text-title" style={{ marginBottom: 12 }}>Tendance mensuelle</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={detail.evolution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={(v) => formatMontantCompact(v).replace(' FCFA', '')} />
                          <Tooltip formatter={(v) => formatMontant(v)} />
                          <Bar dataKey="paye" name="Paye" fill="var(--accent-dgi)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="enAttente" name="En attente" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
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
