// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Service de synchronisation
// Pull depuis le payment-platform (admin-service)
// ─────────────────────────────────────────────────────────────────────

import prisma from '../config/prisma.js';

export const PP_API_URL = (process.env.PP_REMOTE_API_URL || 'http://localhost:3005').replace(/\/+$/, '');

let cachedToken = null;

// ═══════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════

async function authentifierPP() {
  const username = process.env.PP_REMOTE_USERNAME;
  const password = process.env.PP_REMOTE_PASSWORD;
  const authEndpoint = process.env.PP_AUTH_ENDPOINT || '/auth/login';

  if (!username || !password) {
    console.warn('[SYNC] PP_REMOTE_USERNAME ou PP_REMOTE_PASSWORD non configure');
    return null;
  }

  try {
    const response = await fetch(`${PP_API_URL}${authEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });

    if (!response.ok) {
      console.error(`[SYNC] Auth PP echouee: ${response.status}`);
      return null;
    }

    const data = await response.json();
    cachedToken = data.access_token || data.token;
    return cachedToken;
  } catch (err) {
    console.error('[SYNC] Erreur auth PP:', err.message);
    return null;
  }
}

async function requetePP(path) {
  if (!cachedToken) {
    cachedToken = await authentifierPP();
  }
  if (!cachedToken) throw new Error("Impossible de s'authentifier aupres du payment-platform");

  let response = await fetch(`${PP_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${cachedToken}`, Accept: 'application/json' },
  });

  // Re-auth on 401
  if (response.status === 401) {
    cachedToken = await authentifierPP();
    if (!cachedToken) throw new Error('Re-authentification echouee');
    response = await fetch(`${PP_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${cachedToken}`, Accept: 'application/json' },
    });
  }

  if (!response.ok) {
    throw new Error(`PP ${path} -> ${response.status}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// JOURNAL DE SYNC
// ═══════════════════════════════════════════════════════════════

async function logSync(endpoint, statut, nbEnregistrements, dureeMs, messageErreur = null) {
  try {
    await prisma.journalSync.create({
      data: {
        endpoint,
        statut,
        nbEnregistrements,
        dureeMs,
        messageErreur,
      },
    });
  } catch (err) {
    console.error('[SYNC] Erreur ecriture journal:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC MINISTERES
// ═══════════════════════════════════════════════════════════════

async function syncMinisteres() {
  const debut = Date.now();
  try {
    const data = await requetePP('/ministries');
    const items = Array.isArray(data) ? data : data?.data || data?.items || [];

    let count = 0;
    for (const m of items) {
      if (!m.id) continue;
      await prisma.ministere.upsert({
        where: { id: m.id },
        create: {
          id: m.id,
          code: m.code || m.id.substring(0, 30),
          nomFr: m.nameFr || m.name || '',
          nomEn: m.nameEn || null,
          shortName: m.shortName || null,
          icon: m.icon || null,
          couleur: m.color || null,
          estActif: m.isActive !== false,
          sortIndex: m.sortIndex || 0,
          synchroniseLe: new Date(),
        },
        update: {
          code: m.code || undefined,
          nomFr: m.nameFr || m.name || undefined,
          nomEn: m.nameEn || null,
          shortName: m.shortName || null,
          icon: m.icon || null,
          couleur: m.color || null,
          estActif: m.isActive !== false,
          sortIndex: m.sortIndex || 0,
          synchroniseLe: new Date(),
        },
      });
      count++;
    }

    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] Ministeres: ${count} en ${dureeMs}ms`);
    await logSync('/ministries', 'SUCCES', count, dureeMs);
    return count;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error('[SYNC] Erreur ministeres:', err.message);
    await logSync('/ministries', 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC DOMAINES
// ═══════════════════════════════════════════════════════════════

async function syncDomaines() {
  const debut = Date.now();
  try {
    const data = await requetePP('/domains');
    const items = Array.isArray(data) ? data : data?.data || data?.items || [];

    let count = 0;
    for (const d of items) {
      if (!d.id) continue;
      await prisma.domaine.upsert({
        where: { id: d.id },
        create: {
          id: d.id,
          nomFr: d.nameFr || d.name || '',
          nomEn: d.nameEn || null,
          icon: d.icon || null,
          couleur: d.color || null,
          estActif: d.isActive !== false,
          synchroniseLe: new Date(),
        },
        update: {
          nomFr: d.nameFr || d.name || undefined,
          nomEn: d.nameEn || null,
          icon: d.icon || null,
          couleur: d.color || null,
          estActif: d.isActive !== false,
          synchroniseLe: new Date(),
        },
      });
      count++;
    }

    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] Domaines: ${count} en ${dureeMs}ms`);
    await logSync('/domains', 'SUCCES', count, dureeMs);
    return count;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error('[SYNC] Erreur domaines:', err.message);
    await logSync('/domains', 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC ORG UNITS
// ═══════════════════════════════════════════════════════════════

function normalizeOrgUnitType(type) {
  if (!type) return 'ORGANIZATION';
  const upper = type.toUpperCase();
  if (['ORGANIZATION', 'REGION', 'DEPARTMENT', 'ARRONDISSEMENT'].includes(upper)) return upper;
  return 'ORGANIZATION';
}

async function syncOrgUnits() {
  const debut = Date.now();
  try {
    const data = await requetePP('/org-units');
    const items = Array.isArray(data) ? data : data?.data || data?.items || [];

    // Tri par depth pour respecter la hierarchie parent->enfant
    const sorted = [...items].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    let count = 0;
    for (const o of sorted) {
      if (!o.id) continue;

      // Verifier que le parent existe si parentId est fourni
      let parentId = o.parentId || null;
      if (parentId) {
        const parentExists = await prisma.orgUnit.findUnique({ where: { id: parentId }, select: { id: true } });
        if (!parentExists) parentId = null;
      }

      // Verifier que le ministere existe si ministryId est fourni
      let ministereId = o.ministryId || null;
      if (ministereId) {
        const ministereExists = await prisma.ministere.findUnique({ where: { id: ministereId }, select: { id: true } });
        if (!ministereExists) ministereId = null;
      }

      await prisma.orgUnit.upsert({
        where: { id: o.id },
        create: {
          id: o.id,
          code: o.code || o.id.substring(0, 30),
          nomFr: o.nameFr || o.name || '',
          nomEn: o.nameEn || null,
          type: normalizeOrgUnitType(o.type),
          parentId,
          path: o.path || null,
          depth: o.depth || 0,
          ministereId,
          latitude: o.latitude != null ? parseFloat(o.latitude) : null,
          longitude: o.longitude != null ? parseFloat(o.longitude) : null,
          estActif: o.isActive !== false,
          synchroniseLe: new Date(),
        },
        update: {
          code: o.code || undefined,
          nomFr: o.nameFr || o.name || undefined,
          nomEn: o.nameEn || null,
          type: normalizeOrgUnitType(o.type),
          parentId,
          path: o.path || null,
          depth: o.depth || 0,
          ministereId,
          latitude: o.latitude != null ? parseFloat(o.latitude) : null,
          longitude: o.longitude != null ? parseFloat(o.longitude) : null,
          estActif: o.isActive !== false,
          synchroniseLe: new Date(),
        },
      });
      count++;
    }

    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] OrgUnits: ${count} en ${dureeMs}ms`);
    await logSync('/org-units', 'SUCCES', count, dureeMs);
    return count;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error('[SYNC] Erreur org-units:', err.message);
    await logSync('/org-units', 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC SERVICES
// ═══════════════════════════════════════════════════════════════

async function syncServices() {
  const debut = Date.now();
  try {
    const data = await requetePP('/services');
    const items = Array.isArray(data) ? data : data?.data || data?.items || [];

    let count = 0;
    for (const s of items) {
      if (!s.id) continue;

      // Verifier references
      let ministereId = s.ministryId || null;
      if (ministereId) {
        const exists = await prisma.ministere.findUnique({ where: { id: ministereId }, select: { id: true } });
        if (!exists) ministereId = null;
      }

      let domaineId = s.domainId || null;
      if (domaineId) {
        const exists = await prisma.domaine.findUnique({ where: { id: domaineId }, select: { id: true } });
        if (!exists) domaineId = null;
      }

      let orgUnitId = s.orgUnitId || null;
      if (orgUnitId) {
        const exists = await prisma.orgUnit.findUnique({ where: { id: orgUnitId }, select: { id: true } });
        if (!exists) orgUnitId = null;
      }

      await prisma.serviceGouv.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          nomFr: s.nameFr || s.name || '',
          nomEn: s.nameEn || null,
          montant: s.amount || 0,
          ministereId,
          domaineId,
          orgUnitId,
          estActif: s.isActive !== false,
          synchroniseLe: new Date(),
        },
        update: {
          nomFr: s.nameFr || s.name || undefined,
          nomEn: s.nameEn || null,
          montant: s.amount || 0,
          ministereId,
          domaineId,
          orgUnitId,
          estActif: s.isActive !== false,
          synchroniseLe: new Date(),
        },
      });
      count++;
    }

    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] Services: ${count} en ${dureeMs}ms`);
    await logSync('/services', 'SUCCES', count, dureeMs);
    return count;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error('[SYNC] Erreur services:', err.message);
    await logSync('/services', 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC SOUMISSIONS (form-submissions)
// ═══════════════════════════════════════════════════════════════

function resolveStatutPaiement(submission) {
  const paymentStatus = submission.data?.__payment?.status || submission.data?.__corebank?.status;
  if (!paymentStatus) return 'PENDING';

  const upper = String(paymentStatus).toUpperCase();
  if (['SUCCESS', 'COMPLETED', 'PAID'].includes(upper)) return 'PAID';
  if (upper === 'PARTIAL') return 'PARTIAL';
  if (upper === 'FAILED') return 'FAILED';
  return 'PENDING';
}

async function syncSoumissions() {
  const debut = Date.now();
  try {
    const data = await requetePP('/form-submissions');
    const items = Array.isArray(data) ? data : data?.data || data?.items || [];

    // Pre-charger les services pour resolution formId -> serviceId
    // On cherche aussi les forms pour faire le lien
    let formsMap = {};
    try {
      const formsData = await requetePP('/forms');
      const forms = Array.isArray(formsData) ? formsData : formsData?.data || formsData?.items || [];
      for (const f of forms) {
        if (f.id && f.serviceId) {
          formsMap[f.id] = f;
        }
      }
    } catch {
      console.warn('[SYNC] Impossible de charger les formulaires, resolution service limitee');
    }

    // Pre-charger les services locaux
    const servicesLocaux = await prisma.serviceGouv.findMany({
      select: { id: true, ministereId: true, domaineId: true, orgUnitId: true },
    });
    const servicesMap = {};
    for (const s of servicesLocaux) {
      servicesMap[s.id] = s;
    }

    let count = 0;
    for (const sub of items) {
      if (!sub.id) continue;

      // Resoudre le service via le formulaire
      let serviceId = null;
      let ministereId = null;
      let domaineId = null;
      let orgUnitId = null;
      let formulaireNom = null;

      const form = formsMap[sub.formId];
      if (form) {
        serviceId = form.serviceId || null;
        formulaireNom = form.nameFr || form.name || null;
        const svc = servicesMap[serviceId];
        if (svc) {
          ministereId = svc.ministereId;
          domaineId = svc.domaineId;
          orgUnitId = svc.orgUnitId;
        }
      }

      // Verifier les FK existent localement
      if (serviceId && !servicesMap[serviceId]) serviceId = null;
      if (ministereId) {
        const exists = await prisma.ministere.findUnique({ where: { id: ministereId }, select: { id: true } });
        if (!exists) ministereId = null;
      }
      if (domaineId) {
        const exists = await prisma.domaine.findUnique({ where: { id: domaineId }, select: { id: true } });
        if (!exists) domaineId = null;
      }
      if (orgUnitId) {
        const exists = await prisma.orgUnit.findUnique({ where: { id: orgUnitId }, select: { id: true } });
        if (!exists) orgUnitId = null;
      }

      const montant = parseFloat(sub.data?.__payment?.amount) || 0;
      const statutPaiement = resolveStatutPaiement(sub);

      await prisma.soumission.upsert({
        where: { externalId: sub.id },
        create: {
          externalId: sub.id,
          uniqueCode: sub.uniqueCode || null,
          formulaireId: sub.formId || null,
          formulaireNom,
          serviceId,
          ministereId,
          domaineId,
          orgUnitId,
          soumetteurNom: sub.submittedBy || null,
          soumetteurEmail: sub.customer?.email || null,
          soumetteurTelephone: sub.customer?.phoneNumber || null,
          montant,
          statutPaiement,
          dateSoumission: sub.submittedAt ? new Date(sub.submittedAt) : null,
          datePaiement: statutPaiement === 'PAID' && sub.submittedAt ? new Date(sub.submittedAt) : null,
          donneesFormulaire: sub.data || null,
          synchroniseLe: new Date(),
        },
        update: {
          uniqueCode: sub.uniqueCode || undefined,
          formulaireId: sub.formId || undefined,
          formulaireNom: formulaireNom || undefined,
          serviceId,
          ministereId,
          domaineId,
          orgUnitId,
          soumetteurNom: sub.submittedBy || undefined,
          soumetteurEmail: sub.customer?.email || undefined,
          soumetteurTelephone: sub.customer?.phoneNumber || undefined,
          montant,
          statutPaiement,
          dateSoumission: sub.submittedAt ? new Date(sub.submittedAt) : undefined,
          datePaiement: statutPaiement === 'PAID' && sub.submittedAt ? new Date(sub.submittedAt) : undefined,
          donneesFormulaire: sub.data || undefined,
          synchroniseLe: new Date(),
        },
      });
      count++;
    }

    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] Soumissions: ${count} en ${dureeMs}ms`);
    await logSync('/form-submissions', 'SUCCES', count, dureeMs);
    return count;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error('[SYNC] Erreur soumissions:', err.message);
    await logSync('/form-submissions', 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNCHRONISATION COMPLETE
// ═══════════════════════════════════════════════════════════════

export async function lancerSynchronisationComplete() {
  const debutTotal = Date.now();
  console.log('[SYNC] ===== Debut synchronisation complete =====');

  const resultats = {
    ministeres: 0,
    domaines: 0,
    orgUnits: 0,
    services: 0,
    soumissions: 0,
    dureeMs: 0,
    erreurs: [],
  };

  // 1. Referentiel (ordre important pour les FK)
  try {
    resultats.ministeres = await syncMinisteres();
  } catch (err) {
    resultats.erreurs.push(`Ministeres: ${err.message}`);
  }

  try {
    resultats.domaines = await syncDomaines();
  } catch (err) {
    resultats.erreurs.push(`Domaines: ${err.message}`);
  }

  try {
    resultats.orgUnits = await syncOrgUnits();
  } catch (err) {
    resultats.erreurs.push(`OrgUnits: ${err.message}`);
  }

  try {
    resultats.services = await syncServices();
  } catch (err) {
    resultats.erreurs.push(`Services: ${err.message}`);
  }

  // 2. Donnees transactionnelles
  try {
    resultats.soumissions = await syncSoumissions();
  } catch (err) {
    resultats.erreurs.push(`Soumissions: ${err.message}`);
  }

  resultats.dureeMs = Date.now() - debutTotal;

  console.log(`[SYNC] ===== Fin synchronisation: ${resultats.dureeMs}ms =====`);
  console.log(`[SYNC] Ministeres: ${resultats.ministeres}, Domaines: ${resultats.domaines}, OrgUnits: ${resultats.orgUnits}, Services: ${resultats.services}, Soumissions: ${resultats.soumissions}`);
  if (resultats.erreurs.length > 0) {
    console.warn('[SYNC] Erreurs:', resultats.erreurs.join('; '));
  }

  return resultats;
}
