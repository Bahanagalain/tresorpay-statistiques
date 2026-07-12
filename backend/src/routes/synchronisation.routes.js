import { lancerSynchronisationComplete, getEtatSync, purgerDonnees, verifierDisponibilitePP, PP_API_URL } from '../services/synchronisation.service.js';
import prisma from '../config/prisma.js';

export default async function synchronisationRoutes(fastify) {

  fastify.addHook('preHandler', fastify.authentifier);

  // ─── POST /sync/lancer ────────────────────────────────────────────

  fastify.post('/lancer', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Lancer une synchronisation manuelle (super admin)',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async () => {
    const resultat = await lancerSynchronisationComplete();
    return { message: 'Synchronisation terminée', datas: resultat };
  });

  // ─── GET /sync/statut ─────────────────────────────────────────────

  fastify.get('/statut', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Statut de la synchronisation en cours',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const etat = getEtatSync();

    // Compteurs locaux
    const [ministeres, domaines, orgUnits, services, soumissions, plateformes, citoyens, auditLogs] = await Promise.all([
      prisma.ministere.count(),
      prisma.domaine.count(),
      prisma.orgUnit.count(),
      prisma.serviceGouv.count(),
      prisma.soumission.count(),
      prisma.plateformePartenaire.count(),
      prisma.utilisateurCitoyen.count(),
      prisma.journalAudit.count(),
    ]);

    return {
      datas: {
        ...etat,
        compteurs: { ministeres, domaines, orgUnits, services, soumissions, plateformes, citoyens, auditLogs },
      },
    };
  });

  // ─── GET /sync/journal ────────────────────────────────────────────

  fastify.get('/journal', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Journal des 50 dernières synchronisations',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const logs = await prisma.journalSync.findMany({
      orderBy: { executeLe: 'desc' },
      take: 50,
    });
    return { datas: logs };
  });

  // ─── GET /sync/derniere ───────────────────────────────────────────

  fastify.get('/derniere', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Dernière synchronisation réussie par endpoint',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const logs = await prisma.journalSync.findMany({
      where: { statut: 'SUCCES' },
      orderBy: { executeLe: 'desc' },
    });

    const parEndpoint = new Map();
    for (const log of logs) {
      if (!parEndpoint.has(log.endpoint)) parEndpoint.set(log.endpoint, log);
    }

    return { datas: [...parEndpoint.values()] };
  });

  // ─── GET /sync/configuration ──────────────────────────────────────

  fastify.get('/configuration', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Configuration de la synchronisation',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    let config = await prisma.configSync.findUnique({ where: { id: 1 } });
    if (!config) {
      config = await prisma.configSync.create({
        data: { id: 1, intervalleMs: 600000, estActive: true },
      });
    }
    return { datas: config };
  });

  // ─── PUT /sync/configuration ──────────────────────────────────────

  fastify.put('/configuration', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Modifier la configuration de synchronisation (super admin)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          intervalleMs: { type: 'integer', minimum: 60000 },
          estActive: { type: 'boolean' },
        },
      },
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async (request) => {
    const { intervalleMs, estActive } = request.body;
    const data = {};
    if (intervalleMs !== undefined) data.intervalleMs = intervalleMs;
    if (estActive !== undefined) data.estActive = estActive;

    const config = await prisma.configSync.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });

    return { message: 'Configuration mise à jour', datas: config };
  });

  // ─── GET /sync/sante ──────────────────────────────────────────────

  fastify.get('/sante', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Santé de la synchronisation — health check PP + échecs consécutifs',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const etat = getEtatSync();
    const ppDisponible = await verifierDisponibilitePP();

    // Dernière sync réussie
    let derniereSyncReussie = null;
    try {
      const config = await prisma.configSync.findUnique({ where: { id: 1 } });
      derniereSyncReussie = config?.derniereSyncComplete || null;
    } catch { /* ignore */ }

    // Calculer "fraîcheur" — temps depuis la dernière sync réussie
    const fraicheurMs = derniereSyncReussie ? Date.now() - new Date(derniereSyncReussie).getTime() : null;
    const SEUIL_ALERTE_MS = 30 * 60 * 1000; // 30 minutes sans sync = alerte

    const sante = fraicheurMs === null ? 'INCONNU'
      : (!ppDisponible || etat.echecsConsecutifs >= 3) ? 'CRITIQUE'
      : (fraicheurMs > SEUIL_ALERTE_MS || etat.echecsConsecutifs >= 1) ? 'DEGRADE'
      : 'OK';

    return {
      datas: {
        sante,
        ppDisponible,
        ppUrl: PP_API_URL,
        echecsConsecutifs: etat.echecsConsecutifs,
        dernierSucces: etat.dernierSucces,
        dernierEchec: etat.dernierEchec,
        derniereSyncReussie,
        fraicheurMinutes: fraicheurMs ? Math.round(fraicheurMs / 60000) : null,
        syncEnCours: etat.enCours,
      },
    };
  });

  // ─── POST /sync/purger ────────────────────────────────────────────

  fastify.post('/purger', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Purger les données synchronisées (super admin)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          entites: {
            type: 'array',
            items: { type: 'string' },
            description: 'Liste des entités à purger. Vide = tout purger.',
          },
        },
      },
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async (request) => {
    const { entites } = request.body || {};
    const resultat = await purgerDonnees(entites);
    return { message: 'Purge terminée', datas: resultat };
  });
}
