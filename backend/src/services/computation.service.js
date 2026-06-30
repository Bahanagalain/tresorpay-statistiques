// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Service de calcul analytique
// Agregations, KPI, repartitions, drill-downs
// ─────────────────────────────────────────────────────────────────────

import prisma from '../config/prisma.js';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function buildDateFilter(dateDebut, dateFin) {
  const filter = {};
  if (dateDebut) filter.gte = new Date(dateDebut);
  if (dateFin) {
    const end = new Date(dateFin);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

function buildSoumissionWhere(dateDebut, dateFin, extra = {}) {
  const where = { ...extra };
  const dateFilter = buildDateFilter(dateDebut, dateFin);
  if (dateFilter) where.dateSoumission = dateFilter;
  return where;
}

function toNumber(val) {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

function formatMoisLabel(date) {
  const mois = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${mois[date.getMonth()]} ${date.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════
// KPI GLOBAUX
// ═══════════════════════════════════════════════════════════════

export async function computeKpi(dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin);

  // Compter par statut
  const [totalAgg, payeAgg, enAttenteAgg, partielAgg, echoueAgg] = await Promise.all([
    prisma.soumission.aggregate({ where, _count: true, _sum: { montant: true } }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'PAID' },
      _count: true,
      _sum: { montant: true },
    }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'PENDING' },
      _count: true,
    }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'PARTIAL' },
      _count: true,
      _sum: { montant: true },
    }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'FAILED' },
      _count: true,
    }),
  ]);

  const totalSoumissions = totalAgg._count || 0;
  const soumissionsPayees = payeAgg._count || 0;
  const soumissionsEnAttente = enAttenteAgg._count || 0;
  const soumissionsPartielles = partielAgg._count || 0;
  const soumissionsEchouees = echoueAgg._count || 0;
  const totalRevenus = toNumber(payeAgg._sum?.montant) + toNumber(partielAgg._sum?.montant);
  const tauxPaiement = totalSoumissions > 0 ? (soumissionsPayees / totalSoumissions) * 100 : 0;

  // Progression vs periode precedente
  let progressionMoisPrecedent = 0;
  if (dateDebut && dateFin) {
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    const durationMs = fin.getTime() - debut.getTime();
    const prevDebut = new Date(debut.getTime() - durationMs);
    const prevFin = new Date(debut.getTime() - 1);

    const prevAgg = await prisma.soumission.aggregate({
      where: buildSoumissionWhere(prevDebut.toISOString(), prevFin.toISOString(), { statutPaiement: 'PAID' }),
      _sum: { montant: true },
    });
    const prevRevenus = toNumber(prevAgg._sum?.montant);
    if (prevRevenus > 0) {
      progressionMoisPrecedent = ((totalRevenus - prevRevenus) / prevRevenus) * 100;
    }
  } else {
    // Comparer mois courant vs mois precedent
    const now = new Date();
    const debutMoisCourant = new Date(now.getFullYear(), now.getMonth(), 1);
    const debutMoisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMoisPrec = new Date(debutMoisCourant.getTime() - 1);

    const [courantAgg, precAgg] = await Promise.all([
      prisma.soumission.aggregate({
        where: { dateSoumission: { gte: debutMoisCourant }, statutPaiement: 'PAID' },
        _sum: { montant: true },
      }),
      prisma.soumission.aggregate({
        where: {
          dateSoumission: { gte: debutMoisPrec, lte: finMoisPrec },
          statutPaiement: 'PAID',
        },
        _sum: { montant: true },
      }),
    ]);
    const revCourant = toNumber(courantAgg._sum?.montant);
    const revPrec = toNumber(precAgg._sum?.montant);
    if (revPrec > 0) {
      progressionMoisPrecedent = ((revCourant - revPrec) / revPrec) * 100;
    }
  }

  return {
    totalRevenus,
    totalSoumissions,
    soumissionsPayees,
    soumissionsEnAttente,
    soumissionsPartielles,
    soumissionsEchouees,
    tauxPaiement: Math.round(tauxPaiement * 100) / 100,
    progressionMoisPrecedent: Math.round(progressionMoisPrecedent * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// EVOLUTION TEMPORELLE
// ═══════════════════════════════════════════════════════════════

export async function computeEvolution(dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin);

  const soumissions = await prisma.soumission.findMany({
    where,
    select: {
      montant: true,
      statutPaiement: true,
      dateSoumission: true,
    },
    orderBy: { dateSoumission: 'asc' },
  });

  // Grouper par mois
  const moisMap = {};

  for (const s of soumissions) {
    if (!s.dateSoumission) continue;
    const d = new Date(s.dateSoumission);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!moisMap[key]) {
      moisMap[key] = {
        periode: formatMoisLabel(d),
        cle: key,
        paye: 0,
        enAttente: 0,
        echoue: 0,
        partiel: 0,
        total: 0,
      };
    }

    const montant = toNumber(s.montant);
    moisMap[key].total += montant;

    switch (s.statutPaiement) {
      case 'PAID':
        moisMap[key].paye += montant;
        break;
      case 'PENDING':
        moisMap[key].enAttente += montant;
        break;
      case 'FAILED':
        moisMap[key].echoue += montant;
        break;
      case 'PARTIAL':
        moisMap[key].partiel += montant;
        break;
    }
  }

  return Object.values(moisMap).sort((a, b) => a.cle.localeCompare(b.cle));
}

// ═══════════════════════════════════════════════════════════════
// REPARTITION PAR MINISTERES
// ═══════════════════════════════════════════════════════════════

export async function computeRepartitionMinisteres(dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin, { ministereId: { not: null } });

  const groupes = await prisma.soumission.groupBy({
    by: ['ministereId'],
    where,
    _count: true,
    _sum: { montant: true },
  });

  // Charger les noms des ministeres
  const ministereIds = groupes.map((g) => g.ministereId).filter(Boolean);
  const ministeres = await prisma.ministere.findMany({
    where: { id: { in: ministereIds } },
    select: { id: true, nomFr: true, couleur: true, shortName: true },
  });
  const ministeresMap = {};
  for (const m of ministeres) ministeresMap[m.id] = m;

  // Compter les payes par ministere
  const payesGroupes = await prisma.soumission.groupBy({
    by: ['ministereId'],
    where: { ...where, statutPaiement: 'PAID' },
    _count: true,
  });
  const payesMap = {};
  for (const p of payesGroupes) payesMap[p.ministereId] = p._count;

  return groupes
    .map((g) => {
      const m = ministeresMap[g.ministereId] || {};
      const total = g._count || 0;
      const payes = payesMap[g.ministereId] || 0;
      return {
        ministereId: g.ministereId,
        nom: m.nomFr || 'Inconnu',
        shortName: m.shortName || null,
        montant: toNumber(g._sum?.montant),
        nombreSoumissions: total,
        tauxPaiement: total > 0 ? Math.round((payes / total) * 10000) / 100 : 0,
        couleur: m.couleur || null,
      };
    })
    .sort((a, b) => b.montant - a.montant);
}

// ═══════════════════════════════════════════════════════════════
// DETAIL MINISTERE
// ═══════════════════════════════════════════════════════════════

export async function computeMinistereDetail(ministereId, dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin, { ministereId });

  const [ministere, kpiAgg, payeAgg] = await Promise.all([
    prisma.ministere.findUnique({
      where: { id: ministereId },
      select: { id: true, nomFr: true, nomEn: true, code: true, couleur: true, shortName: true },
    }),
    prisma.soumission.aggregate({ where, _count: true, _sum: { montant: true } }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'PAID' },
      _count: true,
      _sum: { montant: true },
    }),
  ]);

  if (!ministere) return null;

  // Services du ministere
  const servicesGroupes = await prisma.soumission.groupBy({
    by: ['serviceId'],
    where: { ...where, serviceId: { not: null } },
    _count: true,
    _sum: { montant: true },
  });

  const serviceIds = servicesGroupes.map((g) => g.serviceId).filter(Boolean);
  const services = await prisma.serviceGouv.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, nomFr: true },
  });
  const servicesMap = {};
  for (const s of services) servicesMap[s.id] = s;

  const servicesDetail = servicesGroupes
    .map((g) => ({
      serviceId: g.serviceId,
      nom: servicesMap[g.serviceId]?.nomFr || 'Inconnu',
      montant: toNumber(g._sum?.montant),
      nombreSoumissions: g._count || 0,
    }))
    .sort((a, b) => b.montant - a.montant);

  // Evolution mensuelle du ministere
  const soumissions = await prisma.soumission.findMany({
    where,
    select: { montant: true, statutPaiement: true, dateSoumission: true },
    orderBy: { dateSoumission: 'asc' },
  });

  const moisMap = {};
  for (const s of soumissions) {
    if (!s.dateSoumission) continue;
    const d = new Date(s.dateSoumission);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!moisMap[key]) {
      moisMap[key] = { periode: formatMoisLabel(d), cle: key, paye: 0, enAttente: 0, echoue: 0 };
    }
    const montant = toNumber(s.montant);
    if (s.statutPaiement === 'PAID') moisMap[key].paye += montant;
    else if (s.statutPaiement === 'PENDING') moisMap[key].enAttente += montant;
    else if (s.statutPaiement === 'FAILED') moisMap[key].echoue += montant;
  }

  const totalSoumissions = kpiAgg._count || 0;
  const soumissionsPayees = payeAgg._count || 0;

  return {
    ministere,
    totalRevenus: toNumber(payeAgg._sum?.montant),
    totalSoumissions,
    soumissionsPayees,
    tauxPaiement: totalSoumissions > 0 ? Math.round((soumissionsPayees / totalSoumissions) * 10000) / 100 : 0,
    services: servicesDetail,
    evolution: Object.values(moisMap).sort((a, b) => a.cle.localeCompare(b.cle)),
  };
}

// ═══════════════════════════════════════════════════════════════
// REPARTITION PAR SERVICES
// ═══════════════════════════════════════════════════════════════

