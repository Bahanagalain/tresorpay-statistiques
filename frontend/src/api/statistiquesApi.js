import { apiGet } from './httpClient';
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

function unwrap(response) {
  if (response && typeof response === 'object' && 'datas' in response) return response.datas;
  return response;
}

function safeArray(value) { return Array.isArray(value) ? value : []; }

export function buildDateParams(range) {
  return {
    date_debut: range?.startDate || undefined,
    date_fin: range?.endDate || undefined,
  };
}

// ─── Dashboard (agrégé) ──────────────────────────────────────

export async function fetchDashboard(range, signal) {
  const raw = await cachedGet('/analytics/dashboard', buildDateParams(range), signal);
  const data = unwrap(raw);
  return {
    kpi: {
      totalRevenus: parseAmount(data?.kpi?.totalRevenus),
      totalSoumissions: Number(data?.kpi?.totalSoumissions || 0),
      soumissionsPayees: Number(data?.kpi?.soumissionsPayees || 0),
      soumissionsEnAttente: Number(data?.kpi?.soumissionsEnAttente || 0),
      soumissionsEchouees: Number(data?.kpi?.soumissionsEchouees || 0),
      tauxPaiement: Number(data?.kpi?.tauxPaiement || 0),
      progressionMoisPrecedent: data?.kpi?.progressionMoisPrecedent == null ? undefined : Number(data.kpi.progressionMoisPrecedent),
    },
    evolution: safeArray(data?.evolution).map(item => ({
      mois: item.periode,
      paye: parseAmount(item.paye),
      enAttente: parseAmount(item.enAttente),
      echoue: parseAmount(item.echoue),
    })),
    ministeres: safeArray(data?.ministeres).map(item => ({
      id: item.ministereId || item.id,
      nom: item.nom,
      montant: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      tauxPaiement: Number(item.tauxPaiement || 0),
      couleur: item.couleur,
    })),
    services: safeArray(data?.services).map(item => ({
      id: item.serviceId || item.id,
      nom: item.nom,
      ministereName: item.ministereNom || item.ministereName,
      montant: parseAmount(item.montant),
      size: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      couleur: item.couleur,
    })),
    domaines: safeArray(data?.domaines).map(item => ({
      id: item.domaineId || item.id,
      nom: item.nom,
      montant: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      couleur: item.couleur,
    })),
    regions: safeArray(data?.regions).map(item => ({
      id: item.orgUnitId || item.id,
      name: item.nom,
      value: parseAmount(item.valeur),
      target: parseAmount(item.objectif),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      status: item.statut || 'attention',
    })),
  };
}

// ─── KPI seul ────────────────────────────────────────────────

export async function fetchKpi(range, signal) {
  const raw = await cachedGet('/analytics/kpi', buildDateParams(range), signal);
  const data = unwrap(raw);
  return {
    totalRevenus: parseAmount(data?.totalRevenus),
    totalSoumissions: Number(data?.totalSoumissions || 0),
    soumissionsPayees: Number(data?.soumissionsPayees || 0),
    soumissionsEnAttente: Number(data?.soumissionsEnAttente || 0),
    soumissionsEchouees: Number(data?.soumissionsEchouees || 0),
    tauxPaiement: Number(data?.tauxPaiement || 0),
    progressionMoisPrecedent: data?.progressionMoisPrecedent == null ? undefined : Number(data.progressionMoisPrecedent),
  };
}

// ─── Évolution temporelle ────────────────────────────────────

export async function fetchEvolution(range, signal) {
  const raw = await cachedGet('/analytics/evolution', buildDateParams(range), signal);
  const data = unwrap(raw);
  return safeArray(data).map(item => ({
    mois: item.periode,
    paye: parseAmount(item.paye),
    enAttente: parseAmount(item.enAttente),
    echoue: parseAmount(item.echoue),
  }));
}

// ─── Ministères ──────────────────────────────────────────────

export async function fetchMinisteres(range, signal) {
  const raw = await cachedGet('/analytics/ministeres', buildDateParams(range), signal);
  const data = unwrap(raw);
  return safeArray(data).map(item => ({
    id: item.ministereId || item.id,
    nom: item.nom,
    montant: parseAmount(item.montant),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    tauxPaiement: Number(item.tauxPaiement || 0),
    couleur: item.couleur,
  }));
}

