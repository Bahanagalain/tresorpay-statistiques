import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const translations = {
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.ministeres': 'Performance Ministères',
    'nav.services': 'Répartition Services',
    'nav.cartographie': 'Cartographie',
    'nav.soumissions': 'Soumissions',
    'nav.monitoring': 'Monitoring Paiements',
    'nav.alertes': 'Alertes',
    'nav.rapports': 'Rapports',
    'nav.parametres': 'Paramètres',
    'nav.administration': 'Administration',
    'common.logout': 'Déconnexion',
    'common.loading': 'Chargement...',
    'common.search': 'Rechercher...',
    'kpi.totalRevenus': 'Total Revenus',
    'kpi.soumissions': 'Soumissions',
    'kpi.tauxPaiement': 'Taux de Paiement',
    'kpi.progression': 'Progression',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.ministeres': 'Ministry Performance',
    'nav.services': 'Service Distribution',
    'nav.cartographie': 'Cartography',
    'nav.soumissions': 'Submissions',
    'nav.monitoring': 'Payment Monitoring',
    'nav.alertes': 'Alerts',
    'nav.rapports': 'Reports',
    'nav.parametres': 'Settings',
    'nav.administration': 'Administration',
    'common.logout': 'Logout',
    'common.loading': 'Loading...',
    'common.search': 'Search...',
    'kpi.totalRevenus': 'Total Revenue',
    'kpi.soumissions': 'Submissions',
    'kpi.tauxPaiement': 'Payment Rate',
    'kpi.progression': 'Progression',
  },
};

const LanguageContext = createContext({ lang: 'fr', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('lang') || 'fr';
    }
    return 'fr';
  });

  const setLang = useCallback((l) => {
    setLangState(l);
    window.localStorage.setItem('lang', l);
  }, []);

  const t = useCallback((key) => {
    return translations[lang]?.[key] || translations.fr?.[key] || key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }
