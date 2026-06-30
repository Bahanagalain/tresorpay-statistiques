import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, Bell, RefreshCw, Clock, Shield } from 'lucide-react';
import { fetchAlertes } from '../api/statistiquesApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { formatMontant } from '../utils/format';

const SEVERITY_CONFIG = {
  CRITIQUE: { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', label: 'Critique' },
  ATTENTION: { icon: AlertCircle, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', label: 'Attention' },
  INFO: { icon: Info, color: 'var(--accent-dgd)', bg: 'var(--accent-dgd-dim)', border: 'rgba(37,99,235,0.3)', label: 'Info' },
};

function getSeverityConfig(sev) {
  const key = (sev || '').toUpperCase();
  if (key === 'CRITIQUE' || key === 'CRITICAL' || key === 'HIGH') return SEVERITY_CONFIG.CRITIQUE;
  if (key === 'ATTENTION' || key === 'WARNING' || key === 'MEDIUM') return SEVERITY_CONFIG.ATTENTION;
  return SEVERITY_CONFIG.INFO;
}

function formatDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

export default function AlertesAnomalies() {
  const { range } = usePeriodFilter();
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAlertes(range);
      setAlertes(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    loadData();

    // Auto-refresh every 60s
    intervalRef.current = setInterval(loadData, 60_000);
    return () => clearInterval(intervalRef.current);
  }, [loadData]);

  const counts = {
    critique: alertes.filter((a) => getSeverityConfig(a.severite) === SEVERITY_CONFIG.CRITIQUE).length,
    attention: alertes.filter((a) => getSeverityConfig(a.severite) === SEVERITY_CONFIG.ATTENTION).length,
    info: alertes.filter((a) => getSeverityConfig(a.severite) === SEVERITY_CONFIG.INFO).length,
  };

  const filtered = filter === 'all'
    ? alertes
    : alertes.filter((a) => {
      const cfg = getSeverityConfig(a.severite);
      if (filter === 'critique') return cfg === SEVERITY_CONFIG.CRITIQUE;
      if (filter === 'attention') return cfg === SEVERITY_CONFIG.ATTENTION;
      return cfg === SEVERITY_CONFIG.INFO;
    });

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400, color: 'var(--text-tertiary)' }}>
        Chargement des alertes...
      </div>
    );
  }

  if (error && alertes.length === 0) {
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
          <h2 className="text-headline" style={{ margin: 0 }}>Alertes & Anomalies</h2>
          <p className="text-body" style={{ margin: '4px 0 0' }}>Surveillance automatique des ecarts et incidents</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {lastRefresh.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button className="btn-secondary-outline" onClick={loadData} style={{ padding: '6px 14px', fontSize: 13 }}>
            <RefreshCw size={14} style={{ marginRight: 6 }} /> Actualiser
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Critiques', value: counts.critique, config: SEVERITY_CONFIG.CRITIQUE, filterKey: 'critique' },
          { label: 'Attention', value: counts.attention, config: SEVERITY_CONFIG.ATTENTION, filterKey: 'attention' },
          { label: 'Informations', value: counts.info, config: SEVERITY_CONFIG.INFO, filterKey: 'info' },
          { label: 'Total', value: alertes.length, icon: Bell, color: 'var(--text-primary)', filterKey: 'all' },
        ].map((card, i) => {
          const Icon = card.config?.icon || card.icon || Shield;
          const color = card.config?.color || card.color;
          const isActive = filter === card.filterKey;
          return (
            <motion.div
              key={card.label}
              className="card-layer"
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              onClick={() => setFilter(card.filterKey)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
                borderColor: isActive ? color : undefined,
                borderWidth: isActive ? 2 : undefined,
              }}
              whileHover={{ y: -2 }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: card.config?.bg || 'var(--bg-surface-elevated)', display: 'grid', placeItems: 'center' }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div>
                <div className="text-label" style={{ marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color }}>{card.value}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'all', label: 'Toutes' },
          { key: 'critique', label: 'Critiques', color: SEVERITY_CONFIG.CRITIQUE.color },
          { key: 'attention', label: 'Attention', color: SEVERITY_CONFIG.ATTENTION.color },
          { key: 'info', label: 'Info', color: SEVERITY_CONFIG.INFO.color },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid',
              borderColor: filter === f.key ? (f.color || 'var(--accent-gold)') : 'var(--glass-border)',
              background: filter === f.key ? `${f.color || 'var(--accent-gold)'}15` : 'transparent',
              color: filter === f.key ? (f.color || 'var(--accent-gold)') : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((alerte, i) => {
          const cfg = getSeverityConfig(alerte.severite);
          const Icon = cfg.icon;
          return (
            <motion.div
              key={alerte.id}
              className="card-layer"
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              style={{
                borderLeft: `4px solid ${cfg.color}`,
                display: 'flex', gap: 16, alignItems: 'flex-start',
                opacity: alerte.estLue ? 0.7 : 1,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>
                <Icon size={20} style={{ color: cfg.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                  <div>
                    <span style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {cfg.label}
                    </span>
                    {alerte.type && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{alerte.type}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {formatDate(alerte.date)}
                  </span>
                </div>

                <p style={{ margin: '4px 0 8px', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{alerte.message}</p>

                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  {alerte.ministere && <span>Ministere : {alerte.ministere}</span>}
                  {alerte.service && <span>Service : {alerte.service}</span>}
                  {alerte.valeur > 0 && <span>Valeur : {formatMontant(alerte.valeur)}</span>}
                  {alerte.seuil > 0 && <span>Seuil : {formatMontant(alerte.seuil)}</span>}
                </div>
              </div>
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="card-layer" style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <Shield size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 500 }}>Aucune alerte {filter !== 'all' ? `de type "${filter}"` : ''}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Tout semble normal pour la periode selectionnee</div>
          </div>
        )}
      </div>
    </div>
  );
}