export async function computeRepartitionServices(dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin, { serviceId: { not: null } });

  const groupes = await prisma.soumission.groupBy({
    by: ['serviceId'],
    where,
    _count: true,
    _sum: { montant: true },
  });

  const serviceIds = groupes.map((g) => g.serviceId).filter(Boolean);
  const services = await prisma.serviceGouv.findMany({
    where: { id: { in: serviceIds } },
    include: { ministere: { select: { nomFr: true, couleur: true } } },
  });
  const servicesMap = {};
  for (const s of services) servicesMap[s.id] = s;

  return groupes
    .map((g) => {
      const svc = servicesMap[g.serviceId] || {};
      return {
        serviceId: g.serviceId,
        nom: svc.nomFr || 'Inconnu',
        ministereNom: svc.ministere?.nomFr || null,
        montant: toNumber(g._sum?.montant),
        nombreSoumissions: g._count || 0,
        couleur: svc.ministere?.couleur || null,
      };
    })
    .sort((a, b) => b.montant - a.montant);
}

// ═══════════════════════════════════════════════════════════════
// DETAIL SERVICE
// ═══════════════════════════════════════════════════════════════

export async function computeServiceDetail(serviceId, dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin, { serviceId });

  const [service, totalAgg, payeAgg] = await Promise.all([
    prisma.serviceGouv.findUnique({
      where: { id: serviceId },
      include: {
        ministere: { select: { id: true, nomFr: true, couleur: true } },
        domaine: { select: { id: true, nomFr: true } },
      },
    }),
    prisma.soumission.aggregate({ where, _count: true, _sum: { montant: true } }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'PAID' },
      _count: true,
      _sum: { montant: true },
    }),
  ]);

  if (!service) return null;

  // Evolution mensuelle
  const soumissions = await prisma.soumission.findMany({
    where,
    select: { montant: true, statutPaiement: true, dateSoumission: true },
    orderBy: { dateSoumission: 'asc' },
  });

  const moisMap = {};
  for (const s of soumissions) {
    if (!s.dateSoumission) continue;
    const d = new Date(s.dateSoumission);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!moisMap[key]) {
      moisMap[key] = { periode: formatMoisLabel(d), cle: key, paye: 0, enAttente: 0, echoue: 0, nombre: 0 };
    }
    moisMap[key].nombre++;
    const montant = toNumber(s.montant);
    if (s.statutPaiement === 'PAID') moisMap[key].paye += montant;
    else if (s.statutPaiement === 'PENDING') moisMap[key].enAttente += montant;
    else if (s.statutPaiement === 'FAILED') moisMap[key].echoue += montant;
  }

  // Repartition par statut
  const statutGroupes = await prisma.soumission.groupBy({
    by: ['statutPaiement'],
    where,
    _count: true,
    _sum: { montant: true },
  });

  const repartitionStatuts = statutGroupes.map((g) => ({
    statut: g.statutPaiement,
    nombre: g._count || 0,
    montant: toNumber(g._sum?.montant),
  }));

  const totalSoumissions = totalAgg._count || 0;
  const soumissionsPayees = payeAgg._count || 0;

  return {
    service: {
      id: service.id,
      nomFr: service.nomFr,
      nomEn: service.nomEn,
      montantUnitaire: toNumber(service.montant),
      ministere: service.ministere,
      domaine: service.domaine,
    },
    totalRevenus: toNumber(payeAgg._sum?.montant),
    totalSoumissions,
    soumissionsPayees,
    tauxPaiement: totalSoumissions > 0 ? Math.round((soumissionsPayees / totalSoumissions) * 10000) / 100 : 0,
    repartitionStatuts,
    evolution: Object.values(moisMap).sort((a, b) => a.cle.localeCompare(b.cle)),
  };
}

// ═══════════════════════════════════════════════════════════════
// REPARTITION PAR DOMAINES
// ═══════════════════════════════════════════════════════════════

export async function computeRepartitionDomaines(dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin, { domaineId: { not: null } });

  const groupes = await prisma.soumission.groupBy({
    by: ['domaineId'],
    where,
    _count: true,
    _sum: { montant: true },
  });

  const domaineIds = groupes.map((g) => g.domaineId).filter(Boolean);
  const domaines = await prisma.domaine.findMany({
    where: { id: { in: domaineIds } },
    select: { id: true, nomFr: true, couleur: true, icon: true },
  });
  const domainesMap = {};
  for (const d of domaines) domainesMap[d.id] = d;

  // Taux de paiement par domaine
  const payesGroupes = await prisma.soumission.groupBy({
    by: ['domaineId'],
    where: { ...where, statutPaiement: 'PAID' },
    _count: true,
  });
  const payesMap = {};
  for (const p of payesGroupes) payesMap[p.domaineId] = p._count;

  return groupes
    .map((g) => {
      const dom = domainesMap[g.domaineId] || {};
      const total = g._count || 0;
      const payes = payesMap[g.domaineId] || 0;
      return {
        domaineId: g.domaineId,
        nom: dom.nomFr || 'Inconnu',
        icon: dom.icon || null,
        montant: toNumber(g._sum?.montant),
        nombreSoumissions: total,
        tauxPaiement: total > 0 ? Math.round((payes / total) * 10000) / 100 : 0,
        couleur: dom.couleur || null,
      };
    })
    .sort((a, b) => b.montant - a.montant);
}

