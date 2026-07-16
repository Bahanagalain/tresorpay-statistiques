import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  Mail,
  Monitor,
  Palette,
  Phone,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  Shield,
  Sparkles,
  Upload,
  User,
} from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { uploadProfilePhoto, updateMyProfile, verifyEmail, resendVerification, sendTestReport } from '../api/authApi';
import { resolveApiUrl } from '../api/apiConfig';
import { savePresentationSettings } from '../components/layout/MainLayout';
import {
  DEFAULT_APPEARANCE,
  loadAppearanceSettings,
  saveAppearanceSettings,
  applyAppearanceSettings,
} from '../styles/spotlight-init';
import toast from 'react-hot-toast';
import Administration from './Administration';
import './Parametres.css';

function resolvePhotoUrl(url) {
  if (!url) return null;
  return resolveApiUrl(url);
}

function loadPresSettings() {
  try {
    const raw = localStorage.getItem('presentation_settings');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ActionButton({
  state = 'idle',
  icon: Icon,
  variant = 'primary',
  loadingLabel,
  successLabel = 'Validé',
  children,
  disabled,
  ...props
}) {
  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const CurrentIcon = isLoading ? RefreshCw : isSuccess ? CheckCircle : Icon;

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`param-btn param-btn--${variant}${isLoading ? ' is-loading' : ''}${isSuccess ? ' is-success' : ''}${state === 'error' ? ' is-error' : ''}`}
    >
      {CurrentIcon ? <CurrentIcon size={14} className={isLoading ? 'spin' : ''} /> : null}
      <span>{isLoading ? loadingLabel : isSuccess ? successLabel : children}</span>
    </button>
  );
}

function FeedbackBanner({ feedback }) {
  if (!feedback) return null;
  const Icon = feedback.tone === 'success' ? CheckCircle : AlertTriangle;
  return (
    <div key={feedback.tick} className={`param-banner param-banner--${feedback.tone}`} role="status" aria-live="polite">
      <Icon size={16} />
      <div>
        <strong>{feedback.title}</strong>
        <span>{feedback.message}</span>
      </div>
    </div>
  );
}

const GLOW_COLOR_PRESETS = [
  { label: 'Vert Trésor', hue: 150 },
  { label: 'Bleu',     hue: 220 },
  { label: 'Violet',   hue: 280 },
  { label: 'Orange',   hue: 30  },
  { label: 'Rouge',    hue: 0   },
  { label: 'Or',       hue: 40  },
  { label: 'Cyan',     hue: 180 },
];

const DEFAULT_PRESENTATION_SETTINGS = { inactivityDelay: 120, slideInterval: 30, dateFilter: 'today' };

function getFilterLabel(filter) {
  if (filter === 'month') return 'Ce mois';
  if (filter === 'all') return 'Toutes les données';
  return "Aujourd'hui";
}

