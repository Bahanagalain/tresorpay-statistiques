// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Service Webhook (réception events du PP)
// ─────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import prisma from '../config/prisma.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'tresorpay-webhook-secret-change-me';
const TIMESTAMP_TOLERANCE_S = 300; // 5 minutes

// ═══════════════════════════════════════════════════════════════
// VERIFICATION SIGNATURE HMAC
// ═══════════════════════════════════════════════════════════════

export function verifierSignature(signature, timestamp, body) {
  if (!signature || !timestamp) return false;

  // Protection anti-replay
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > TIMESTAMP_TOLERANCE_S) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const received = signature.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

// ═══════════════════════════════════════════════════════════════
// TRAITEMENT DES EVENTS
// ═══════════════════════════════════════════════════════════════

/** Tronque une string (sécurité VarChar) */
function t(val, maxLen) {
  if (!val) return null;
  return String(val).substring(0, maxLen);
}

const HANDLERS = {
  // ─── Ministères ────────────────────────────────────────────
  'ministry.created': upsertMinistere,
  'ministry.updated': upsertMinistere,

  // ─── Domaines ──────────────────────────────────────────────
  'domain.created': upsertDomaine,
  'domain.updated': upsertDomaine,

  // ─── OrgUnits ──────────────────────────────────────────────
  'org-unit.created': upsertOrgUnit,
  'org-unit.updated': upsertOrgUnit,

  // ─── Services ──────────────────────────────────────────────
  'service.created': upsertService,
  'service.updated': upsertService,

  // ─── Structures ────────────────────────────────────────────
  'structure.created': upsertStructure,
  'structure.updated': upsertStructure,

  // ─── Bénéficiaires ─────────────────────────────────────────
  'beneficiary.created': upsertBeneficiaire,
  'beneficiary.updated': upsertBeneficiaire,

  // ─── Soumissions ───────────────────────────────────────────
  'submission.created': upsertSoumission,
  'submission.updated': upsertSoumission,

  // ─── Demandes partenaires ──────────────────────────────────
  'partner-request.paid': upsertDemandePartenaire,
  'partner-request.partial': upsertDemandePartenaire,

  // ─── Revenue Groups ────────────────────────────────────────
  'revenue-group.created': upsertGroupeRevenu,
  'revenue-group.updated': upsertGroupeRevenu,
};

export async function traiterEvent(event) {
  const handler = HANDLERS[event.eventType];
  if (!handler) {
    console.log(`[WEBHOOK] Event type inconnu: ${event.eventType} — ignoré`);
    return;
  }
  await handler(event.payload, event.aggregateId);
}

// ═══════════════════════════════════════════════════════════════
// HANDLERS PAR ENTITE
// ═══════════════════════════════════════════════════════════════