// ═══════════════════════════════════════════════════════════════
// DETAIL DOMAINE
// ═══════════════════════════════════════════════════════════════

export async function computeDomaineDetail(domaineId, dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin, { domaineId });

  const [domaine, totalAgg, payeAgg] = await Promise.all([
    prisma.domaine.findUnique({
      where: { id: domaineId },
      select: { id: true, nomFr: true, nomEn: true, couleur: true, icon: true },
    }),
    prisma.soumission.aggregate({ where, _count: true, _sum: { montant: true } }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'PAID' },
      _count: true,
      _sum: { montant: true },
    }),
  ]);

  if (!domaine) return null;

  // Services dans ce domaine
  const servicesGroupes = await prisma.soumission.groupBy({
    by: ['serviceId'],
    where: { ...where, serviceId: { not: null } },
    _count: true,
    _sum: { montant: true },
  });

  const serviceIds = servicesGroupes.map((g) => g.serviceId).filter(Boolean);
  const services = await prisma.serviceGouv.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, nomFr: true },
  });
  const servicesMap = {};
  for (const s of services) servicesMap[s.id] = s;

  const servicesDetail = servicesGroupes
    .map((g) => ({
      serviceId: g.serviceId,
      nom: servicesMap[g.serviceId]?.nomFr || 'Inconnu',
      montant: toNumber(g._sum?.montant),
      nombreSoumissions: g._count || 0,
    }))
    .sort((a, b) => b.montant - a.montant);

  // Evolution mensuelle
  const soumissions = await prisma.soumission.findMany({
    where,
    select: { montant: true, statutPaiement: true, dateSoumission: true },
    orderBy: { dateSoumission: 'asc' },
  });

  const moisMap = {};
  for (const s of soumissions) {
    if (!s.dateSoumission) continue;
    const d = new Date(s.dateSoumission);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!moisMap[key]) {
      moisMap[key] = { periode: formatMoisLabel(d), cle: key, paye: 0, enAttente: 0, echoue: 0 };
    }
    const montant = toNumber(s.montant);
    if (s.statutPaiement === 'PAID') moisMap[key].paye += montant;
    else if (s.statutPaiement === 'PENDING') moisMap[key].enAttente += montant;
    else if (s.statutPaiement === 'FAILED') moisMap[key].echoue += montant;
  }

  const totalSoumissions = totalAgg._count || 0;
  const soumissionsPayees = payeAgg._count || 0;

  return {
    domaine,
    totalRevenus: toNumber(payeAgg._sum?.montant),
    totalSoumissions,
    soumissionsPayees,
    tauxPaiement: totalSoumissions > 0 ? Math.round((soumissionsPayees / totalSoumissions) * 10000) / 100 : 0,
    services: servicesDetail,
    evolution: Object.values(moisMap).sort((a, b) => a.cle.localeCompare(b.cle)),
  };
}

// ═══════════════════════════════════════════════════════════════
// REPARTITION PAR ORG UNITS
// ═══════════════════════════════════════════════════════════════

export async function computeRepartitionOrgUnits(dateDebut, dateFin) {
  const where = buildSoumissionWhere(dateDebut, dateFin, { orgUnitId: { not: null } });

  const groupes = await prisma.soumission.groupBy({
    by: ['orgUnitId'],
    where,
    _count: true,
    _sum: { montant: true },
  });

  const orgUnitIds = groupes.map((g) => g.orgUnitId).filter(Boolean);
  const orgUnits = await prisma.orgUnit.findMany({
    where: { id: { in: orgUnitIds } },
    select: { id: true, nomFr: true, code: true, type: true },
  });
  const orgUnitsMap = {};
  for (const o of orgUnits) orgUnitsMap[o.id] = o;

  return groupes
    .map((g) => {
      const ou = orgUnitsMap[g.orgUnitId] || {};
      return {
        orgUnitId: g.orgUnitId,
        nom: ou.nomFr || 'Inconnu',
        code: ou.code || null,
        type: ou.type || null,
        montant: toNumber(g._sum?.montant),
        nombreSoumissions: g._count || 0,
      };
    })
    .sort((a, b) => b.montant - a.montant);
}

// ═══════════════════════════════════════════════════════════════
// TELEMETRIE REGIONS
// ═══════════════════════════════════════════════════════════════

