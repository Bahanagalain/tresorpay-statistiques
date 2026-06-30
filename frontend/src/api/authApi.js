import { apiFetch, apiGet, apiPost } from './httpClient';

export function loginRequest({ username, password }) {
  return apiPost('/auth/login', {
    identifiant: username,
    mot_de_passe: password,
  }, { auth: false });
}

export function logoutRequest(refreshToken) {
  return apiPost('/auth/logout', { refresh_token: refreshToken });
}

export function getMyProfile() {
  return apiGet('/auth/me');
}

export function getMyAccessModel() {
  return apiGet('/auth/me/access');
}

export function updateMyProfile(data) {
  return apiFetch('/auth/me/profile', { method: 'PUT', body: data });
}

export function verifyEmail(code) {
  return apiPost('/auth/me/verify-email', { code });
}

export function resendVerification() {
  return apiPost('/auth/me/resend-verification', {});
}

export function sendTestReport() {
  return apiPost('/auth/me/test-report', {});
}

export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/auth/me/photo', {
    method: 'PUT',
    body: formData,
    headers: {}, // let browser set multipart boundary
  });
}