export async function fetchMinistereDetail(ministereId, range, signal) {
  const params = { ...buildDateParams(range) };
  const raw = await cachedGet(`/analytics/ministeres/${ministereId}`, params, signal);
  const data = unwrap(raw);
  return {
    id: data?.ministereId || data?.id || ministereId,
    nom: data?.nom,
    montant: parseAmount(data?.montant),
    nombreSoumissions: Number(data?.nombreSoumissions || 0),
    tauxPaiement: Number(data?.tauxPaiement || 0),
    evolution: safeArray(data?.evolution).map(item => ({
      mois: item.periode,
      paye: parseAmount(item.paye),
      enAttente: parseAmount(item.enAttente),
      echoue: parseAmount(item.echoue),
    })),
    services: safeArray(data?.services).map(item => ({
      id: item.serviceId || item.id,
      nom: item.nom,
      montant: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      couleur: item.couleur,
    })),
  };
}

// ─── Services ────────────────────────────────────────────────

export async function fetchServices(range, signal) {
  const raw = await cachedGet('/analytics/services', buildDateParams(range), signal);
  const data = unwrap(raw);
  return safeArray(data).map(item => ({
    id: item.serviceId || item.id,
    nom: item.nom,
    ministereName: item.ministereNom || item.ministereName,
    montant: parseAmount(item.montant),
    size: parseAmount(item.montant),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    couleur: item.couleur,
  }));
}

export async function fetchServiceDetail(serviceId, range, signal) {
  const params = { ...buildDateParams(range) };
  const raw = await cachedGet(`/analytics/services/${serviceId}`, params, signal);
  const data = unwrap(raw);
  return {
    id: data?.serviceId || data?.id || serviceId,
    nom: data?.nom,
    ministereName: data?.ministereNom || data?.ministereName,
    montant: parseAmount(data?.montant),
    nombreSoumissions: Number(data?.nombreSoumissions || 0),
    tauxPaiement: Number(data?.tauxPaiement || 0),
    evolution: safeArray(data?.evolution).map(item => ({
      mois: item.periode,
      paye: parseAmount(item.paye),
      enAttente: parseAmount(item.enAttente),
      echoue: parseAmount(item.echoue),
    })),
    domaines: safeArray(data?.domaines).map(item => ({
      id: item.domaineId || item.id,
      nom: item.nom,
      montant: parseAmount(item.montant),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
      couleur: item.couleur,
    })),
  };
}

// ─── Domaines ────────────────────────────────────────────────

export async function fetchDomaines(range, signal) {
  const raw = await cachedGet('/analytics/domaines', buildDateParams(range), signal);
  const data = unwrap(raw);
  return safeArray(data).map(item => ({
    id: item.domaineId || item.id,
    nom: item.nom,
    montant: parseAmount(item.montant),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    couleur: item.couleur,
  }));
}

export async function fetchDomaineDetail(domaineId, range, signal) {
  const params = { ...buildDateParams(range) };
  const raw = await cachedGet(`/analytics/domaines/${domaineId}`, params, signal);
  const data = unwrap(raw);
  return {
    id: data?.domaineId || data?.id || domaineId,
    nom: data?.nom,
    montant: parseAmount(data?.montant),
    nombreSoumissions: Number(data?.nombreSoumissions || 0),
    evolution: safeArray(data?.evolution).map(item => ({
      mois: item.periode,
      paye: parseAmount(item.paye),
      enAttente: parseAmount(item.enAttente),
      echoue: parseAmount(item.echoue),
    })),
  };
}

// ─── Régions / OrgUnits (cartographie) ───────────────────────

export async function fetchRegionTelemetry(range, signal) {
  const raw = await cachedGet('/analytics/regions', buildDateParams(range), signal);
  const data = unwrap(raw);
  return safeArray(data).map(item => ({
    id: item.orgUnitId || item.id,
    name: item.nom,
    value: parseAmount(item.valeur),
    target: parseAmount(item.objectif),
    nombreSoumissions: Number(item.nombreSoumissions || 0),
    status: item.statut || 'attention',
  }));
}

export async function fetchRegionDetail(regionId, range, signal) {
  const params = { ...buildDateParams(range) };
  const raw = await cachedGet(`/analytics/regions/${regionId}`, params, signal);
  const data = unwrap(raw);
  return {
    id: data?.orgUnitId || data?.id || regionId,
    name: data?.nom,
    value: parseAmount(data?.valeur),
    target: parseAmount(data?.objectif),
    nombreSoumissions: Number(data?.nombreSoumissions || 0),
    status: data?.statut || 'attention',
    evolution: safeArray(data?.evolution).map(item => ({
      mois: item.periode,
      paye: parseAmount(item.paye),
      enAttente: parseAmount(item.enAttente),
      echoue: parseAmount(item.echoue),
    })),
    departements: safeArray(data?.departements).map(item => ({
      id: item.orgUnitId || item.id,
      name: item.nom,
      value: parseAmount(item.valeur),
      nombreSoumissions: Number(item.nombreSoumissions || 0),
    })),
  };
}

