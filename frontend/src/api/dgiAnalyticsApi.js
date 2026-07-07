import { apiGet, apiPost } from './httpClient';
import { withCache } from './cache';

function cachedGet(path, params, signal) {
  return withCache(path, params, (opts) => apiGet(path, params, opts), { signal });
}

/**
 * Déclenche une synchronisation manuelle : le backend va « puller » les
 * derniers avis depuis l'API distante DGI au lieu d'attendre le cycle
 * automatique. Renvoie l'objet résultat ({ success, count, duration } ou
 * { skipped: true } si une synchro est déjà en cours).
 */
export async function lancerSynchronisation(signal) {
  const raw = await apiPost('/sync/lancer', undefined, { signal });
  return raw?.datas ?? raw ?? {};
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

function toStatusClass(value) {
  if (!value) return 'warning';
  const lowered = String(value).toLowerCase();
  if (['success', 'ok', 'conforme'].includes(lowered)) return 'success';
  if (['warning', 'attention'].includes(lowered)) return 'warning';
  return 'danger';
}

export function buildAnalyticsDateParams(range) {
  return {
    date_debut: range?.startDate || undefined,
    date_fin: range?.endDate || undefined,
  };
}

/** Safely extract the `datas` field from the API envelope { datas, message, meta } */
function unwrap(response) {
  if (response && typeof response === 'object' && 'datas' in response) {
    return response.datas;
  }
  return response;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

// ─── Dashboard Bulk (1 call for all dashboard data) ─────────
export async function fetchDashboard(range, signal) {
  const raw = await cachedGet('/analytics/dashboard', buildAnalyticsDateParams(range), signal);
  const data = unwrap(raw);
  return {
    kpi: {
      totalRecouvre: parseAmount(data?.kpi?.totalRecouvre),
      totalAvis: Number(data?.kpi?.totalAvis || 0),
      avisPayes: Number(data?.kpi?.avisPayes || 0),
      avisEnAttente: Number(data?.kpi?.avisEnAttente || 0),
      avisEnRetard: Number(data?.kpi?.avisEnRetard || 0),
      tauxRecouvrement: Number(data?.kpi?.tauxRecouvrement || 0),
      progressionMoisPrecedent: data?.kpi?.progressionMoisPrecedent == null
        ? undefined : Number(data.kpi.progressionMoisPrecedent),
      totalReversements: parseAmount(data?.kpi?.totalReversements),
      nombreReversements: Number(data?.kpi?.nombreReversements || 0),
      montantTotal: parseAmount(data?.kpi?.montantTotal),
    },
    evolution: safeArray(data?.evolution).map((item) => ({
      mois: item.periode,
      paye: parseAmount(item.paye),
      enAttente: parseAmount(item.enAttente),
      enRetard: parseAmount(item.enRetard),
    })),
    cdi: safeArray(data?.cdi).map((item) => ({
      centre: item.centre,
      montant: parseAmount(item.montant),
      montantRecouvre: parseAmount(item.montantRecouvre),
      nombreAvis: Number(item.nombreAvis || 0),
      avisPaies: Number(item.avisPaies || 0),
      avisEnAttente: Number(item.avisEnAttente || 0),
      avisEnRetard: Number(item.avisEnRetard || 0),
      tauxRecouvrement: Number(item.tauxRecouvrement || 0),
    })),
    taxes: safeArray(data?.taxes).map((item) => ({
      type: item.type,
      code: item.code || '',
      montant: parseAmount(item.montant),
      size: parseAmount(item.montant),
      count: Number(item.count || 0),
      color: item.color,
    })),
    communes: safeArray(data?.communes).map((item) => ({
      commune: item.commune,
      montant: parseAmount(item.montant),
    })),
    regions: safeArray(data?.regions).map((item) => ({
      id: item.id,
      name: item.name,
      value: parseAmount(item.value),
      target: parseAmount(item.target),
      nbCdis: Number(item.nbCdis || 0),
      nbAvis: Number(item.nbAvis || 0),
      avisPaies: Number(item.avisPaies || 0),
      tauxRecouvrement: Number(item.tauxRecouvrement || 0),
      status: toStatusClass(item.status),
    })),
  };
}

export async function fetchDgiKpi(range, signal) {
  const raw = await cachedGet('/analytics/kpi', buildAnalyticsDateParams(range), signal);
  const data = unwrap(raw);
  return {
    totalRecouvre: parseAmount(data?.totalRecouvre),
    totalAvis: Number(data?.totalAvis || 0),
    avisPayes: Number(data?.avisPayes || 0),
    avisEnAttente: Number(data?.avisEnAttente || 0),
    avisEnRetard: Number(data?.avisEnRetard || 0),
    tauxRecouvrement: Number(data?.tauxRecouvrement || 0),
    progressionMoisPrecedent: data?.progressionMoisPrecedent == null
      ? undefined
      : Number(data.progressionMoisPrecedent),
    totalReversements: parseAmount(data?.totalReversements),
    nombreReversements: Number(data?.nombreReversements || 0),
  };
}

export async function fetchDgiEvolution(range, signal) {
  const raw = await cachedGet('/analytics/evolution', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    mois: item.periode,
    paye: parseAmount(item.paye),
    enAttente: parseAmount(item.enAttente),
    enRetard: parseAmount(item.enRetard),
  }));
}

