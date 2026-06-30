import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  PieChart,
  Map,
  FileText,
  Activity,
  AlertTriangle,
  FileBarChart,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const APP_VERSION = '0.1.0';

const navItems = [
  { to: '/tableau-de-bord',         label: 'Tableau de bord',        icon: LayoutDashboard },
  { to: '/performance-ministeres',  label: 'Performance Ministères', icon: Building2 },
  { to: '/repartition-services',    label: 'Répartition Services',   icon: PieChart },
  { to: '/cartographie',            label: 'Cartographie',           icon: Map },
  { to: '/soumissions',             label: 'Soumissions',            icon: FileText },
  { to: '/monitoring-paiements',    label: 'Monitoring Paiements',   icon: Activity },
  { to: '/alertes',                 label: 'Alertes',                icon: AlertTriangle },
  { to: '/rapports',                label: 'Rapports',               icon: FileBarChart },
];

const bottomItems = [
  { to: '/parametres',     label: 'Paramètres',     icon: Settings },
  { to: '/administration', label: 'Administration', icon: Shield, adminOnly: true },
];

/* ---------- styles ---------- */

const sidebarBase = {
  position: 'fixed',
  top: 0,
  left: 0,
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--sidebar-bg, #0f1117)',
  borderRight: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  zIndex: 40,
  transition: 'width 0.3s cubic-bezier(.4,0,.2,1)',
  overflow: 'hidden',
  userSelect: 'none',
};

const brandBlock = {
  padding: '20px 16px 12px',
  borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
  flexShrink: 0,
};

const brandTitle = {
  fontWeight: 700,
  fontSize: 20,
  letterSpacing: '-0.02em',
  color: 'var(--gold, #d4a843)',
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
};

const brandSub = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted, rgba(255,255,255,0.45))',
  marginTop: 2,
  whiteSpace: 'nowrap',
};

const navSection = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '8px 0',
};

const separatorStyle = {
  height: 1,
  margin: '8px 16px',
  background: 'var(--border-glass, rgba(255,255,255,0.08))',
};

const linkBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  margin: '2px 8px',
  borderRadius: 8,
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text-secondary, rgba(255,255,255,0.6))',
  transition: 'all 0.2s ease',
  whiteSpace: 'nowrap',
  borderLeft: '3px solid transparent',
  cursor: 'pointer',
  position: 'relative',
};

const linkActive = {
  color: 'var(--gold, #d4a843)',
  background: 'var(--gold-bg, rgba(212,168,67,0.08))',
  borderLeftColor: 'var(--gold, #d4a843)',
};

const linkHover = {
  background: 'var(--hover-bg, rgba(255,255,255,0.04))',
  color: 'var(--text-primary, rgba(255,255,255,0.85))',
};

const toggleBtn = {
  position: 'absolute',
  top: 20,
  right: -14,
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1px solid var(--border-glass, rgba(255,255,255,0.12))',
  background: 'var(--sidebar-bg, #0f1117)',
  color: 'var(--text-muted, rgba(255,255,255,0.45))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 50,
  transition: 'all 0.2s ease',
};

const versionStyle = {
  padding: '12px 16px',
  fontSize: 11,
  color: 'var(--text-muted, rgba(255,255,255,0.3))',
  borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

/* ---------- component ---------- */

export default function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();
  const { user } = useAuth();
  const [hoveredPath, setHoveredPath] = React.useState(null);

  const width = isOpen ? 260 : 72;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const renderLink = ({ to, label, icon: Icon }) => {
    const active = isActive(to);
    const hovered = hoveredPath === to && !active;

    return (
      <NavLink
        key={to}
        to={to}
        style={{
          ...linkBase,
          ...(active ? linkActive : {}),
          ...(hovered ? linkHover : {}),
          justifyContent: isOpen ? 'flex-start' : 'center',
          padding: isOpen ? '10px 16px' : '10px 0',
          gap: isOpen ? 12 : 0,
        }}
        onMouseEnter={() => setHoveredPath(to)}
        onMouseLeave={() => setHoveredPath(null)}
        title={!isOpen ? label : undefined}
      >
        <Icon size={20} style={{ flexShrink: 0 }} />
        {isOpen && <span>{label}</span>}
      </NavLink>
    );
  };

  const visibleBottomItems = bottomItems.filter(
    (item) => !item.adminOnly || user?.est_super_admin
  );

  return (
    <aside style={{ ...sidebarBase, width }}>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={toggleBtn}
        aria-label={isOpen ? 'Réduire le menu' : 'Étendre le menu'}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Brand */}
      <div style={{ ...brandBlock, textAlign: isOpen ? 'left' : 'center', padding: isOpen ? '20px 16px 12px' : '20px 8px 12px' }}>
        {isOpen ? (
          <>
            <div style={brandTitle}>TresorPay</div>
            <div style={brandSub}>Statistiques</div>
          </>
        ) : (
          <div style={{ ...brandTitle, fontSize: 16 }}>TP</div>
        )}
      </div>

      {/* Main nav */}
      <nav style={navSection}>
        {navItems.map(renderLink)}

        <div style={separatorStyle} />

        {visibleBottomItems.map(renderLink)}
      </nav>

      {/* Version */}
      <div style={versionStyle}>
        {isOpen ? `v${APP_VERSION}` : `v${APP_VERSION.split('.')[0]}`}
      </div>
    </aside>
  );
}
