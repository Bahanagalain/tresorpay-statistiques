import { useState, useCallback } from 'react';

import { User, Mail, Phone, Camera, Save, Sun, Moon, Globe, Bell, Lock, CheckCircle } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { useTheme } from '../components/theme/ThemeProvider';
import { useLanguage } from '../components/i18n/LanguageProvider';
import { updateMyProfile, uploadProfilePhoto } from '../api/authApi';
import toast from 'react-hot-toast';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

export default function Parametres() {
  const { user, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLanguage();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    telephone: user?.telephone || user?.phone || '',
  });

  // Notification preferences (local state)
  const [notifEmail, setNotifEmail] = useState(true);
  const [dailyReportTime, setDailyReportTime] = useState('08:00');

  const initials = user
    ? `${(user.prenom || user.nom || 'U')[0]}${(user.nom || '')[0] || ''}`.toUpperCase()
    : 'U';

  const displayName = user
    ? [user.prenom, user.nom].filter(Boolean).join(' ') || user.email || 'Utilisateur'
    : 'Utilisateur';

  const handleSaveProfile = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyProfile(form);
      await refreshProfile();
      setEditing(false);
      toast.success('Profil mis a jour');
    } catch (err) {
      toast.error(err?.message || 'Erreur lors de la mise a jour');
    }
    setSaving(false);
  }, [form, refreshProfile]);

  const handlePhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadProfilePhoto(file);
      await refreshProfile();
      toast.success('Photo mise a jour');
    } catch {
      toast.error('Erreur lors du telechargement de la photo');
    }
  }, [refreshProfile]);

  return (
    <div>
      {/* Header */}
      <div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <h2 className="text-headline" style={{ margin: 0 }}>Parametres</h2>
        <p className="text-body" style={{ margin: '4px 0 0' }}>Gerez votre profil et vos preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* ─── Profile Card ─── */}
        <div className="card-layer glass-panel" custom={0} variants={fadeUp} initial="hidden" animate="visible" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-gold), #9E7D17)',
                display: 'grid', placeItems: 'center',
                fontSize: 28, fontWeight: 700, color: '#fff',
                boxShadow: 'var(--shadow-glow)',
              }}>
                {user?.photo_url ? (
                  <img src={user.photo_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : initials}
              </div>
              <label style={{
                position: 'absolute', bottom: 0, right: 0, width: 28, height: 28,
                borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--glass-border)',
                display: 'grid', placeItems: 'center', cursor: 'pointer',
              }}>
                <Camera size={14} style={{ color: 'var(--text-secondary)' }} />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{displayName}</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
                {user?.email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={14} /> {user.email}</span>
                )}
                {(user?.telephone || user?.phone) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={14} /> {user.telephone || user.phone}</span>
                )}
              </div>
              {user?.est_super_admin && (
                <span style={{ marginTop: 8, display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }}>
                  Super Administrateur
                </span>
              )}
            </div>

            <button
              className={editing ? 'btn-secondary-outline' : 'btn-primary'}
              onClick={() => {
                if (editing) {
                  setForm({ nom: user?.nom || '', prenom: user?.prenom || '', email: user?.email || '', telephone: user?.telephone || user?.phone || '' });
                }
                setEditing(!editing);
              }}
              style={{ padding: '8px 20px', fontSize: 13, flexShrink: 0 }}
            >
              {editing ? 'Annuler' : 'Modifier le profil'}
            </button>
          </div>
        </div>

        {/* ─── Edit Profile Form ─── */}
        {editing && (
          <div className="card-layer glass-panel" custom={1} variants={fadeUp} initial="hidden" animate="visible" style={{ gridColumn: '1 / -1' }}>
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} /> Modifier le profil
            </h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Prenom</label>
                <input className="ghost-input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prenom" />
              </div>
              <div>
                <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Nom</label>
                <input className="ghost-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom" required />
              </div>
              <div>
                <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Email</label>
                <input className="ghost-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.cm" />
              </div>
              <div>
                <label className="text-label" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Telephone</label>
                <input className="ghost-input" type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+237 6..." />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn-secondary-outline" onClick={() => setEditing(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── Theme & Language ─── */}
        <div className="card-layer glass-panel" custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Apparence</h3>

          {/* Theme */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {theme === 'dark' ? <Moon size={18} style={{ color: 'var(--accent-dgd)' }} /> : <Sun size={18} style={{ color: 'var(--accent-gold)' }} />}
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Theme</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{theme === 'dark' ? 'Mode sombre' : 'Mode clair'}</div>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              style={{
                width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: theme === 'dark' ? 'var(--accent-gold)' : 'var(--bg-surface-elevated)',
                position: 'relative', transition: 'background 0.3s ease',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: theme === 'dark' ? 27 : 3,
                transition: 'left 0.3s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* Language */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Globe size={18} style={{ color: 'var(--accent-dgi)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Langue</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{lang === 'fr' ? 'Francais' : 'English'}</div>
              </div>
            </div>
            <button
              onClick={toggleLang}
              style={{
                padding: '6px 14px', borderRadius: 8,
                border: '1px solid var(--glass-border)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          </div>
        </div>

        {/* ─── Notifications ─── */}
        <div className="card-layer glass-panel" custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16 }}>Notifications</h3>

          {/* Email notifications */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Bell size={18} style={{ color: 'var(--accent-gold)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Notifications par email</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Recevez les alertes par email</div>
              </div>
            </div>
            <button
              onClick={() => setNotifEmail(!notifEmail)}
              style={{
                width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: notifEmail ? 'var(--accent-dgi)' : 'var(--bg-surface-elevated)',
                position: 'relative', transition: 'background 0.3s ease',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: notifEmail ? 27 : 3,
                transition: 'left 0.3s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* Daily report time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Mail size={18} style={{ color: 'var(--accent-dgd)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Rapport quotidien</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Heure d'envoi du rapport</div>
              </div>
            </div>
            <input
              type="time"
              value={dailyReportTime}
              onChange={(e) => setDailyReportTime(e.target.value)}
              className="ghost-input"
              style={{ width: 100, padding: '6px 10px', textAlign: 'center' }}
            />
          </div>
        </div>

        {/* ─── Security (Placeholder) ─── */}
        <div className="card-layer glass-panel" custom={4} variants={fadeUp} initial="hidden" animate="visible" style={{ gridColumn: '1 / -1' }}>
          <h3 className="text-title" style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} /> Securite
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Mot de passe</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Modifier votre mot de passe de connexion</div>
            </div>
            <button className="btn-secondary-outline" style={{ padding: '6px 14px', fontSize: 13 }}>
              Changer le mot de passe
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Derniere connexion</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {user?.derniere_connexion
                  ? new Date(user.derniere_connexion).toLocaleString('fr-FR')
                  : 'Information non disponible'}
              </div>
            </div>
            <CheckCircle size={18} style={{ color: 'var(--accent-dgi)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