export async function fetchDgiCdi(range, signal) {
  const raw = await cachedGet('/analytics/repartition/cdi', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    centre: item.centre,
    montant: parseAmount(item.montant),
    montantRecouvre: parseAmount(item.montantRecouvre),
    nombreAvis: Number(item.nombreAvis || 0),
    avisPaies: Number(item.avisPaies || 0),
    avisEnAttente: Number(item.avisEnAttente || 0),
    avisEnRetard: Number(item.avisEnRetard || 0),
    tauxRecouvrement: Number(item.tauxRecouvrement || 0),
  }));
}

export async function fetchCdiDetail(centreName, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/cdi/${encodeURIComponent(centreName)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

export async function fetchCdiComparison(centreName, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/cdi/${encodeURIComponent(centreName)}/comparison`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

export async function fetchDgiTaxes(range, signal) {
  const raw = await cachedGet('/analytics/repartition/taxes', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    type: item.type,
    code: item.code || '',
    montant: parseAmount(item.montant),
    size: parseAmount(item.montant),
    count: Number(item.count || 0),
    color: item.color,
  }));
}

export async function fetchTaxDetail(taxCode, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/taxes/${encodeURIComponent(taxCode)}`, buildAnalyticsDateParams(range), signal);
  const data = unwrap(raw) || {};
  return {
    code: data.code || taxCode,
    libelle: data.libelle || taxCode,
    kpi: {
      nbAvis: Number(data.kpi?.nbAvis || 0),
      totalMontant: parseAmount(data.kpi?.totalMontant),
      montantPaye: parseAmount(data.kpi?.montantPaye),
      montantAttente: parseAmount(data.kpi?.montantAttente),
      montantRetard: parseAmount(data.kpi?.montantRetard),
      nbPaye: Number(data.kpi?.nbPaye || 0),
      nbAttente: Number(data.kpi?.nbAttente || 0),
      nbRetard: Number(data.kpi?.nbRetard || 0),
      tauxRecouvrement: Number(data.kpi?.tauxRecouvrement || 0),
    },
    avis: safeArray(data.avis).map((a) => ({
      numero: a.numero,
      contribuable: a.contribuable || 'Contribuable inconnu',
      nui: a.nui,
      centre: a.centre || 'Centre inconnu',
      montantTaxe: parseAmount(a.montantTaxe),
      montantTotal: parseAmount(a.montantTotal),
      statut: a.statut,
      dateCreation: normalizeDate(a.dateCreation),
      datePaiement: normalizeDate(a.datePaiement),
    })),
  };
}

export async function fetchDgiCommunes(range, signal) {
  const raw = await cachedGet('/analytics/repartition/communes', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    commune: item.commune,
    montant: parseAmount(item.montant),
  }));
}

