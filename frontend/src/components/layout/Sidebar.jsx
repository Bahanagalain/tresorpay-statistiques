import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Landmark, Building2, ChevronRight, Settings, Shield,
  PieChart, Map, Users, Activity, AlertTriangle, FileBarChart,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useSidebar } from './MainLayout';
import { useTranslation } from '../../i18n/LanguageProvider';
import { resolveApiUrl } from '../../api/apiConfig';
import tresorPayLogo from '../../assets/logo-tresorpay.png';
import './Sidebar.css';

function resolvePhotoUrl(url) {
  if (!url) return null;
  return resolveApiUrl(url);
}

function getInitials(user) {
  if (!user?.nom_complet) return '?';
  const parts = user.nom_complet.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function Sidebar() {
  const { user } = useAuth();
  const { collapsed, toggleSidebar } = useSidebar();
  const { t } = useTranslation();
  const isSuperAdmin = user?.est_super_admin;
  const photoUrl = resolvePhotoUrl(user?.photo_url);

  const navItems = [
    {
      section: null,
      links: [
        { to: '/dgi', icon: Landmark, label: t('sidebar.dashboard'), iconColor: '#059669' },
      ],
    },
    {
      section: t('sidebar.analysis'),
      links: [
        { to: '/performance-cdi', icon: Building2, label: t('sidebar.perfCdi'), iconColor: '#2563EB' },
        { to: '/repartition-fiscale', icon: PieChart, label: t('sidebar.fiscalDist'), iconColor: '#8B5CF6' },
        { to: '/cartographie', icon: Map, label: t('sidebar.cartography'), iconColor: '#14B8A6' },
        { to: '/contribuables', icon: Users, label: t('sidebar.taxpayers'), iconColor: '#EC4899' },
      ],
    },
    {
      section: t('sidebar.operations'),
      links: [
        { to: '/conformite-rib', icon: Shield, label: 'Conformite RIB', iconColor: '#DC2626' },
        { to: '/monitoring-otp', icon: Activity, label: t('sidebar.monitoringOtp'), iconColor: '#6366F1' },
        { to: '/alertes', icon: AlertTriangle, label: t('sidebar.alerts'), iconColor: '#D97706' },
      ],
    },
    {
      section: t('sidebar.reports'),
      links: [
        { to: '/rapports', icon: FileBarChart, label: t('sidebar.generation'), iconColor: '#F97316' },
      ],
    },
    {
      section: t('sidebar.governance'),
      links: [
        { to: '/parametres', icon: Settings, label: 'Paramètres', iconColor: '#64748B' },
      ],
    },
  ];

  return (
    <>
      {collapsed && (
        <button className="sidebar-expand-btn" onClick={toggleSidebar} title={t('sidebar.openMenu')}>
          <ChevronsRight size={16} />
        </button>
      )}

      <aside className={`sidebar-vault ${collapsed ? 'hidden' : ''}`}>
        <button className="sidebar-collapse-pill" onClick={toggleSidebar} title={t('sidebar.closeMenu')}>
          <ChevronsLeft size={14} />
        </button>

        <div className="sidebar-brand">
          <img src={tresorPayLogo} alt="TresorPay" className="sidebar-brand-logo" />
          <span className="sidebar-brand-text">Analytics</span>
        </div>

        <div className="sidebar-profile-section">
          <div className="sidebar-avatar-link" aria-hidden="true">
            <div className="sb-avatar-ring">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="sb-avatar-img" />
              ) : (
                <div className="sb-avatar-initials">{getInitials(user)}</div>
              )}
            </div>
            <span className="sb-avatar-status" />
          </div>
          <span className="sb-user-greeting">{t('sidebar.greeting')}, {user?.nom_complet?.split(' ')[0] || 'User'}</span>
        </div>

        <div className="sidebar-nav-area">
          {navItems.filter(s => s.links.length > 0).map(({ section, links }) => (
            <div className="nav-section" key={section || 'main'}>
              {section && <span className="nav-label">{section}</span>}
              <nav className="vault-nav">
                {links.map(({ to, icon: Icon, label, iconColor }, idx) => (
                  <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    {links.length > 1 && (
                      <span className="nav-tree-line" data-last={idx === links.length - 1 ? 'true' : undefined} />
                    )}
                    <span className="nav-icon-wrap" style={{ '--icon-color': iconColor }}>
                      <Icon size={16} />
                    </span>
                    <span className="link-text">{label}</span>
                    <ChevronRight size={13} className="nav-chevron" />
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
