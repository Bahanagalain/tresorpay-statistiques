import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw, Settings, Trash2, Clock, CheckCircle, XCircle,
  Database, AlertTriangle, Play, Pause,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import {
  fetchSyncStatut, fetchSyncJournal, fetchSyncConfig,
  updateSyncConfig, lancerSynchronisation, lancerPurge,
} from '../api/analyticsApi';
import { formatEntier } from '../utils/format';

// ─── Styles réutilisables ──────────────────────────────────
const styles = {
  page: {
    display: 'flex', flexDirection: 'column', gap: '1.5rem',
    padding: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%',
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexWrap: 'wrap', gap: '1rem',
  },
  title: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0,
  },
  subtitle: {
    fontSize: '0.82rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0',
  },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
    borderRadius: '14px', padding: '1.4rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)',
    margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.8rem',
  },
  counter: {
    background: 'var(--bg-base)', borderRadius: '10px', padding: '0.8rem 1rem',
    textAlign: 'center',
  },
  counterLabel: {
    fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  counterValue: {
    fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem',
  },
  btn: (bg, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.82rem',
    fontWeight: 700, border: 'none', cursor: 'pointer', color,
    background: bg, transition: 'opacity 0.2s',
  }),
  btnRow: {
    display: 'flex', gap: '0.8rem', flexWrap: 'wrap',
  },
  badge: (bg, fg) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem',
    fontWeight: 700, background: bg, color: fg,
  }),
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem',
  },
  th: {
    textAlign: 'left', padding: '0.6rem 0.8rem', fontWeight: 700,
    color: 'var(--text-secondary)', borderBottom: '2px solid var(--glass-border)',
    fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: {
    padding: '0.5rem 0.8rem', borderBottom: '1px solid var(--glass-border)',
    color: 'var(--text-primary)', verticalAlign: 'middle',
  },
  toggle: (active) => ({
    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
    background: active ? '#059669' : 'var(--glass-border)',
    position: 'relative', transition: 'background 0.2s',
  }),
  toggleKnob: (active) => ({
    position: 'absolute', top: 3, left: active ? 23 : 3,
    width: 18, height: 18, borderRadius: '50%', background: '#fff',
    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  }),
  progressBar: {
    width: '100%', height: 8, borderRadius: 4,
    background: 'var(--glass-border)', overflow: 'hidden',
  },
  progressFill: (pct) => ({
    width: `${Math.min(pct, 100)}%`, height: '100%',
    background: 'linear-gradient(90deg, #059669, #14B8A6)',
    borderRadius: 4, transition: 'width 0.5s ease',
  }),
};

// ─── Status indicator ──────────────────────────────────────
function StatusIndicator({ enCours }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.6rem 1rem', borderRadius: '12px',
      background: enCours ? 'rgba(5,150,105,0.08)' : 'var(--bg-base)',
    }}>
      {enCours ? (
        <RefreshCw size={20} style={{ color: '#059669', animation: 'spin 1.5s linear infinite' }} />
      ) : (
        <Pause size={20} style={{ color: 'var(--text-tertiary)' }} />
      )}
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: enCours ? '#059669' : 'var(--text-secondary)' }}>
          {enCours ? 'Synchronisation en cours' : 'Inactif'}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
          {enCours ? 'Veuillez patienter...' : 'Aucune synchronisation active'}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────
