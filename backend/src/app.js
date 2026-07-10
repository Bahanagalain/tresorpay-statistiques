import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import swaggerPlugin from './plugins/swagger.plugin.js';
import authentificationPlugin from './plugins/authentification.plugin.js';

import { checkAndSendDailyReports, verifySmtp } from './services/email.service.js';
import authentificationRoutes from './routes/authentification.routes.js';
import utilisateursRoutes from './routes/utilisateurs.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import referentielRoutes from './routes/referentiel.routes.js';
import synchronisationRoutes from './routes/synchronisation.routes.js';
import explorerRoutes from './routes/explorer.routes.js';

import prisma from './config/prisma.js';
import { lancerSynchronisationComplete, PP_API_URL } from './services/synchronisation.service.js';

const PORT = parseInt(process.env.PORT) || 3002;
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_SYNC_INTERVAL_MS = 600_000;
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5175',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost',
  'https://stats.devinst.tresorpublic.cm',
  'https://stats-api.devinst.tresorpublic.cm',
];

function formaterIntervalle(ms) {
  if (ms % 60_000 === 0) return `${ms / 60_000} min`;
  return `${ms / 1000}s`;
}

function normalizeOrigin(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try { return new URL(trimmed).origin; } catch { return trimmed.replace(/\/+$/, ''); }
}

function parseCorsOrigins(value) {
  const defaults = DEFAULT_CORS_ORIGINS.map(normalizeOrigin).filter(Boolean);
  if (!value) return defaults;
  const origins = value.split(',').map(normalizeOrigin).filter(Boolean);
  return origins.length > 0 ? origins : defaults;
}

const ALLOWED_CORS_ORIGINS = parseCorsOrigins(process.env.CORS_ORIGINS);

const app = Fastify({
  logger: {
    level: 'info',
    transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname' } },
  },
});

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    const normalizedOrigin = normalizeOrigin(origin);
    if (ALLOWED_CORS_ORIGINS.includes('*') || ALLOWED_CORS_ORIGINS.includes(normalizedOrigin)) {
      callback(null, true); return;
    }
    app.log.warn({ origin: normalizedOrigin }, '[CORS] Origine refusee');
    callback(null, false);
  },
  credentials: true,
});

await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });
await app.register(fastifyStatic, {
  root: join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
  decorateReply: false,
});
await app.register(swaggerPlugin);
await app.register(authentificationPlugin);

await app.register(authentificationRoutes, { prefix: '/auth' });
await app.register(utilisateursRoutes,     { prefix: '/utilisateurs' });
await app.register(analyticsRoutes,        { prefix: '/analytics' });
await app.register(referentielRoutes,      { prefix: '/referentiel' });
await app.register(synchronisationRoutes,  { prefix: '/sync' });
await app.register(explorerRoutes,         { prefix: '/analytics/explorer' });

app.get('/sante', {
  schema: { tags: ['Systeme'], summary: 'Etat de sante du serveur' },
}, async () => {
  const [utilisateurs, ministeres, services, domaines, orgUnits, soumissions, plateformes, citoyens] = await Promise.all([
    prisma.utilisateur.count(),
    prisma.ministere.count(),
    prisma.serviceGouv.count(),
    prisma.domaine.count(),
    prisma.orgUnit.count(),
    prisma.soumission.count(),
    prisma.plateformePartenaire.count().catch(() => 0),
    prisma.utilisateurCitoyen.count().catch(() => 0),
  ]);

  const dernierSync = await prisma.journalSync.findFirst({
    where: { statut: 'SUCCES' },
    orderBy: { executeLe: 'desc' },
  });

  return {
    statut: 'ok',
    version: '1.1.0',
    payment_platform: PP_API_URL,
    derniere_sync: dernierSync?.executeLe || null,
    compteurs: { utilisateurs, ministeres, services, domaines, org_units: orgUnits, soumissions, plateformes, citoyens },
  };
});

try {
  await app.listen({ port: PORT, host: HOST });
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log(`║  TresorPay Statistiques API — http://localhost:${PORT}   ║`);
  console.log(`║  Swagger UI            — http://localhost:${PORT}/docs   ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Payment Platform : ${PP_API_URL}`);
  console.log(`║  Sync Pull        : toutes les ${formaterIntervalle(Number.parseInt(process.env.SYNC_INTERVAL_MS ?? '', 10) || DEFAULT_SYNC_INTERVAL_MS)}`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[CORS] Origines autorisees : ${ALLOWED_CORS_ORIGINS.join(', ')}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const SYNC_ACTIVEE = process.env.SYNC_ENABLED !== 'false';
const SYNC_INTERVALLE_MS = Number.parseInt(process.env.SYNC_INTERVAL_MS ?? '', 10) || DEFAULT_SYNC_INTERVAL_MS;
let syncEnCours = false;

if (SYNC_ACTIVEE) {
  setTimeout(() => {
    lancerSynchronisationComplete().catch(err => console.error('[SYNC] Erreur sync initiale :', err.message));
  }, 5_000);

  setInterval(async () => {
    if (syncEnCours) return;
    syncEnCours = true;
    try { await lancerSynchronisationComplete(); }
    catch (err) { console.error('[SYNC] Erreur sync :', err.message); }
    finally { syncEnCours = false; }
  }, SYNC_INTERVALLE_MS);

  console.log(`[SYNC] Synchronisation automatique activee — toutes les ${formaterIntervalle(SYNC_INTERVALLE_MS)}`);
}

const smtpOk = await verifySmtp();
if (smtpOk) {
  setInterval(() => {
    checkAndSendDailyReports().catch(err => console.error('[Email] Erreur verification:', err.message));
  }, 60_000);
  console.log('[EMAIL] Verification des rapports quotidiens activee (toutes les 60s)');
} else {
  console.log('[EMAIL] SMTP non connecte — rapports email desactives');
}

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
