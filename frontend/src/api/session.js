import { AUTH_STORAGE_KEYS } from './apiConfig';

function emitAuthEvent(name) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name));
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getStoredTokens() {
  return {
    accessToken: window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken),
    refreshToken: window.localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken),
    tokenType: window.localStorage.getItem(AUTH_STORAGE_KEYS.tokenType) || 'Bearer',
  };
}

export function storeTokens(tokens) {
  if (tokens.accessToken) {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, tokens.accessToken);
  }
  if (tokens.refreshToken) {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, tokens.refreshToken);
  }
  window.localStorage.setItem(AUTH_STORAGE_KEYS.tokenType, tokens.tokenType || 'Bearer');
  emitAuthEvent('auth:session-updated');
}

export function clearTokens() {
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.tokenType);
}

export function getStoredUser() {
  return safeJsonParse(window.localStorage.getItem(AUTH_STORAGE_KEYS.user), null);
}

export function storeUser(user) {
  if (!user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.user);
    emitAuthEvent('auth:session-updated');
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
  emitAuthEvent('auth:session-updated');
}

export function getStoredAccessModel() {
  return safeJsonParse(window.localStorage.getItem(AUTH_STORAGE_KEYS.accessModel), null);
}

export function storeAccessModel(accessModel) {
  if (!accessModel) {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.accessModel);
    emitAuthEvent('auth:session-updated');
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEYS.accessModel, JSON.stringify(accessModel));
  emitAuthEvent('auth:session-updated');
}

export function clearSession() {
  clearTokens();
  storeUser(null);
  storeAccessModel(null);
  emitAuthEvent('auth:session-cleared');
}
