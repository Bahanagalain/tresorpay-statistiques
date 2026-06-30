import { useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'period_filter_state';
const DEFAULT_STATE = { preset: 'all', customStart: '', customEnd: '' };

function loadInitial() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch { return DEFAULT_STATE; }
}

let current = loadInitial();
const listeners = new Set();

function notify() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch {}
  listeners.forEach((fn) => fn());
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function getSnapshot() { return current; }

export function setPeriodState(partial) {
  current = { ...current, ...partial };
  notify();
}

export function computeRange(state = current) {
  const { preset, customStart, customEnd } = state;
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  switch (preset) {
    case 'today': return { startDate: fmt(now), endDate: fmt(now) };
    case 'month': return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) };
    case 'custom': return { startDate: customStart || undefined, endDate: customEnd || undefined };
    default: return {};
  }
}

export function getCurrentPeriodRange() { return computeRange(current); }

export function usePeriodFilter() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const range = useMemo(() => computeRange(state), [state.preset, state.customStart, state.customEnd]);
  return { state, setState: setPeriodState, range };
}
