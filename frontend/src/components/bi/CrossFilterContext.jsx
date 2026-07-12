import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const CrossFilterContext = createContext(null);

export function CrossFilterProvider({ children }) {
  const [crossFilters, setCrossFilters] = useState({});

  const setCrossFilter = useCallback((widgetId, dimension, valeur, nom) => {
    setCrossFilters(prev => ({
      ...prev,
      [widgetId]: { dimension, valeur, nom },
    }));
  }, []);

  const clearCrossFilter = useCallback((widgetId) => {
    setCrossFilters(prev => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
  }, []);

  const clearAllCrossFilters = useCallback(() => {
    setCrossFilters({});
  }, []);

  const getCrossFiltersForWidget = useCallback((widgetId) => {
    const result = {};
    Object.entries(crossFilters).forEach(([sourceId, filter]) => {
      if (sourceId !== String(widgetId)) {
        result[sourceId] = filter;
      }
    });
    return result;
  }, [crossFilters]);

  const value = useMemo(() => ({
    crossFilters,
    setCrossFilter,
    clearCrossFilter,
    clearAllCrossFilters,
    getCrossFiltersForWidget,
  }), [crossFilters, setCrossFilter, clearCrossFilter, clearAllCrossFilters, getCrossFiltersForWidget]);

  return (
    <CrossFilterContext.Provider value={value}>
      {children}
    </CrossFilterContext.Provider>
  );
}

export function useCrossFilter() {
  const ctx = useContext(CrossFilterContext);
  if (!ctx) {
    throw new Error('useCrossFilter doit être utilisé dans un CrossFilterProvider');
  }
  return ctx;
}
