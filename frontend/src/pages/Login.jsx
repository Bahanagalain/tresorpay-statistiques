import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTheme } from '../components/theme/ThemeProvider';
import { useAuth } from '../components/auth/AuthProvider';
import { useLanguage } from '../components/i18n/LanguageProvider';
import './Login.css';

/* ── rate-limiter ── */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

/* ── FlowingLines canvas ── */
function FlowingLines({ width, height }) {
  const canvasRef = useRef(null);
  const linesRef = useRef([]);
  const rafRef = useRef(null);

  const COLORS = ['#b8860b', '#228b22', '#c0392b'];

  const createLine = useCallback(
    (w, h) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      len: 80 + Math.random() * 120,
      speed: 0.3 + Math.random() * 0.7,
      angle: Math.random() * Math.PI * 2,
      da: (Math.random() - 0.5) * 0.02,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.12 + Math.random() * 0.18,
      width: 1 + Math.random() * 2,
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = width || canvas.parentElement.clientWidth;
    const h = height || canvas.parentElement.clientHeight;
    canvas.width = w;
    canvas.height = h;

    if (!linesRef.current.length) {
      linesRef.current = Array.from({ length: 35 }, () => createLine(w, h));
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      linesRef.current.forEach((l) => {
        l.angle += l.da;
        l.x += Math.cos(l.angle) * l.speed;
        l.y += Math.sin(l.angle) * l.speed;

        if (l.x < -l.len) l.x = w + l.len;
        if (l.x > w + l.len) l.x = -l.len;
        if (l.y < -l.len) l.y = h + l.len;
        if (l.y > h + l.len) l.y = -l.len;

        const ex = l.x + Math.cos(l.angle) * l.len;
        const ey = l.y + Math.sin(l.angle) * l.len;

        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = l.color;
        ctx.globalAlpha = l.alpha;
        ctx.lineWidth = l.width;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, createLine]);

  return <canvas ref={canvasRef} className="lp-flowing-canvas" />;
}

/* ── Login page ── */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { t, lang, setLang } = useLanguage();

  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);

  /* lock countdown */
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setAttempts(0);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = lockedUntil && Date.now() < lockedUntil;
  const remainingSec = isLocked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) {
      toast.error(t?.loginLocked || `Compte verrouille. Reessayez dans ${remainingSec}s`);
      return;
    }
    if (!identifiant.trim() || !password.trim()) {
      toast.error(t?.loginFieldsRequired || 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      await login(identifiant.trim(), password);
      toast.success(t?.loginSuccess || 'Connexion reussie');
      navigate('/tableau-de-bord');
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        toast.error(
          t?.loginLockedOut ||
            `Trop de tentatives. Verrouille pendant 60 secondes.`,
        );
      } else {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            t?.loginFailed ||
            'Identifiants incorrects',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* ── top bar ── */}
      <div className="login-top-bar">
        <button
          className="ltb-btn"
          onClick={toggleTheme}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
        >
          {isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
        <button
          className="ltb-btn"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          title="Langue"
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>
      </div>

      {/* ── left panel ── */}
      <div className="login-panel login-panel--left">
        <div className="login-orb login-orb--1" />
        <div className="login-orb login-orb--2" />
        <div className="login-orb login-orb--3" />

        <div className="lp-canvas-wrapper">
          <FlowingLines />
        </div>

        <div className="lp-content">
          <h1 className="lp-title">TresorPay Statistiques</h1>
          <p className="lp-subtitle">
            {t?.loginSubtitle || 'Plateforme de suivi et analyse des paiements'}
          </p>
        </div>

        <div className="lp-partners">
          <span className="lp-partner-text">Republique du Cameroun</span>
          <span className="lp-partner-sep">|</span>
          <span className="lp-partner-text">Ministere des Finances</span>
        </div>
      </div>

      {/* ── right panel ── */}
      <div className="login-panel login-panel--right">
        <div className="lr-card">
          <div className="lr-logo-text">TresorPay Statistiques</div>
          <h2 className="lr-title">
            {t?.loginTitle || 'Connexion'}
          </h2>
          <p className="lr-desc">
            {t?.loginDesc || 'Accedez a votre espace de statistiques'}
          </p>

          <form className="lr-form" onSubmit={handleSubmit}>
            <div className="lr-field">
              <label className="lr-label" htmlFor="identifiant">
                {t?.loginIdentifiant || 'Identifiant'}
              </label>
              <input
                id="identifiant"
                className="lr-input"
                type="text"
                autoComplete="username"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                disabled={loading || isLocked}
                placeholder={t?.loginIdentifiantPlaceholder || 'Votre identifiant'}
              />
            </div>

            <div className="lr-field">
              <label className="lr-label" htmlFor="password">
                {t?.loginPassword || 'Mot de passe'}
              </label>
              <div className="lr-password-wrapper">
                <input
                  id="password"
                  className="lr-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || isLocked}
                  placeholder="********"
                />
                <button
                  type="button"
                  className="lr-toggle-pw"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F'}
                </button>
              </div>
            </div>

            {isLocked && (
              <p className="lr-locked-msg">
                {t?.loginLockedMsg || `Verrouille — reessayez dans ${remainingSec}s`}
              </p>
            )}

            <button
              type="submit"
              className="lr-btn"
              disabled={loading || isLocked}
            >
              {loading ? (
                <span className="lr-spinner" />
              ) : (
                t?.loginButton || 'Se connecter'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