export default function Synchronisation() {
  const [statut, setStatut] = useState(null);
  const [journal, setJournal] = useState([]);
  const [config, setConfig] = useState({ intervalle: 60, actif: true });
  const [configDirty, setConfigDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const pollRef = useRef(null);

  // ── Chargement initial ────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [s, j, c] = await Promise.all([
        fetchSyncStatut(),
        fetchSyncJournal(),
        fetchSyncConfig(),
      ]);
      setStatut(s);
      setJournal(j);
      if (c) {
        setConfig({ intervalle: c.intervalle ?? 60, actif: c.actif ?? true });
        setConfigDirty(false);
      }
    } catch (e) {
      console.error('Erreur chargement sync:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Polling statut quand sync en cours ────────────────
  const enCours = statut?.enCours ?? false;

  useEffect(() => {
    if (!enCours) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const s = await fetchSyncStatut();
        setStatut(s);
        if (!s?.enCours) {
          // Sync terminée, rafraîchir le journal
          const j = await fetchSyncJournal();
          setJournal(j);
        }
      } catch (e) { /* ignore */ }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [enCours]);

  // ── Polling journal quand sync en cours ───────────────
  useEffect(() => {
    if (!enCours) return;
    const id = setInterval(async () => {
      try {
        const j = await fetchSyncJournal();
        setJournal(j);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [enCours]);

  // ── Actions ───────────────────────────────────────────
  const handleLancerSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const tid = toast.loading('Lancement de la synchronisation...');
    try {
      const res = await lancerSynchronisation();
      if (res?.skipped) {
        toast.success('Une synchronisation est déjà en cours.', { id: tid });
      } else {
        toast.success('Synchronisation lancée avec succès.', { id: tid });
      }
      const s = await fetchSyncStatut();
      setStatut(s);
    } catch (e) {
      toast.error(e?.message || 'Erreur lors du lancement de la synchronisation.', { id: tid });
    } finally {
      setSyncing(false);
    }
  };

  const handlePurge = async () => {
    if (purging) return;
    setPurging(true);
    setConfirmPurge(false);
    const tid = toast.loading('Purge des données en cours...');
    try {
      await lancerPurge();
      toast.success('Toutes les données ont été purgées.', { id: tid });
      await loadAll();
    } catch (e) {
      toast.error(e?.message || 'Erreur lors de la purge.', { id: tid });
    } finally {
      setPurging(false);
    }
  };

  const handleSaveConfig = async () => {
    const tid = toast.loading('Sauvegarde de la configuration...');
    try {
      await updateSyncConfig(config);
      toast.success('Configuration mise à jour.', { id: tid });
      setConfigDirty(false);
    } catch (e) {
      toast.error(e?.message || 'Erreur lors de la sauvegarde.', { id: tid });
    }
  };

  // ── Compteurs du statut ───────────────────────────────
  const compteurs = statut ? [
    { label: 'Ministères', value: statut.ministeres ?? 0 },
    { label: 'Domaines', value: statut.domaines ?? 0 },
    { label: 'Org Units', value: statut.orgUnits ?? 0 },
    { label: 'Services', value: statut.services ?? 0 },
    { label: 'Soumissions', value: statut.soumissions ?? 0 },
    { label: 'Plateformes', value: statut.plateformes ?? 0 },
    { label: 'Citoyens', value: statut.citoyens ?? 0 },
    { label: 'Audit Logs', value: statut.auditLogs ?? 0 },
  ] : [];

  // ── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...styles.page, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <WeaveSpinner size={80} message="Chargement de la synchronisation..." />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }} />

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}><RefreshCw size={24} /> Synchronisation</h1>
          <p style={styles.subtitle}>Gestion de la synchronisation avec le Payment Platform</p>
        </div>
      </div>

      {/* ── Statut actuel ─────────────────────────────── */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}><Database size={16} /> Statut actuel</h3>
        <StatusIndicator enCours={enCours} />

        {enCours && statut?.progression != null && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {statut.etapeCourante || 'Synchronisation...'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {Math.round(statut.progression)}%
              </span>
            </div>
            <div style={styles.progressBar}>
              <div style={styles.progressFill(statut.progression)} />
            </div>
          </div>
        )}

        {compteurs.length > 0 && (
          <div style={{ ...styles.grid, marginTop: '1rem' }}>
            {compteurs.map(c => (
              <div key={c.label} style={styles.counter}>
                <div style={styles.counterLabel}>{c.label}</div>
                <div style={styles.counterValue}>{formatEntier(c.value)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────── */}
      <div style={styles.btnRow}>
        <button
          style={{ ...styles.btn('#059669', '#fff'), opacity: syncing || enCours ? 0.6 : 1 }}
          onClick={handleLancerSync}
          disabled={syncing || enCours}
        >
          <Play size={15} />
          {syncing ? 'Lancement...' : 'Lancer la synchronisation'}
        </button>

        {confirmPurge ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 600 }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> Confirmer la purge ?
            </span>
            <button
              style={styles.btn('#DC2626', '#fff')}
              onClick={handlePurge}
              disabled={purging}
            >
              Oui, purger
            </button>
            <button
              style={styles.btn('var(--bg-base)', 'var(--text-secondary)')}
              onClick={() => setConfirmPurge(false)}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            style={{ ...styles.btn('rgba(220,38,38,0.1)', '#DC2626'), opacity: purging ? 0.6 : 1 }}
            onClick={() => setConfirmPurge(true)}
            disabled={purging || enCours}
          >
            <Trash2 size={15} />
            Purger toutes les données
          </button>
        )}
      </div>

      {/* ── Configuration ─────────────────────────────── */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}><Settings size={16} /> Configuration</h3>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Intervalle de synchronisation (minutes)
            </label>
            <input
              type="number"
              min={1}
              value={config.intervalle}
              onChange={e => {
                setConfig(c => ({ ...c, intervalle: Math.max(1, Number(e.target.value) || 1) }));
                setConfigDirty(true);
              }}
              style={{
                width: 120, padding: '0.45rem 0.7rem', borderRadius: '8px',
                border: '1px solid var(--glass-border)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Synchronisation active
            </label>
            <button
              style={styles.toggle(config.actif)}
              onClick={() => {
                setConfig(c => ({ ...c, actif: !c.actif }));
                setConfigDirty(true);
              }}
            >
              <span style={styles.toggleKnob(config.actif)} />
            </button>
          </div>

          <button
            style={{ ...styles.btn('#2563EB', '#fff'), opacity: configDirty ? 1 : 0.5 }}
            onClick={handleSaveConfig}
            disabled={!configDirty}
          >
            <CheckCircle size={15} />
            Sauvegarder
          </button>
        </div>
      </div>

      {/* ── Journal de synchronisation ────────────────── */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>
          <Clock size={16} /> Journal de synchronisation
          {enCours && (
            <span style={{
              marginLeft: '0.5rem', fontSize: '0.68rem', color: '#059669',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <RefreshCw size={11} style={{ animation: 'spin 1.5s linear infinite' }} />
              Rafraîchissement auto
            </span>
          )}
        </h3>

        {journal.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
            Aucune entrée dans le journal.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Endpoint</th>
                  <th style={styles.th}>Statut</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Enregistrements</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Durée (ms)</th>
                  <th style={styles.th}>Erreur</th>
                </tr>
              </thead>
              <tbody>
                {journal.map((entry, i) => {
                  const isSuccess = (entry.statut || '').toUpperCase() === 'SUCCES';
                  const date = entry.date || entry.executeLe || entry.createdAt || '';
                  const dateStr = date ? new Date(date).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  }) : '—';

                  return (
                    <tr key={entry.id || i}>
                      <td style={styles.td}>
                        <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{dateStr}</span>
                      </td>
                      <td style={styles.td}>
                        <code style={{
                          fontSize: '0.72rem', background: 'var(--bg-base)',
                          padding: '0.15rem 0.4rem', borderRadius: '4px',
                        }}>
                          {entry.endpoint || '—'}
                        </code>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge(
                          isSuccess ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
                          isSuccess ? '#059669' : '#DC2626',
                        )}>
                          {isSuccess ? <CheckCircle size={11} /> : <XCircle size={11} />}
                          {entry.statut || '—'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                        {formatEntier(entry.enregistrements ?? entry.count ?? 0)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {entry.duree ?? entry.dureeMs ?? '—'}
                      </td>
                      <td style={{ ...styles.td, maxWidth: 250 }}>
                        {entry.erreur ? (
                          <span style={{ color: '#DC2626', fontSize: '0.72rem', wordBreak: 'break-word' }}>
                            {entry.erreur}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
