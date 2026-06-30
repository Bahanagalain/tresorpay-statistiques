import prisma from '../config/prisma.js';

export default async function referentielRoutes(fastify) {

  fastify.addHook('preHandler', fastify.authentifier);

  // ─── GET /referentiel/roles ───────────────────────────────────────

  fastify.get('/roles', {
    schema: {
      tags: ['Referentiel'],
      summary: 'Liste de tous les rôles',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const roles = await prisma.role.findMany({
      orderBy: [{ niveau: 'asc' }, { libelle: 'asc' }],
    });
    return { datas: roles };
  });

  // ─── GET /referentiel/ministeres ──────────────────────────────────

  fastify.get('/ministeres', {
    schema: {
      tags: ['Referentiel'],
      summary: 'Liste des ministères',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const ministeres = await prisma.ministere.findMany({
      orderBy: [{ sortIndex: 'asc' }, { nomFr: 'asc' }],
    });
    return { datas: ministeres };
  });

  // ─── GET /referentiel/domaines ────────────────────────────────────

  fastify.get('/domaines', {
    schema: {
      tags: ['Referentiel'],
      summary: 'Liste des domaines',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const domaines = await prisma.domaine.findMany({
      orderBy: { nomFr: 'asc' },
    });
    return { datas: domaines };
  });

  // ─── GET /referentiel/services ────────────────────────────────────

  fastify.get('/services', {
    schema: {
      tags: ['Referentiel'],
      summary: 'Liste des services (filtrable par ministère et domaine)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          ministere_id: { type: 'string', description: 'Filtrer par ministère' },
          domaine_id:   { type: 'string', description: 'Filtrer par domaine' },
        },
      },
    },
  }, async (request) => {
    const { ministere_id, domaine_id } = request.query;

    const where = {};
    if (ministere_id) where.ministereId = ministere_id;
    if (domaine_id)   where.domaineId = domaine_id;

    const services = await prisma.serviceGouv.findMany({
      where,
      include: { ministere: true, domaine: true },
      orderBy: { nomFr: 'asc' },
    });

    return { datas: services };
  });

  // ─── GET /referentiel/orgUnits ────────────────────────────────────

  fastify.get('/orgUnits', {
    schema: {
      tags: ['Referentiel'],
      summary: 'Liste des unités organisationnelles (filtrable)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          parent_id:    { type: 'string', description: 'Filtrer par parent' },
          type:         { type: 'string', enum: ['ORGANIZATION', 'REGION', 'DEPARTMENT', 'ARRONDISSEMENT'], description: 'Filtrer par type' },
          ministere_id: { type: 'string', description: 'Filtrer par ministère' },
        },
      },
    },
  }, async (request) => {
    const { parent_id, type, ministere_id } = request.query;

    const where = {};
    if (parent_id)    where.parentId = parent_id;
    if (type)         where.type = type;
    if (ministere_id) where.ministereId = ministere_id;

    const orgUnits = await prisma.orgUnit.findMany({
      where,
      include: { ministere: true, parent: true },
      orderBy: { nomFr: 'asc' },
    });

    return { datas: orgUnits };
  });
}