async function upsertMinistere(m) {
  const code = t(m.code || m.shortName || m.id, 30);
  await prisma.ministere.upsert({
    where: { id: m.id },
    create: {
      id: m.id,
      code,
      nomFr: t(m.nameFr || m.name, 200) || '',
      nomEn: t(m.nameEn, 200),
      shortName: t(m.shortName, 30),
      icon: t(m.icon, 50),
      couleur: t(m.color, 20),
      estActif: m.isActive !== false,
      sortIndex: m.sortIndex || 0,
      synchroniseLe: new Date(),
    },
    update: {
      code,
      nomFr: t(m.nameFr || m.name, 200) || undefined,
      nomEn: t(m.nameEn, 200),
      shortName: t(m.shortName, 30),
      icon: t(m.icon, 50),
      couleur: t(m.color, 20),
      estActif: m.isActive !== false,
      sortIndex: m.sortIndex || 0,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertDomaine(d) {
  await prisma.domaine.upsert({
    where: { id: d.id },
    create: {
      id: d.id,
      nomFr: t(d.nameFr || d.name, 200) || '',
      nomEn: t(d.nameEn, 200),
      icon: t(d.icon, 50),
      couleur: t(d.color, 20),
      estActif: d.isActive !== false,
      synchroniseLe: new Date(),
    },
    update: {
      nomFr: t(d.nameFr || d.name, 200) || undefined,
      nomEn: t(d.nameEn, 200),
      icon: t(d.icon, 50),
      couleur: t(d.color, 20),
      estActif: d.isActive !== false,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertOrgUnit(o) {
  let parentId = o.parentId || null;
  if (parentId) {
    const exists = await prisma.orgUnit.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!exists) parentId = null;
  }
  let ministereId = o.ministryId || null;
  if (ministereId) {
    const exists = await prisma.ministere.findUnique({ where: { id: ministereId }, select: { id: true } });
    if (!exists) ministereId = null;
  }

  const type = (() => {
    if (!o.type) return 'ORGANIZATION';
    const upper = o.type.toUpperCase();
    if (['ORGANIZATION', 'REGION', 'DEPARTMENT', 'ARRONDISSEMENT'].includes(upper)) return upper;
    return 'ORGANIZATION';
  })();

  await prisma.orgUnit.upsert({
    where: { id: o.id },
    create: {
      id: o.id,
      code: t(o.code || o.id, 30),
      nomFr: t(o.nameFr || o.name, 200) || '',
      nomEn: t(o.nameEn, 200),
      type,
      parentId,
      path: t(o.path, 500),
      depth: o.depth || 0,
      ministereId,
      latitude: o.latitude != null ? parseFloat(o.latitude) : null,
      longitude: o.longitude != null ? parseFloat(o.longitude) : null,
      estActif: o.isActive !== false,
      synchroniseLe: new Date(),
    },
    update: {
      code: t(o.code, 30) || undefined,
      nomFr: t(o.nameFr || o.name, 200) || undefined,
      nomEn: t(o.nameEn, 200),
      type,
      parentId,
      path: t(o.path, 500),
      depth: o.depth || 0,
      ministereId,
      latitude: o.latitude != null ? parseFloat(o.latitude) : null,
      longitude: o.longitude != null ? parseFloat(o.longitude) : null,
      estActif: o.isActive !== false,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertService(s) {
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

  await prisma.serviceGouv.upsert({
    where: { id: s.id },
    create: {
      id: s.id,
      nomFr: t(s.nameFr || s.name, 300) || '',
      nomEn: t(s.nameEn, 300),
      montant: s.amount || 0,
      ministereId,
      domaineId,
      serviceCode: t(s.serviceCode, 50),
      estActif: s.isActive !== false,
      synchroniseLe: new Date(),
    },
    update: {
      nomFr: t(s.nameFr || s.name, 300) || undefined,
      nomEn: t(s.nameEn, 300),
      montant: s.amount || 0,
      ministereId,
      domaineId,
      serviceCode: t(s.serviceCode, 50),
      estActif: s.isActive !== false,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertStructure(s) {
  let ministereId = s.ministryId || s.ministry?.id || null;
  if (ministereId) {
    const exists = await prisma.ministere.findUnique({ where: { id: ministereId }, select: { id: true } });
    if (!exists) ministereId = null;
  }

  await prisma.structure.upsert({
    where: { id: s.id },
    create: {
      id: s.id,
      code: t(s.code || s.id, 50),
      nomFr: t(s.nameFr || s.name, 200) || '',
      nomEn: t(s.nameEn, 200),
      ministereId,
      estActif: s.isActive !== false,
      synchroniseLe: new Date(),
    },
    update: {
      code: t(s.code, 50) || undefined,
      nomFr: t(s.nameFr || s.name, 200) || undefined,
      nomEn: t(s.nameEn, 200),
      ministereId,
      estActif: s.isActive !== false,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertBeneficiaire(b) {
  await prisma.beneficiaire.upsert({
    where: { id: b.id },
    create: {
      id: b.id,
      code: t(b.code || b.id, 50),
      nom: t(b.name, 200) || '',
      rib: t(b.rib, 50),
      estActif: b.isActive !== false,
      synchroniseLe: new Date(),
    },
    update: {
      code: t(b.code, 50) || undefined,
      nom: t(b.name, 200) || undefined,
      rib: t(b.rib, 50),
      estActif: b.isActive !== false,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertGroupeRevenu(g) {
  let ministereId = g.ministryId || g.ministry?.id || null;
  if (ministereId) {
    const exists = await prisma.ministere.findUnique({ where: { id: ministereId }, select: { id: true } });
    if (!exists) ministereId = null;
  }

  await prisma.groupeRevenu.upsert({
    where: { id: g.id },
    create: {
      id: g.id,
      nomFr: t(g.nameFr || g.name, 200) || '',
      nomEn: t(g.nameEn, 200),
      ministereId,
      estActif: g.isActive !== false,
      synchroniseLe: new Date(),
    },
    update: {
      nomFr: t(g.nameFr || g.name, 200) || undefined,
      nomEn: t(g.nameEn, 200),
      ministereId,
      estActif: g.isActive !== false,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertSoumission(sub) {
  // Résoudre les FK
  let serviceId = null, ministereId = null, domaineId = null;

  if (sub.formId) {
    // Chercher le service via le formulaire local (si disponible)
    const champ = await prisma.champFormulaire.findFirst({
      where: { formulaireId: sub.formId },
      select: { serviceId: true },
    });
    if (champ?.serviceId) {
      serviceId = champ.serviceId;
      const svc = await prisma.serviceGouv.findUnique({
        where: { id: serviceId },
        select: { ministereId: true, domaineId: true },
      });
      if (svc) {
        ministereId = svc.ministereId;
        domaineId = svc.domaineId;
      }
    }
  }

  const montant = parseFloat(sub.data?.__paymentAmount ?? sub.data?.__payment?.amount ?? sub.data?.paymentAmount ?? 0) || 0;
  const statutPaiement = resolveStatutPaiement(sub);

  await prisma.soumission.upsert({
    where: { externalId: sub.id },
    create: {
      externalId: sub.id,
      uniqueCode: t(sub.uniqueCode, 30),
      formulaireId: sub.formId || null,
      serviceId,
      ministereId,
      domaineId,
      soumetteurNom: t(sub.submittedBy, 200),
      soumetteurEmail: t(sub.customer?.email, 200),
      soumetteurTelephone: t(sub.customer?.phoneNumber, 30),
      montant,
      statutPaiement,
      dateSoumission: sub.submittedAt ? new Date(sub.submittedAt) : null,
      datePaiement: statutPaiement === 'PAID' && sub.submittedAt ? new Date(sub.submittedAt) : null,
      donneesFormulaire: sub.data || null,
      synchroniseLe: new Date(),
    },
    update: {
      uniqueCode: t(sub.uniqueCode, 30) || undefined,
      serviceId,
      ministereId,
      domaineId,
      montant,
      statutPaiement,
      datePaiement: statutPaiement === 'PAID' && sub.submittedAt ? new Date(sub.submittedAt) : undefined,
      donneesFormulaire: sub.data || undefined,
      synchroniseLe: new Date(),
    },
  });
}

async function upsertDemandePartenaire(d) {
  const plateformeId = d.platformId || d.partnerPlatformId || null;
  if (!plateformeId) return;

  // Vérifier que la plateforme existe localement
  const pf = await prisma.plateformePartenaire.findUnique({ where: { id: plateformeId }, select: { id: true } });
  if (!pf) return;

  await prisma.demandePartenaire.upsert({
    where: { externalId: String(d.id) },
    create: {
      externalId: String(d.id),
      plateformeId,
      platformReference: t(d.platformReference, 100),
      serviceId: d.serviceId || null,
      uniqueCode: t(d.uniqueCode, 30),
      montant: d.amount || 0,
      montantPaye: d.paidAmount || 0,
      statut: d.status || 'PENDING',
      methodePaiement: t(d.paymentMethod, 50),
      operateurPaiement: t(d.paymentOperator, 50),
      payeurNom: t(d.payerName || d.userInfo?.nom, 200),
      raisonEchec: t(d.failureReason, 500),
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
      methodePaiement: t(d.paymentMethod, 50),
      operateurPaiement: t(d.paymentOperator, 50),
      payeurNom: t(d.payerName || d.userInfo?.nom, 200),
      raisonEchec: t(d.failureReason, 500),
      callbackStatutHttp: d.callbackHttpStatus || null,
      callbackTentatives: d.callbackAttempts || 0,
      payeLe: d.paidAt ? new Date(d.paidAt) : null,
      synchroniseLe: new Date(),
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
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