export async function computeTelemetrieRegions(dateDebut, dateFin) {
  // Obtenir les org units de type REGION
  const regions = await prisma.orgUnit.findMany({
    where: { type: 'REGION', estActif: true },
    select: { id: true, nomFr: true, code: true, latitude: true, longitude: true },
  });

  if (regions.length === 0) return [];

  const regionIds = regions.map((r) => r.id);

  // Pour chaque region, agreger les soumissions (directes + sous-unites)
  const where = buildSoumissionWhere(dateDebut, dateFin);

  // Soumissions directement rattachees aux regions
  const directGroupes = await prisma.soumission.groupBy({
    by: ['orgUnitId'],
    where: { ...where, orgUnitId: { in: regionIds } },
    _count: true,
    _sum: { montant: true },
  });

  // Soumissions rattachees aux sous-unites des regions
  const sousUnites = await prisma.orgUnit.findMany({
    where: { parentId: { in: regionIds } },
    select: { id: true, parentId: true },
  });
  const sousUniteIds = sousUnites.map((s) => s.id);
  const sousUnitesParentMap = {};
  for (const s of sousUnites) sousUnitesParentMap[s.id] = s.parentId;

  // Egalement les sous-sous-unites (arrondissements)
  const sousSousUnites = await prisma.orgUnit.findMany({
    where: { parentId: { in: sousUniteIds } },
    select: { id: true, parentId: true },
  });
  for (const ss of sousSousUnites) {
    sousUnitesParentMap[ss.id] = sousUnitesParentMap[ss.parentId] || ss.parentId;
  }
  const tousEnfantIds = [...sousUniteIds, ...sousSousUnites.map((s) => s.id)];

  const enfantsGroupes = await prisma.soumission.groupBy({
    by: ['orgUnitId'],
    where: { ...where, orgUnitId: { in: tousEnfantIds } },
    _count: true,
    _sum: { montant: true },
  });

  // Agreger par region
  const regionAgg = {};
  for (const r of regions) {
    regionAgg[r.id] = { valeur: 0, nombreSoumissions: 0 };
  }

  for (const g of directGroupes) {
    if (regionAgg[g.orgUnitId]) {
      regionAgg[g.orgUnitId].valeur += toNumber(g._sum?.montant);
      regionAgg[g.orgUnitId].nombreSoumissions += g._count || 0;
    }
  }

  for (const g of enfantsGroupes) {
    const regionId = sousUnitesParentMap[g.orgUnitId];
    if (regionId && regionAgg[regionId]) {
      regionAgg[regionId].valeur += toNumber(g._sum?.montant);
      regionAgg[regionId].nombreSoumissions += g._count || 0;
    }
  }

  // Calculer objectif et statut
  const totalNational = Object.values(regionAgg).reduce((sum, r) => sum + r.valeur, 0);
  const objectifParRegion = regions.length > 0 ? totalNational / regions.length : 0;

  return regions
    .map((r) => {
      const agg = regionAgg[r.id] || { valeur: 0, nombreSoumissions: 0 };
      const objectif = objectifParRegion;
      const ratio = objectif > 0 ? agg.valeur / objectif : 0;
      let statut = 'danger';
      if (ratio >= 0.8) statut = 'success';
      else if (ratio >= 0.5) statut = 'attention';

      return {
        orgUnitId: r.id,
        nom: r.nomFr,
        code: r.code,
        latitude: r.latitude,
        longitude: r.longitude,
        valeur: agg.valeur,
        objectif: Math.round(objectif),
        nombreSoumissions: agg.nombreSoumissions,
        statut,
      };
    })
    .sort((a, b) => b.valeur - a.valeur);
}

// ═══════════════════════════════════════════════════════════════
// DETAIL REGION
// ═══════════════════════════════════════════════════════════════

