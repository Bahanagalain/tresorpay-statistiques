// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Service de synchronisation
// Pull depuis le payment-platform (admin-service)
// ─────────────────────────────────────────────────────────────────────

import prisma from '../config/prisma.js';

export const PP_API_URL = (process.env.PP_REMOTE_API_URL || 'http://localhost:3005').replace(/\/+$/, '');

let cachedToken = null;

// ═══════════════════════════════════════════════════════════════
// ETAT DE SYNC (en memoire)
// ═══════════════════════════════════════════════════════════════

const etatSync = {
  enCours: false,
  progression: 0,
  etapeCourante: null,
  debutLe: null,
  dernierResultat: null,
};

export function getEtatSync() {
  return { ...etatSync };
}

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
      body: JSON.stringify({ email: username, username, password }),
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
      data: { endpoint, statut, nbEnregistrements, dureeMs, messageErreur },
    });
  } catch (err) {
    console.error('[SYNC] Erreur ecriture journal:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function normalizeArray(data) {
  return Array.isArray(data) ? data : data?.data || data?.items || [];
}

function normalizeOrgUnitType(type) {
  if (!type) return 'ORGANIZATION';
  const upper = type.toUpperCase();
  if (['ORGANIZATION', 'REGION', 'DEPARTMENT', 'ARRONDISSEMENT'].includes(upper)) return upper;
  return 'ORGANIZATION';
}

function normalizeActionAudit(action) {
  if (!action) return 'CREATE';
  const upper = action.toUpperCase().replace(/-/g, '_');
  const valid = ['CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'PUBLISH', 'APPROVE', 'REJECT', 'LOGIN', 'ACTIVATE', 'DEACTIVATE'];
  return valid.includes(upper) ? upper : 'CREATE';
}

/** Verifie qu'un enregistrement existe en base locale */
async function existeLocalement(model, id) {
  if (!id) return false;
  const r = await prisma[model].findUnique({ where: { id }, select: { id: true } });
  return !!r;
}

/** Wrapper generique de sync par entite */
async function syncEntite(nom, endpoint, processItem) {
  const debut = Date.now();
  try {
    const data = await requetePP(endpoint);
    const items = normalizeArray(data);
    let count = 0;
    for (const item of items) {
      if (!item.id) continue;
      await processItem(item);
      count++;
    }
    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] ${nom}: ${count} en ${dureeMs}ms`);
    await logSync(endpoint, 'SUCCES', count, dureeMs);
    return count;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error(`[SYNC] Erreur ${nom}:`, err.message);
    await logSync(endpoint, 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC PAR ENTITE
// ═══════════════════════════════════════════════════════════════

async function syncMinisteres() {
  return syncEntite('Ministeres', '/ministries', async (m) => {
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
  });
}

async function syncDomaines() {
  return syncEntite('Domaines', '/domains', async (d) => {
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
  });
}

async function syncOrgUnits() {
  const debut = Date.now();
  try {
    const data = await requetePP('/org-units');
    const items = normalizeArray(data);
    const sorted = [...items].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    let count = 0;
    for (const o of sorted) {
      if (!o.id) continue;
      let parentId = o.parentId || null;
      if (parentId && !(await existeLocalement('orgUnit', parentId))) parentId = null;
      let ministereId = o.ministryId || null;
      if (ministereId && !(await existeLocalement('ministere', ministereId))) ministereId = null;

      await prisma.orgUnit.upsert({
        where: { id: o.id },
        create: {
          id: o.id,
          code: o.code || o.id.substring(0, 30),
          nomFr: o.nameFr || o.name || '',
          nomEn: o.nameEn || null,
          type: normalizeOrgUnitType(o.type),
          parentId, path: o.path || null, depth: o.depth || 0,
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
          parentId, path: o.path || null, depth: o.depth || 0,
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

async function syncGroupesRevenu() {
  return syncEntite('GroupesRevenu', '/revenue-groups', async (g) => {
    let ministereId = g.ministryId || g.ministry?.id || null;
    if (ministereId && !(await existeLocalement('ministere', ministereId))) ministereId = null;

    await prisma.groupeRevenu.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        nomFr: g.nameFr || g.name || '',
        nomEn: g.nameEn || null,
        ministereId,
        estActif: g.isActive !== false,
        synchroniseLe: new Date(),
      },
      update: {
        nomFr: g.nameFr || g.name || undefined,
        nomEn: g.nameEn || null,
        ministereId,
        estActif: g.isActive !== false,
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncServices() {
  return syncEntite('Services', '/services', async (s) => {
    let ministereId = s.ministryId || null;
    if (ministereId && !(await existeLocalement('ministere', ministereId))) ministereId = null;
    let domaineId = s.domainId || null;
    if (domaineId && !(await existeLocalement('domaine', domaineId))) domaineId = null;
    let orgUnitId = s.orgUnitId || null;
    if (orgUnitId && !(await existeLocalement('orgUnit', orgUnitId))) orgUnitId = null;
    let groupeRevenuId = s.revenueGroupId || null;
    if (groupeRevenuId && !(await existeLocalement('groupeRevenu', groupeRevenuId))) groupeRevenuId = null;

    await prisma.serviceGouv.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        nomFr: s.nameFr || s.name || '',
        nomEn: s.nameEn || null,
        montant: s.amount || 0,
        ministereId, domaineId, orgUnitId, groupeRevenuId,
        serviceCode: s.serviceCode || null,
        estActif: s.isActive !== false,
        synchroniseLe: new Date(),
      },
      update: {
        nomFr: s.nameFr || s.name || undefined,
        nomEn: s.nameEn || null,
        montant: s.amount || 0,
        ministereId, domaineId, orgUnitId, groupeRevenuId,
        serviceCode: s.serviceCode || null,
        estActif: s.isActive !== false,
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncBeneficiaires() {
  return syncEntite('Beneficiaires', '/beneficiaries', async (b) => {
    await prisma.beneficiaire.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        code: b.code || b.id.substring(0, 50),
        nom: b.name || '',
        rib: b.rib || null,
        estActif: b.isActive !== false,
        synchroniseLe: new Date(),
      },
      update: {
        code: b.code || undefined,
        nom: b.name || undefined,
        rib: b.rib || null,
        estActif: b.isActive !== false,
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncDistrictsFinanciers() {
  return syncEntite('DistrictsFinanciers', '/financial-districts', async (d) => {
    await prisma.districtFinancier.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        code: d.code || d.id.substring(0, 30),
        nomFr: d.nameFr || d.name || '',
        nomEn: d.nameEn || null,
        type: d.type || null,
        codePoste: d.codePoste || null,
        estActif: d.isActive !== false,
        synchroniseLe: new Date(),
      },
      update: {
        code: d.code || undefined,
        nomFr: d.nameFr || d.name || undefined,
        nomEn: d.nameEn || null,
        type: d.type || null,
        codePoste: d.codePoste || null,
        estActif: d.isActive !== false,
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncPostesComptables() {
  return syncEntite('PostesComptables', '/accounting-posts', async (p) => {
    let districtFinancierId = p.financialDistrictId || null;
    if (districtFinancierId && !(await existeLocalement('districtFinancier', districtFinancierId))) districtFinancierId = null;
    let orgUnitId = p.orgUnitId || null;
    if (orgUnitId && !(await existeLocalement('orgUnit', orgUnitId))) orgUnitId = null;

    await prisma.posteComptable.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        code: p.code || p.id.substring(0, 30),
        nomFr: p.nameFr || p.name || '',
        nomEn: p.nameEn || null,
        districtFinancierId, orgUnitId,
        estActif: p.isActive !== false,
        synchroniseLe: new Date(),
      },
      update: {
        code: p.code || undefined,
        nomFr: p.nameFr || p.name || undefined,
        nomEn: p.nameEn || null,
        districtFinancierId, orgUnitId,
        estActif: p.isActive !== false,
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncTypesStructure() {
  return syncEntite('TypesStructure', '/structure-types', async (t) => {
    await prisma.typeStructure.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        nomFr: t.nameFr || t.name || '',
        nomEn: t.nameEn || null,
        description: t.description || null,
        estActif: t.isActive !== false,
        synchroniseLe: new Date(),
      },
      update: {
        nomFr: t.nameFr || t.name || undefined,
        nomEn: t.nameEn || null,
        description: t.description || null,
        estActif: t.isActive !== false,
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncStructures() {
  return syncEntite('Structures', '/structures', async (s) => {
    let typeStructureId = s.structureTypeId || s.structureType?.id || null;
    if (typeStructureId && !(await existeLocalement('typeStructure', typeStructureId))) typeStructureId = null;
    let ministereId = s.ministryId || s.ministry?.id || null;
    if (ministereId && !(await existeLocalement('ministere', ministereId))) ministereId = null;
    let orgUnitId = s.orgUnitId || s.orgUnit?.id || null;
    if (orgUnitId && !(await existeLocalement('orgUnit', orgUnitId))) orgUnitId = null;

    await prisma.structure.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        code: s.code || s.id.substring(0, 50),
        nomFr: s.nameFr || s.name || '',
        nomEn: s.nameEn || null,
        typeStructureId, ministereId, orgUnitId,
        latitude: s.latitude != null ? parseFloat(s.latitude) : null,
        longitude: s.longitude != null ? parseFloat(s.longitude) : null,
        estActif: s.isActive !== false,
        synchroniseLe: new Date(),
      },
      update: {
        code: s.code || undefined,
        nomFr: s.nameFr || s.name || undefined,
        nomEn: s.nameEn || null,
        typeStructureId, ministereId, orgUnitId,
        latitude: s.latitude != null ? parseFloat(s.latitude) : null,
        longitude: s.longitude != null ? parseFloat(s.longitude) : null,
        estActif: s.isActive !== false,
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncPlateformesPartenaire() {
  return syncEntite('PlateformesPartenaire', '/partner-platforms', async (p) => {
    let ministereId = p.ministryId || p.ministry?.id || null;
    if (ministereId && !(await existeLocalement('ministere', ministereId))) ministereId = null;

    await prisma.plateformePartenaire.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        code: p.code || p.id.substring(0, 50),
        nom: p.name || '',
        ministereId,
        contactEmail: p.contactEmail || null,
        logoUrl: p.logoUrl || null,
        statut: ['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(p.status) ? p.status : 'ACTIVE',
        callbackUrl: p.defaultCallbackUrl || null,
        callbackRetries: p.callbackRetries || 3,
        estActif: p.status !== 'INACTIVE',
        synchroniseLe: new Date(),
      },
      update: {
        code: p.code || undefined,
        nom: p.name || undefined,
        ministereId,
        contactEmail: p.contactEmail || null,
        logoUrl: p.logoUrl || null,
        statut: ['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(p.status) ? p.status : 'ACTIVE',
        callbackUrl: p.defaultCallbackUrl || null,
        callbackRetries: p.callbackRetries || 3,
        estActif: p.status !== 'INACTIVE',
        synchroniseLe: new Date(),
      },
    });
  });
}

async function syncDemandesPartenaire() {
  const debut = Date.now();
  try {
    // Charger toutes les plateformes locales
    const plateformes = await prisma.plateformePartenaire.findMany({ select: { id: true } });
    let totalCount = 0;

    for (const pf of plateformes) {
      try {
        const data = await requetePP(`/partner-platforms/${pf.id}/payment-requests?limit=1000`);
        const items = normalizeArray(data);

        for (const d of items) {
          if (!d.id) continue;
          await prisma.demandePartenaire.upsert({
            where: { externalId: String(d.id) },
            create: {
              externalId: String(d.id),
              plateformeId: pf.id,
              platformReference: d.platformReference || null,
              serviceId: d.serviceId || null,
              uniqueCode: d.uniqueCode || null,
              montant: d.amount || 0,
              montantPaye: d.paidAmount || 0,
              statut: d.status || 'PENDING',
              methodePaiement: d.paymentMethod || null,
              operateurPaiement: d.paymentOperator || null,
              payeurNom: d.payerName || d.userInfo?.nom || null,
              raisonEchec: d.failureReason || null,
              callbackStatutHttp: d.callbackHttpStatus || null,
              callbackTentatives: d.callbackAttempts || 0,
              payeLe: d.paidAt ? new Date(d.paidAt) : null,
              creeLe: d.createdAt ? new Date(d.createdAt) : new Date(),
              synchroniseLe: new Date(),
            },
            update: {
              montant: d.amount || 0,
              montantPaye: d.paidAmount || 0,
              statut: d.status || 'PENDING',
              methodePaiement: d.paymentMethod || null,
              operateurPaiement: d.paymentOperator || null,
              payeurNom: d.payerName || d.userInfo?.nom || null,
              raisonEchec: d.failureReason || null,
              callbackStatutHttp: d.callbackHttpStatus || null,
              callbackTentatives: d.callbackAttempts || 0,
              payeLe: d.paidAt ? new Date(d.paidAt) : null,
              synchroniseLe: new Date(),
            },
          });
          totalCount++;
        }
      } catch (err) {
        console.warn(`[SYNC] Erreur demandes partenaire ${pf.id}:`, err.message);
      }
    }

    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] DemandesPartenaire: ${totalCount} en ${dureeMs}ms`);
    await logSync('/partner-platforms/*/payment-requests', 'SUCCES', totalCount, dureeMs);
    return totalCount;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error('[SYNC] Erreur demandes partenaire:', err.message);
    await logSync('/partner-platforms/*/payment-requests', 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

async function syncCitoyens() {
  const debut = Date.now();
  try {
    // Les citoyens sont exportes via backup, on tente l'endpoint direct
    let items = [];
    try {
      const data = await requetePP('/citizen-users');
      items = normalizeArray(data);
    } catch {
      // Endpoint peut ne pas exister, on skip silencieusement
      console.warn('[SYNC] Endpoint /citizen-users non disponible, skip');
      await logSync('/citizen-users', 'SUCCES', 0, Date.now() - debut);
      return 0;
    }

    let count = 0;
    for (const c of items) {
      if (!c.id) continue;
      await prisma.utilisateurCitoyen.upsert({
        where: { externalId: String(c.id) },
        create: {
          externalId: String(c.id),
          email: c.email || null,
          telephone: c.phone || null,
          prenom: c.firstName || null,
          nom: c.lastName || null,
          estVerifie: c.isVerified === true,
          estActif: c.isActive !== false,
          creeLe: c.createdAt ? new Date(c.createdAt) : new Date(),
          synchroniseLe: new Date(),
        },
        update: {
          email: c.email || null,
          telephone: c.phone || null,
          prenom: c.firstName || null,
          nom: c.lastName || null,
          estVerifie: c.isVerified === true,
          estActif: c.isActive !== false,
          synchroniseLe: new Date(),
        },
      });
      count++;
    }

    const dureeMs = Date.now() - debut;
    console.log(`[SYNC] Citoyens: ${count} en ${dureeMs}ms`);
    await logSync('/citizen-users', 'SUCCES', count, dureeMs);
    return count;
  } catch (err) {
    const dureeMs = Date.now() - debut;
    console.error('[SYNC] Erreur citoyens:', err.message);
    await logSync('/citizen-users', 'ECHEC', 0, dureeMs, err.message);
    return 0;
  }
}

async function syncAuditLogs() {
  return syncEntite('AuditLogs', '/audit-logs', async (a) => {
    await prisma.journalAudit.upsert({
      where: { externalId: String(a.id) },
      create: {
        externalId: String(a.id),
        acteurEmail: a.actorEmail || null,
        acteurNom: a.actorName ? `${a.actorName} ${a.actorSurname || ''}`.trim() : null,
        action: normalizeActionAudit(a.action),
        typeEntite: a.entityType || null,
        entiteId: a.entityId || null,
        methodeHttp: a.httpMethod || null,
        cheminRoute: a.routePath || null,
        metadata: a.metadata || null,
        executeLe: a.createdAt ? new Date(a.createdAt) : new Date(),
        synchroniseLe: new Date(),
      },
      update: {
        acteurEmail: a.actorEmail || null,
        acteurNom: a.actorName ? `${a.actorName} ${a.actorSurname || ''}`.trim() : null,
        action: normalizeActionAudit(a.action),
        typeEntite: a.entityType || null,
        entiteId: a.entityId || null,
        methodeHttp: a.httpMethod || null,
        cheminRoute: a.routePath || null,
        metadata: a.metadata || null,
        synchroniseLe: new Date(),
      },
    });
  });
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
    const items = normalizeArray(data);

    // Pre-charger les forms pour resolution formId -> serviceId
    let formsMap = {};
    try {
      const formsData = await requetePP('/forms');
      const forms = normalizeArray(formsData);
      for (const f of forms) {
        if (f.id && f.serviceId) formsMap[f.id] = f;
      }
    } catch {
      console.warn('[SYNC] Impossible de charger les formulaires');
    }

    // Pre-charger les services locaux
    const servicesLocaux = await prisma.serviceGouv.findMany({
      select: { id: true, ministereId: true, domaineId: true, orgUnitId: true },
    });
    const servicesMap = {};
    for (const s of servicesLocaux) servicesMap[s.id] = s;

    let count = 0;
    for (const sub of items) {
      if (!sub.id) continue;

      let serviceId = null, ministereId = null, domaineId = null, orgUnitId = null, formulaireNom = null;

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

      // OrgUnit de la soumission peut etre different du service
      if (sub.orgUnitId) {
        const ouExists = await existeLocalement('orgUnit', sub.orgUnitId);
        if (ouExists) orgUnitId = sub.orgUnitId;
      }

      if (serviceId && !servicesMap[serviceId]) serviceId = null;
      if (ministereId && !(await existeLocalement('ministere', ministereId))) ministereId = null;
      if (domaineId && !(await existeLocalement('domaine', domaineId))) domaineId = null;
      if (orgUnitId && !(await existeLocalement('orgUnit', orgUnitId))) orgUnitId = null;

      const montant = parseFloat(sub.data?.__paymentAmount ?? sub.data?.__payment?.amount ?? sub.data?.paymentAmount ?? 0) || 0;
      const statutPaiement = resolveStatutPaiement(sub);

      await prisma.soumission.upsert({
        where: { externalId: sub.id },
        create: {
          externalId: sub.id,
          uniqueCode: sub.uniqueCode || null,
          formulaireId: sub.formId || null,
          formulaireNom,
          serviceId, ministereId, domaineId, orgUnitId,
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
          serviceId, ministereId, domaineId, orgUnitId,
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

const ETAPES_SYNC = [
  { nom: 'Ministères', fn: syncMinisteres, cle: 'ministeres' },
  { nom: 'Domaines', fn: syncDomaines, cle: 'domaines' },
  { nom: 'Unités org.', fn: syncOrgUnits, cle: 'orgUnits' },
  { nom: 'Types structure', fn: syncTypesStructure, cle: 'typesStructure' },
  { nom: 'Structures', fn: syncStructures, cle: 'structures' },
  { nom: 'Groupes de revenu', fn: syncGroupesRevenu, cle: 'groupesRevenu' },
  { nom: 'Services', fn: syncServices, cle: 'services' },
  { nom: 'Bénéficiaires', fn: syncBeneficiaires, cle: 'beneficiaires' },
  { nom: 'Districts financiers', fn: syncDistrictsFinanciers, cle: 'districtsFinanciers' },
  { nom: 'Postes comptables', fn: syncPostesComptables, cle: 'postesComptables' },
  { nom: 'Plateformes partenaires', fn: syncPlateformesPartenaire, cle: 'plateformesPartenaire' },
  { nom: 'Soumissions', fn: syncSoumissions, cle: 'soumissions' },
  { nom: 'Demandes partenaires', fn: syncDemandesPartenaire, cle: 'demandesPartenaire' },
  { nom: 'Citoyens', fn: syncCitoyens, cle: 'citoyens' },
  { nom: 'Audit logs', fn: syncAuditLogs, cle: 'auditLogs' },
];

export async function lancerSynchronisationComplete() {
  if (etatSync.enCours) {
    return { skipped: true, message: 'Synchronisation deja en cours' };
  }

  etatSync.enCours = true;
  etatSync.progression = 0;
  etatSync.debutLe = new Date();
  const debutTotal = Date.now();
  console.log('[SYNC] ===== Debut synchronisation complete =====');

  const resultats = { dureeMs: 0, erreurs: [] };

  for (let i = 0; i < ETAPES_SYNC.length; i++) {
    const etape = ETAPES_SYNC[i];
    etatSync.etapeCourante = etape.nom;
    etatSync.progression = Math.round((i / ETAPES_SYNC.length) * 100);

    try {
      resultats[etape.cle] = await etape.fn();
    } catch (err) {
      resultats[etape.cle] = 0;
      resultats.erreurs.push(`${etape.nom}: ${err.message}`);
    }
  }

  resultats.dureeMs = Date.now() - debutTotal;

  // Mettre a jour ConfigSync
  try {
    await prisma.configSync.upsert({
      where: { id: 1 },
      create: { id: 1, derniereSyncComplete: new Date() },
      update: { derniereSyncComplete: new Date() },
    });
  } catch { /* ignore */ }

  etatSync.enCours = false;
  etatSync.progression = 100;
  etatSync.etapeCourante = null;
  etatSync.dernierResultat = resultats;

  const resume = ETAPES_SYNC.map(e => `${e.nom}: ${resultats[e.cle] || 0}`).join(', ');
  console.log(`[SYNC] ===== Fin: ${resultats.dureeMs}ms =====`);
  console.log(`[SYNC] ${resume}`);
  if (resultats.erreurs.length > 0) {
    console.warn('[SYNC] Erreurs:', resultats.erreurs.join('; '));
  }

  return resultats;
}

// ═══════════════════════════════════════════════════════════════
// PURGE
// ═══════════════════════════════════════════════════════════════

const TABLES_PURGEABLES = {
  soumissions: 'soumission',
  demandesPartenaire: 'demandePartenaire',
  transactionsPartenaire: 'transactionPartenaire',
  journalAudit: 'journalAudit',
  citoyens: 'utilisateurCitoyen',
  serviceBeneficiaires: 'serviceBeneficiaire',
  beneficiaires: 'beneficiaire',
  structures: 'structure',
  typesStructure: 'typeStructure',
  postesComptables: 'posteComptable',
  districtsFinanciers: 'districtFinancier',
  plateformesPartenaire: 'plateformePartenaire',
  services: 'serviceGouv',
  groupesRevenu: 'groupeRevenu',
  domaines: 'domaine',
  orgUnits: 'orgUnit',
  ministeres: 'ministere',
};

export async function purgerDonnees(entites = null) {
  const tablesToPurge = entites && entites.length > 0
    ? entites.filter(e => TABLES_PURGEABLES[e])
    : Object.keys(TABLES_PURGEABLES);

  const resultats = {};

  // Purger dans l'ordre FK (enfants d'abord)
  for (const cle of tablesToPurge) {
    const model = TABLES_PURGEABLES[cle];
    if (!model) continue;
    try {
      const { count } = await prisma[model].deleteMany({});
      resultats[cle] = count;
      console.log(`[PURGE] ${cle}: ${count} supprime(s)`);
    } catch (err) {
      resultats[cle] = `Erreur: ${err.message}`;
      console.error(`[PURGE] Erreur ${cle}:`, err.message);
    }
  }

  // Log la purge
  await logSync('PURGE', 'SUCCES', Object.values(resultats).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0), 0);

  return resultats;
}
