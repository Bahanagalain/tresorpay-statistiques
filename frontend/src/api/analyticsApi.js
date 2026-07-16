import { apiGet, apiPost, apiPut } from './httpClient';
import { withCache } from './cache';

function cachedGet(path, params, signal) {
  return withCache(path, params, (opts) => apiGet(path, params, opts), { signal });
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function buildAnalyticsDateParams(range) {
  return {
    date_debut: range?.startDate || undefined,
    date_fin: range?.endDate || undefined,
  };
}

function unwrap(response) {
  if (response && typeof response === 'object' && 'datas' in response) {
    return response.datas;
  }
  return response;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

// ─── Dashboard Bulk ────────────────────────────────────────────
export async function fetchDashboard(range, signal) {
  const raw = await cachedGet('/analytics/dashboard', buildAnalyticsDateParams(range), signal);
  const data = unwrap(raw);
  return {
    kpi: {
      totalRevenus: parseAmount(data?.kpi?.totalRevenus),
      totalSoumissions: Number(data?.kpi?.totalSoumissions || 0),
      soumissionsPayees: Number(data?.kpi?.soumissionsPayees || 0),
      soumissionsEnAttente: Number(data?.kpi?.soumissionsEnAttente || 0),
      soumissionsPartielles: Number(data?.kpi?.soumissionsPartielles || 0),
      soumissionsEchouees: Number(data?.kpi?.soumissionsEchouees || 0),
      tauxPaiement: Number(data?.kpi?.tauxPaiement || 0),
      progressionMoisPrecedent: data?.kpi?.progressionMoisPrecedent == null
        ? undefined : Number(data.kpi.progressionMoisPrecedent),
    },
    evolution: safeArray(data?.evolution).map((item) => ({
      periode: item.periode,
      paye: parseAmount(item.paye),
      enAttente: parseAmount(item.enAttente),
      echoue: parseAmount(item.echoue),
      partiel: parseAmount(item.partiel),
    })),
    ministeres: safeArray(data?.ministeres).map((item) => ({
      ministereId: item.ministereId,
      nom: item.nom,
      shortName: item.shortName,
      montant: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      tauxPaiement: Number(item.tauxPaiement || 0),
      couleur: item.couleur,
    })),
    services: safeArray(data?.services).map((item) => ({
      serviceId: item.serviceId,
      nom: item.nom,
      ministereNom: item.ministereNom,
      montant: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      couleur: item.couleur,
    })),
    domaines: safeArray(data?.domaines).map((item) => ({
      domaineId: item.domaineId,
      nom: item.nom,
      montant: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      couleur: item.couleur,
    })),
    regions: safeArray(data?.regions).map((item) => ({
      orgUnitId: item.orgUnitId,
      nom: item.nom,
      code: item.code,
      valeur: parseAmount(item.valeur),
      objectif: parseAmount(item.objectif),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      statut: item.statut,
    })),
    alertes: safeArray(data?.alertes),
  };
}

// ─── KPI ───────────────────────────────────────────────────────
export async function fetchKpi(range, signal) {
  const raw = await cachedGet('/analytics/kpi', buildAnalyticsDateParams(range), signal);
  const data = unwrap(raw);
  return {
    totalRevenus: parseAmount(data?.totalRevenus),
    totalSoumissions: Number(data?.totalSoumissions || 0),
    soumissionsPayees: Number(data?.soumissionsPayees || 0),
    soumissionsEnAttente: Number(data?.soumissionsEnAttente || 0),
    soumissionsPartielles: Number(data?.soumissionsPartielles || 0),
    soumissionsEchouees: Number(data?.soumissionsEchouees || 0),
    tauxPaiement: Number(data?.tauxPaiement || 0),
    progressionMoisPrecedent: data?.progressionMoisPrecedent == null
      ? undefined : Number(data.progressionMoisPrecedent),
  };
}

// ─── Evolution ─────────────────────────────────────────────────
export async function fetchEvolution(range, signal) {
  const raw = await cachedGet('/analytics/evolution', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    periode: item.periode,
    paye: parseAmount(item.paye),
    enAttente: parseAmount(item.enAttente),
    echoue: parseAmount(item.echoue),
    partiel: parseAmount(item.partiel),
  }));
}

