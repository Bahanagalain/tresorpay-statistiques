import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Maximize, Minimize, LogOut, X, MoonStar, SunMedium, Settings, Languages } from 'lucide-react';
import { usePresentMode } from './MainLayout';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { useTranslation } from '../../i18n/LanguageProvider';
import tresorPayLogo from '../../assets/logo-tresorpay.png';
import './TopNav.css';

function YaoundeClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const opts = { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const formatted = time.toLocaleTimeString('fr-FR', opts);
  const [h, m, s] = formatted.split(':');
  return (
    <div className="yde-clock">
      <span className="yde-clock__time">
        <span className="yde-clock__h">{h}</span>
        <span className="yde-clock__sep">:</span>
        <span className="yde-clock__m">{m}</span>
        <span className="yde-clock__sep yde-clock__sep--blink">:</span>
        <span className="yde-clock__s">{s}</span>
      </span>
      <span className="yde-clock__label">Yaoundé, Cameroun</span>
    </div>
  );
}

export default function TopNav() {
  const { presentMode, toggle } = usePresentMode();
  const { theme, isDark, toggleTheme } = useTheme();
  const { logout, user } = useAuth();
  const { lang, setLang, t } = useTranslation();
  const [showLogout, setShowLogout] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = user?.est_super_admin;
  const isOnDgi = location.pathname === '/tableau-de-bord' || location.pathname === '/';

  const confirmLogout = async () => {
    setShowLogout(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const toggleLang = () => setLang(lang === 'fr' ? 'en' : 'fr');

  return (
    <header className="topnav-vault">
      <div className="topnav-left">
      </div>

      <YaoundeClock />

      <div className="topnav-actions" style={{ alignItems: 'center' }}>
        {/* Language toggle */}
        <button className="lang-toggle-btn" onClick={toggleLang} title={lang === 'fr' ? 'Switch to English' : 'Passer en Français'}>
          <Languages size={15} />
          <span>{lang === 'fr' ? 'EN' : 'FR'}</span>
        </button>

        <button
          className={`icon-btn-vault theme-toggle-btn${isDark ? ' is-active' : ''}`}
          onClick={toggleTheme}
          title={isDark ? t('topnav.lightMode') : t('topnav.darkMode')}
        >
          {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
        </button>
        <button className="icon-btn-vault" onClick={toggle} title={t('topnav.presentation')}>
          {presentMode ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        <button className="icon-btn-vault">
          <Bell size={18} />
          <span className="notif-dot"></span>
        </button>

        {isSuperAdmin && (
          <button
            className={`icon-btn-vault admin-settings-btn${!isOnDgi ? ' is-active' : ''}`}
            title={t('topnav.admin')}
            onClick={() => navigate('/administration')}
          >
            <Settings size={18} />
          </button>
        )}

        <button className="icon-btn-vault" title={t('topnav.logout')} onClick={() => setShowLogout(true)}>
          <LogOut size={18} />
        </button>
      </div>

      {showLogout && (
        <div className="logout-overlay" onClick={() => setShowLogout(false)}>
          <div className="logout-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button className="logout-close" onClick={() => setShowLogout(false)} aria-label="Fermer"><X size={16} /></button>
            <div className="logout-icon"><LogOut size={22} /></div>
            <h3 className="logout-title">{t('topnav.logout')}</h3>
            <p className="logout-message">{t('topnav.logoutConfirm')}</p>
            <div className="logout-actions">
              <button className="lo-btn lo-btn--cancel" onClick={() => setShowLogout(false)}>{t('cancel')}</button>
              <button className="lo-btn lo-btn--confirm" onClick={confirmLogout}>
                <LogOut size={14} /> {t('topnav.logoutBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