export default function Parametres() {
  const { user, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);
  const actionTimersRef = useRef({});
  const feedbackTimersRef = useRef({});

  const isSuperAdmin = Boolean(user?.est_super_admin);

  const SECTION_GROUPS = [
    {
      title: 'Compte',
      items: [
        { id: 'profile', label: 'Profil', icon: User, desc: 'Identité, contact et photo' },
      ],
    },
    {
      title: 'Préférences',
      items: [
        { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Rapports et emails' },
        { id: 'apparence',     label: 'Apparence',     icon: Palette, desc: 'Effet de survol' },
        { id: 'presentation',  label: 'Présentation',  icon: Monitor, desc: 'Diaporama automatique' },
      ],
    },
    ...(isSuperAdmin ? [{
      title: 'Système',
      items: [
        { id: 'administration', label: 'Administration', icon: Shield, desc: 'Utilisateurs et rôles' },
      ],
    }] : []),
  ];

  const [activeSection, setActiveSection] = useState('profile');

  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.telephone || '');
  const [verifyCode, setVerifyCode] = useState('');
  const [showVerify, setShowVerify] = useState(false);

  const [emailReportEnabled, setEmailReportEnabled] = useState(Boolean(user?.rapport_quotidien));
  const [emailReportTime, setEmailReportTime] = useState(user?.heure_rapport || '07:00');

  const [presSettings, setPresSettings] = useState(() => loadPresSettings() || DEFAULT_PRESENTATION_SETTINGS);
  const [appearance, setAppearance] = useState(() => loadAppearanceSettings());
  const [actionStates, setActionStates] = useState({});
  const [sectionFeedback, setSectionFeedback] = useState({
    profile: null,
    notifications: null,
    presentation: null,
    apparence: null,
  });

  const photoUrl = resolvePhotoUrl(user?.photo_url);

  useEffect(() => {
    setEditEmail(user?.email || '');
    setEditPhone(user?.telephone || '');
    setEmailReportEnabled(Boolean(user?.rapport_quotidien));
    setEmailReportTime(user?.heure_rapport || '07:00');
    if (!user?.email || user?.email_verifie) {
      setShowVerify(false);
      setVerifyCode('');
    }
  }, [user?.email, user?.telephone, user?.rapport_quotidien, user?.heure_rapport, user?.email_verifie]);

  useEffect(() => () => {
    Object.values(actionTimersRef.current).forEach(clearTimeout);
    Object.values(feedbackTimersRef.current).forEach(clearTimeout);
  }, []);

  useEffect(() => {
    applyAppearanceSettings(appearance);
  }, [appearance]);

  useEffect(() => () => {
    applyAppearanceSettings(loadAppearanceSettings());
  }, []);

  const getInitials = () => {
    if (!user?.nom_complet) return '?';
    const parts = user.nom_complet.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  const setTimedActionState = (key, state) => {
    setActionStates((prev) => ({ ...prev, [key]: state }));
    if (state === 'success' || state === 'error') {
      clearTimeout(actionTimersRef.current[key]);
      actionTimersRef.current[key] = setTimeout(() => {
        setActionStates((prev) => ({ ...prev, [key]: 'idle' }));
      }, state === 'success' ? 1800 : 2600);
    }
  };

  const pushSectionFeedback = (section, tone, title, message) => {
    const entry = { tone, title, message, tick: Date.now() };
    setSectionFeedback((prev) => ({ ...prev, [section]: entry }));
    clearTimeout(feedbackTimersRef.current[section]);
    feedbackTimersRef.current[section] = setTimeout(() => {
      setSectionFeedback((prev) => ({ ...prev, [section]: null }));
    }, tone === 'success' ? 5200 : 6800);
  };

  const runAction = async (key, config, action) => {
    setTimedActionState(key, 'loading');
    const toastId = toast.loading(config.loadingMessage);
    try {
      const result = await action();
      const successTitle = typeof config.successTitle === 'function' ? config.successTitle(result) : (config.successTitle || 'Action validée');
      const successMessage = typeof config.successMessage === 'function' ? config.successMessage(result) : (config.successMessage || 'Opération terminée.');
      setTimedActionState(key, 'success');
      pushSectionFeedback(config.section, 'success', successTitle, successMessage);
      toast.success(successMessage, { id: toastId, duration: config.duration || 4500 });
      return result;
    } catch (err) {
      const errorMessage = err?.message || config.errorMessage || 'Une erreur est survenue.';
      setTimedActionState(key, 'error');
      pushSectionFeedback(config.section, 'error', config.errorTitle || 'Action interrompue', errorMessage);
      toast.error(errorMessage, { id: toastId });
      throw err;
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La photo ne doit pas dépasser 2 Mo.');
      event.target.value = '';
      return;
    }
    try {
      await runAction('uploadPhoto', {
        section: 'profile',
        loadingMessage: 'Mise à jour de la photo...',
        successTitle: 'Photo actualisée',
        successMessage: 'Votre photo de profil est visible immédiatement.',
      }, async () => {
        await uploadProfilePhoto(file);
        await refreshProfile();
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveEmail = async () => {
    const nextEmail = editEmail.trim();
    await runAction('saveEmail', {
      section: 'profile',
      loadingMessage: "Mise à jour de l'adresse email...",
      successTitle: (response) => !nextEmail ? 'Adresse supprimée' : response?.email_verification_needed ? 'Email enregistré' : 'Adresse mise à jour',
      successMessage: (response) => !nextEmail ? 'Adresse retirée du profil.' : response?.email_verification_needed ? `Un code de vérification a été envoyé à ${nextEmail}.` : 'Adresse email enregistrée.',
    }, async () => {
      const response = await updateMyProfile({ email: nextEmail });
      await refreshProfile();
      if (response?.email_verification_needed) setShowVerify(true);
      return response;
    });
  };

  const handleVerifyCode = async () => {
    if (verifyCode.length !== 6) return;
    await runAction('verifyEmail', {
      section: 'profile',
      loadingMessage: "Validation de l'adresse email...",
      successTitle: 'Adresse validée',
      successMessage: 'Email vérifié. Un rapport test vient d\'être envoyé.',
    }, async () => {
      const response = await verifyEmail(verifyCode);
      await refreshProfile();
      setShowVerify(false);
      setVerifyCode('');
      return response;
    });
  };

  const handleResend = async () => {
    await runAction('resendVerification', {
      section: 'profile',
      loadingMessage: 'Renvoi du code...',
      successTitle: 'Code renvoyé',
      successMessage: 'Un nouveau code a été expédié à votre adresse.',
    }, async () => resendVerification());
  };

  const handleSavePhone = async () => {
    await runAction('savePhone', {
      section: 'profile',
      loadingMessage: 'Mise à jour du téléphone...',
      successTitle: 'Téléphone mis à jour',
      successMessage: 'Votre numéro est désormais enregistré.',
    }, async () => {
      await updateMyProfile({ telephone: editPhone.trim() });
      await refreshProfile();
    });
  };

  const handleSaveNotifications = async () => {
    await runAction('saveNotifications', {
      section: 'notifications',
      loadingMessage: 'Enregistrement...',
      successTitle: 'Préférences enregistrées',
      successMessage: `Rapports quotidiens ${emailReportEnabled ? `activés à ${emailReportTime}` : 'désactivés'}.`,
    }, async () => {
      await updateMyProfile({ rapport_quotidien: emailReportEnabled, heure_rapport: emailReportTime });
      await refreshProfile();
    });
  };

  const handleSendTestReport = async () => {
    await runAction('sendTestReport', {
      section: 'notifications',
      loadingMessage: 'Envoi du rapport test...',
      successTitle: 'Rapport test envoyé',
      successMessage: (response) => response?.message || 'Le rapport du jour a été envoyé.',
      duration: 5500,
    }, async () => sendTestReport());
  };

  const handleSavePresentation = async () => {
    await runAction('savePresentation', {
      section: 'presentation',
      loadingMessage: 'Application...',
      successTitle: 'Mode présentation actualisé',
      successMessage: `Slides de ${presSettings.slideInterval}s, filtre : ${getFilterLabel(presSettings.dateFilter).toLowerCase()}.`,
    }, async () => {
      savePresentationSettings(presSettings);
    });
  };

  const handleSaveAppearance = async () => {
    await runAction('saveAppearance', {
      section: 'apparence',
      loadingMessage: 'Application...',
      successTitle: 'Apparence appliquée',
      successMessage: appearance.glowEnabled
        ? `Rayon ${appearance.glowSize}px, teinte ${appearance.glowHue}°, intensité ${Math.round(appearance.glowIntensity * 100)}%.`
        : 'Effet de survol désactivé.',
    }, async () => {
      saveAppearanceSettings(appearance);
    });
  };

  const handleResetAppearance = () => setAppearance(DEFAULT_APPEARANCE);

  const normalizedCurrentEmail = (user?.email || '').trim();
  const normalizedEditEmail = editEmail.trim();
  const normalizedCurrentPhone = (user?.telephone || '').trim();
  const normalizedEditPhone = editPhone.trim();

  const activeItem = SECTION_GROUPS.flatMap(g => g.items).find(i => i.id === activeSection);

  return (
    <div className="param-page">
      {/* ── Left rail ───────────────────────────────── */}
      <aside className="param-rail">
        <div className="param-rail__brand">
          <Settings size={16} />
          <span>Paramètres</span>
        </div>

        {SECTION_GROUPS.map(group => (
          <div key={group.title} className="param-rail__group">
            <h4>{group.title}</h4>
            <nav>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`param-rail__link ${activeSection === item.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(item.id)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="param-rail__user">
          <div className="param-rail__avatar">
            {photoUrl ? <img src={photoUrl} alt="" /> : <span>{getInitials()}</span>}
          </div>
          <div className="param-rail__user-info">
            <strong>{user?.nom_complet || 'Utilisateur'}</strong>
            <span>{user?.niveau || 'CENTRAL'}</span>
          </div>
        </div>
      </aside>

      {/* ── Content ───────────────────────────────── */}
      <main className="param-main">
        <header className="param-main__header">
          <div className="param-main__crumbs">Paramètres <span>/</span> {activeItem?.label}</div>
          <h1>{activeItem?.label}</h1>
          <p>{activeItem?.desc}</p>
        </header>

        {activeSection === 'profile' && (
          <div className="param-sections">
            <FeedbackBanner feedback={sectionFeedback.profile} />

            <section className="param-card">
              <div className="param-card__head">
                <h3>Photo de profil</h3>
                <p>Image affichée dans la navigation et les rapports.</p>
              </div>
              <div className="param-card__body param-photo-row">
                <div className="param-photo" onClick={() => fileInputRef.current?.click()}>
                  {photoUrl ? <img src={photoUrl} alt="" /> : <span>{getInitials()}</span>}
                  <div className="param-photo__hover"><Upload size={16} /></div>
                </div>
                <div className="param-photo-meta">
                  <p>JPG, PNG ou WebP. Max 2 Mo.</p>
                  <button className="param-btn param-btn--ghost" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} /> Changer la photo
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </div>
              </div>
            </section>

            <section className="param-card">
              <div className="param-card__head">
                <h3>Identité</h3>
                <p>Informations gérées par l'administrateur système.</p>
              </div>
              <div className="param-card__body param-grid-2">
                <div className="param-field param-field--readonly">
                  <label>Nom complet</label>
                  <div className="param-value">{user?.nom_complet || '—'}</div>
                </div>
                <div className="param-field param-field--readonly">
                  <label>Identifiant</label>
                  <div className="param-value">{user?.identifiant || '—'}</div>
                </div>
                <div className="param-field param-field--readonly">
                  <label>Niveau d'accès</label>
                  <div className="param-value"><span className="param-pill">{user?.niveau || '—'}</span></div>
                </div>
                {user?.region && (
                  <div className="param-field param-field--readonly">
                    <label>Région</label>
                    <div className="param-value">{user.region.nom || user.region.id}</div>
                  </div>
                )}
                {user?.cdi && (
                  <div className="param-field param-field--readonly">
                    <label>Ministère</label>
                    <div className="param-value">{user.cdi.nom || user.cdi.id}</div>
                  </div>
                )}
                {user?.roles?.length > 0 && (
                  <div className="param-field param-field--readonly param-field--full">
                    <label>Rôles</label>
                    <div className="param-value">
                      {user.roles.map((role) => (
                        <span key={role.code} className="param-pill param-pill--subtle">{role.label || role.code}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="param-card">
              <div className="param-card__head">
                <h3>Adresse email</h3>
                <p>Utilisée pour les rapports automatiques et les notifications.</p>
              </div>
              <div className="param-card__body">
                <div className="param-field">
                  <label><Mail size={13} /> Email</label>
                  <div className="param-input-row">
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemple.com" className="param-input" />
                    {user?.email && user?.email_verifie && <span className="param-tag param-tag--success"><CheckCircle size={12} /> Vérifié</span>}
                    {user?.email && !user?.email_verifie && <span className="param-tag param-tag--warning">Non vérifié</span>}
                  </div>
                </div>

                {(showVerify || (user?.email && !user?.email_verifie)) && (
                  <div className="param-verify">
                    <p>Code à 6 chiffres envoyé à <strong>{user?.email || normalizedEditEmail}</strong>.</p>
                    <div className="param-verify__row">
                      <input type="text" maxLength={6} value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="param-code-input" />
                      <ActionButton state={actionStates.verifyEmail} icon={CheckCircle} loadingLabel="Vérification..." successLabel="Validé" onClick={handleVerifyCode} disabled={verifyCode.length !== 6}>Vérifier</ActionButton>
                      <ActionButton state={actionStates.resendVerification} icon={RefreshCw} variant="ghost" loadingLabel="Renvoi..." successLabel="Renvoyé" onClick={handleResend}>Renvoyer</ActionButton>
                    </div>
                  </div>
                )}
              </div>
              <div className="param-card__foot">
                <ActionButton state={actionStates.saveEmail} icon={Mail} loadingLabel="Enregistrement..." successLabel="Enregistré" onClick={handleSaveEmail} disabled={normalizedEditEmail === normalizedCurrentEmail}>Enregistrer</ActionButton>
              </div>
            </section>

            <section className="param-card">
              <div className="param-card__head">
                <h3>Téléphone</h3>
                <p>Numéro de contact optionnel.</p>
              </div>
              <div className="param-card__body">
                <div className="param-field">
                  <label><Phone size={13} /> Numéro</label>
                  <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+237..." className="param-input" />
                </div>
              </div>
              <div className="param-card__foot">
                <ActionButton state={actionStates.savePhone} icon={Phone} loadingLabel="Enregistrement..." successLabel="Mis à jour" onClick={handleSavePhone} disabled={normalizedEditPhone === normalizedCurrentPhone}>Enregistrer</ActionButton>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="param-sections">
            <FeedbackBanner feedback={sectionFeedback.notifications} />

            <section className="param-card">
              <div className="param-card__head">
                <h3>Rapport quotidien par email</h3>
                <p>Recevez chaque jour un résumé des collectes avec ventilation par région et par ministère.</p>
              </div>
              <div className="param-card__body">
                <div className="param-toggle-row">
                  <div>
                    <strong>Activer l'envoi automatique</strong>
                    <span>Requiert une adresse email vérifiée.</span>
                  </div>
                  <label className="param-switch">
                    <input type="checkbox" checked={emailReportEnabled} onChange={(e) => setEmailReportEnabled(e.target.checked)} />
                    <span />
                  </label>
                </div>

                {emailReportEnabled && (
                  <div className="param-field">
                    <label><Clock size={13} /> Heure d'envoi (UTC+1)</label>
                    <input type="time" value={emailReportTime} onChange={(e) => setEmailReportTime(e.target.value)} className="param-input param-input--sm" />
                  </div>
                )}

                {emailReportEnabled && !user?.email && (
                  <div className="param-warning">Configurez une adresse email dans la section Profil avant d'activer l'envoi automatique.</div>
                )}
                {emailReportEnabled && user?.email && !user?.email_verifie && (
                  <div className="param-warning">Votre email doit être vérifié pour recevoir les rapports.</div>
                )}
              </div>
              <div className="param-card__foot">
                <ActionButton state={actionStates.saveNotifications} icon={Send} loadingLabel="Enregistrement..." successLabel="Enregistré" onClick={handleSaveNotifications}>Enregistrer</ActionButton>
              </div>
            </section>

            {user?.email && user?.email_verifie && emailReportEnabled && (
              <section className="param-card">
                <div className="param-card__head">
                  <h3>Rapport test</h3>
                  <p>Envoyer immédiatement le rapport du jour pour vérifier le bon fonctionnement.</p>
                </div>
                <div className="param-card__foot">
                  <ActionButton state={actionStates.sendTestReport} icon={Mail} variant="ghost" loadingLabel="Envoi..." successLabel="Envoyé" onClick={handleSendTestReport}>Envoyer un rapport test</ActionButton>
                </div>
              </section>
            )}
          </div>
        )}

        {activeSection === 'apparence' && (
          <div className="param-sections">
            <FeedbackBanner feedback={sectionFeedback.apparence} />

            <section className="param-card">
              <div className="param-card__head">
                <h3>Effet de survol</h3>
                <p>Halo lumineux qui suit le curseur sur les cartes et tableaux.</p>
              </div>
              <div className="param-card__body">
                <div
                  className="param-preview"
                  data-glow="custom"
                  style={{ '--user-glow-hue': appearance.glowHue }}
                >
                  <div className="param-preview__content">
                    <Sparkles size={18} />
                    <strong>Aperçu en direct</strong>
                    <span>Passez la souris ici — les changements sont appliqués en temps réel.</span>
                  </div>
                </div>

                <div className="param-toggle-row">
                  <div>
                    <strong>Activer l'effet</strong>
                    <span>Désactivez pour une interface plus sobre.</span>
                  </div>
                  <label className="param-switch">
                    <input type="checkbox" checked={appearance.glowEnabled} onChange={(e) => setAppearance(prev => ({ ...prev, glowEnabled: e.target.checked }))} />
                    <span />
                  </label>
                </div>

                <div className="param-field">
                  <label>Rayon <em>{appearance.glowSize} px</em></label>
                  <input type="range" min={80} max={500} step={10} value={appearance.glowSize} onChange={(e) => setAppearance(prev => ({ ...prev, glowSize: Number(e.target.value) }))} disabled={!appearance.glowEnabled} className="param-range" style={{ '--range-hue': appearance.glowHue }} />
                </div>

                <div className="param-field">
                  <label>Intensité <em>{Math.round(appearance.glowIntensity * 100)}%</em></label>
                  <input type="range" min={0} max={150} step={5} value={Math.round(appearance.glowIntensity * 100)} onChange={(e) => setAppearance(prev => ({ ...prev, glowIntensity: Number(e.target.value) / 100 }))} disabled={!appearance.glowEnabled} className="param-range" style={{ '--range-hue': appearance.glowHue }} />
                </div>

                <div className="param-field">
                  <label>Couleur <em>teinte {appearance.glowHue}°</em></label>
                  <div className="param-color-row">
                    {GLOW_COLOR_PRESETS.map(p => (
                      <button key={p.hue} type="button" className={`param-color-chip ${appearance.glowHue === p.hue ? 'active' : ''}`} style={{ '--chip-hue': p.hue }} onClick={() => setAppearance(prev => ({ ...prev, glowHue: p.hue }))} disabled={!appearance.glowEnabled} title={p.label} />
                    ))}
                  </div>
                  <input type="range" min={0} max={360} step={1} value={appearance.glowHue} onChange={(e) => setAppearance(prev => ({ ...prev, glowHue: Number(e.target.value) }))} disabled={!appearance.glowEnabled} className="param-range param-range--hue" />
                </div>
              </div>
              <div className="param-card__foot">
                <button type="button" className="param-btn param-btn--ghost" onClick={handleResetAppearance}>
                  <RotateCcw size={13} /> Réinitialiser
                </button>
                <ActionButton state={actionStates.saveAppearance} icon={Palette} loadingLabel="Application..." successLabel="Appliqué" onClick={handleSaveAppearance}>Enregistrer</ActionButton>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'presentation' && (
          <div className="param-sections">
            <FeedbackBanner feedback={sectionFeedback.presentation} />

            <section className="param-card">
              <div className="param-card__head">
                <h3>Mode Présentation</h3>
                <p>Diaporama automatique qui démarre après une période d'inactivité.</p>
              </div>
              <div className="param-card__body">
                <div className="param-field">
                  <label><Clock size={13} /> Délai d'inactivité</label>
                  <select value={presSettings.inactivityDelay} onChange={(e) => setPresSettings(prev => ({ ...prev, inactivityDelay: Number(e.target.value) }))} className="param-input">
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={180}>3 minutes</option>
                    <option value={300}>5 minutes</option>
                    <option value={600}>10 minutes</option>
                  </select>
                </div>

                <div className="param-field">
                  <label><Monitor size={13} /> Durée par slide</label>
                  <select value={presSettings.slideInterval} onChange={(e) => setPresSettings(prev => ({ ...prev, slideInterval: Number(e.target.value) }))} className="param-input">
                    <option value={10}>10 secondes</option>
                    <option value={15}>15 secondes</option>
                    <option value={20}>20 secondes</option>
                    <option value={30}>30 secondes</option>
                    <option value={45}>45 secondes</option>
                    <option value={60}>1 minute</option>
                  </select>
                </div>

                <div className="param-field">
                  <label><Calendar size={13} /> Filtre de données</label>
                  <select value={presSettings.dateFilter} onChange={(e) => setPresSettings(prev => ({ ...prev, dateFilter: e.target.value }))} className="param-input">
                    <option value="today">Aujourd'hui</option>
                    <option value="month">Ce mois</option>
                    <option value="all">Toutes les données</option>
                  </select>
                </div>
              </div>
              <div className="param-card__foot">
                <ActionButton state={actionStates.savePresentation} icon={Monitor} loadingLabel="Application..." successLabel="Appliqué" onClick={handleSavePresentation}>Appliquer</ActionButton>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'administration' && isSuperAdmin && (
          <div className="param-sections param-sections--embed">
            <Administration embedded />
          </div>
        )}
      </main>
    </div>
  );
}