export async function computeRegionDetail(regionCode, dateDebut, dateFin) {
  const region = await prisma.orgUnit.findFirst({
    where: { OR: [{ code: regionCode }, { id: regionCode }], type: 'REGION' },
    select: { id: true, nomFr: true, nomEn: true, code: true, latitude: true, longitude: true },
  });

  if (!region) return null;

  // Sous-unites de la region
  const sousUnites = await prisma.orgUnit.findMany({
    where: { parentId: region.id },
    select: { id: true, nomFr: true, code: true, type: true },
  });
  const sousUniteIds = sousUnites.map((s) => s.id);

  // Inclure arrondissements
  const arrondissements = await prisma.orgUnit.findMany({
    where: { parentId: { in: sousUniteIds } },
    select: { id: true, parentId: true },
  });
  const tousIds = [region.id, ...sousUniteIds, ...arrondissements.map((a) => a.id)];

  const where = buildSoumissionWhere(dateDebut, dateFin, { orgUnitId: { in: tousIds } });

  // KPI region
  const [totalAgg, payeAgg] = await Promise.all([
    prisma.soumission.aggregate({ where, _count: true, _sum: { montant: true } }),
    prisma.soumission.aggregate({
      where: { ...where, statutPaiement: 'PAID' },
      _count: true,
      _sum: { montant: true },
    }),
  ]);

  // Repartition par sous-unite
  const sousUnitesGroupes = await prisma.soumission.groupBy({
    by: ['orgUnitId'],
    where,
    _count: true,
    _sum: { montant: true },
  });

  // Map vers les departements (agglomerer les arrondissements)
  const arrParentMap = {};
  for (const a of arrondissements) arrParentMap[a.id] = a.parentId;

  const deptAgg = {};
  for (const su of sousUnites) {
    deptAgg[su.id] = { nom: su.nomFr, code: su.code, type: su.type, montant: 0, nombreSoumissions: 0 };
  }

  for (const g of sousUnitesGroupes) {
    const deptId = arrParentMap[g.orgUnitId] || g.orgUnitId;
    if (deptAgg[deptId]) {
      deptAgg[deptId].montant += toNumber(g._sum?.montant);
      deptAgg[deptId].nombreSoumissions += g._count || 0;
    }
  }

  // Services dans la region
  const servicesGroupes = await prisma.soumission.groupBy({
    by: ['serviceId'],
    where: { ...where, serviceId: { not: null } },
    _count: true,
    _sum: { montant: true },
  });

  const serviceIds = servicesGroupes.map((g) => g.serviceId).filter(Boolean);
  const services = await prisma.serviceGouv.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, nomFr: true },
  });
  const servicesMap = {};
  for (const s of services) servicesMap[s.id] = s;

  const servicesDetail = servicesGroupes
    .map((g) => ({
      serviceId: g.serviceId,
      nom: servicesMap[g.serviceId]?.nomFr || 'Inconnu',
      montant: toNumber(g._sum?.montant),
      nombreSoumissions: g._count || 0,
    }))
    .sort((a, b) => b.montant - a.montant)
    .slice(0, 20);

  // Evolution mensuelle
  const soumissions = await prisma.soumission.findMany({
    where,
    select: { montant: true, statutPaiement: true, dateSoumission: true },
    orderBy: { dateSoumission: 'asc' },
  });

  const moisMap = {};
  for (const s of soumissions) {
    if (!s.dateSoumission) continue;
    const d = new Date(s.dateSoumission);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!moisMap[key]) {
      moisMap[key] = { periode: formatMoisLabel(d), cle: key, paye: 0, enAttente: 0, echoue: 0 };
    }
    const montant = toNumber(s.montant);
    if (s.statutPaiement === 'PAID') moisMap[key].paye += montant;
    else if (s.statutPaiement === 'PENDING') moisMap[key].enAttente += montant;
    else if (s.statutPaiement === 'FAILED') moisMap[key].echoue += montant;
  }

  const totalSoumissions = totalAgg._count || 0;
  const soumissionsPayees = payeAgg._count || 0;

  return {
    region,
    totalRevenus: toNumber(payeAgg._sum?.montant),
    totalSoumissions,
    soumissionsPayees,
    tauxPaiement: totalSoumissions > 0 ? Math.round((soumissionsPayees / totalSoumissions) * 10000) / 100 : 0,
    departements: Object.entries(deptAgg)
      .map(([id, d]) => ({ orgUnitId: id, ...d }))
      .sort((a, b) => b.montant - a.montant),
    services: servicesDetail,
    evolution: Object.values(moisMap).sort((a, b) => a.cle.localeCompare(b.cle)),
  };
}

// ═══════════════════════════════════════════════════════════════
// SOUMISSIONS (liste paginee)
// ═══════════════════════════════════════════════════════════════

