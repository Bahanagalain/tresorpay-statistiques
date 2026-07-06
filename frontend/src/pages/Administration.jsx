import { useState, useEffect, useCallback } from 'react';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Users, RefreshCw, Plus, Edit2, Shield, Clock, CheckCircle, XCircle, X, Database } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { apiGet, apiPost, apiFetch } from '../api/httpClient';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
}

const EMPTY_USER = { nom: '', prenom: '', email: '', identifiant: '', mot_de_passe: '', est_super_admin: false };

export default function Administration() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('utilisateurs');

  // -- Users state --
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);

  // -- Sync state --
  const [syncInfo, setSyncInfo] = useState(null);
  const [syncJournal, setSyncJournal] = useState([]);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ── Users ───────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await apiGet('/utilisateurs');
      const list = res?.datas || res?.data || res || [];
      setUsers(Array.isArray(list) ? list : []);
    } catch { setUsers([]); }
    setUsersLoading(false);
  }, []);

  useEffect(() => { if (tab === 'utilisateurs') loadUsers(); }, [tab, loadUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(EMPTY_USER);
    setShowUserModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setForm({
      nom: u.nom || '',
      prenom: u.prenom || '',
      email: u.email || '',
      identifiant: u.identifiant || u.username || '',
      mot_de_passe: '',
      est_super_admin: Boolean(u.est_super_admin),
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.mot_de_passe) delete body.mot_de_passe;

      if (editingUser) {
        await apiFetch(`/utilisateurs/${editingUser.id}`, { method: 'PUT', body });
      } else {
        await apiPost('/utilisateurs', body);
      }
      setShowUserModal(false);
      loadUsers();
    } catch { /* silent */ }
    setSaving(false);
  };

  // ── Sync ────────────────────────────────────────
  const loadSync = useCallback(async () => {
    setSyncLoading(true);
    try {
      const [infoRes, journalRes] = await Promise.all([
        apiGet('/sync/status').catch(() => null),
        apiGet('/sync/journal').catch(() => null),
      ]);
      setSyncInfo(infoRes?.datas || infoRes || null);
      const journal = journalRes?.datas || journalRes?.data || journalRes || [];
      setSyncJournal(Array.isArray(journal) ? journal : []);
    } catch { /* silent */ }
    setSyncLoading(false);
  }, []);

  useEffect(() => { if (tab === 'sync') loadSync(); }, [tab, loadSync]);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await apiPost('/sync/trigger', {});
      await loadSync();
    } catch { /* silent */ }
    setSyncing(false);
  };

  // Mini stats for user overview
  const adminCount = users.filter((u) => u.est_super_admin).length;
  const activeCount = users.filter((u) => u.actif !== false).length;

  return (
    <div>
      {/* Header */}
      <div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <h2 className="text-headline" style={{ margin: 0 }}>Administration</h2>
        <p className="text-body" style={{ margin: '4px 0 0' }}>Gestion des utilisateurs et synchronisation</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--glass-border)' }}>
        {[
          { key: 'utilisateurs', label: 'Utilisateurs', icon: Users },
          { key: 'sync', label: 'Synchronisation', icon: RefreshCw },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: tab === t.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                borderBottom: tab === t.key ? '2px solid var(--accent-gold)' : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ Utilisateurs Tab ═══ */}
      {tab === 'utilisateurs' && (
        <>
          {/* Mini Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Utilisateurs', value: users.length, icon: Users, color: 'var(--accent-gold)' },
              { label: 'Administrateurs', value: adminCount, icon: Shield, color: '#8B5CF6' },
              { label: 'Actifs', value: activeCount, icon: CheckCircle, color: 'var(--accent-dgi)' },
            ].map((kpi, i) => (
              <div key={kpi.label} className="card-layer" custom={i} variants={fadeUp} initial="hidden" animate="visible" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}15`, display: 'grid', placeItems: 'center' }}>
                  <kpi.icon size={18} style={{ color: kpi.color }} />
                </div>
                <div>
                  <div className="text-label" style={{ marginBottom: 2, fontSize: 10 }}>{kpi.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{users.length} utilisateur{users.length > 1 ? 's' : ''}</span>
            <button className="btn-primary" onClick={openCreateModal} style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Creer un utilisateur
            </button>
          </div>

          {/* Users Table */}
          <div className="card-layer glass-panel" custom={3} variants={fadeUp} initial="hidden" animate="visible">
            {usersLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Chargement...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                      {['Nom', 'Email', 'Identifiant', 'Role', 'Actions'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {[u.prenom, u.nom].filter(Boolean).join(' ') || '-'}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{u.email || '-'}</td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{u.identifiant || u.username || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          {u.est_super_admin ? (
                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }}>Super Admin</span>
                          ) : (
                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}>Utilisateur</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => openEditModal(u)}
                            style={{ background: 'none', border: '1px solid var(--glass-border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Edit2 size={13} /> Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Aucun utilisateur</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* User Modal */}
          {showUserModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 24 }} onClick={() => setShowUserModal(false)}>
              <div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="card-layer glass-panel"
                style={{ maxWidth: 500, width: '100%', padding: 32 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 className="text-title" style={{ margin: 0 }}>{editingUser ? 'Modifier' : 'Creer'} un utilisateur</h2>
                  <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Prenom</label>
                      <input className="ghost-input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prenom" />
                    </div>
                    <div>
                      <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Nom</label>
                      <input className="ghost-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Email</label>
                    <input className="ghost-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.cm" />
                  </div>
                  <div>
                    <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Identifiant</label>
                    <input className="ghost-input" value={form.identifiant} onChange={(e) => setForm({ ...form, identifiant: e.target.value })} placeholder="Identifiant de connexion" required disabled={!!editingUser} />
                  </div>
                  <div>
                    <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Mot de passe{editingUser ? ' (laisser vide pour ne pas changer)' : ''}</label>
                    <input className="ghost-input" type="password" value={form.mot_de_passe} onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })} placeholder="********" required={!editingUser} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={form.est_super_admin} onChange={(e) => setForm({ ...form, est_super_admin: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--accent-gold)' }} />
                    Super administrateur
                  </label>
                  <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', marginTop: 8 }}>
                    {saving ? 'Enregistrement...' : editingUser ? 'Mettre a jour' : 'Creer'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ Sync Tab ═══ */}
      {tab === 'sync' && (
        <>
          {/* Sync Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card-layer" custom={0} variants={fadeUp} initial="hidden" animate="visible" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-dgi-dim)', display: 'grid', placeItems: 'center' }}>
                <Database size={22} style={{ color: 'var(--accent-dgi)' }} />
              </div>
              <div>
                <div className="text-label" style={{ marginBottom: 2 }}>Derniere synchro</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(syncInfo?.derniereSynchro || syncInfo?.last_sync)}</div>
              </div>
            </div>
            <div className="card-layer" custom={1} variants={fadeUp} initial="hidden" animate="visible" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-gold-dim)', display: 'grid', placeItems: 'center' }}>
                {syncInfo?.statut === 'OK' || syncInfo?.status === 'OK'
                  ? <CheckCircle size={22} style={{ color: 'var(--accent-dgi)' }} />
                  : <XCircle size={22} style={{ color: '#ef4444' }} />
                }
              </div>
              <div>
                <div className="text-label" style={{ marginBottom: 2 }}>Statut</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{syncInfo?.statut || syncInfo?.status || 'Inconnu'}</div>
              </div>
            </div>
          </div>

          {/* Trigger button */}
          <div className="card-layer glass-panel" custom={2} variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 className="text-title" style={{ margin: 0 }}>Synchronisation manuelle</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Declencher une synchronisation avec la plateforme TresorPay</p>
            </div>
            <button className="btn-primary" onClick={triggerSync} disabled={syncing} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? 'Synchronisation...' : 'Synchroniser'}
            </button>
          </div>

          {/* Sync Journal */}
          <div className="card-layer glass-panel" custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Journal de synchronisation</h3>
            {syncLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Chargement...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                      {['Date', 'Type', 'Statut', 'Elements', 'Duree'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {syncJournal.map((entry, idx) => (
                      <tr key={entry.id || idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(entry.date || entry.createdAt)}</td>
                        <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{entry.type || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: (entry.statut || entry.status) === 'OK' ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.12)',
                            color: (entry.statut || entry.status) === 'OK' ? 'var(--accent-dgi)' : '#ef4444',
                          }}>
                            {entry.statut || entry.status || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{entry.elements || entry.count || '-'}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{entry.duree || entry.duration || '-'}</td>
                      </tr>
                    ))}
                    {syncJournal.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Aucun historique de synchronisation</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
