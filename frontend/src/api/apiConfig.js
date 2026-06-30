export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/+$/, '');

function getRuntimeOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
}

export function resolveApiUrl(path = '') {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedBase = /^https?:\/\//i.test(API_BASE_URL)
    ? API_BASE_URL
    : `${getRuntimeOrigin()}${API_BASE_URL.startsWith('/') ? '' : '/'}${API_BASE_URL}`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export const AUTH_STORAGE_KEYS = {
  accessToken: 'tps.accessToken',
  refreshToken: 'tps.refreshToken',
  tokenType: 'tps.tokenType',
  user: 'tps.user',
  accessModel: 'tps.accessModel',
};
