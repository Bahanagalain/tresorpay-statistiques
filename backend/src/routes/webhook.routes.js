// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Routes Webhook (réception events du PP)
// Pas d'auth JWT — protégé par signature HMAC
// ─────────────────────────────────────────────────────────────────────

import { verifierSignature, traiterEvent } from '../services/webhook.service.js';
import prisma from '../config/prisma.js';

export default async function webhookRoutes(fastify) {

  // ─── POST /webhook/events ──────────────────────────────────────────

  fastify.post('/events', {
    schema: {
      tags: ['Webhook'],
      summary: 'Réception des events du payment-platform (HMAC)',
      body: {
        type: 'object',
        required: ['eventId', 'eventType', 'aggregateType', 'aggregateId', 'payload'],
        properties: {
          eventId: { type: 'string' },
          eventType: { type: 'string' },
          aggregateType: { type: 'string' },
          aggregateId: { type: 'string' },
          payload: { type: 'object' },
          emittedAt: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const signature = request.headers['x-webhook-signature'];
    const timestamp = request.headers['x-webhook-timestamp'];
    const eventId = request.headers['x-webhook-event-id'];

    // 1. Vérifier signature HMAC
    const rawBody = JSON.stringify(request.body);
    if (!verifierSignature(signature, timestamp, rawBody)) {
      return reply.status(401).send({ error: 'Signature invalide' });
    }

    // 2. Idempotence : vérifier si eventId déjà traité
    const existing = await prisma.webhookInbox.findUnique({ where: { id: eventId } });
    if (existing) {
      return reply.status(200).send({ status: 'already_processed', eventId });
    }

    // 3. Traiter l'event
    const { eventType, aggregateType, aggregateId, payload } = request.body;

    try {
      await traiterEvent(request.body);

      // 4. Enregistrer dans inbox (confirmation de traitement)
      await prisma.webhookInbox.create({
        data: {
          id: eventId,
          eventType,
          aggregateType,
          aggregateId,
          payload: payload || {},
          status: 'PROCESSED',
        },
      });

      console.log(`[WEBHOOK] ✓ ${eventType} ${aggregateId}`);
      return reply.status(200).send({ status: 'processed', eventId });

    } catch (err) {
      // Enregistrer l'échec dans inbox pour traçabilité
      try {
        await prisma.webhookInbox.create({
          data: {
            id: eventId,
            eventType,
            aggregateType,
            aggregateId,
            payload: payload || {},
            status: 'FAILED',
            errorMessage: err.message?.substring(0, 500),
          },
        });
      } catch { /* ignore si déjà existant */ }

      console.error(`[WEBHOOK] ✗ ${eventType} ${aggregateId}: ${err.message}`);
      // Retourner 500 pour que le PP retry
      return reply.status(500).send({ error: err.message });
    }
  });

  // ─── GET /webhook/stats ──────────────────────────────────────────────

  fastify.get('/stats', {
    schema: {
      tags: ['Webhook'],
      summary: 'Statistiques des webhooks reçus',
    },
  }, async () => {
    const [total, processed, failed, recent] = await Promise.all([
      prisma.webhookInbox.count(),
      prisma.webhookInbox.count({ where: { status: 'PROCESSED' } }),
      prisma.webhookInbox.count({ where: { status: 'FAILED' } }),
      prisma.webhookInbox.findMany({
        orderBy: { processedAt: 'desc' },
        take: 10,
        select: { id: true, eventType: true, aggregateId: true, status: true, processedAt: true },
      }),
    ]);

    return {
      datas: { total, processed, failed, recent },
    };
  });
}
