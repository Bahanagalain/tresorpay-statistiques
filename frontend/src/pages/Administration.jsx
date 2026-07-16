import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Users, UserPlus, Search, Filter, Edit3, Trash2,
  ChevronDown, ChevronUp, X, Check, Eye, EyeOff, RefreshCw,
  Building2, MapPin, AlertTriangle, CheckCircle, Clock,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { apiGet, apiPost } from '../api/httpClient';
import { apiFetch } from '../api/httpClient';
import './Administration.css';

const NIVEAUX = ['CENTRAL', 'REGIONAL', 'CDI'];
const NIVEAU_LABELS = { CENTRAL: 'Central', REGIONAL: 'Régional', CDI: 'Départemental' };
const NIVEAU_COLORS = { CENTRAL: '#B8860B', REGIONAL: '#2563EB', CDI: '#059669' };

function NiveauBadge({ niveau }) {
  return (
    <span className="adm-badge" style={{ '--badge-color': NIVEAU_COLORS[niveau] || '#6B7280' }}>
      {NIVEAU_LABELS[niveau] || niveau}
    </span>
  );
}

function StatutBadge({ actif }) {
  return (
    <span className={`adm-statut ${actif ? 'adm-statut--actif' : 'adm-statut--inactif'}`}>
      {actif ? <><CheckCircle size={12} /> Actif</> : <><AlertTriangle size={12} /> Inactif</>}
    </span>
  );
}

// ─── Modal de création / modification ──────────────────────────────

