// ─────────────────────────────────────────────────────────────────────
// API Client — Module BI Self-Service
// ─────────────────────────────────────────────────────────────────────

import { apiFetch } from './httpClient';

// ═══════════════════════════════════════════════════════════════
// MOTEUR DE REQUETE
// ═══════════════════════════════════════════════════════════════

export async function biQuery(body, signal) {
  return apiFetch('/bi/query', { method: 'POST', body, signal });
}

export async function biQueryPreview(body, signal) {
  return apiFetch('/bi/query/preview', { method: 'POST', body, signal });
}

export async function biQueryPivot(body, signal) {
  return apiFetch('/bi/query/pivot', { method: 'POST', body, signal });
}

// ═══════════════════════════════════════════════════════════════
// DATASETS & DIMENSIONS
// ═══════════════════════════════════════════════════════════════

export async function fetchDatasets(signal) {
  return apiFetch('/bi/datasets', { signal });
}

export async function fetchDimensions(datasetCode, params, signal) {
  return apiFetch(`/bi/datasets/${datasetCode}/dimensions`, { params, signal });
}

export async function fetchFiltreValeurs(datasetCode, cle, signal) {
  return apiFetch(`/bi/datasets/${datasetCode}/filtres/${cle}/valeurs`, { signal });
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARDS
// ═══════════════════════════════════════════════════════════════

export async function fetchDashboards(signal) {
  return apiFetch('/bi/dashboards', { signal });
}

export async function fetchDashboard(id, signal) {
  return apiFetch(`/bi/dashboards/${id}`, { signal });
}

export async function createDashboard(data) {
  return apiFetch('/bi/dashboards', { method: 'POST', body: data });
}

export async function updateDashboard(id, data) {
  return apiFetch(`/bi/dashboards/${id}`, { method: 'PUT', body: data });
}

export async function deleteDashboard(id) {
  return apiFetch(`/bi/dashboards/${id}`, { method: 'DELETE' });
}

export async function duplicateDashboard(id) {
  return apiFetch(`/bi/dashboards/${id}/duplicate`, { method: 'POST' });
}

// ═══════════════════════════════════════════════════════════════
// WIDGETS
// ═══════════════════════════════════════════════════════════════

export async function addWidget(dashboardId, data) {
  return apiFetch(`/bi/dashboards/${dashboardId}/widgets`, { method: 'POST', body: data });
}

export async function updateWidget(widgetId, data) {
  return apiFetch(`/bi/widgets/${widgetId}`, { method: 'PUT', body: data });
}

export async function deleteWidget(widgetId) {
  return apiFetch(`/bi/widgets/${widgetId}`, { method: 'DELETE' });
}

export async function executeWidget(widgetId, body) {
  return apiFetch(`/bi/widgets/${widgetId}/execute`, { method: 'POST', body });
}

export async function executeWidgetKpi(widgetId, body) {
  return apiFetch(`/bi/widgets/${widgetId}/execute-kpi`, { method: 'POST', body });
}

// ═══════════════════════════════════════════════════════════════
// INDICATEURS
// ═══════════════════════════════════════════════════════════════

export async function fetchIndicateurs(signal) {
  return apiFetch('/bi/indicateurs', { signal });
}

export async function createIndicateur(data) {
  return apiFetch('/bi/indicateurs', { method: 'POST', body: data });
}

export async function updateIndicateur(id, data) {
  return apiFetch(`/bi/indicateurs/${id}`, { method: 'PUT', body: data });
}

export async function deleteIndicateur(id) {
  return apiFetch(`/bi/indicateurs/${id}`, { method: 'DELETE' });
}

export async function computeIndicateur(id, filtres) {
  return apiFetch(`/bi/indicateurs/${id}/compute`, { method: 'POST', body: { filtres } });
}
