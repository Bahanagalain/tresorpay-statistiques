import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';

async function swaggerPlugin(fastify) {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'TresorPay Statistiques API',
        description: 'API du backend TresorPay Statistiques — Gestion des utilisateurs, synchronisation payment-platform et analytics.',
        version: '1.0.0',
      },
      servers: [
        { url: `http://localhost:${process.env.PORT || 3002}`, description: 'Serveur local' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'Authentification', description: 'Connexion, deconnexion, refresh token, profil' },
        { name: 'Utilisateurs', description: 'CRUD utilisateurs (super admin)' },
        { name: 'Referentiel', description: 'Ministeres, domaines, services, org units' },
        { name: 'Analytics', description: 'KPIs, evolutions, repartitions, soumissions' },
        { name: 'Synchronisation', description: 'Sync avec la payment-platform' },
        { name: 'Systeme', description: 'Sante, statut' },
      ],
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });
}

export default fp(swaggerPlugin);
