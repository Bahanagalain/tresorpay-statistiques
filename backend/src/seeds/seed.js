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

  // ═══════════════════════════════════════════════════════════════
  // SEED BI: INDICATEURS METIER PRE-CONFIGURES
  // ═══════════════════════════════════════════════════════════════

  console.log('[SEED] Creation des indicateurs metier...');

  // Find admin user for ownership
  const adminUser = await prisma.utilisateur.findFirst({ where: { estSuperAdmin: true } });
  if (!adminUser) {
    console.warn('  -> Pas de super admin trouve, skip BI seed');
  } else {
    // Find datasets
    const datasetSoumissions = await prisma.biDataset.findUnique({ where: { code: 'soumissions' } });
    const datasetPartenaires = await prisma.biDataset.findUnique({ where: { code: 'demandes_partenaire' } });

    if (datasetSoumissions) {
      const INDICATEURS = [
        {
          code: 'taux_paiement',
          libelle: 'Taux de paiement',
          description: 'Pourcentage de soumissions effectivement payées',
          datasetId: datasetSoumissions.id,
          typeMesure: 'RATIO',
          filtresDefaut: { statut_paiement: 'PAID' },
          formatAffichage: 'POURCENTAGE',
          estSysteme: true,
          createurId: adminUser.id,
        },
        {
          code: 'total_encaisse',
          libelle: 'Total encaissé',
          description: 'Montant total des paiements reçus (PAID + PARTIAL)',
          datasetId: datasetSoumissions.id,
          typeMesure: 'SUM',
          colonneMesure: 'montant',
          filtresDefaut: { statut_paiement: ['PAID', 'PARTIAL'] },
          formatAffichage: 'MONTANT',
          estSysteme: true,
          createurId: adminUser.id,
        },
        {
          code: 'total_soumissions',
          libelle: 'Total soumissions',
          description: 'Nombre total de soumissions sur la période',
          datasetId: datasetSoumissions.id,
          typeMesure: 'COUNT',
          formatAffichage: 'ENTIER',
          estSysteme: true,
          createurId: adminUser.id,
        },
        {
          code: 'montant_moyen',
          libelle: 'Montant moyen par soumission',
          description: 'Montant moyen des soumissions',
          datasetId: datasetSoumissions.id,
          typeMesure: 'AVG',
          colonneMesure: 'montant',
          formatAffichage: 'MONTANT',
          estSysteme: true,
          createurId: adminUser.id,
        },
        {
          code: 'soumissions_en_attente',
          libelle: 'Soumissions en attente',
          description: 'Nombre de soumissions non encore payées',
          datasetId: datasetSoumissions.id,
          typeMesure: 'COUNT',
          filtresDefaut: { statut_paiement: 'PENDING' },
          formatAffichage: 'ENTIER',
          estSysteme: true,
          createurId: adminUser.id,
        },
        {
          code: 'soumissions_echouees',
          libelle: 'Soumissions échouées',
          description: 'Nombre de paiements en échec',
          datasetId: datasetSoumissions.id,
          typeMesure: 'COUNT',
          filtresDefaut: { statut_paiement: 'FAILED' },
          formatAffichage: 'ENTIER',
          estSysteme: true,
          createurId: adminUser.id,
        },
        {
          code: 'couverture_services',
          libelle: 'Couverture des services',
          description: 'Nombre de services ayant reçu au moins une soumission',
          datasetId: datasetSoumissions.id,
          typeMesure: 'COUNT',
          colonneMesure: 'service',
          formatAffichage: 'ENTIER',
          estSysteme: true,
          createurId: adminUser.id,
        },
        {
          code: 'concentration_recettes',
          libelle: 'Concentration des recettes',
          description: 'Part du montant total générée par le top 5 services',
          datasetId: datasetSoumissions.id,
          typeMesure: 'CUSTOM',
          formatAffichage: 'POURCENTAGE',
          estSysteme: true,
          createurId: adminUser.id,
        },
      ];

      let indicCreated = 0;
      for (const ind of INDICATEURS) {
        try {
          await prisma.biIndicateur.upsert({
            where: { code: ind.code },
            update: {},
            create: ind,
          });
          indicCreated++;
        } catch (e) {
          // Skip if foreign key issue or duplicate
        }
      }
      console.log(`  -> ${indicCreated} indicateurs metier`);
    } else {
      console.log('  -> Dataset soumissions introuvable, indicateurs ignores');
    }

    // ═══════════════════════════════════════════════════════════════
    // SEED BI: DASHBOARDS PRE-CONFIGURES
    // ═══════════════════════════════════════════════════════════════

    console.log('[SEED] Creation des dashboards pre-configures...');

    const DASHBOARDS = [
      {
        code: 'tpl-direction-generale',
        titre: 'Vue Direction Générale',
        description: 'Tableau de bord stratégique — KPI nationaux, tendances, top ministères',
        visibilite: 'PUBLIC',
        proprietaireId: adminUser.id,
        widgets: datasetSoumissions ? [
          { titre: 'Total encaissé', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'SUM', colonne: 'montant', filtres: { statut_paiement: ['PAID', 'PARTIAL'] } }, gridX: 0, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'Soumissions', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT' }, gridX: 3, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'Taux de paiement', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'RATIO', filtresNumerateur: { statut_paiement: 'PAID' } }, gridX: 6, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'En attente', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT', filtres: { statut_paiement: 'PENDING' } }, gridX: 9, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'Évolution mensuelle', typeWidget: 'CHART_AREA', datasetId: datasetSoumissions.id, dimensions: { dimension: 'mois', mesure: 'SUM', colonne: 'montant' }, gridX: 0, gridY: 2, gridW: 8, gridH: 4 },
          { titre: 'Top 10 Ministères', typeWidget: 'CHART_BAR', datasetId: datasetSoumissions.id, dimensions: { dimension: 'ministere', mesure: 'SUM', colonne: 'montant' }, limite: 10, gridX: 8, gridY: 2, gridW: 4, gridH: 4 },
          { titre: 'Répartition par statut', typeWidget: 'CHART_DONUT', datasetId: datasetSoumissions.id, dimensions: { dimension: 'statut', mesure: 'COUNT' }, gridX: 0, gridY: 6, gridW: 4, gridH: 4 },
          { titre: 'Top 10 Services', typeWidget: 'CHART_BAR', datasetId: datasetSoumissions.id, dimensions: { dimension: 'service', mesure: 'SUM', colonne: 'montant' }, limite: 10, gridX: 4, gridY: 6, gridW: 8, gridH: 4 },
        ] : [],
      },
      {
        code: 'tpl-ministere',
        titre: 'Vue Ministère',
        description: 'Performance d\'un ministère — services, soumissions, tendances',
        visibilite: 'PUBLIC',
        proprietaireId: adminUser.id,
        widgets: datasetSoumissions ? [
          { titre: 'Montant encaissé', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'SUM', colonne: 'montant', filtres: { statut_paiement: ['PAID'] } }, gridX: 0, gridY: 0, gridW: 4, gridH: 2 },
          { titre: 'Soumissions', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT' }, gridX: 4, gridY: 0, gridW: 4, gridH: 2 },
          { titre: 'Taux paiement', typeWidget: 'GAUGE', datasetId: datasetSoumissions.id, dimensions: { mesure: 'RATIO', filtresNumerateur: { statut_paiement: 'PAID' } }, gridX: 8, gridY: 0, gridW: 4, gridH: 2 },
          { titre: 'Services par montant', typeWidget: 'CHART_BAR', datasetId: datasetSoumissions.id, dimensions: { dimension: 'service', mesure: 'SUM', colonne: 'montant' }, limite: 20, gridX: 0, gridY: 2, gridW: 12, gridH: 5 },
          { titre: 'Évolution mensuelle', typeWidget: 'CHART_LINE', datasetId: datasetSoumissions.id, dimensions: { dimension: 'mois', mesure: 'SUM', colonne: 'montant' }, gridX: 0, gridY: 7, gridW: 8, gridH: 4 },
          { titre: 'Répartition par statut', typeWidget: 'CHART_PIE', datasetId: datasetSoumissions.id, dimensions: { dimension: 'statut', mesure: 'COUNT' }, gridX: 8, gridY: 7, gridW: 4, gridH: 4 },
        ] : [],
      },
      {
        code: 'tpl-regional',
        titre: 'Vue Régionale',
        description: 'Activité par région — départements, services, soumissions',
        visibilite: 'PUBLIC',
        proprietaireId: adminUser.id,
        widgets: datasetSoumissions ? [
          { titre: 'Recettes régionales', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'SUM', colonne: 'montant', filtres: { statut_paiement: ['PAID'] } }, gridX: 0, gridY: 0, gridW: 4, gridH: 2 },
          { titre: 'Soumissions', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT' }, gridX: 4, gridY: 0, gridW: 4, gridH: 2 },
          { titre: 'Départements', typeWidget: 'CHART_BAR', datasetId: datasetSoumissions.id, dimensions: { dimension: 'departement', mesure: 'SUM', colonne: 'montant' }, gridX: 0, gridY: 2, gridW: 6, gridH: 5 },
          { titre: 'Services actifs', typeWidget: 'CHART_BAR', datasetId: datasetSoumissions.id, dimensions: { dimension: 'service', mesure: 'COUNT' }, limite: 10, gridX: 6, gridY: 2, gridW: 6, gridH: 5 },
          { titre: 'Évolution', typeWidget: 'CHART_AREA', datasetId: datasetSoumissions.id, dimensions: { dimension: 'mois', mesure: 'SUM', colonne: 'montant' }, gridX: 0, gridY: 7, gridW: 12, gridH: 4 },
        ] : [],
      },
      {
        code: 'tpl-operationnel',
        titre: 'Vue Opérationnelle',
        description: 'Suivi quotidien — soumissions récentes, statuts, alertes',
        visibilite: 'PUBLIC',
        proprietaireId: adminUser.id,
        widgets: datasetSoumissions ? [
          { titre: 'Soumissions aujourd\'hui', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT', granularite: 'JOUR' }, gridX: 0, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'Payées aujourd\'hui', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT', filtres: { statut_paiement: 'PAID' }, granularite: 'JOUR' }, gridX: 3, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'Échouées aujourd\'hui', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT', filtres: { statut_paiement: 'FAILED' }, granularite: 'JOUR' }, gridX: 6, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'En attente total', typeWidget: 'KPI_CARD', datasetId: datasetSoumissions.id, dimensions: { mesure: 'COUNT', filtres: { statut_paiement: 'PENDING' } }, gridX: 9, gridY: 0, gridW: 3, gridH: 2 },
          { titre: 'Statuts ce mois', typeWidget: 'CHART_STACKED', datasetId: datasetSoumissions.id, dimensions: { dimension: 'statut', mesure: 'COUNT', groupeSecondaire: 'mois' }, gridX: 0, gridY: 2, gridW: 6, gridH: 4 },
          { titre: 'Répartition par ministère', typeWidget: 'CHART_DONUT', datasetId: datasetSoumissions.id, dimensions: { dimension: 'ministere', mesure: 'COUNT' }, limite: 8, gridX: 6, gridY: 2, gridW: 6, gridH: 4 },
        ] : [],
      },
    ];

    let dashCreated = 0;
    for (const dash of DASHBOARDS) {
      try {
        const existing = await prisma.biDashboard.findUnique({ where: { code: dash.code } });
        if (!existing) {
          const { widgets, ...dashData } = dash;
          await prisma.biDashboard.create({
            data: {
              ...dashData,
              widgets: {
                create: widgets.map((w, i) => ({
                  ...w,
                  dimensions: w.dimensions || undefined,
                  ordreAffichage: i,
                })),
              },
            },
          });
          dashCreated++;
        }
      } catch (e) {
        // Skip if foreign key issue or duplicate
      }
    }
    console.log(`  -> ${dashCreated} dashboards pre-configures`);
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
