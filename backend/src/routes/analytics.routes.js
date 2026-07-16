import {
  computeKpi,
  computeEvolution,
  computeRepartitionMinisteres,
  computeMinistereDetail,
  computeMinistereComparison,
  computeRepartitionServices,
  computeServiceDetail,
  computeRepartitionDomaines,
  computeDomaineDetail,
  computeRepartitionOrgUnits,
  computeOrgUnitDetail,
  computeTelemetrieRegions,
  computeRegionDetail,
  computeSoumissions,
  computeSoumissionDetail,
  computeAlertes,
  computeMonitoring,
  computeDashboard,
  computeRapport,
  computePartenaires,
  computePartenaireDetail,
  computeCitoyens,
  computeAudit,
} from '../services/computation.service.js';
import prisma from '../config/prisma.js';

function extractScope(utilisateur) {
  if (!utilisateur) return {};
  if (utilisateur.estSuperAdmin) return {}; // Super admin sees everything
  return {
    niveau: utilisateur.niveau,
    ministereId: utilisateur.ministereId || null,
    orgUnitId: utilisateur.orgUnitId || null,
  };
}

export default async function analyticsRoutes(fastify) {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authentifier);

  // ─── Cache-Control on analytics responses (10 min) ───
  fastify.addHook('onSend', (request, reply, payload, done) => {
    if (!reply.hasHeader('cache-control')) {
      reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=120');
    }
    done(null, payload);
  });

  // ─── Dashboard Bulk (1 call instead of 6) ───────────
  fastify.get('/dashboard', {
    schema: {
      tags: ['Analytics'],
      summary: 'Dashboard complet (KPI + évolution + répartitions)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const scope = extractScope(request.utilisateur);
    const data = await computeDashboard(date_debut || null, date_fin || null, scope);
    return { datas: data, message: 'Dashboard récupéré avec succès' };
  });

  // ─── KPI ─────────────────────────────────────────────
  fastify.get('/kpi', {
    schema: {
      tags: ['Analytics'],
      summary: 'Indicateurs clés de performance',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const scope = extractScope(request.utilisateur);
    const data = await computeKpi(date_debut || null, date_fin || null, scope);
    return { datas: data, message: 'KPI calculés avec succès' };
  });

  // ─── Evolution ───────────────────────────────────────
  fastify.get('/evolution', {
    schema: {
      tags: ['Analytics'],
      summary: 'Évolution temporelle des paiements',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const scope = extractScope(request.utilisateur);
    const data = await computeEvolution(date_debut || null, date_fin || null, scope);
    return { datas: data, message: 'Évolution calculée avec succès' };
  });

  // ─── Répartition par ministère ───────────────────────
  fastify.get('/repartition/ministeres', {
    schema: {
      tags: ['Analytics'],
      summary: 'Répartition par ministère',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const scope = extractScope(request.utilisateur);
    const data = await computeRepartitionMinisteres(date_debut || null, date_fin || null, scope);
    return { datas: data, message: 'Répartition ministères calculée avec succès' };
  });

  // ─── Ministère drill-down ────────────────────────────
  fastify.get('/repartition/ministeres/:id', {
    schema: {
      tags: ['Analytics'],
      summary: 'Détail d\'un ministère (drill-down)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params;
    const { date_debut, date_fin } = request.query;
    const data = await computeMinistereDetail(id, date_debut || null, date_fin || null);
    return { datas: data, message: 'Détail ministère récupéré avec succès' };
  });

  // ─── Ministère comparison ────────────────────────────
  fastify.get('/repartition/ministeres/:id/comparison', {
    schema: {
      tags: ['Analytics'],
      summary: 'Comparaison temporelle d\'un ministère',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params;
    const { date_debut, date_fin } = request.query;
    const data = await computeMinistereComparison(id, date_debut || null, date_fin || null);
    return { datas: data, message: 'Comparaison ministère récupérée' };
  });

  // ─── Répartition par service ─────────────────────────
  fastify.get('/repartition/services', {
    schema: {
      tags: ['Analytics'],
      summary: 'Répartition par service',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const data = await computeRepartitionServices(date_debut || null, date_fin || null);
    return { datas: data, message: 'Répartition services calculée avec succès' };
  });

  // ─── Service drill-down ──────────────────────────────
  fastify.get('/repartition/services/:id', {
    schema: {
      tags: ['Analytics'],
      summary: 'Détail d\'un service (drill-down)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params;
    const { date_debut, date_fin } = request.query;
    const data = await computeServiceDetail(id, date_debut || null, date_fin || null);
    return { datas: data, message: 'Détail service récupéré avec succès' };
  });

  // ─── Répartition par domaine ─────────────────────────
  fastify.get('/repartition/domaines', {
    schema: {
      tags: ['Analytics'],
      summary: 'Répartition par domaine',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const data = await computeRepartitionDomaines(date_debut || null, date_fin || null);
    return { datas: data, message: 'Répartition domaines calculée avec succès' };
  });

  // ─── Domaine drill-down ──────────────────────────────
  fastify.get('/repartition/domaines/:id', {
    schema: {
      tags: ['Analytics'],
      summary: 'Détail d\'un domaine (drill-down)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params;
    const { date_debut, date_fin } = request.query;
    const data = await computeDomaineDetail(id, date_debut || null, date_fin || null);
    return { datas: data, message: 'Détail domaine récupéré avec succès' };
  });

  // ─── Répartition par org unit ────────────────────────
  fastify.get('/repartition/orgUnits', {
    schema: {
      tags: ['Analytics'],
      summary: 'Répartition par unité organisationnelle',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const data = await computeRepartitionOrgUnits(date_debut || null, date_fin || null);
    return { datas: data, message: 'Répartition org units calculée avec succès' };
  });

  // ─── Org unit drill-down ─────────────────────────────
  fastify.get('/repartition/orgUnits/:id', {
    schema: {
      tags: ['Analytics'],
      summary: 'Détail d\'une unité organisationnelle (drill-down)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params;
    const { date_debut, date_fin } = request.query;
    const data = await computeOrgUnitDetail(id, date_debut || null, date_fin || null);
    return { datas: data, message: 'Détail org unit récupéré avec succès' };
  });

  // ─── Télémétrie régionale ────────────────────────────
  fastify.get('/telemetrie/regions', {
    schema: {
      tags: ['Analytics'],
      summary: 'Télémétrie régionale',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const data = await computeTelemetrieRegions(date_debut || null, date_fin || null);
    return { datas: data, message: 'Télémétrie régionale calculée avec succès' };
  });

  // ─── Région detail ───────────────────────────────────
  fastify.get('/telemetrie/regions/:code', {
    schema: {
      tags: ['Analytics'],
      summary: 'Détail d\'une région',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { code } = request.params;
    const { date_debut, date_fin } = request.query;
    const data = await computeRegionDetail(decodeURIComponent(code), date_debut || null, date_fin || null);
    return { datas: data, message: 'Détail région récupéré avec succès' };
  });

  // ─── Soumissions (paginées) ──────────────────────────
  fastify.get('/soumissions', {
    schema: {
      tags: ['Analytics'],
      summary: 'Liste paginée des soumissions',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page:         { type: 'integer', minimum: 1, default: 1 },
          limite:       { type: 'integer', minimum: 1, maximum: 500, default: 20 },
          search:       { type: 'string' },
          statut:       { type: 'string', enum: ['PAID', 'PENDING', 'PARTIAL', 'FAILED'] },
          ministere_id: { type: 'string' },
          service_id:   { type: 'string' },
          domaine_id:   { type: 'string' },
          date_debut:   { type: 'string', format: 'date' },
          date_fin:     { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { page = 1, limite = 20, search, statut, ministere_id, service_id, domaine_id, date_debut, date_fin } = request.query;
    const data = await computeSoumissions(
      {
        recherche: search || undefined,
        statut: statut || undefined,
        ministereId: ministere_id || undefined,
        serviceId: service_id || undefined,
        domaineId: domaine_id || undefined,
        dateDebut: date_debut || undefined,
        dateFin: date_fin || undefined,
      },
      { page: Number(page), limite: Number(limite) },
    );
    return {
      datas: { donnees: data.donnees, pagination: data.pagination },
      message: 'Soumissions récupérées avec succès',
    };
  });

  // ─── Soumission detail ───────────────────────────────
  fastify.get('/soumissions/:code', {
    schema: {
      tags: ['Analytics'],
      summary: 'Détail d\'une soumission par code unique',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
  }, async (request, reply) => {
    const { code } = request.params;
    const data = await computeSoumissionDetail(code);
    if (!data) return reply.code(404).send({ error: 'Soumission introuvable' });
    return { datas: data, message: 'Détail soumission récupéré' };
  });

  // ─── Alertes ─────────────────────────────────────────
  fastify.get('/alertes', {
    schema: {
      tags: ['Analytics'],
      summary: 'Anomalies et alertes',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const data = await computeAlertes();
    return { datas: data, message: 'Alertes calculées avec succès' };
  });

  // ─── Monitoring ──────────────────────────────────────
  fastify.get('/monitoring', {
    schema: {
      tags: ['Analytics'],
      summary: 'Monitoring des paiements',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const data = await computeMonitoring();
    return { datas: data, message: 'Monitoring récupéré avec succès' };
  });

  // ─── Rapport multi-période ───────────────────────────
  fastify.post('/rapport', {
    schema: {
      tags: ['Analytics'],
      summary: 'Génération de rapport multi-période',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['periodes'],
        properties: {
          periodes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['debut', 'fin'],
              properties: {
                debut: { type: 'string', format: 'date' },
                fin:   { type: 'string', format: 'date' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { periodes } = request.body || {};
    if (!Array.isArray(periodes) || periodes.length === 0) {
      return reply.code(400).send({ error: 'Le champ "periodes" est requis (tableau de {debut, fin})' });
    }
    const data = await computeRapport(periodes);
    return { datas: data, message: 'Rapport généré avec succès' };
  });

  // ─── Partenaires ────────────────────────────────────
  fastify.get('/partenaires', { schema: { tags: ['Analytics'], summary: 'Statistiques plateformes partenaires', security: [{ bearerAuth: [] }], querystring: { type: 'object', properties: { date_debut: { type: 'string', format: 'date' }, date_fin: { type: 'string', format: 'date' } } } } }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const data = await computePartenaires(date_debut || null, date_fin || null);
    return { datas: data, message: 'Partenaires récupérés' };
  });

  fastify.get('/partenaires/:id', { schema: { tags: ['Analytics'], summary: 'Détail plateforme partenaire', security: [{ bearerAuth: [] }], params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, querystring: { type: 'object', properties: { date_debut: { type: 'string', format: 'date' }, date_fin: { type: 'string', format: 'date' } } } } }, async (request, reply) => {
    const { id } = request.params;
    const { date_debut, date_fin } = request.query;
    const data = await computePartenaireDetail(id, date_debut || null, date_fin || null);
    if (!data) return reply.code(404).send({ error: 'Plateforme introuvable' });
    return { datas: data, message: 'Détail partenaire récupéré' };
  });

  // ─── Citoyens ───────────────────────────────────────
  fastify.get('/citoyens', { schema: { tags: ['Analytics'], summary: 'Statistiques citoyens', security: [{ bearerAuth: [] }], querystring: { type: 'object', properties: { date_debut: { type: 'string', format: 'date' }, date_fin: { type: 'string', format: 'date' } } } } }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const data = await computeCitoyens(date_debut || null, date_fin || null);
    return { datas: data, message: 'Citoyens récupérés' };
  });

  // ─── Audit ──────────────────────────────────────────
  fastify.get('/audit', { schema: { tags: ['Analytics'], summary: 'Statistiques audit', security: [{ bearerAuth: [] }], querystring: { type: 'object', properties: { date_debut: { type: 'string', format: 'date' }, date_fin: { type: 'string', format: 'date' } } } } }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const data = await computeAudit(date_debut || null, date_fin || null);
    return { datas: data, message: 'Audit récupéré' };
  });

  // ─── Mon périmètre ─────────────────────────────────
  fastify.get('/mon-perimetre', {
    schema: {
      tags: ['Analytics'],
      summary: 'Dashboard scopé au périmètre de l\'utilisateur',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', format: 'date' },
          date_fin:   { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const { date_debut, date_fin } = request.query;
    const scope = extractScope(request.utilisateur);
    const u = request.utilisateur;

    const result = {
      perimetre: {
        niveau: u.niveau,
        ministereId: u.ministereId || null,
        orgUnitId: u.orgUnitId || null,
        ministereNom: null,
        orgUnitNom: null,
      },
    };

    // Resolve names
    if (u.ministereId) {
      const m = await prisma.ministere.findUnique({ where: { id: parseInt(u.ministereId) }, select: { nomFr: true } });
      result.perimetre.ministereNom = m?.nomFr || null;
    }
    if (u.orgUnitId) {
      const o = await prisma.orgUnit.findUnique({ where: { id: parseInt(u.orgUnitId) }, select: { nomFr: true } });
      result.perimetre.orgUnitNom = o?.nomFr || null;
    }

    // Get scoped KPI + evolution
    const [kpi, evolution] = await Promise.all([
      computeKpi(date_debut || null, date_fin || null, scope),
      computeEvolution(date_debut || null, date_fin || null, scope),
    ]);

    result.kpi = kpi;
    result.evolution = evolution;

    return { datas: result };
  });
}
