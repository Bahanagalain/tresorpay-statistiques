import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  User,
  LogOut,
  Settings,
  ChevronDown,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import useLanguage from '../../hooks/useLanguage';

/* ---------- route → page title mapping ---------- */

const pageTitles = {
  '/tableau-de-bord':        'Tableau de bord',
  '/performance-ministeres': 'Performance Ministères',
  '/repartition-services':   'Répartition Services',
  '/cartographie':           'Cartographie',
  '/soumissions':            'Soumissions',
  '/monitoring-paiements':   'Monitoring Paiements',
  '/alertes':                'Alertes',
  '/rapports':               'Rapports',
  '/parametres':             'Paramètres',
  '/administration':         'Administration',
};

function getPageTitle(pathname) {
  const match = Object.keys(pageTitles).find(
    (key) => pathname === key || pathname.startsWith(key + '/')
  );
  return match ? pageTitles[match] : 'TresorPay Statistiques';
}

/* ---------- styles ---------- */

const topBarStyle = {
  height: 64,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  background: 'var(--topbar-bg, rgba(255,255,255,0.03))',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
  position: 'sticky',
  top: 0,
  zIndex: 30,
  flexShrink: 0,
};

const leftSection = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
};

const rightSection = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const iconBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary, rgba(255,255,255,0.6))',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const langToggleStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 32,
  padding: '0 10px',
  borderRadius: 6,
  border: '1px solid var(--border-glass, rgba(255,255,255,0.12))',
  background: 'transparent',
  color: 'var(--text-secondary, rgba(255,255,255,0.6))',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  transition: 'all 0.2s ease',
};

const titleStyle = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--text-primary, rgba(255,255,255,0.9))',
  letterSpacing: '-0.01em',
};

const avatarBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 8px 4px 4px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const avatarCircle = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'var(--gold-gradient, linear-gradient(135deg, #d4a843 0%, #b8922e 100%))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  flexShrink: 0,
};

const dropdownStyle = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  minWidth: 200,
  background: 'var(--dropdown-bg, #1a1b23)',
  border: '1px solid var(--border-glass, rgba(255,255,255,0.1))',
  borderRadius: 10,
  padding: '6px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 100,
};

const dropdownHeaderStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
  marginBottom: 4,
};

const dropdownItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary, rgba(255,255,255,0.6))',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'all 0.15s ease',
  textAlign: 'left',
};

const dropdownItemDanger = {
  ...dropdownItemStyle,
  color: '#ef4444',
};

const dividerStyle = {
  height: 1,
  margin: '4px 8px',
  background: 'var(--border-glass, rgba(255,255,255,0.08))',
};

/* ---------- component ---------- */

export default function TopBar({ onToggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLanguage();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const dropdownRef = useRef(null);

  const pageTitle = getPageTitle(location.pathname);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [dropdownOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const initials = user
    ? `${(user.prenom || user.nom || 'U')[0]}${(user.nom || '')[0] || ''}`.toUpperCase()
    : 'U';

  const displayName = user
    ? [user.prenom, user.nom].filter(Boolean).join(' ') || user.email || 'Utilisateur'
    : 'Utilisateur';

  const displayEmail = user?.email || '';

  const handleLogout = () => {
    setDropdownOpen(false);
    if (logout) logout();
  };

  const hoverBg = 'var(--hover-bg, rgba(255,255,255,0.06))';

  return (
    <header style={topBarStyle}>
      {/* Left */}
      <div style={leftSection}>
        <button
          onClick={onToggleSidebar}
          style={iconBtnStyle}
          aria-label="Basculer le menu"
          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Menu size={20} />
        </button>
        <h1 style={titleStyle}>{pageTitle}</h1>
      </div>

      {/* Right */}
      <div style={rightSection}>
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          style={langToggleStyle}
          aria-label="Changer de langue"
          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {(lang || 'fr').toUpperCase()}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={iconBtnStyle}
          aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            style={avatarBtnStyle}
            aria-label="Menu utilisateur"
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={avatarCircle}>{initials}</div>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted, rgba(255,255,255,0.4))',
                transition: 'transform 0.2s ease',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {dropdownOpen && (
            <div style={dropdownStyle}>
              {/* User info header */}
              <div style={dropdownHeaderStyle}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary, rgba(255,255,255,0.9))',
                  }}
                >
                  {displayName}
                </div>
                {displayEmail && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted, rgba(255,255,255,0.4))',
                      marginTop: 2,
                    }}
                  >
                    {displayEmail}
                  </div>
                )}
              </div>

              {/* Profile */}
              <button
                style={{
                  ...dropdownItemStyle,
                  ...(hoveredItem === 'profile' ? { background: hoverBg } : {}),
                }}
                onMouseEnter={() => setHoveredItem('profile')}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/parametres');
                }}
              >
                <User size={16} />
                Profil
              </button>

              {/* Settings */}
              <button
                style={{
                  ...dropdownItemStyle,
                  ...(hoveredItem === 'settings' ? { background: hoverBg } : {}),
                }}
                onMouseEnter={() => setHoveredItem('settings')}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/parametres');
                }}
              >
                <Settings size={16} />
                Paramètres
              </button>

              <div style={dividerStyle} />

              {/* Logout */}
              <button
                style={{
                  ...dropdownItemDanger,
                  ...(hoveredItem === 'logout' ? { background: 'rgba(239,68,68,0.08)' } : {}),
                }}
                onMouseEnter={() => setHoveredItem('logout')}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
