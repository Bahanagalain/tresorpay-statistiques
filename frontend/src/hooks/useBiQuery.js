import { useState, useEffect, useCallback, useRef } from 'react';
import { biQuery } from '../api/biApi';

/**
 * Hook pour exécuter une requête BI et gérer le state (loading, data, error).
 * Re-exécute automatiquement quand queryConfig change.
 */
export function useBiQuery(queryConfig, { autoFetch = true, debounceMs = 300 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  const execute = useCallback(async (overrides = {}) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const config = { ...queryConfig, ...overrides };
      const res = await biQuery(config, controller.signal);
      if (!controller.signal.aborted) {
        setData(res?.datas || res);
        setLoading(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        setError(err.message || 'Erreur requête BI');
        setLoading(false);
      }
    }
  }, [queryConfig]);

  useEffect(() => {
    if (!autoFetch || !queryConfig?.dimensions?.length) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => execute(), debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [execute, autoFetch, debounceMs]);

  return { data, loading, error, execute, setData };
}

export default useBiQuery;