export async function computeSoumissions(filters = {}, pagination = {}) {
  const { dateDebut, dateFin, statut, ministereId, serviceId, domaineId, orgUnitId, recherche } = filters;
  const page = Math.max(1, parseInt(pagination.page) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(pagination.limite) || 20));
  const offset = (page - 1) * limite;

  const where = {};

  // Filtres de date
  const dateFilter = buildDateFilter(dateDebut, dateFin);
  if (dateFilter) where.dateSoumission = dateFilter;

  // Filtres par entite
  if (statut) where.statutPaiement = statut;
  if (ministereId) where.ministereId = ministereId;
  if (serviceId) where.serviceId = serviceId;
  if (domaineId) where.domaineId = domaineId;
  if (orgUnitId) where.orgUnitId = orgUnitId;

  // Recherche textuelle
  if (recherche) {
    where.OR = [
      { uniqueCode: { contains: recherche, mode: 'insensitive' } },
      { soumetteurNom: { contains: recherche, mode: 'insensitive' } },
      { soumetteurEmail: { contains: recherche, mode: 'insensitive' } },
      { soumetteurTelephone: { contains: recherche, mode: 'insensitive' } },
      { formulaireNom: { contains: recherche, mode: 'insensitive' } },
    ];
  }

  const [total, soumissions] = await Promise.all([
    prisma.soumission.count({ where }),
    prisma.soumission.findMany({
      where,
      include: {
        service: { select: { id: true, nomFr: true } },
        ministere: { select: { id: true, nomFr: true, couleur: true } },
        domaine: { select: { id: true, nomFr: true } },
        orgUnit: { select: { id: true, nomFr: true, type: true } },
      },
      orderBy: { dateSoumission: 'desc' },
      skip: offset,
      take: limite,
    }),
  ]);

  return {
    donnees: soumissions.map((s) => ({
      id: s.id,
      externalId: s.externalId,
      uniqueCode: s.uniqueCode,
      formulaireNom: s.formulaireNom,
      service: s.service,
      ministere: s.ministere,
      domaine: s.domaine,
      orgUnit: s.orgUnit,
      soumetteurNom: s.soumetteurNom,
      soumetteurEmail: s.soumetteurEmail,
      soumetteurTelephone: s.soumetteurTelephone,
      montant: toNumber(s.montant),
      statutPaiement: s.statutPaiement,
      dateSoumission: s.dateSoumission,
      datePaiement: s.datePaiement,
    })),
    pagination: {
      page,
      limite,
      total,
      totalPages: Math.ceil(total / limite),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// DETAIL SOUMISSION
// ═══════════════════════════════════════════════════════════════

export async function computeSoumissionDetail(uniqueCode) {
  const soumission = await prisma.soumission.findFirst({
    where: {
      OR: [
        { uniqueCode },
        { externalId: uniqueCode },
        { id: isNaN(parseInt(uniqueCode)) ? undefined : parseInt(uniqueCode) },
      ].filter((c) => Object.values(c)[0] !== undefined),
    },
    include: {
      service: {
        select: { id: true, nomFr: true, nomEn: true, montant: true },
      },
      ministere: {
        select: { id: true, nomFr: true, nomEn: true, code: true, couleur: true },
      },
      domaine: {
        select: { id: true, nomFr: true, nomEn: true },
      },
      orgUnit: {
        select: { id: true, nomFr: true, nomEn: true, code: true, type: true },
      },
    },
  });

  if (!soumission) return null;

  return {
    id: soumission.id,
    externalId: soumission.externalId,
    uniqueCode: soumission.uniqueCode,
    formulaireId: soumission.formulaireId,
    formulaireNom: soumission.formulaireNom,
    service: soumission.service,
    ministere: soumission.ministere,
    domaine: soumission.domaine,
    orgUnit: soumission.orgUnit,
    soumetteurNom: soumission.soumetteurNom,
    soumetteurEmail: soumission.soumetteurEmail,
    soumetteurTelephone: soumission.soumetteurTelephone,
    montant: toNumber(soumission.montant),
    statutPaiement: soumission.statutPaiement,
    dateSoumission: soumission.dateSoumission,
    datePaiement: soumission.datePaiement,
    donneesFormulaire: soumission.donneesFormulaire,
    synchroniseLe: soumission.synchroniseLe,
  };
}

// ═══════════════════════════════════════════════════════════════
// ALERTES
// ═══════════════════════════════════════════════════════════════

export async function computeAlertes() {
  const maintenant = new Date();
  const il24h = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
  const il7j = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000);

  const alertes = [];

  // 1. Paiements echoues recents (dernières 24h)
  const echouesRecents = await prisma.soumission.count({
    where: {
      statutPaiement: 'FAILED',
      dateSoumission: { gte: il24h },
    },
  });
  if (echouesRecents > 0) {
    alertes.push({
      type: 'danger',
      categorie: 'paiement_echoue',
      titre: `${echouesRecents} paiement(s) echoue(s)`,
      description: `${echouesRecents} paiement(s) echoue(s) dans les dernieres 24 heures`,
      valeur: echouesRecents,
      date: maintenant,
    });
  }

  // 2. Services sans soumission depuis 7 jours
  const servicesActifs = await prisma.serviceGouv.findMany({
    where: { estActif: true },
    select: { id: true, nomFr: true },
  });

  const servicesAvecSoumissions = await prisma.soumission.groupBy({
    by: ['serviceId'],
    where: {
      serviceId: { not: null },
      dateSoumission: { gte: il7j },
    },
  });
  const servicesActifsIds = new Set(servicesAvecSoumissions.map((s) => s.serviceId));

  const servicesSansSoumission = servicesActifs.filter((s) => !servicesActifsIds.has(s.id));
  if (servicesSansSoumission.length > 0) {
    alertes.push({
      type: 'attention',
      categorie: 'service_inactif',
      titre: `${servicesSansSoumission.length} service(s) inactif(s)`,
      description: `${servicesSansSoumission.length} service(s) sans soumission depuis 7 jours`,
      valeur: servicesSansSoumission.length,
      details: servicesSansSoumission.slice(0, 10).map((s) => s.nomFr),
      date: maintenant,
    });
  }

  // 3. Taux d'echec eleve (>10% dernières 24h)
  const total24h = await prisma.soumission.count({
    where: { dateSoumission: { gte: il24h } },
  });
  if (total24h > 0) {
    const tauxEchec = (echouesRecents / total24h) * 100;
    if (tauxEchec > 10) {
      alertes.push({
        type: 'danger',
        categorie: 'taux_echec_eleve',
        titre: `Taux d'echec eleve: ${tauxEchec.toFixed(1)}%`,
        description: `Le taux d'echec des paiements depasse 10% sur les dernieres 24h`,
        valeur: Math.round(tauxEchec * 100) / 100,
        date: maintenant,
      });
    }
  }

  // 4. Montants anormaux (soumissions avec montant 0 mais statut PAID)
  const anomalies = await prisma.soumission.count({
    where: {
      statutPaiement: 'PAID',
      montant: { lte: 0 },
      dateSoumission: { gte: il7j },
    },
  });
  if (anomalies > 0) {
    alertes.push({
      type: 'attention',
      categorie: 'anomalie_montant',
      titre: `${anomalies} anomalie(s) de montant`,
      description: `${anomalies} soumission(s) marquee(s) payee(s) avec un montant nul ou negatif`,
      valeur: anomalies,
      date: maintenant,
    });
  }

  // 5. Synchronisation echouee recente
  const derniereSync = await prisma.journalSync.findFirst({
    where: { statut: 'ECHEC' },
    orderBy: { executeLe: 'desc' },
  });
  if (derniereSync && derniereSync.executeLe > il24h) {
    alertes.push({
      type: 'danger',
      categorie: 'sync_echouee',
      titre: 'Synchronisation echouee',
      description: `Derniere erreur de synchronisation: ${derniereSync.endpoint} — ${derniereSync.messageErreur || 'Erreur inconnue'}`,
      valeur: 1,
      date: derniereSync.executeLe,
    });
  }

  return alertes;
}

// ═══════════════════════════════════════════════════════════════
// MONITORING TEMPS REEL
// ═══════════════════════════════════════════════════════════════

export async function computeMonitoring(dateDebut, dateFin) {
  const now = new Date();
  const effectiveDebut = dateDebut || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const effectiveFin = dateFin || now.toISOString();

  const where = buildSoumissionWhere(effectiveDebut, effectiveFin);

  // Repartition par statut
  const statutGroupes = await prisma.soumission.groupBy({
    by: ['statutPaiement'],
    where,
    _count: true,
    _sum: { montant: true },
  });

  const repartitionStatuts = {};
  for (const g of statutGroupes) {
    repartitionStatuts[g.statutPaiement] = {
      nombre: g._count || 0,
      montant: toNumber(g._sum?.montant),
    };
  }

  // Soumissions recentes (derniers enregistrements)
  const recentes = await prisma.soumission.findMany({
    where,
    include: {
      service: { select: { nomFr: true } },
      ministere: { select: { nomFr: true, couleur: true } },
    },
    orderBy: { dateSoumission: 'desc' },
    take: 20,
  });

  // Timeline horaire
  const soumissions = await prisma.soumission.findMany({
    where,
    select: { montant: true, statutPaiement: true, dateSoumission: true },
    orderBy: { dateSoumission: 'asc' },
  });

  const heureMap = {};
  for (const s of soumissions) {
    if (!s.dateSoumission) continue;
    const d = new Date(s.dateSoumission);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
    if (!heureMap[key]) {
      heureMap[key] = { heure: key, nombre: 0, montant: 0, echoues: 0 };
    }
    heureMap[key].nombre++;
    heureMap[key].montant += toNumber(s.montant);
    if (s.statutPaiement === 'FAILED') heureMap[key].echoues++;
  }

  // Derniere synchronisation
  const derniereSync = await prisma.journalSync.findFirst({
    orderBy: { executeLe: 'desc' },
  });

  return {
    repartitionStatuts,
    recentes: recentes.map((s) => ({
      id: s.id,
      uniqueCode: s.uniqueCode,
      soumetteurNom: s.soumetteurNom,
      serviceNom: s.service?.nomFr || null,
      ministereNom: s.ministere?.nomFr || null,
      ministereCouleur: s.ministere?.couleur || null,
      montant: toNumber(s.montant),
      statutPaiement: s.statutPaiement,
      dateSoumission: s.dateSoumission,
    })),
    timeline: Object.values(heureMap),
    derniereSync: derniereSync
      ? {
          endpoint: derniereSync.endpoint,
          statut: derniereSync.statut,
          executeLe: derniereSync.executeLe,
          dureeMs: derniereSync.dureeMs,
        }
      : null,
  };
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD COMPLET (batch)
// ═══════════════════════════════════════════════════════════════

export async function computeDashboard(dateDebut, dateFin) {
  const [kpi, evolution, ministeres, services, domaines, regions, alertes] = await Promise.all([
    computeKpi(dateDebut, dateFin),
    computeEvolution(dateDebut, dateFin),
    computeRepartitionMinisteres(dateDebut, dateFin),
    computeRepartitionServices(dateDebut, dateFin),
    computeRepartitionDomaines(dateDebut, dateFin),
    computeTelemetrieRegions(dateDebut, dateFin),
    computeAlertes(),
  ]);

  return {
    kpi,
    evolution,
    ministeres: ministeres.slice(0, 10),
    services: services.slice(0, 10),
    domaines: domaines.slice(0, 10),
    regions,
    alertes,
    genereA: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════
// RAPPORT MULTI-PERIODES
// ═══════════════════════════════════════════════════════════════

export async function computeRapport(periodes = []) {
  if (!periodes || periodes.length === 0) {
    // Par defaut: 6 derniers mois
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const debut = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      periodes.push({
        label: formatMoisLabel(debut),
        dateDebut: debut.toISOString().split('T')[0],
        dateFin: fin.toISOString().split('T')[0],
      });
    }
  }

  const resultats = [];

  for (const p of periodes) {
    const kpi = await computeKpi(p.dateDebut, p.dateFin);
    const ministeres = await computeRepartitionMinisteres(p.dateDebut, p.dateFin);

    resultats.push({
      label: p.label || `${p.dateDebut} - ${p.dateFin}`,
      dateDebut: p.dateDebut,
      dateFin: p.dateFin,
      kpi,
      topMinisteres: ministeres.slice(0, 5),
    });
  }

  // Totaux globaux
  const premierDebut = periodes[0]?.dateDebut;
  const derniereFin = periodes[periodes.length - 1]?.dateFin;
  const totaux = await computeKpi(premierDebut, derniereFin);

  return {
    periodes: resultats,
    totaux,
    genereA: new Date(),
  };
}
