import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, MoonStar, SunMedium, Languages } from 'lucide-react';
import { useTheme } from '../components/theme/ThemeProvider';
import { useAuth } from '../components/auth/AuthProvider';
import { useTranslation } from '../i18n/LanguageProvider';
import toast, { Toaster } from 'react-hot-toast';
import tresorPayLogo from '../assets/logo-tresorpay.png';
import './Login.css';

// ── Rate limiting (frontend) ─────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

function useLoginRateLimit() {
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (lockedUntil <= Date.now()) { setCountdown(0); return; }
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) { setCountdown(0); setAttempts(0); setLockedUntil(0); clearInterval(interval); }
      else setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const recordFailure = () => {
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
    }
  };

  const isLocked = lockedUntil > Date.now();
  return { recordFailure, isLocked, countdown, attemptsLeft: MAX_ATTEMPTS - attempts };
}

/* ── Animated flowing lines canvas ──────────────────────────── */
function FlowingLines() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const LINES = [
      { color: '#16a34a', speed: 0.7,  amplitude: 22, phase: 0,   yBase: 0.30, width: 2.2, dashLen: 18, gapLen: 10 },
      { color: '#dc2626', speed: 0.50, amplitude: 18, phase: 2.1, yBase: 0.50, width: 2.0, dashLen: 22, gapLen: 14 },
      { color: '#D97706', speed: 0.65, amplitude: 25, phase: 4.2, yBase: 0.70, width: 1.8, dashLen: 14, gapLen: 8  },
      { color: '#16a34a', speed: 0.40, amplitude: 12, phase: 1.0, yBase: 0.18, width: 1.4, dashLen: 8,  gapLen: 18 },
      { color: '#dc2626', speed: 0.85, amplitude: 16, phase: 3.3, yBase: 0.85, width: 1.3, dashLen: 20, gapLen: 12 },
      { color: '#fbbf24', speed: 0.55, amplitude: 20, phase: 5.1, yBase: 0.60, width: 2.0, dashLen: 16, gapLen: 9  },
    ];

    let t = 0, raf;
    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      LINES.forEach(line => {
        ctx.beginPath();
        ctx.setLineDash([line.dashLen, line.gapLen]);
        ctx.lineWidth = line.width;
        ctx.strokeStyle = line.color + 'a0';
        const steps = 120;
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * W;
          const y = line.yBase * H
            + Math.sin((i / steps) * Math.PI * 3.5 + t * line.speed + line.phase) * line.amplitude
            + Math.sin((i / steps) * Math.PI * 6 + t * line.speed * 0.5 + line.phase) * (line.amplitude * 0.3);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        const dotX = ((t * line.speed * 55 + LINES.indexOf(line) * 100) % (W + 30)) - 15;
        const pr = (dotX + 15) / (W + 30);
        const dotY = line.yBase * H
          + Math.sin(pr * Math.PI * 3.5 + t * line.speed + line.phase) * line.amplitude
          + Math.sin(pr * Math.PI * 6 + t * line.speed * 0.5 + line.phase) * (line.amplitude * 0.3);
        const grad = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 9);
        grad.addColorStop(0, line.color + 'dd');
        grad.addColorStop(1, line.color + '00');
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.fillStyle = grad;
        ctx.arc(dotX, dotY, 9, 0, Math.PI * 2);
        ctx.fill();
      });
      t += 0.012;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <div className="lp-canvas-wrapper"><canvas ref={canvasRef} className="lp-canvas" /></div>;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { login: signIn, isAuthenticated, status } = useAuth();
  const { t, lang, setLang } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(null);
  const { recordFailure, isLocked, countdown } = useLoginRateLimit();
  const redirectTo = location.state?.from?.pathname || '/tableau-de-bord';

  useEffect(() => {
    if (status === 'authenticated' || isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo, status]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setLoading(true);
    const toastId = toast.loading(t('login.connecting'));

    try {
      await signIn({ username: loginValue, password });
      toast.success(t('login.success'), { id: toastId });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      recordFailure();
      toast.error(error?.message || t('login.failure'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = () => setLang(lang === 'fr' ? 'en' : 'fr');

  return (
    <div className="login-root">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '0.82rem', borderRadius: '10px' } }} />

      {/* Top bar: theme + language */}
      <div className="login-top-bar">
        <button className="login-lang-btn" onClick={toggleLang} type="button">
          <Languages size={14} />
          <span>{lang === 'fr' ? 'EN' : 'FR'}</span>
        </button>
        <button
          className={`login-theme-btn${isDark ? ' is-active' : ''}`}
          onClick={toggleTheme}
          type="button"
        >
          {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
          <span>{isDark ? t('login.lightMode') : t('login.darkMode')}</span>
        </button>
      </div>

      {/* Ambient orbs */}
      <div className="login-orb login-orb--1" />
      <div className="login-orb login-orb--2" />
      <div className="login-orb login-orb--3" />

      {/* Left panel */}
      <div className="login-panel login-panel--left">
        <div className="lp-inner">
          <div className="lp-hero">
            <h1 className="lp-title">{t('login.title')}<br /><span className="lp-accent">{t('login.accent')}</span></h1>
            <p className="lp-desc">{t('login.desc')}</p>
          </div>
          <FlowingLines />
        </div>

        {/* Partner logos — bottom left */}
        <div className="lp-partners-block">
          <span className="lp-partners-label">Projet porté par :</span>
          <div className="lp-partners">
            <img src="/images/logo-cameroun.png" alt="Cameroun" title="République du Cameroun" />
            <img src="/images/Logo_DGI_Cameroun.png" alt="DGI" title="Direction Générale des Impôts" />
            <img src="/images/logo-dgtcfm.png" alt="DGTCFM" title="Direction Générale du Trésor" />
            <img src="/images/logo douane.png" alt="DGD" title="Direction Générale des Douanes" />
          </div>
        </div>

        <div className="lp-grid" aria-hidden />
      </div>

      {/* Right panel */}
      <div className="login-panel login-panel--right">
        <div className="lr-card">
          <img src={tresorPayLogo} alt="TresorPay" className="lr-logo" />
          <p className="lr-sub">{t('login.accessRestricted')}</p>

          <form onSubmit={handleLogin} className="lr-form">
            <div className={`lr-field ${focused === 'login' ? 'lr-field--active' : ''}`}>
              <User size={16} className="lr-field-icon" />
              <input type="text" placeholder={t('login.loginPlaceholder')} value={loginValue} onChange={e => setLoginValue(e.target.value)} onFocus={() => setFocused('login')} onBlur={() => setFocused(null)} className="lr-input" required autoComplete="username" />
            </div>

            <div className={`lr-field ${focused === 'pw' ? 'lr-field--active' : ''}`}>
              <Lock size={16} className="lr-field-icon" />
              <input type="password" placeholder={t('login.passwordPlaceholder')} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)} className="lr-input" required autoComplete="current-password" />
            </div>

            {isLocked && (
              <div className="lr-lockout">
                {t('login.tooManyAttempts')} <strong>{countdown}</strong> {t('login.seconds')}
              </div>
            )}

            <button type="submit" className="lr-btn" disabled={loading || isLocked}>
              {loading
                ? <span className="lr-spinner" />
                : <><span>{t('login.submit')}</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          <p className="lr-footer">{t('login.footer')}</p>
        </div>
      </div>
    </div>
  );
}
