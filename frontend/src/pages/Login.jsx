import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { useTheme } from '../components/theme/ThemeProvider';
import { useAuth } from '../components/auth/AuthProvider';
import { useLanguage } from '../components/i18n/LanguageProvider';
import tresorPayLogo from '../assets/logo-tresorpay.png';
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
  const { lang, setLang } = useLanguage();

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
      toast.error(`Compte verrouille. Reessayez dans ${remainingSec}s`);
      return;
    }
    if (!identifiant.trim() || !password.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      await login({ username: identifiant.trim(), password });
      toast.success('Connexion reussie');
      navigate('/tableau-de-bord');
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        toast.error('Trop de tentatives. Verrouille pendant 60 secondes.');
      } else {
        toast.error(err?.message || 'Identifiants incorrects');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }} />

      {/* ── top bar ── */}
      <div className="login-top-bar">
        <button
          className="ltb-btn"
          onClick={toggleTheme}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
        >
          {isDark ? '☀' : '☽'}
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
          <img src="/assets/logo-dgtcfm.png" alt="DGTCFM" className="lp-logo-institution" />
          <h1 className="lp-title">TresorPay Statistiques RNF</h1>
          <p className="lp-subtitle">
            Plateforme de suivi et analyse des recettes non fiscales
          </p>
        </div>

        <div className="lp-partners">
          <img src="/assets/logo-cameroun.png" alt="Cameroun" className="lp-partner-logo" />
          <div className="lp-partner-texts">
            <span className="lp-partner-text">Republique du Cameroun</span>
            <span className="lp-partner-sep">|</span>
            <span className="lp-partner-text">Ministere des Finances</span>
          </div>
        </div>
      </div>

      {/* ── right panel ── */}
      <div className="login-panel login-panel--right">
        <div className="lr-card">
          <img src={tresorPayLogo} alt="TresorPay" className="lr-logo" />

          <h2 className="lr-title">Connexion</h2>
          <p className="lr-desc">
            Accedez a votre espace de statistiques
          </p>

          <form className="lr-form" onSubmit={handleSubmit}>
            <div className="lr-field">
              <label className="lr-label" htmlFor="identifiant">
                Identifiant
              </label>
              <input
                id="identifiant"
                className="lr-input"
                type="text"
                autoComplete="username"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                disabled={loading || isLocked}
                placeholder="Votre identifiant"
              />
            </div>

            <div className="lr-field">
              <label className="lr-label" htmlFor="password">
                Mot de passe
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
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {isLocked && (
              <p className="lr-locked-msg">
                Verrouille — reessayez dans {remainingSec}s
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
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        {/* Mentions legales */}
        <div className="lr-legal">
          <p>Direction Generale du Tresor, de la Cooperation Financiere et Monetaire</p>
          <p>Plateforme TresorPay Statistiques RNF &copy; {new Date().getFullYear()} — Tous droits reserves</p>
          <p>Republique du Cameroun — Ministere des Finances</p>
        </div>
      </div>
    </div>
  );
}