// ─── Soumissions (paginé) ────────────────────────────────────

export async function fetchSoumissions({ range, page = 1, pageSize = 20, statut, search, ministereId, serviceId } = {}, signal) {
  const params = {
    ...buildDateParams(range),
    page,
    page_size: pageSize,
    statut: statut || undefined,
    search: search || undefined,
    ministere_id: ministereId || undefined,
    service_id: serviceId || undefined,
  };
  const raw = await cachedGet('/analytics/soumissions', params, signal);
  const wrapper = unwrap(raw);

  const items = safeArray(wrapper?.items || wrapper?.data || wrapper);
  const meta = wrapper?.meta || wrapper?.pagination || {};

  return {
    data: items.map(item => ({
      id: item.soumissionId || item.id,
      reference: item.reference,
      contribuable: item.contribuableNom || item.contribuable,
      ministere: item.ministereNom || item.ministere,
      service: item.serviceNom || item.service,
      domaine: item.domaineNom || item.domaine,
      montant: parseAmount(item.montant),
      statut: item.statut,
      dateSoumission: item.dateSoumission || item.createdAt,
      datePaiement: item.datePaiement,
    })),
    meta: {
      totalItems: Number(meta.totalItems || meta.total || items.length),
      totalPages: Number(meta.totalPages || meta.pages || 1),
      currentPage: Number(meta.currentPage || meta.page || page),
    },
  };
}

export async function fetchSoumissionDetail(soumissionId, signal) {
  const raw = await cachedGet(`/analytics/soumissions/${soumissionId}`, {}, signal);
  const data = unwrap(raw);
  return {
    id: data?.soumissionId || data?.id || soumissionId,
    reference: data?.reference,
    contribuable: data?.contribuableNom || data?.contribuable,
    ministere: data?.ministereNom || data?.ministere,
    service: data?.serviceNom || data?.service,
    domaine: data?.domaineNom || data?.domaine,
    montant: parseAmount(data?.montant),
    statut: data?.statut,
    dateSoumission: data?.dateSoumission || data?.createdAt,
    datePaiement: data?.datePaiement,
    details: data?.details || {},
    historique: safeArray(data?.historique).map(h => ({
      action: h.action,
      date: h.date,
      utilisateur: h.utilisateur,
      commentaire: h.commentaire,
    })),
  };
}

// ─── Alertes & Anomalies ─────────────────────────────────────

export async function fetchAlertes(range, signal) {
  const raw = await cachedGet('/analytics/alertes', buildDateParams(range), signal);
  const data = unwrap(raw);
  return safeArray(data).map(item => ({
    id: item.alerteId || item.id,
    type: item.type,
    severite: item.severite || item.severity,
    message: item.message,
    ministere: item.ministereNom || item.ministere,
    service: item.serviceNom || item.service,
    valeur: parseAmount(item.valeur),
    seuil: parseAmount(item.seuil),
    date: item.date || item.createdAt,
    estLue: Boolean(item.estLue || item.isRead),
  }));
}

// ─── Monitoring Paiements ────────────────────────────────────

export async function fetchMonitoring(range, signal) {
  const raw = await cachedGet('/analytics/monitoring', buildDateParams(range), signal);
  const data = unwrap(raw);
  return {
    resume: {
      totalTransactions: Number(data?.resume?.totalTransactions || 0),
      montantTotal: parseAmount(data?.resume?.montantTotal),
      tauxReussite: Number(data?.resume?.tauxReussite || 0),
      tempsTraitementMoyen: Number(data?.resume?.tempsTraitementMoyen || 0),
    },
    parMethode: safeArray(data?.parMethode).map(item => ({
      methode: item.methode,
      transactions: Number(item.transactions || 0),
      montant: parseAmount(item.montant),
      tauxReussite: Number(item.tauxReussite || 0),
      couleur: item.couleur,
    })),
    evolutionJournaliere: safeArray(data?.evolutionJournaliere).map(item => ({
      date: item.date,
      reussi: Number(item.reussi || 0),
      echoue: Number(item.echoue || 0),
      enAttente: Number(item.enAttente || 0),
      montant: parseAmount(item.montant),
    })),
    dernieresTransactions: safeArray(data?.dernieresTransactions).map(item => ({
      id: item.transactionId || item.id,
      reference: item.reference,
      montant: parseAmount(item.montant),
      methode: item.methode,
      statut: item.statut,
      date: item.date || item.createdAt,
    })),
  };
}
