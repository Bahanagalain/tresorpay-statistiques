import { lancerSynchronisationComplete } from '../services/synchronisation.service.js';
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
    const resultat = await lancerSynchronisationComplete(fastify);
    return { message: 'Synchronisation terminée', datas: resultat };
  });

  // ─── GET /sync/journal ────────────────────────────────────────────

  fastify.get('/journal', {
    schema: {
      tags: ['Synchronisation'],
      summary: 'Journal des 30 dernières synchronisations',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const logs = await prisma.journalSync.findMany({
      orderBy: { executeLe: 'desc' },
      take: 30,
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
}
