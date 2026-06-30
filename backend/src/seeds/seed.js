import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  TresorPay Statistiques — Peuplement initial        ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

const ROLES = [
  { code: 'DIR_STAT',     libelle: 'Directeur des Statistiques',                    niveau: 'CENTRAL',        description: 'Direction centrale des statistiques de recettes' },
  { code: 'RESP_ANALYSE', libelle: 'Responsable Analyse et Reporting',              niveau: 'CENTRAL',        description: 'Responsable des analyses et rapports nationaux' },
  { code: 'COORD_STAT',   libelle: 'Coordinateur Statistiques',                     niveau: 'CENTRAL',        description: 'Coordination des statistiques nationales' },
  { code: 'CHEF_REG',     libelle: 'Chef Statistiques Regional',                    niveau: 'REGIONAL',       description: 'Responsable statistiques de la region' },
  { code: 'ANALYSTE_REG', libelle: 'Analyste Regional',                             niveau: 'REGIONAL',       description: 'Analyste des donnees regionales' },
  { code: 'CHEF_DEP',     libelle: 'Chef Statistiques Departemental',               niveau: 'DEPARTEMENTAL',  description: 'Responsable statistiques du departement' },
  { code: 'AGENT_DEP',    libelle: 'Agent Statistiques Departemental',              niveau: 'DEPARTEMENTAL',  description: 'Agent de collecte et suivi departemental' },
];

async function seed() {
  console.log('[SEED] Insertion des roles...');
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: {},
      create: r,
    });
  }
  console.log(`  -> ${ROLES.length} roles`);

  console.log('[SEED] Creation du super administrateur...');
  const identifiant = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
  const motDePasse = process.env.SUPER_ADMIN_PASSWORD || 'Admin@2026!';
  const nomComplet = process.env.SUPER_ADMIN_FULLNAME || 'Super Administrateur';

  const existe = await prisma.utilisateur.findUnique({ where: { identifiant } });

  if (!existe) {
    const hash = bcrypt.hashSync(motDePasse, 12);
    const admin = await prisma.utilisateur.create({
      data: {
        identifiant,
        motDePasseHash: hash,
        nomComplet,
        niveau: 'CENTRAL',
        estSuperAdmin: true,
      },
    });

    const rolesCentraux = await prisma.role.findMany({ where: { niveau: 'CENTRAL' } });
    await prisma.utilisateurRole.createMany({
      data: rolesCentraux.map(r => ({ utilisateurId: admin.id, roleId: r.id })),
    });

    console.log(`  -> Super admin cree : ${identifiant} / ${motDePasse}`);
  } else {
    console.log(`  -> Super admin "${identifiant}" existe deja`);
  }

  const [roles, utilisateurs] = await Promise.all([
    prisma.role.count(),
    prisma.utilisateur.count(),
  ]);

  console.log('\n✓ Peuplement termine !\n');
  console.log('  Resume :');
  console.log(`    Roles        : ${roles}`);
  console.log(`    Utilisateurs : ${utilisateurs}`);
  console.log('');
}

seed()
  .catch((err) => {
    console.error('✗ Erreur peuplement :', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