export async function fetchCommuneDetail(communeName, range, signal) {
  const raw = await cachedGet(`/analytics/repartition/communes/${encodeURIComponent(communeName)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

export async function fetchDgiRegionTelemetry(range, signal) {
  const raw = await cachedGet('/analytics/telemetrie/regions', buildAnalyticsDateParams(range), signal);
  return safeArray(unwrap(raw)).map((item) => ({
    id: item.id,
    name: item.name,
    value: parseAmount(item.value),
    target: parseAmount(item.target),
    nbCdis: Number(item.nbCdis || 0),
    nbAvis: Number(item.nbAvis || 0),
    avisPaies: Number(item.avisPaies || 0),
    tauxRecouvrement: Number(item.tauxRecouvrement || 0),
    status: toStatusClass(item.status),
  }));
}

export async function fetchRegionDetail(regionCode, range, signal) {
  const raw = await cachedGet(`/analytics/telemetrie/regions/${encodeURIComponent(regionCode)}`, buildAnalyticsDateParams(range), signal);
  return unwrap(raw);
}

// ─── Conformité RIB ─────────────────────────────────────────
export async function fetchConformiteRib(signal) {
  const raw = await cachedGet('/analytics/conformite-rib', {}, signal);
  return unwrap(raw);
}

// ─── NEW: Contribuables ──────────────────────────────────────
export async function fetchContribuables(params = {}, signal) {
  const raw = await apiGet('/analytics/contribuables', {
    ...buildAnalyticsDateParams(params),
    page: params.page,
    limite: params.limit,
    search: params.search,
    sort_by: params.sortBy,
    sort_dir: params.sortDir,
  }, { signal });

  const rows = unwrap(raw);
  const meta = raw?.meta || {};

  return {
    data: safeArray(rows).map(item => ({
      nui: item.nui,
      contribuable: item.contribuable,
      centre: item.centre,
      nombreAvis: item.nombreAvis,
      montantTotal: parseAmount(item.montantTotal),
      avisPayes: item.avisPayes,
      avisEnAttente: item.avisEnAttente,
      avisEnRetard: item.avisEnRetard,
      montantPaye: parseAmount(item.montantPaye),
      tauxPaiement: item.tauxPaiement,
      premierAvis: normalizeDate(item.premierAvis),
      dernierAvis: normalizeDate(item.dernierAvis),
    })),
    meta: {
      totalItems: Number(meta.total_elements || 0),
      totalPages: Number(meta.total_pages || 0),
      currentPage: Number(meta.page_courante || 1),
    },
  };
}

export async function fetchContribuableDetail(nui, signal) {
  const raw = await apiGet(`/analytics/contribuables/${encodeURIComponent(nui)}`, {}, { signal });
  return unwrap(raw);
}

// ─── NEW: Alertes ────────────────────────────────────────────
export async function fetchAlertes(signal) {
  const raw = await apiGet('/analytics/alertes', {}, { signal });
  return {
    alertes: safeArray(unwrap(raw)),
    resume: raw?.resume || {},
  };
}

export async function fetchDgiAvis(params = {}, signal) {
  const raw = await apiGet('/analytics/avis', {
    ...buildAnalyticsDateParams(params),
    page: params.page,
    limite: params.limit,
    contribuable: params.search,
    statut: params.statut,
    centre: params.cdi,
  }, { signal });

  const rows = unwrap(raw);
  const meta = raw?.meta || {};

  return {
    data: safeArray(rows).map((item) => ({
      numero: item.numero,
      contribuable: item.contribuable || 'Contribuable inconnu',
      nui: item.nui,
      centre: item.centre || 'Centre inconnu',
      montantTotal: parseAmount(item.montantTotal),
      statut: item.statut,
      dateCreation: normalizeDate(item.dateCreation),
      imputations: safeArray(item.imputations).map((imp) => ({
        code: imp.code,
        libelle: imp.libelle,
        beneficiaire: imp.beneficiaire || 'N/A',
        montant: parseAmount(imp.montant),
      })),
    })),
    meta: {
      totalItems: Number(meta.total_elements || meta.totalItems || 0),
      totalPages: Number(meta.total_pages || meta.totalPages || 0),
      currentPage: Number(meta.page_courante || meta.currentPage || params.page || 1),
    },
  };
}