function UserFormModal({ isOpen, onClose, onSaved, user, roles, regions, cdis }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    identifiant: '', mot_de_passe: '', nom_complet: '', email: '', telephone: '',
    niveau: 'CENTRAL', codes_roles: [], region_fiscale_id: '', cdi_id: '', est_actif: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filteredCdis, setFilteredCdis] = useState([]);

  useEffect(() => {
    if (user) {
      setForm({
        identifiant: user.identifiant || '',
        mot_de_passe: '',
        nom_complet: user.nom_complet || '',
        email: user.email || '',
        telephone: user.telephone || '',
        niveau: user.niveau || 'CENTRAL',
        codes_roles: user.roles?.map(r => r.code) || [],
        region_fiscale_id: user.region?.id || '',
        cdi_id: user.cdi?.id || '',
        est_actif: user.est_actif !== false,
      });
    } else {
      setForm({
        identifiant: '', mot_de_passe: '', nom_complet: '', email: '', telephone: '',
        niveau: 'CENTRAL', codes_roles: [], region_fiscale_id: '', cdi_id: '', est_actif: true,
      });
    }
  }, [user]);

  useEffect(() => {
    if (form.region_fiscale_id) {
      setFilteredCdis(cdis.filter(c => c.regionFiscaleId === parseInt(form.region_fiscale_id)));
    } else {
      setFilteredCdis(cdis);
    }
  }, [form.region_fiscale_id, cdis]);

  const availableRoles = roles.filter(r => r.niveau === form.niveau);

  const update = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'niveau') {
        next.codes_roles = [];
        if (value === 'CENTRAL') { next.region_fiscale_id = ''; next.cdi_id = ''; }
        if (value === 'REGIONAL') { next.cdi_id = ''; }
      }
      if (field === 'region_fiscale_id') { next.cdi_id = ''; }
      return next;
    });
  };

  const toggleRole = (code) => {
    setForm(prev => ({
      ...prev,
      codes_roles: prev.codes_roles.includes(code)
        ? prev.codes_roles.filter(c => c !== code)
        : [...prev.codes_roles, code],
    }));
  };

  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    if (!form.identifiant.trim()) errors.identifiant = 'L\'identifiant est requis';
    else if (form.identifiant.trim().length < 3) errors.identifiant = 'L\'identifiant doit contenir au moins 3 caractères';
    if (!isEdit && !form.mot_de_passe) errors.mot_de_passe = 'Le mot de passe est requis';
    else if (form.mot_de_passe && form.mot_de_passe.length < 6) errors.mot_de_passe = 'Le mot de passe doit contenir au moins 6 caractères';
    if (!form.nom_complet.trim()) errors.nom_complet = 'Le nom complet est requis';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Format d\'email invalide';
    if (form.niveau === 'REGIONAL' && !form.region_fiscale_id) errors.region_fiscale_id = 'La région est requise pour le niveau Régional';
    if (form.niveau === 'CDI' && !form.region_fiscale_id) errors.region_fiscale_id = 'Sélectionnez d\'abord une région';
    if (form.niveau === 'CDI' && form.region_fiscale_id && !form.cdi_id) errors.cdi_id = 'Le ministère est requis pour le niveau Départemental';
    if (form.codes_roles.length === 0) errors.codes_roles = 'Sélectionnez au moins un rôle';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs du formulaire');
      return;
    }
    setSaving(true);
    try {
      const body = { ...form };
      if (body.region_fiscale_id) body.region_fiscale_id = parseInt(body.region_fiscale_id);
      else delete body.region_fiscale_id;
      if (body.cdi_id) body.cdi_id = parseInt(body.cdi_id);
      else delete body.cdi_id;
      if (isEdit && !body.mot_de_passe) delete body.mot_de_passe;

      if (isEdit) {
        await apiFetch(`/utilisateurs/${user.id}`, { method: 'PUT', body });
        toast.success('Utilisateur modifié avec succès');
      } else {
        await apiPost('/utilisateurs', body);
        toast.success('Utilisateur créé avec succès');
      }
      setFormErrors({});
      onSaved();
      onClose();
    } catch (err) {
      const msg = err?.message || 'Erreur inconnue';
      // Parse backend validation errors
      if (msg.includes('minLength') || msg.includes('mot_de_passe')) {
        toast.error('Le mot de passe est trop court (minimum 6 caractères)');
      } else if (msg.includes('identifiant') && (msg.includes('unique') || msg.includes('existe'))) {
        toast.error('Cet identifiant est déjà utilisé');
      } else if (msg.includes('Validation') || msg.includes('validation')) {
        toast.error('Erreur de validation : vérifiez les champs du formulaire');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-modal animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h3>{isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h3>
          <button className="adm-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="adm-form">
          <div className="adm-form-grid">
            <div className={`adm-field${formErrors.identifiant ? ' adm-field--error' : ''}`}>
              <label>Identifiant *</label>
              <input type="text" value={form.identifiant} onChange={e => { update('identifiant', e.target.value); setFormErrors(p => ({...p, identifiant: ''})); }}
                required disabled={isEdit} placeholder="nom.utilisateur" />
              {formErrors.identifiant && <span className="adm-field-error">{formErrors.identifiant}</span>}
            </div>
            <div className={`adm-field${formErrors.mot_de_passe ? ' adm-field--error' : ''}`}>
              <label>{isEdit ? 'Nouveau mot de passe' : 'Mot de passe *'}</label>
              <div className="adm-pw-wrap">
                <input type={showPassword ? 'text' : 'password'} value={form.mot_de_passe}
                  onChange={e => { update('mot_de_passe', e.target.value); setFormErrors(p => ({...p, mot_de_passe: ''})); }}
                  required={!isEdit} placeholder={isEdit ? 'Laisser vide si inchangé' : 'Min. 6 caractères'} />
                <button type="button" className="adm-pw-toggle" onClick={() => setShowPassword(p => !p)}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {formErrors.mot_de_passe && <span className="adm-field-error">{formErrors.mot_de_passe}</span>}
              {!isEdit && form.mot_de_passe && form.mot_de_passe.length > 0 && form.mot_de_passe.length < 6 && !formErrors.mot_de_passe && (
                <span className="adm-field-hint adm-field-hint--warn">⚠ Encore {6 - form.mot_de_passe.length} caractère{6 - form.mot_de_passe.length > 1 ? 's' : ''} minimum</span>
              )}
            </div>
            <div className={`adm-field adm-field--full${formErrors.nom_complet ? ' adm-field--error' : ''}`}>
              <label>Nom complet *</label>
              <input type="text" value={form.nom_complet} onChange={e => { update('nom_complet', e.target.value); setFormErrors(p => ({...p, nom_complet: ''})); }}
                required placeholder="Prénom Nom" />
              {formErrors.nom_complet && <span className="adm-field-error">{formErrors.nom_complet}</span>}
            </div>
            <div className={`adm-field${formErrors.email ? ' adm-field--error' : ''}`}>
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => { update('email', e.target.value); setFormErrors(p => ({...p, email: ''})); }}
                placeholder="email@example.cm" />
              {formErrors.email && <span className="adm-field-error">{formErrors.email}</span>}
            </div>
            <div className="adm-field">
              <label>Téléphone</label>
              <input type="text" value={form.telephone} onChange={e => update('telephone', e.target.value)}
                placeholder="+237 6XX XXX XXX" />
            </div>
          </div>

          <div className="adm-separator" />

          <div className="adm-form-grid">
            <div className="adm-field">
              <label>Niveau d'habilitation *</label>
              <div className="adm-niveau-picker">
                {NIVEAUX.map(n => (
                  <button key={n} type="button"
                    className={`adm-niveau-btn ${form.niveau === n ? 'active' : ''}`}
                    style={{ '--btn-accent': NIVEAU_COLORS[n] }}
                    onClick={() => update('niveau', n)}>
                    {NIVEAU_LABELS[n]}
                  </button>
                ))}
              </div>
            </div>

            {form.niveau !== 'CENTRAL' && (
              <div className={`adm-field${formErrors.region_fiscale_id ? ' adm-field--error' : ''}`}>
                <label>Région {form.niveau !== 'CENTRAL' ? '*' : ''}</label>
                <select value={form.region_fiscale_id} onChange={e => { update('region_fiscale_id', e.target.value); setFormErrors(p => ({...p, region_fiscale_id: '', cdi_id: ''})); }}
                  required={form.niveau !== 'CENTRAL'}>
                  <option value="">— Sélectionner une région —</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.libelle}</option>)}
                </select>
                {formErrors.region_fiscale_id && <span className="adm-field-error">{formErrors.region_fiscale_id}</span>}
              </div>
            )}

            {form.niveau === 'CDI' && (
              <div className={`adm-field${formErrors.cdi_id ? ' adm-field--error' : ''}`}>
                <label>Ministère *</label>
                <select value={form.cdi_id}
                  onChange={e => { update('cdi_id', e.target.value); setFormErrors(p => ({...p, cdi_id: ''})); }}
                  required
                  disabled={!form.region_fiscale_id}
                  className={!form.region_fiscale_id ? 'adm-select--disabled' : ''}
                >
                  <option value="">{!form.region_fiscale_id ? '⬆ Sélectionnez d\'abord une région' : '— Sélectionner un ministère —'}</option>
                  {filteredCdis.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                {!form.region_fiscale_id && <span className="adm-field-hint">Sélectionnez d'abord la région pour voir les ministères disponibles</span>}
                {formErrors.cdi_id && <span className="adm-field-error">{formErrors.cdi_id}</span>}
              </div>
            )}
          </div>

          {availableRoles.length > 0 && (
            <>
              <div className="adm-separator" />
              <div className={`adm-field${formErrors.codes_roles ? ' adm-field--error' : ''}`}>
                <label>Rôles ({NIVEAU_LABELS[form.niveau]}) *</label>
                <div className="adm-roles-grid">
                  {availableRoles.map(r => (
                    <label key={r.code} className={`adm-role-chip ${form.codes_roles.includes(r.code) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.codes_roles.includes(r.code)}
                        onChange={() => { toggleRole(r.code); setFormErrors(p => ({...p, codes_roles: ''})); }} />
                      <span>{r.libelle}</span>
                    </label>
                  ))}
                </div>
                {formErrors.codes_roles && <span className="adm-field-error">{formErrors.codes_roles}</span>}
              </div>
            </>
          )}

          {isEdit && (
            <>
              <div className="adm-separator" />
              <label className="adm-toggle-label">
                <input type="checkbox" checked={form.est_actif} onChange={e => update('est_actif', e.target.checked)} />
                <span>Compte actif</span>
              </label>
            </>
          )}

          <div className="adm-modal-footer">
            <button type="button" className="adm-btn outline" onClick={onClose}>Annuler</button>
            <button type="submit" className="adm-btn primary" disabled={saving}>
              {saving ? <span className="adm-spinner" /> : <><Check size={14} /> {isEdit ? 'Enregistrer' : 'Créer'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirmation suppression ──────────────────────────────────────

function ConfirmModal({ isOpen, onClose, onConfirm, userName }) {
  if (!isOpen) return null;
  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-modal adm-modal--sm animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h3>Désactiver l'utilisateur</h3>
          <button className="adm-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="adm-confirm-text">
          Êtes-vous sûr de vouloir désactiver <strong>{userName}</strong> ? L'utilisateur ne pourra plus se connecter.
        </p>
        <div className="adm-modal-footer">
          <button className="adm-btn outline" onClick={onClose}>Annuler</button>
          <button className="adm-btn danger" onClick={onConfirm}><Trash2 size={14} /> Désactiver</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────

export default function Administration({ embedded = false } = {}) {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [roles, setRoles] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cdis, setCdis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreActif, setFiltreActif] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('cree_le');
  const [sortDir, setSortDir] = useState('desc');

  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rolesRes, regionsRes, cdisRes] = await Promise.all([
        apiGet('/utilisateurs', { limite: 200 }),
        apiGet('/referentiel/roles'),
        apiGet('/referentiel/regions'),
        apiGet('/referentiel/cdis'),
      ]);
      setUtilisateurs(uRes?.datas || []);
      setRoles(rolesRes?.datas || rolesRes || []);
      setRegions(regionsRes?.datas || regionsRes || []);
      setCdis(cdisRes?.datas || cdisRes || []);
    } catch (err) {
      toast.error('Erreur chargement : ' + (err?.message || 'Inconnue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Filtrage et tri
  const filtered = utilisateurs
    .filter(u => {
      if (search) {
        const q = search.toLowerCase();
        if (!u.identifiant?.toLowerCase().includes(q) &&
            !u.nom_complet?.toLowerCase().includes(q) &&
            !u.email?.toLowerCase().includes(q)) return false;
      }
      if (filtreNiveau && u.niveau !== filtreNiveau) return false;
      if (filtreActif === 'true' && !u.est_actif) return false;
      if (filtreActif === 'false' && u.est_actif) return false;
      return true;
    })
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'cree_le') { va = new Date(va); vb = new Date(vb); }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/utilisateurs/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Utilisateur désactivé');
      setDeleteTarget(null);
      charger();
    } catch (err) {
      toast.error(err?.message || 'Erreur');
    }
  };

  const stats = {
    total: utilisateurs.length,
    actifs: utilisateurs.filter(u => u.est_actif).length,
    central: utilisateurs.filter(u => u.niveau === 'CENTRAL').length,
    regional: utilisateurs.filter(u => u.niveau === 'REGIONAL').length,
    cdi: utilisateurs.filter(u => u.niveau === 'CDI').length,
  };

  return (
    <div className={`adm-page${embedded ? ' adm-page--embedded' : ''}`}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }} />

      {/* ── Header ── */}
      {embedded ? (
        <div className="adm-actions-bar">
          <button className="adm-btn outline" onClick={charger} title="Actualiser">
            <RefreshCw size={14} /> Actualiser
          </button>
          <button className="adm-btn primary" onClick={() => { setEditUser(null); setShowForm(true); }}>
            <UserPlus size={14} /> Nouvel utilisateur
          </button>
        </div>
      ) : (
        <div className="adm-header">
          <div className="adm-header-left">
            <div className="adm-dept-icon"><Shield size={26} /></div>
            <div>
              <h1 className="adm-page-title">Administration</h1>
              <p className="adm-page-sub">Gestion des utilisateurs et habilitations</p>
            </div>
          </div>
          <div className="adm-header-right">
            <button className="adm-btn outline" onClick={charger} title="Actualiser">
              <RefreshCw size={14} /> Actualiser
            </button>
            <button className="adm-btn primary" onClick={() => { setEditUser(null); setShowForm(true); }}>
              <UserPlus size={14} /> Nouvel utilisateur
            </button>
          </div>
        </div>
      )}

      {/* ── Stats cards ── */}
      <div className="adm-stats-row">
        <div className="adm-stat-card">
          <Users size={18} className="adm-stat-icon" />
          <div className="adm-stat-value">{stats.total}</div>
          <div className="adm-stat-label">Total</div>
        </div>
        <div className="adm-stat-card">
          <CheckCircle size={18} className="adm-stat-icon" style={{ color: '#059669' }} />
          <div className="adm-stat-value">{stats.actifs}</div>
          <div className="adm-stat-label">Actifs</div>
        </div>
        <div className="adm-stat-card">
          <Shield size={18} className="adm-stat-icon" style={{ color: NIVEAU_COLORS.CENTRAL }} />
          <div className="adm-stat-value">{stats.central}</div>
          <div className="adm-stat-label">Central</div>
        </div>
        <div className="adm-stat-card">
          <MapPin size={18} className="adm-stat-icon" style={{ color: NIVEAU_COLORS.REGIONAL }} />
          <div className="adm-stat-value">{stats.regional}</div>
          <div className="adm-stat-label">Régional</div>
        </div>
        <div className="adm-stat-card">
          <Building2 size={18} className="adm-stat-icon" style={{ color: NIVEAU_COLORS.CDI }} />
          <div className="adm-stat-value">{stats.cdi}</div>
          <div className="adm-stat-label">Départemental</div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="adm-toolbar">
        <div className="adm-search-wrap">
          <Search size={16} className="adm-search-icon" />
          <input type="text" className="adm-search" placeholder="Rechercher par nom, identifiant, email..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="adm-clear" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        <button className={`adm-btn outline ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(p => !p)}>
          <Filter size={14} /> Filtres
        </button>
      </div>

      {showFilters && (
        <div className="adm-filters animate-slide-up">
          <div className="adm-filter-group">
            <label>Niveau</label>
            <select value={filtreNiveau} onChange={e => setFiltreNiveau(e.target.value)}>
              <option value="">Tous</option>
              {NIVEAUX.map(n => <option key={n} value={n}>{NIVEAU_LABELS[n]}</option>)}
            </select>
          </div>
          <div className="adm-filter-group">
            <label>Statut</label>
            <select value={filtreActif} onChange={e => setFiltreActif(e.target.value)}>
              <option value="">Tous</option>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
            </select>
          </div>
          <button className="adm-btn outline" onClick={() => { setFiltreNiveau(''); setFiltreActif(''); }}>
            Réinitialiser
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-loading">
            <RefreshCw size={20} className="adm-spin" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">Aucun utilisateur trouvé</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('identifiant')}>Identifiant <SortIcon field="identifiant" /></th>
                <th onClick={() => toggleSort('nom_complet')}>Nom complet <SortIcon field="nom_complet" /></th>
                <th onClick={() => toggleSort('niveau')}>Niveau <SortIcon field="niveau" /></th>
                <th>Rôles</th>
                <th>Rattachement</th>
                <th onClick={() => toggleSort('est_actif')}>Statut <SortIcon field="est_actif" /></th>
                <th onClick={() => toggleSort('cree_le')}>Créé le <SortIcon field="cree_le" /></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={!u.est_actif ? 'adm-row--inactive' : ''}>
                  <td className="adm-cell-id">
                    {u.identifiant}
                    {u.est_super_admin && <span className="adm-sa-badge">SA</span>}
                  </td>
                  <td>{u.nom_complet}</td>
                  <td><NiveauBadge niveau={u.niveau} /></td>
                  <td className="adm-cell-roles">
                    {u.roles?.map(r => <span key={r.code} className="adm-role-tag">{r.code}</span>)}
                  </td>
                  <td className="adm-cell-rattachement">
                    {u.region && <span><MapPin size={12} /> {u.region.libelle}</span>}
                    {u.cdi && <span><Building2 size={12} /> {u.cdi.nom}</span>}
                    {!u.region && !u.cdi && <span className="adm-muted">—</span>}
                  </td>
                  <td><StatutBadge actif={u.est_actif} /></td>
                  <td className="adm-cell-date">
                    {u.cree_le ? new Date(u.cree_le).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="adm-cell-actions">
                    <button className="adm-action-btn" title="Modifier"
                      onClick={() => { setEditUser(u); setShowForm(true); }}>
                      <Edit3 size={14} />
                    </button>
                    {!u.est_super_admin && (
                      <button className="adm-action-btn adm-action-btn--danger" title="Désactiver"
                        onClick={() => setDeleteTarget(u)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="adm-footer-info">
        {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        {(search || filtreNiveau || filtreActif) ? ` (sur ${utilisateurs.length} au total)` : ''}
      </div>

      {/* Modals */}
      <UserFormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditUser(null); }}
        onSaved={charger} user={editUser} roles={roles} regions={regions} cdis={cdis} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} userName={deleteTarget?.nom_complet} />
    </div>
  );
}
