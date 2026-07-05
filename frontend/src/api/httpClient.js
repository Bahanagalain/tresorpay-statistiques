import { resolveApiUrl } from './apiConfig';
import { clearSession, getStoredTokens, storeTokens } from './session';

export class ApiError extends Error {
  constructor(message, { status = 500, data = null, response = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.response = response;
  }
}

let refreshPromise = null;

function buildUrl(path, params) {
  const url = new URL(resolveApiUrl(path));
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

async function refreshAccessToken() {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) {
    throw new ApiError('Session expirée', { status: 401 });
  }

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await parseResponse(response);
  const tokenData = data?.datas || data;
  if (!response.ok || !tokenData?.access_token) {
    throw new ApiError('Impossible de rafraîchir la session', {
      status: response.status,
      data,
      response,
    });
  }

  const nextTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || refreshToken,
    tokenType: tokenData.token_type || 'Bearer',
  };

  storeTokens(nextTokens);
  return nextTokens.accessToken;
}

async function getValidAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    headers = {},
    params,
    body,
    auth = true,
    signal,
    retryOnUnauthorized = true,
  } = options;

  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');

  if (body !== undefined && body !== null && !(body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const { accessToken, tokenType } = getStoredTokens();
    if (!accessToken) {
      throw new ApiError('Session non authentifiée', { status: 401 });
    }
    requestHeaders.set('Authorization', `${tokenType || 'Bearer'} ${accessToken}`);
  }

  const response = await fetch(buildUrl(path, params), {
    method,
    headers: requestHeaders,
    body: body !== undefined && body !== null
      ? (requestHeaders.get('Content-Type')?.includes('application/json') ? JSON.stringify(body) : body)
      : undefined,
    signal,
  });

  const data = await parseResponse(response);

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const nextToken = await getValidAccessToken();
    return apiFetch(path, {
      ...options,
      headers: {
        ...headers,
        Authorization: `Bearer ${nextToken}`,
      },
      retryOnUnauthorized: false,
    });
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Erreur API (${response.status})`;
    throw new ApiError(message, { status: response.status, data, response });
  }

  return data;
}

export function apiGet(path, params, options = {}) {
  return apiFetch(path, { ...options, method: 'GET', params });
}

export function apiPost(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'POST', body });
}
