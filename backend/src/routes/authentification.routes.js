import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

// ─── Rate limiting (in-memory) ──────────────────────────────────────
const loginAttempts = new Map(); // IP → { count, resetAt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 300_000);

export default async function authentificationRoutes(fastify) {

  // ─── POST /auth/login ─────────────────────────────────────────────

  fastify.post('/login', {
    schema: {
      tags: ['Authentification'],
      summary: 'Connexion utilisateur',
      body: {
        type: 'object',
        required: ['identifiant', 'mot_de_passe'],
        properties: {
          identifiant: { type: 'string', minLength: 1 },
          mot_de_passe: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { identifiant, mot_de_passe } = request.body;

    // Rate limit check
    const clientIp = request.ip;
    const limit = checkRateLimit(clientIp);
    if (!limit.allowed) {
      return reply.code(429).send({
        error: `Trop de tentatives. Réessayez dans ${limit.retryAfter} secondes.`,
        retry_after: limit.retryAfter,
      });
    }

    const utilisateur = await prisma.utilisateur.findFirst({
      where: { identifiant, estActif: true },
    });

    if (!utilisateur || !bcrypt.compareSync(mot_de_passe, utilisateur.motDePasseHash)) {
      return reply.code(401).send({ error: 'Identifiants invalides' });
    }

    const accessToken = fastify.jwt.sign({
      utilisateurId: utilisateur.id,
      identifiant: utilisateur.identifiant,
      niveau: utilisateur.niveau,
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');

    await prisma.jetonRefresh.create({
      data: {
        utilisateurId: utilisateur.id,
        jeton: refreshToken,
        expireLe: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });

    return {
      datas: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        utilisateur: {
          id: utilisateur.id,
          identifiant: utilisateur.identifiant,
          nom_complet: utilisateur.nomComplet,
          email: utilisateur.email,
          telephone: utilisateur.telephone,
          niveau: utilisateur.niveau,
          est_super_admin: utilisateur.estSuperAdmin,
        },
      },
      message: 'Connexion réussie',
    };
  });

  // ─── POST /auth/refresh ───────────────────────────────────────────

  fastify.post('/refresh', {
    schema: {
      tags: ['Authentification'],
      summary: 'Rafraîchir le token',
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { refresh_token } = request.body;

    const stored = await prisma.jetonRefresh.findUnique({
      where: { jeton: refresh_token },
      include: { utilisateur: true },
    });

    if (!stored || !stored.utilisateur.estActif) {
      return reply.code(401).send({ error: 'Refresh token invalide' });
    }

    if (stored.expireLe < new Date()) {
      await prisma.jetonRefresh.delete({ where: { id: stored.id } });
      return reply.code(401).send({ error: 'Refresh token expiré' });
    }

    // Supprimer l'ancien et créer un nouveau
    await prisma.jetonRefresh.delete({ where: { id: stored.id } });

    const accessToken = fastify.jwt.sign({
      utilisateurId: stored.utilisateur.id,
      identifiant: stored.utilisateur.identifiant,
      niveau: stored.utilisateur.niveau,
    });

    const newRefreshToken = crypto.randomBytes(64).toString('hex');

    await prisma.jetonRefresh.create({
      data: {
        utilisateurId: stored.utilisateur.id,
        jeton: newRefreshToken,
        expireLe: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });

    return {
      datas: {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
      },
    };
  });

  // ─── POST /auth/logout ────────────────────────────────────────────

  fastify.post('/logout', {
    schema: {
      tags: ['Authentification'],
      summary: 'Déconnexion',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          refresh_token: { type: 'string' },
        },
      },
    },
    preHandler: [fastify.authentifier],
  }, async (request) => {
    const { refresh_token } = request.body || {};

    if (refresh_token) {
      await prisma.jetonRefresh.deleteMany({
        where: { jeton: refresh_token, utilisateurId: request.utilisateur.id },
      });
    } else {
      await prisma.jetonRefresh.deleteMany({
        where: { utilisateurId: request.utilisateur.id },
      });
    }

    return { message: 'Déconnexion réussie' };
  });

  // ─── GET /auth/me ─────────────────────────────────────────────────

  fastify.get('/me', {
    schema: {
      tags: ['Authentification'],
      summary: 'Profil de l\'utilisateur connecté',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authentifier],
  }, async (request) => {
    const u = await prisma.utilisateur.findUnique({
      where: { id: request.utilisateur.id },
      include: {
        ministere: true,
        orgUnit: { include: { ministere: true } },
      },
    });

    return {
      datas: {
        id: u.id,
        identifiant: u.identifiant,
        nom_complet: u.nomComplet,
        email: u.email,
        telephone: u.telephone,
        photo_url: u.photoUrl,
        sexe: u.sexe,
        email_verifie: u.emailVerifie,
        rapport_quotidien: u.rapportQuotidien,
        heure_rapport: u.heureRapport,
        niveau: u.niveau,
        est_super_admin: u.estSuperAdmin,
        ministere: u.ministere,
        orgUnit: u.orgUnit,
      },
    };
  });

  // ─── PUT /auth/me/profile ──────────────────────────────────────────

  fastify.put('/me/profile', {
    schema: {
      tags: ['Authentification'],
      summary: 'Modifier son profil',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authentifier],
  }, async (request, reply) => {
    const { email, telephone, sexe, rapport_quotidien, heure_rapport } = request.body || {};
    const data = {};
    if (telephone !== undefined) data.telephone = telephone || null;
    if (sexe !== undefined) data.sexe = sexe || null;
    if (rapport_quotidien !== undefined) data.rapportQuotidien = !!rapport_quotidien;
    if (heure_rapport !== undefined) data.heureRapport = heure_rapport || null;

    // Email change: requires verification
    if (email !== undefined) {
      const currentUser = await prisma.utilisateur.findUnique({ where: { id: request.utilisateur.id } });
      if (!currentUser) return reply.code(401).send({ error: 'Utilisateur non trouvé' });
      if (email && email !== currentUser.email) {
        // New email → send verification code
        const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
        data.email = email;
        data.emailVerifie = false;
        data.codeVerifEmail = code;
        data.codeVerifExpire = new Date(Date.now() + 15 * 60 * 1000); // 15min

        // Send verification email
        try {
          const { sendVerificationEmail } = await import('../services/email.service.js');
          await sendVerificationEmail(email, code);
        } catch (err) {
          fastify.log.error('Failed to send verification email:', err.message);
          delete data.email;
          delete data.emailVerifie;
          delete data.codeVerifEmail;
          delete data.codeVerifExpire;
          return reply.code(502).send({ error: `Impossible d'envoyer l'email de vérification: ${err.message}` });
        }
      } else if (!email) {
        data.email = null;
        data.emailVerifie = false;
        data.codeVerifEmail = null;
      }
    }

    await prisma.utilisateur.update({ where: { id: request.utilisateur.id }, data });
    return { message: 'Profil mis à jour', email_verification_needed: !!data.codeVerifEmail };
  });

  // ─── POST /auth/me/verify-email ───────────────────────────────────

  fastify.post('/me/verify-email', {
    schema: {
      tags: ['Authentification'],
      summary: 'Vérifier l\'email avec un code',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authentifier],
  }, async (request, reply) => {
    const { code } = request.body || {};
    if (!code) return reply.code(400).send({ error: 'Code requis' });

    const user = await prisma.utilisateur.findUnique({ where: { id: request.utilisateur.id } });
    if (!user.codeVerifEmail) return reply.code(400).send({ error: 'Aucune vérification en cours' });
    if (user.codeVerifExpire && new Date() > user.codeVerifExpire) return reply.code(400).send({ error: 'Code expiré, veuillez renvoyer un email' });
    if (user.codeVerifEmail !== code) return reply.code(400).send({ error: 'Code incorrect' });

    await prisma.utilisateur.update({
      where: { id: request.utilisateur.id },
      data: { emailVerifie: true, codeVerifEmail: null, codeVerifExpire: null },
    });

    // Send test report immediately with current day's data
    try {
      const { sendDailyReport } = await import('../services/email.service.js');
      await sendDailyReport(user, { period: 'current_day', isTest: true });
    } catch (err) {
      fastify.log.error('Failed to send test report after verification:', err.message);
    }

    return { message: 'Email vérifié avec succès. Un rapport test de la journée en cours a été envoyé.' };
  });

  // ─── POST /auth/me/resend-verification ────────────────────────────

  fastify.post('/me/resend-verification', {
    schema: {
      tags: ['Authentification'],
      summary: 'Renvoyer le code de vérification email',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authentifier],
  }, async (request, reply) => {
    const user = await prisma.utilisateur.findUnique({ where: { id: request.utilisateur.id } });
    if (!user) return reply.code(401).send({ error: 'Utilisateur non trouvé' });
    if (!user.email) return reply.code(400).send({ error: 'Aucun email configuré' });
    if (user.emailVerifie) return reply.code(400).send({ error: 'Email déjà vérifié' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.utilisateur.update({
      where: { id: request.utilisateur.id },
      data: { codeVerifEmail: code, codeVerifExpire: new Date(Date.now() + 15 * 60 * 1000) },
    });

    try {
      const { sendVerificationEmail } = await import('../services/email.service.js');
      await sendVerificationEmail(user.email, code);
    } catch (err) {
      fastify.log.error('Failed to resend verification email:', err.message);
      return reply.code(502).send({ error: `Impossible d'envoyer l'email: ${err.message}` });
    }

    return { message: 'Code de vérification renvoyé' };
  });

  // ─── POST /auth/me/test-report ────────────────────────────────────

  fastify.post('/me/test-report', {
    schema: {
      tags: ['Authentification'],
      summary: 'Envoyer un rapport test',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authentifier],
  }, async (request, reply) => {
    const user = await prisma.utilisateur.findUnique({ where: { id: request.utilisateur.id } });
    if (!user) return reply.code(401).send({ error: 'Utilisateur non trouvé' });
    if (!user.email) return reply.code(400).send({ error: 'Aucun email configuré' });
    if (!user.emailVerifie) return reply.code(400).send({ error: 'Votre email doit être vérifié' });

    try {
      const { sendDailyReport } = await import('../services/email.service.js');
      await sendDailyReport(user, { period: 'current_day', isTest: true });
    } catch (err) {
      fastify.log.error('Failed to send test report:', err.message);
      return reply.code(502).send({ error: `Impossible d'envoyer le rapport: ${err.message}` });
    }

    return { message: 'Rapport test de la journée en cours envoyé à ' + user.email };
  });

  // ─── PUT /auth/me/photo ───────────────────────────────────────────

  fastify.put('/me/photo', {
    schema: {
      tags: ['Authentification'],
      summary: 'Mettre à jour la photo de profil',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authentifier],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'Aucun fichier envoyé' });

    const ext = data.filename.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return reply.code(400).send({ error: 'Format non supporté (jpg, png, webp uniquement)' });
    }

    const { createWriteStream } = await import('fs');
    const { join } = await import('path');
    const { pipeline } = await import('stream/promises');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const fileName = `user_${request.utilisateur.id}_${Date.now()}.${ext}`;
    const filePath = join(__dirname, '..', '..', 'uploads', 'photos', fileName);

    await pipeline(data.file, createWriteStream(filePath));

    const photoUrl = `/uploads/photos/${fileName}`;
    await prisma.utilisateur.update({
      where: { id: request.utilisateur.id },
      data: { photoUrl },
    });

    return { datas: { photo_url: photoUrl }, message: 'Photo mise à jour' };
  });

  // ─── GET /auth/me/access ──────────────────────────────────────────

  fastify.get('/me/access', {
    schema: {
      tags: ['Authentification'],
      summary: 'Modèle d\'accès de l\'utilisateur connecté',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authentifier],
  }, async (request) => {
    const u = request.utilisateur;

    const rolesResult = await prisma.utilisateurRole.findMany({
      where: { utilisateurId: u.id },
      include: { role: true },
    });
    const roles = rolesResult.map(ur => ur.role);

    const privileges = new Set();
    if (u.estSuperAdmin) {
      ['SUPER_ADMIN', 'GERER_UTILISATEURS', 'VOIR_TOUT', 'SYNCHRONISER', 'EXPORTER'].forEach(p => privileges.add(p));
    }
    if (u.niveau === 'CENTRAL')        ['VOIR_TOUT', 'EXPORTER', 'VOIR_NATIONAL'].forEach(p => privileges.add(p));
    if (u.niveau === 'REGIONAL')       ['VOIR_REGIONAL', 'EXPORTER'].forEach(p => privileges.add(p));
    if (u.niveau === 'DEPARTEMENTAL')  privileges.add('VOIR_DEPARTEMENTAL');

    return {
      datas: {
        roles,
        privileges_effectifs: [...privileges],
      },
    };
  });
}