// ─── Répartition Ministères ────────────────────────────────────
export async function fetchRepartitionMinisteres(range, signal) {
  const raw = await cachedGet('/analytics/repartition/ministeres', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    ministereId: item.ministereId,
    nom: item.nom,
    shortName: item.shortName,
    montant: parseAmount(item.montant),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    tauxPaiement: Number(item.tauxPaiement || 0),
    couleur: item.couleur,
  }));
}

export async function fetchMinistereDetail(id, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/ministeres/${encodeURIComponent(id)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

export async function fetchMinistereComparison(id, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/ministeres/${encodeURIComponent(id)}/comparison`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Répartition Services ──────────────────────────────────────
export async function fetchRepartitionServices(range, signal) {
  const raw = await cachedGet('/analytics/repartition/services', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    serviceId: item.serviceId,
    nom: item.nom,
    ministereNom: item.ministereNom,
    montant: parseAmount(item.montant),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    couleur: item.couleur,
  }));
}

export async function fetchServiceDetail(id, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/services/${encodeURIComponent(id)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Répartition Domaines ──────────────────────────────────────
export async function fetchRepartitionDomaines(range, signal) {
  const raw = await cachedGet('/analytics/repartition/domaines', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    domaineId: item.domaineId,
    nom: item.nom,
    icon: item.icon,
    montant: parseAmount(item.montant),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    tauxPaiement: Number(item.tauxPaiement || 0),
    couleur: item.couleur,
  }));
}

export async function fetchDomaineDetail(id, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/domaines/${encodeURIComponent(id)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Répartition OrgUnits ──────────────────────────────────────
export async function fetchRepartitionOrgUnits(range, signal) {
  const raw = await cachedGet('/analytics/repartition/orgUnits', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    orgUnitId: item.orgUnitId,
    nom: item.nom,
    code: item.code,
    type: item.type,
    montant: parseAmount(item.montant),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
  }));
}

export async function fetchOrgUnitDetail(id, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/orgUnits/${encodeURIComponent(id)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Télémétrie Régionale ──────────────────────────────────────
export async function fetchTelemetrieRegions(range, signal) {
  const raw = await cachedGet('/analytics/telemetrie/regions', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    orgUnitId: item.orgUnitId,
    nom: item.nom,
    code: item.code,
    latitude: item.latitude,
    longitude: item.longitude,
    valeur: parseAmount(item.valeur),
    objectif: parseAmount(item.objectif),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    statut: item.statut,
  }));
}

export async function fetchRegionDetail(code, range, signal) {
  const raw = await cachedGet(`/analytics/telemetrie/regions/${encodeURIComponent(code)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Soumissions (paginées) ────────────────────────────────────
export async function fetchSoumissions(params = {}, signal) {
  const raw = await apiGet('/analytics/soumissions', {
    ...buildAnalyticsDateParams(params),
    page: params.page,
    limite: params.limit,
    search: params.search,
    statut: params.statut,
    ministere_id: params.ministereId,
    service_id: params.serviceId,
    domaine_id: params.domaineId,
  }, { signal });

  const data = unwrap(raw);
  const pagination = data?.pagination || raw?.meta || {};

  return {
    donnees: safeArray(data?.donnees || data).map(item => ({
      id: item.id,
      externalId: item.externalId,
      uniqueCode: item.uniqueCode,
      formulaireNom: item.formulaireNom,
      service: item.service,
      ministere: item.ministere,
      domaine: item.domaine,
      orgUnit: item.orgUnit,
      soumetteurNom: item.soumetteurNom,
      soumetteurEmail: item.soumetteurEmail,
      soumetteurTelephone: item.soumetteurTelephone,
      montant: parseAmount(item.montant),
      statutPaiement: item.statutPaiement,
      dateSoumission: normalizeDate(item.dateSoumission),
      datePaiement: normalizeDate(item.datePaiement),
    })),
    pagination: {
      page: Number(pagination.page || 1),
      limite: Number(pagination.limite || 20),
      total: Number(pagination.total || 0),
      totalPages: Number(pagination.totalPages || 0),
    },
  };
}

export async function fetchSoumissionDetail(code, signal) {
  const raw = await apiGet(`/analytics/soumissions/${encodeURIComponent(code)}`, {}, { signal });
  return unwrap(raw);
}

// ─── Alertes ───────────────────────────────────────────────────
export async function fetchAlertes(signal) {
  const raw = await apiGet('/analytics/alertes', {}, { signal });
  return safeArray(unwrap(raw));
}

// ─── Monitoring ────────────────────────────────────────────────
export async function fetchMonitoring(signal) {
  const raw = await apiGet('/analytics/monitoring', {}, { signal });
  return unwrap(raw);
}

// ─── Rapport ───────────────────────────────────────────────────
export async function fetchRapport(periodes, signal) {
  const raw = await apiPost('/analytics/rapport', { periodes }, { signal });
  return unwrap(raw);
}

// ─── Synchronisation ───────────────────────────────────────────
export async function lancerSynchronisation(signal) {
  const raw = await apiPost('/sync/lancer', undefined, { signal });
  return raw?.datas ?? raw ?? {};
}

export async function fetchSyncStatut(signal) {
  const raw = await apiGet('/sync/statut', {}, { signal });
  return unwrap(raw);
}

export async function fetchSyncJournal(signal) {
  const raw = await apiGet('/sync/journal', {}, { signal });
  return safeArray(unwrap(raw));
}

export async function fetchSyncDerniere(signal) {
  const raw = await apiGet('/sync/derniere', {}, { signal });
  return safeArray(unwrap(raw));
}

export async function fetchSyncConfig(signal) {
  const raw = await apiGet('/sync/configuration', {}, { signal });
  return unwrap(raw);
}

export async function updateSyncConfig(data, signal) {
  const raw = await apiPut('/sync/configuration', data, { signal });
  return unwrap(raw);
}

export async function lancerPurge(entites, signal) {
  const raw = await apiPost('/sync/purger', { entites }, { signal });
  return raw?.datas ?? raw ?? {};
}

// ─── Partenaires ───────────────────────────────────────
export async function fetchPartenaires(range, signal) {
  const raw = await cachedGet('/analytics/partenaires', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw));
}

export async function fetchPartenaireDetail(id, range, signal) {
  const raw = await cachedGet(`/analytics/partenaires/${encodeURIComponent(id)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Citoyens ──────────────────────────────────────────
export async function fetchCitoyens(range, signal) {
  const raw = await cachedGet('/analytics/citoyens', buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Audit ─────────────────────────────────────────────
export async function fetchAudit(range, signal) {
  const raw = await cachedGet('/analytics/audit', buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Mon perimetre (dashboard scope) ─────────────────
export async function fetchMonPerimetre(range, signal) {
  const raw = await cachedGet('/analytics/mon-perimetre', buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Explorateur de donnees ───────────────────────────
export async function fetchExplorerDimensions(params = {}, signal) {
  const raw = await apiGet('/analytics/explorer/dimensions', params, { signal });
  return unwrap(raw);
}

export async function fetchExplorerExplore(body, signal) {
  const raw = await apiPost('/analytics/explorer/explore', body, { signal });
  return unwrap(raw);
}

export async function fetchExplorerCrosstab(body, signal) {
  const raw = await apiPost('/analytics/explorer/crosstab', body, { signal });
  return unwrap(raw);
}
