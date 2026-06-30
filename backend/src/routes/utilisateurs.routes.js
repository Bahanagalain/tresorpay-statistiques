import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

export default async function utilisateursRoutes(fastify) {

  fastify.addHook('preHandler', fastify.authentifier);

  // ─── GET /utilisateurs ────────────────────────────────────────────

  fastify.get('/', {
    schema: {
      tags: ['Utilisateurs'],
      summary: 'Liste des utilisateurs (paginée, filtrable)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page:         { type: 'integer', minimum: 1, default: 1 },
          limite:       { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          niveau:       { type: 'string', enum: ['CENTRAL', 'REGIONAL', 'DEPARTEMENTAL'] },
          ministere_id: { type: 'string' },
          org_unit_id:  { type: 'string' },
          est_actif:    { type: 'string' },
          search:       { type: 'string' },
        },
      },
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async (request) => {
    const { niveau, ministere_id, org_unit_id, est_actif, page = 1, limite = 50, search } = request.query;
    const skip = (page - 1) * limite;

    const where = {};
    if (niveau)       where.niveau = niveau;
    if (ministere_id) where.ministereId = ministere_id;
    if (org_unit_id)  where.orgUnitId = org_unit_id;
    if (est_actif !== undefined) where.estActif = est_actif === 'true';
    if (search) {
      where.OR = [
        { identifiant: { contains: search, mode: 'insensitive' } },
        { nomComplet: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [utilisateurs, total] = await Promise.all([
      prisma.utilisateur.findMany({
        where,
        skip,
        take: parseInt(limite),
        orderBy: { creeLe: 'desc' },
        include: {
          ministere: true,
          orgUnit: true,
          createur: { select: { identifiant: true } },
          roles: { include: { role: true } },
        },
      }),
      prisma.utilisateur.count({ where }),
    ]);

    const datas = utilisateurs.map(u => ({
      id: u.id,
      identifiant: u.identifiant,
      nom_complet: u.nomComplet,
      email: u.email,
      telephone: u.telephone,
      niveau: u.niveau,
      est_super_admin: u.estSuperAdmin,
      est_actif: u.estActif,
      ministere: u.ministere,
      orgUnit: u.orgUnit,
      cree_par_identifiant: u.createur?.identifiant || null,
      cree_le: u.creeLe,
      roles: u.roles.map(ur => ur.role),
    }));

    return {
      datas,
      meta: { total_elements: total, total_pages: Math.ceil(total / limite), page_courante: parseInt(page) },
    };
  });

  // ─── GET /utilisateurs/:id ────────────────────────────────────────

  fastify.get('/:id', {
    schema: {
      tags: ['Utilisateurs'],
      summary: 'Détail d\'un utilisateur',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async (request, reply) => {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: parseInt(request.params.id) },
      include: {
        ministere: true,
        orgUnit: true,
        roles: { include: { role: true } },
      },
    });

    if (!utilisateur) return reply.code(404).send({ error: 'Utilisateur introuvable' });

    const { motDePasseHash, ...safe } = utilisateur;
    return {
      datas: {
        ...safe,
        roles: utilisateur.roles.map(ur => ur.role),
      },
    };
  });

  // ─── POST /utilisateurs ───────────────────────────────────────────

  fastify.post('/', {
    schema: {
      tags: ['Utilisateurs'],
      summary: 'Créer un utilisateur',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['identifiant', 'mot_de_passe', 'nom_complet', 'niveau'],
        properties: {
          identifiant:   { type: 'string', minLength: 3 },
          mot_de_passe:  { type: 'string', minLength: 6 },
          nom_complet:   { type: 'string', minLength: 2 },
          email:         { type: 'string', format: 'email' },
          telephone:     { type: 'string' },
          niveau:        { type: 'string', enum: ['CENTRAL', 'REGIONAL', 'DEPARTEMENTAL'] },
          codes_roles:   { type: 'array', items: { type: 'string' } },
          ministere_id:  { type: 'string' },
          org_unit_id:   { type: 'string' },
        },
      },
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async (request, reply) => {
    const { identifiant, mot_de_passe, nom_complet, email, telephone, niveau, codes_roles, ministere_id, org_unit_id } = request.body;

    if (niveau === 'REGIONAL' && !ministere_id) {
      return reply.code(400).send({ error: 'ministere_id requis pour le niveau REGIONAL' });
    }
    if (niveau === 'DEPARTEMENTAL' && !org_unit_id) {
      return reply.code(400).send({ error: 'org_unit_id requis pour le niveau DEPARTEMENTAL' });
    }

    const existe = await prisma.utilisateur.findUnique({ where: { identifiant } });
    if (existe) return reply.code(409).send({ error: 'Ce nom d\'utilisateur existe déjà' });

    const hash = bcrypt.hashSync(mot_de_passe, 12);

    const utilisateur = await prisma.utilisateur.create({
      data: {
        identifiant,
        motDePasseHash: hash,
        nomComplet: nom_complet,
        email: email || null,
        telephone: telephone || null,
        niveau,
        ministereId: ministere_id || null,
        orgUnitId: org_unit_id || null,
        creePar: request.utilisateur.id,
        roles: codes_roles?.length > 0
          ? {
              create: (await prisma.role.findMany({ where: { code: { in: codes_roles } } }))
                .map(r => ({ roleId: r.id })),
            }
          : undefined,
      },
      select: { id: true, identifiant: true, nomComplet: true, niveau: true, creeLe: true },
    });

    reply.code(201);
    return { datas: utilisateur, message: 'Utilisateur créé avec succès' };
  });

  // ─── PUT /utilisateurs/:id ────────────────────────────────────────

  fastify.put('/:id', {
    schema: {
      tags: ['Utilisateurs'],
      summary: 'Modifier un utilisateur',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async (request, reply) => {
    const id = parseInt(request.params.id);

    const cible = await prisma.utilisateur.findUnique({ where: { id } });
    if (!cible) return reply.code(404).send({ error: 'Utilisateur introuvable' });
    if (cible.estSuperAdmin && cible.id !== request.utilisateur.id) {
      return reply.code(403).send({ error: 'Impossible de modifier un autre super administrateur' });
    }

    const { nom_complet, email, telephone, niveau, codes_roles, ministere_id, org_unit_id, est_actif, mot_de_passe } = request.body;

    const data = {};
    if (nom_complet !== undefined)  data.nomComplet = nom_complet;
    if (email !== undefined)        data.email = email;
    if (telephone !== undefined)    data.telephone = telephone;
    if (niveau !== undefined)       data.niveau = niveau;
    if (ministere_id !== undefined) data.ministereId = ministere_id;
    if (org_unit_id !== undefined)  data.orgUnitId = org_unit_id;
    if (est_actif !== undefined)    data.estActif = est_actif;
    if (mot_de_passe)               data.motDePasseHash = bcrypt.hashSync(mot_de_passe, 12);

    await prisma.utilisateur.update({ where: { id }, data });

    // Mettre à jour les rôles si fournis
    if (codes_roles !== undefined) {
      await prisma.utilisateurRole.deleteMany({ where: { utilisateurId: id } });

      if (codes_roles.length > 0) {
        const rolesDb = await prisma.role.findMany({ where: { code: { in: codes_roles } } });
        await prisma.utilisateurRole.createMany({
          data: rolesDb.map(r => ({ utilisateurId: id, roleId: r.id })),
        });
      }
    }

    return { message: 'Utilisateur mis à jour avec succès' };
  });

  // ─── DELETE /utilisateurs/:id ─────────────────────────────────────

  fastify.delete('/:id', {
    schema: {
      tags: ['Utilisateurs'],
      summary: 'Désactiver un utilisateur',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
    preHandler: [fastify.exigerSuperAdmin],
  }, async (request, reply) => {
    const id = parseInt(request.params.id);

    const cible = await prisma.utilisateur.findUnique({ where: { id } });
    if (!cible) return reply.code(404).send({ error: 'Utilisateur introuvable' });
    if (cible.estSuperAdmin) return reply.code(403).send({ error: 'Impossible de supprimer un super administrateur' });

    await prisma.utilisateur.update({ where: { id }, data: { estActif: false } });
    await prisma.jetonRefresh.deleteMany({ where: { utilisateurId: id } });

    return { message: 'Utilisateur désactivé' };
  });
}
