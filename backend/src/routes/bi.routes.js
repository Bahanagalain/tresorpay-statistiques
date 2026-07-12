// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Routes BI Self-Service
// CRUD dashboards, widgets, indicateurs + moteur de requête
// ─────────────────────────────────────────────────────────────────────

import prisma from '../config/prisma.js';
import { executerRequete, executerTableauCroise, getDimensionsDisponibles, getValeursFiltres } from '../services/bi-query-engine.service.js';

export default async function biRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authentifier);

  // ═══════════════════════════════════════════════════════════════
  // MOTEUR DE REQUETE
  // ═══════════════════════════════════════════════════════════════

  fastify.post('/query', {
    schema: {
      tags: ['BI'],
      summary: 'Exécuter une requête analytique',
      body: {
        type: 'object',
        properties: {
          dataset: { type: 'string' },
          dimensions: { type: 'array', items: { type: 'string' } },
          mesures: { type: 'array', items: { type: 'object' } },
          filtres: { type: 'object' },
          granularite: { type: 'string' },
          limite: { type: 'integer', minimum: 1, maximum: 500 },
          tri: { type: 'object' },
          drillDown: { type: 'object' },
        },
      },
    },
  }, async (request) => {
    const result = await executerRequete(request.body);
    return { datas: result };
  });

  fastify.post('/query/preview', {
    schema: { tags: ['BI'], summary: 'Preview rapide (10 rows max)' },
  }, async (request) => {
    const result = await executerRequete({ ...request.body, limite: 10 });
    return { datas: result };
  });

  fastify.post('/query/pivot', {
    schema: {
      tags: ['BI'],
      summary: 'Tableau croisé dynamique',
      body: {
        type: 'object',
        properties: {
          dataset: { type: 'string' },
          dim_ligne: { type: 'string' },
          dim_colonne: { type: 'string' },
          mesure: { type: 'string' },
          filtres: { type: 'object' },
          drillDown: { type: 'object' },
        },
      },
    },
  }, async (request) => {
    const result = await executerTableauCroise(request.body);
    return { datas: result };
  });

  // ═══════════════════════════════════════════════════════════════
  // DATASETS & DIMENSIONS
  // ═══════════════════════════════════════════════════════════════

  fastify.get('/datasets', {
    schema: { tags: ['BI'], summary: 'Liste des datasets disponibles' },
  }, async () => {
    const datasets = await prisma.biDataset.findMany({
      where: { estActif: true },
      orderBy: { id: 'asc' },
    });
    return { datas: datasets };
  });

  fastify.get('/datasets/:code/dimensions', {
    schema: { tags: ['BI'], summary: 'Dimensions disponibles pour un dataset' },
  }, async (request) => {
    const { code } = request.params;
    const { service_id, formulaire_id } = request.query || {};
    const result = await getDimensionsDisponibles(code, service_id, formulaire_id);
    return { datas: result };
  });

  fastify.get('/datasets/:code/filtres/:cle/valeurs', {
    schema: { tags: ['BI'], summary: 'Valeurs possibles pour un filtre' },
  }, async (request) => {
    const { code, cle } = request.params;
    const result = await getValeursFiltres(code, cle);
    return { datas: result };
  });

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARDS CRUD
  // ═══════════════════════════════════════════════════════════════

  fastify.get('/dashboards', {
    schema: { tags: ['BI'], summary: 'Liste des dashboards accessibles' },
  }, async (request) => {
    const userId = request.utilisateur.id;

    const dashboards = await prisma.biDashboard.findMany({
      where: {
        OR: [
          { proprietaireId: userId },
          { visibilite: 'PUBLIC' },
          { partages: { some: { utilisateurId: userId } } },
        ],
      },
      include: {
        proprietaire: { select: { id: true, nomComplet: true } },
        _count: { select: { widgets: true } },
      },
      orderBy: [{ estFavori: 'desc' }, { modifieLe: 'desc' }],
    });

    return { datas: dashboards };
  });

  fastify.post('/dashboards', {
    schema: {
      tags: ['BI'],
      summary: 'Créer un dashboard',
      body: {
        type: 'object',
        required: ['titre'],
        properties: {
          titre: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          visibilite: { type: 'string', enum: ['PRIVE', 'EQUIPE', 'PUBLIC'] },
        },
      },
    },
  }, async (request) => {
    const { titre, description, visibilite } = request.body;
    const dashboard = await prisma.biDashboard.create({
      data: {
        titre,
        description: description || null,
        visibilite: visibilite || 'PRIVE',
        proprietaireId: request.utilisateur.id,
      },
    });
    return { message: 'Dashboard créé', datas: dashboard };
  });

  fastify.get('/dashboards/:id', {
    schema: { tags: ['BI'], summary: 'Détail dashboard avec widgets' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    const dashboard = await prisma.biDashboard.findUnique({
      where: { id },
      include: {
        proprietaire: { select: { id: true, nomComplet: true } },
        widgets: {
          include: {
            dataset: { select: { code: true, libelle: true } },
            indicateurs: { include: { indicateur: true } },
          },
          orderBy: { ordreAffichage: 'asc' },
        },
        filtres: { orderBy: { ordreAffichage: 'asc' } },
        partages: { include: { utilisateur: { select: { id: true, nomComplet: true } } } },
      },
    });

    if (!dashboard) return { error: 'Dashboard introuvable', statusCode: 404 };
    return { datas: dashboard };
  });

  fastify.put('/dashboards/:id', {
    schema: {
      tags: ['BI'],
      summary: 'Modifier un dashboard',
      body: {
        type: 'object',
        properties: {
          titre: { type: 'string' },
          description: { type: 'string' },
          visibilite: { type: 'string' },
          layoutConfig: { type: 'object' },
          filtresGlobaux: { type: 'object' },
          themeConfig: { type: 'object' },
          estFavori: { type: 'boolean' },
        },
      },
    },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    const data = {};
    const { titre, description, visibilite, layoutConfig, filtresGlobaux, themeConfig, estFavori } = request.body;

    if (titre !== undefined) data.titre = titre;
    if (description !== undefined) data.description = description;
    if (visibilite !== undefined) data.visibilite = visibilite;
    if (layoutConfig !== undefined) data.layoutConfig = layoutConfig;
    if (filtresGlobaux !== undefined) data.filtresGlobaux = filtresGlobaux;
    if (themeConfig !== undefined) data.themeConfig = themeConfig;
    if (estFavori !== undefined) data.estFavori = estFavori;

    const dashboard = await prisma.biDashboard.update({ where: { id }, data });
    return { message: 'Dashboard mis à jour', datas: dashboard };
  });

  fastify.delete('/dashboards/:id', {
    schema: { tags: ['BI'], summary: 'Supprimer un dashboard' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    await prisma.biDashboard.delete({ where: { id } });
    return { message: 'Dashboard supprimé' };
  });

  fastify.post('/dashboards/:id/duplicate', {
    schema: { tags: ['BI'], summary: 'Dupliquer un dashboard' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    const source = await prisma.biDashboard.findUnique({
      where: { id },
      include: { widgets: true, filtres: true },
    });
    if (!source) return { error: 'Dashboard introuvable', statusCode: 404 };

    const copy = await prisma.biDashboard.create({
      data: {
        titre: `${source.titre} (copie)`,
        description: source.description,
        visibilite: 'PRIVE',
        layoutConfig: source.layoutConfig,
        filtresGlobaux: source.filtresGlobaux,
        themeConfig: source.themeConfig,
        proprietaireId: request.utilisateur.id,
        widgets: {
          create: source.widgets.map(w => ({
            datasetId: w.datasetId,
            titre: w.titre,
            typeWidget: w.typeWidget,
            dimensions: w.dimensions,
            filtresLocaux: w.filtresLocaux,
            granularite: w.granularite,
            limite: w.limite,
            tri: w.tri,
            chartConfig: w.chartConfig,
            gridX: w.gridX,
            gridY: w.gridY,
            gridW: w.gridW,
            gridH: w.gridH,
            drillDownConfig: w.drillDownConfig,
            ordreAffichage: w.ordreAffichage,
          })),
        },
        filtres: {
          create: source.filtres.map(f => ({
            cle: f.cle,
            libelle: f.libelle,
            type: f.type,
            config: f.config,
            ordreAffichage: f.ordreAffichage,
          })),
        },
      },
    });

    return { message: 'Dashboard dupliqué', datas: copy };
  });

  // ═══════════════════════════════════════════════════════════════
  // WIDGETS CRUD
  // ═══════════════════════════════════════════════════════════════

  fastify.post('/dashboards/:dashboardId/widgets', {
    schema: {
      tags: ['BI'],
      summary: 'Ajouter un widget au dashboard',
      body: {
        type: 'object',
        required: ['titre', 'typeWidget'],
        properties: {
          titre: { type: 'string' },
          typeWidget: { type: 'string' },
          datasetId: { type: 'integer' },
          dimensions: { type: 'array' },
          filtresLocaux: { type: 'object' },
          granularite: { type: 'string' },
          limite: { type: 'integer' },
          tri: { type: 'string' },
          chartConfig: { type: 'object' },
          gridX: { type: 'integer' },
          gridY: { type: 'integer' },
          gridW: { type: 'integer' },
          gridH: { type: 'integer' },
          drillDownConfig: { type: 'object' },
        },
      },
    },
  }, async (request) => {
    const dashboardId = parseInt(request.params.dashboardId, 10);
    const widget = await prisma.biWidget.create({
      data: { dashboardId, ...request.body },
    });
    return { message: 'Widget ajouté', datas: widget };
  });

  fastify.put('/widgets/:id', {
    schema: { tags: ['BI'], summary: 'Modifier un widget' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    const widget = await prisma.biWidget.update({
      where: { id },
      data: request.body,
    });
    return { message: 'Widget mis à jour', datas: widget };
  });

  fastify.delete('/widgets/:id', {
    schema: { tags: ['BI'], summary: 'Supprimer un widget' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    await prisma.biWidget.delete({ where: { id } });
    return { message: 'Widget supprimé' };
  });

  // Exécuter la requête d'un widget (charge sa config et exécute)
  fastify.post('/widgets/:id/execute', {
    schema: { tags: ['BI'], summary: 'Exécuter la requête d\'un widget' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    const widget = await prisma.biWidget.findUnique({
      where: { id },
      include: { dataset: true },
    });
    if (!widget) return { error: 'Widget introuvable', statusCode: 404 };

    // Fusionner les filtres globaux (body) avec les filtres locaux du widget
    const filtresFusionnes = { ...(widget.filtresLocaux || {}), ...(request.body?.filtres || {}) };

    const result = await executerRequete({
      dataset: widget.dataset?.code || 'soumissions',
      dimensions: widget.dimensions || [],
      mesures: widget.chartConfig?.mesures || [{ type: 'COUNT' }],
      filtres: filtresFusionnes,
      granularite: widget.granularite || undefined,
      limite: widget.limite || 50,
      tri: widget.chartConfig?.tri || { colonne: 'nombre', direction: 'desc' },
      drillDown: request.body?.drillDown,
    });

    return { datas: result };
  });

  // ═══════════════════════════════════════════════════════════════
  // INDICATEURS
  // ═══════════════════════════════════════════════════════════════

  fastify.get('/indicateurs', {
    schema: { tags: ['BI'], summary: 'Liste des indicateurs' },
  }, async (request) => {
    const indicateurs = await prisma.biIndicateur.findMany({
      where: {
        estActif: true,
        OR: [
          { estSysteme: true },
          { createurId: request.utilisateur.id },
        ],
      },
      include: { dataset: { select: { code: true, libelle: true } } },
      orderBy: [{ estSysteme: 'desc' }, { libelle: 'asc' }],
    });
    return { datas: indicateurs };
  });

  fastify.post('/indicateurs', {
    schema: {
      tags: ['BI'],
      summary: 'Créer un indicateur personnalisé',
      body: {
        type: 'object',
        required: ['code', 'libelle', 'datasetId', 'typeMesure'],
        properties: {
          code: { type: 'string' },
          libelle: { type: 'string' },
          description: { type: 'string' },
          datasetId: { type: 'integer' },
          typeMesure: { type: 'string' },
          formule: { type: 'object' },
          colonneMesure: { type: 'string' },
          filtresDefaut: { type: 'object' },
          formatAffichage: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const indicateur = await prisma.biIndicateur.create({
      data: { ...request.body, createurId: request.utilisateur.id },
    });
    return { message: 'Indicateur créé', datas: indicateur };
  });

  fastify.put('/indicateurs/:id', {
    schema: { tags: ['BI'], summary: 'Modifier un indicateur' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    const indicateur = await prisma.biIndicateur.update({
      where: { id },
      data: request.body,
    });
    return { message: 'Indicateur mis à jour', datas: indicateur };
  });

  fastify.delete('/indicateurs/:id', {
    schema: { tags: ['BI'], summary: 'Supprimer un indicateur' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    // Ne pas supprimer les indicateurs système
    const ind = await prisma.biIndicateur.findUnique({ where: { id } });
    if (ind?.estSysteme) return { error: 'Indicateur système non supprimable', statusCode: 403 };
    await prisma.biIndicateur.delete({ where: { id } });
    return { message: 'Indicateur supprimé' };
  });

  // Calculer la valeur d'un indicateur
  fastify.post('/indicateurs/:id/compute', {
    schema: { tags: ['BI'], summary: 'Calculer la valeur d\'un indicateur' },
  }, async (request) => {
    const id = parseInt(request.params.id, 10);
    const ind = await prisma.biIndicateur.findUnique({
      where: { id },
      include: { dataset: true },
    });
    if (!ind) return { error: 'Indicateur introuvable', statusCode: 404 };

    const filtres = { ...(ind.filtresDefaut || {}), ...(request.body?.filtres || {}) };

    const result = await executerRequete({
      dataset: ind.dataset.code,
      dimensions: [],
      mesures: [{ type: ind.typeMesure, colonne: ind.colonneMesure, ...ind.formule }],
      filtres,
      limite: 1,
    });

    const valeur = result.rows[0] || {};
    return { datas: { indicateur: ind, valeur } };
  });
}
