import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import translations from './translations';

const LanguageContext = createContext({ lang: 'fr', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'fr');

  const setLang = useCallback((l) => {
    setLangState(l);
    localStorage.setItem('lang', l);
  }, []);

  const t = useCallback((key) => {
    const keys = key.split('.');
    let val = translations[lang];
    for (const k of keys) {
      if (val == null) return key;
      val = val[k];
    }
    return val ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
