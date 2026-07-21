// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Routes Explorateur de donnees
// ─────────────────────────────────────────────────────────────────────

import {
  computeDimensionsDisponibles,
  computeExploration,
  computeTableauCroise,
} from '../services/explorer.service.js';

export default async function explorerRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authentifier);

  // ═══════════════════════════════════════════════════════════════
  // GET /dimensions — liste des dimensions disponibles
  // ═══════════════════════════════════════════════════════════════

  fastify.get('/dimensions', async (request) => {
    const { service_id, formulaire_id } = request.query;
    return computeDimensionsDisponibles(service_id || null, formulaire_id || null);
  });

  // ═══════════════════════════════════════════════════════════════
  // POST /explore — agregation dynamique multi-dimensionnelle
  // ═══════════════════════════════════════════════════════════════

  fastify.post('/explore', {
    schema: {
      body: {
        type: 'object',
        required: ['group_by'],
        properties: {
          group_by: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
          mesure: { type: 'string', enum: ['count', 'sum', 'avg'], default: 'count' },
          filtres: { type: 'object' },
          limite: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
          tri: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
    },
  }, async (request) => {
    const resultats = await computeExploration(request.body);
    return { resultats, total: resultats.length };
  });

  // ═══════════════════════════════════════════════════════════════
  // POST /crosstab — tableau croise dynamique (pivot)
  // ═══════════════════════════════════════════════════════════════

  fastify.post('/crosstab', {
    schema: {
      body: {
        type: 'object',
        required: ['dim_ligne', 'dim_colonne'],
        properties: {
          dim_ligne: { type: 'string' },
          dim_colonne: { type: 'string' },
          mesure: { type: 'string', enum: ['count', 'sum'], default: 'count' },
          filtres: { type: 'object' },
        },
      },
    },
  }, async (request) => {
    return computeTableauCroise(request.body);
  });
}
