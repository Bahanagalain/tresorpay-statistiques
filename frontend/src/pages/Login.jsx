import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, MoonStar, SunMedium, Languages, Eye, EyeOff } from 'lucide-react';
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

/* ── Animated particle network canvas ──────────────────────── */
function ParticleNetwork() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; ctx.scale(2, 2); };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#059669', '#2563EB', '#D97706', '#0d9488', '#6366F1'];
    const PARTICLE_COUNT = 55;
    const CONNECTION_DIST = 140;
    const MOUSE_DIST = 180;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2.5 + 1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      pulse: Math.random() * Math.PI * 2,
    }));

    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', handleMouse);

    let raf;
    const draw = () => {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      const mouse = mouseRef.current;

      // Update & draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.02;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        // Mouse repulsion
        const dmx = p.x - mouse.x, dmy = p.y - mouse.y;
        const dm = Math.sqrt(dmx * dmx + dmy * dmy);
        if (dm < MOUSE_DIST && dm > 0) {
          const force = (MOUSE_DIST - dm) / MOUSE_DIST * 0.015;
          p.vx += (dmx / dm) * force;
          p.vy += (dmy / dm) * force;
        }

        // Damping
        p.vx *= 0.999;
        p.vy *= 0.999;

        const glow = 0.5 + Math.sin(p.pulse) * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + Math.sin(p.pulse) * 0.2), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = glow;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const opacity = (1 - dist / CONNECTION_DIST) * 0.2;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = particles[i].color;
            ctx.globalAlpha = opacity;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      // Mouse connections
      for (const p of particles) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_DIST) {
          const opacity = (1 - dist / MOUSE_DIST) * 0.35;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = '#D97706';
          ctx.globalAlpha = opacity;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); canvas.removeEventListener('mousemove', handleMouse); };
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
  const [showPassword, setShowPassword] = useState(false);
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
          <ParticleNetwork />
        </div>

        {/* Partner logos — bottom left */}
        <div className="lp-partners-block">
          <span className="lp-partners-label">Projet porté par :</span>
          <div className="lp-partners">
            <img src="/images/logo-cameroun.png" alt="Cameroun" title="République du Cameroun" />
            <img src="/images/logo-dgtcfm.png" alt="DGTCFM" title="Direction Générale du Trésor, de la Coopération Financière et Monétaire" className="lp-partner-main" />
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
              <input type={showPassword ? 'text' : 'password'} placeholder={t('login.passwordPlaceholder')} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)} className="lr-input" required autoComplete="current-password" />
              <button type="button" className="lr-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
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
