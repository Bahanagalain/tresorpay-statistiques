import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import prisma from '../config/prisma.js';

async function authentificationPlugin(fastify) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'tresorpay-stats-secret',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  });

  fastify.decorate('authentifier', async function (request, reply) {
    try {
      const payload = await request.jwtVerify();
      const utilisateur = await prisma.utilisateur.findFirst({
        where: { id: payload.utilisateurId, estActif: true },
        include: { roles: { include: { role: true } } },
      });
      if (!utilisateur) {
        return reply.code(401).send({ error: 'Utilisateur introuvable ou desactive' });
      }
      request.utilisateur = {
        ...utilisateur,
        roles: utilisateur.roles.map(ur => ur.role),
      };
    } catch {
      return reply.code(401).send({ error: 'Token invalide ou expire' });
    }
  });

  fastify.decorate('exigerSuperAdmin', async function (request, reply) {
    if (!request.utilisateur?.estSuperAdmin) {
      return reply.code(403).send({ error: 'Acces reserve au super administrateur' });
    }
  });

  const ORDRE_NIVEAUX = { CENTRAL: 3, REGIONAL: 2, DEPARTEMENTAL: 1 };

  fastify.decorate('exigerNiveau', function (niveauMin) {
    return async function (request, reply) {
      const rangUtilisateur = ORDRE_NIVEAUX[request.utilisateur?.niveau] || 0;
      const rangRequis = ORDRE_NIVEAUX[niveauMin] || 0;
      if (rangUtilisateur < rangRequis) {
        return reply.code(403).send({
          error: `Niveau d'habilitation insuffisant. Requis : ${niveauMin}`,
        });
      }
    };
  });
}

export default fp(authentificationPlugin);
