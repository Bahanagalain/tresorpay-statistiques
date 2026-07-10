// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Explorateur de donnees dynamique
// Permet l'agregation par dimensions fixes ET dynamiques (champs formulaire)
// ─────────────────────────────────────────────────────────────────────

import prisma from '../config/prisma.js';

// ═══════════════════════════════════════════════════════════════
// DIMENSIONS FIXES
// ═══════════════════════════════════════════════════════════════

const DIMENSIONS_FIXES = [
  { cle: 'ministere', libelle: 'Ministère', type: 'fixed', colonneSql: 's.ministere_id', modelResolution: 'ministere' },
  { cle: 'service', libelle: 'Service', type: 'fixed', colonneSql: 's.service_id', modelResolution: 'serviceGouv' },
  { cle: 'domaine', libelle: 'Domaine', type: 'fixed', colonneSql: 's.domaine_id', modelResolution: 'domaine' },
  { cle: 'region', libelle: 'Région', type: 'fixed', colonneSql: 's.org_unit_id', modelResolution: 'orgUnit' },
  { cle: 'statut', libelle: 'Statut paiement', type: 'fixed', colonneSql: 's.statut_paiement', modelResolution: null },
  { cle: 'mois', libelle: 'Mois', type: 'fixed', colonneSql: "to_char(s.date_soumission, 'YYYY-MM')", modelResolution: null },
];

const DIMENSIONS_FIXES_MAP = new Map(DIMENSIONS_FIXES.map(d => [d.cle, d]));

// ═══════════════════════════════════════════════════════════════
// DIMENSIONS DISPONIBLES
// ═══════════════════════════════════════════════════════════════

export async function computeDimensionsDisponibles(serviceId, formulaireId) {
  const where = { estDimension: true };
  if (serviceId) where.serviceId = serviceId;
  if (formulaireId) where.formulaireId = formulaireId;

  const champsDynamiques = await prisma.champFormulaire.findMany({
    where,
    select: {
      id: true,
      cleChamp: true,
      libelleChamp: true,
      libelleChampEn: true,
      formulaireId: true,
      serviceId: true,
      typeChamp: true,
      optionsDisponibles: true,
      estChampPaiement: true,
    },
    orderBy: [{ serviceId: 'asc' }, { ordreAffichage: 'asc' }],
  });

  return {
    fixes: DIMENSIONS_FIXES.map(d => ({ cle: d.cle, libelle: d.libelle, type: 'fixed' })),
    dynamiques: champsDynamiques.map(c => ({
      cle: `champ_${c.id}`,
      champId: c.id,
      libelle: c.libelleChamp,
      libelleEn: c.libelleChampEn,
      type: 'dynamic',
      typeChamp: c.typeChamp,
      formulaireId: c.formulaireId,
      serviceId: c.serviceId,
      estChampPaiement: c.estChampPaiement,
      options: c.optionsDisponibles || [],
    })),
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPLORATION DYNAMIQUE
// ═══════════════════════════════════════════════════════════════

function buildWhereClause(filtres = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (filtres.date_debut) {
    conditions.push(`s.date_soumission >= $${paramIndex}`);
    params.push(new Date(filtres.date_debut));
    paramIndex++;
  }
  if (filtres.date_fin) {
    const fin = new Date(filtres.date_fin);
    fin.setHours(23, 59, 59, 999);
    conditions.push(`s.date_soumission <= $${paramIndex}`);
    params.push(fin);
    paramIndex++;
  }
  if (filtres.ministere_id) {
    conditions.push(`s.ministere_id = $${paramIndex}`);
    params.push(filtres.ministere_id);
    paramIndex++;
  }
  if (filtres.service_id) {
    conditions.push(`s.service_id = $${paramIndex}`);
    params.push(filtres.service_id);
    paramIndex++;
  }
  if (filtres.domaine_id) {
    conditions.push(`s.domaine_id = $${paramIndex}`);
    params.push(filtres.domaine_id);
    paramIndex++;
  }
  if (filtres.orgunit_id) {
    conditions.push(`s.org_unit_id = $${paramIndex}`);
    params.push(filtres.orgunit_id);
    paramIndex++;
  }
  if (filtres.statut) {
    conditions.push(`s.statut_paiement = $${paramIndex}`);
    params.push(filtres.statut);
    paramIndex++;
  }

  // Filtres dynamiques sur champs formulaire
  if (filtres.champs && typeof filtres.champs === 'object') {
    for (const [champIdStr, valeur] of Object.entries(filtres.champs)) {
      const champId = parseInt(champIdStr, 10);
      if (isNaN(champId)) continue;
      conditions.push(
        `EXISTS (SELECT 1 FROM valeurs_soumission vf WHERE vf.soumission_id = s.id AND vf.champ_formulaire_id = $${paramIndex} AND vf.valeur = $${paramIndex + 1})`
      );
      params.push(champId, valeur);
      paramIndex += 2;
    }
  }

  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params, nextParamIndex: paramIndex };
}

function parseDimension(dimKey) {
  if (dimKey.startsWith('champ_')) {
    const champId = parseInt(dimKey.replace('champ_', ''), 10);
    return { type: 'dynamic', champId };
  }
  const fixe = DIMENSIONS_FIXES_MAP.get(dimKey);
  if (fixe) return { type: 'fixed', ...fixe };
  return null;
}

export async function computeExploration({ group_by = [], mesure = 'count', filtres = {}, limite = 50, tri = 'desc' }) {
  if (!group_by.length) return [];

  const dims = group_by.map(parseDimension).filter(Boolean);
  if (dims.length === 0) return [];

  // Construire le SELECT, les JOINs, et le GROUP BY
  const selectCols = [];
  const groupByCols = [];
  const joins = [];
  let joinIndex = 0;

  for (const dim of dims) {
    if (dim.type === 'fixed') {
      const alias = `dim_${dim.cle}`;
      selectCols.push(`${dim.colonneSql} AS ${alias}`);
      groupByCols.push(dim.colonneSql);
    } else {
      const alias = `vs${joinIndex}`;
      joins.push(`LEFT JOIN valeurs_soumission ${alias} ON ${alias}.soumission_id = s.id AND ${alias}.champ_formulaire_id = ${dim.champId}`);
      selectCols.push(`${alias}.valeur AS dim_champ_${dim.champId}`);
      groupByCols.push(`${alias}.valeur`);
      joinIndex++;
    }
  }

  // Mesures
  const mesureCols = [
    'COUNT(*) AS nombre',
    'COALESCE(SUM(s.montant), 0) AS montant_total',
  ];
  if (mesure === 'avg') {
    mesureCols.push('COALESCE(AVG(s.montant), 0) AS montant_moyen');
  }

  const { where, params } = buildWhereClause(filtres);

  const orderCol = mesure === 'count' ? 'nombre' : 'montant_total';
  const orderDir = tri === 'asc' ? 'ASC' : 'DESC';

  const sql = `
    SELECT ${selectCols.join(', ')}, ${mesureCols.join(', ')}
    FROM soumissions s
    ${joins.join('\n')}
    ${where}
    GROUP BY ${groupByCols.join(', ')}
    ORDER BY ${orderCol} ${orderDir}
    LIMIT ${Math.min(limite, 500)}
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);

  // Resoudre les noms pour les dimensions fixes (ID -> nom)
  return await resolveNomsDimensions(rows, dims);
}

async function resolveNomsDimensions(rows, dims) {
  if (!rows.length) return [];

  // Collecter les IDs a resoudre par modele
  const idsParModele = {};
  for (const dim of dims) {
    if (dim.type === 'fixed' && dim.modelResolution) {
      idsParModele[dim.cle] = new Set();
    }
  }

  for (const row of rows) {
    for (const dim of dims) {
      if (dim.type !== 'fixed' || !dim.modelResolution) continue;
      const val = row[`dim_${dim.cle}`];
      if (val) idsParModele[dim.cle].add(val);
    }
  }

  // Charger les noms
  const nomsCache = {};
  for (const dim of dims) {
    if (dim.type !== 'fixed' || !dim.modelResolution) continue;
    const ids = [...(idsParModele[dim.cle] || [])];
    if (ids.length === 0) continue;

    const model = dim.modelResolution;
    const records = await prisma[model].findMany({
      where: { id: { in: ids } },
      select: { id: true, nomFr: true },
    });
    nomsCache[dim.cle] = new Map(records.map(r => [r.id, r.nomFr]));
  }

  // Formatter les resultats
  return rows.map(row => {
    const dimensions = {};
    for (const dim of dims) {
      if (dim.type === 'fixed') {
        const rawVal = row[`dim_${dim.cle}`];
        const nom = nomsCache[dim.cle]?.get(rawVal);
        dimensions[dim.cle] = { id: rawVal, nom: nom || rawVal || '(non défini)' };
      } else {
        const val = row[`dim_champ_${dim.champId}`];
        dimensions[`champ_${dim.champId}`] = { id: val, nom: val || '(non défini)' };
      }
    }

    return {
      dimensions,
      nombre: Number(row.nombre),
      montant: Number(row.montant_total),
      moyenne: row.montant_moyen != null ? Number(row.montant_moyen) : undefined,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// TABLEAU CROISE DYNAMIQUE
// ═══════════════════════════════════════════════════════════════

export async function computeTableauCroise({ dim_ligne, dim_colonne, mesure = 'count', filtres = {} }) {
  if (!dim_ligne || !dim_colonne) return { colonnes: [], lignes: [], totauxColonnes: [], totalGeneral: 0 };

  const dimL = parseDimension(dim_ligne);
  const dimC = parseDimension(dim_colonne);
  if (!dimL || !dimC) return { colonnes: [], lignes: [], totauxColonnes: [], totalGeneral: 0 };

  // Construire la requete
  const selectL = dimL.type === 'fixed' ? `${dimL.colonneSql}` : 'vl.valeur';
  const selectC = dimC.type === 'fixed' ? `${dimC.colonneSql}` : 'vc.valeur';
  const joins = [];

  if (dimL.type === 'dynamic') {
    joins.push(`LEFT JOIN valeurs_soumission vl ON vl.soumission_id = s.id AND vl.champ_formulaire_id = ${dimL.champId}`);
  }
  if (dimC.type === 'dynamic') {
    joins.push(`LEFT JOIN valeurs_soumission vc ON vc.soumission_id = s.id AND vc.champ_formulaire_id = ${dimC.champId}`);
  }

  const valeurExpr = mesure === 'sum' ? 'COALESCE(SUM(s.montant), 0)' : 'COUNT(*)';
  const { where, params } = buildWhereClause(filtres);

  const sql = `
    SELECT ${selectL} AS ligne, ${selectC} AS colonne, ${valeurExpr} AS valeur
    FROM soumissions s
    ${joins.join('\n')}
    ${where}
    GROUP BY ${selectL}, ${selectC}
    ORDER BY ${selectL}, ${selectC}
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);

  // Resoudre les noms
  const resolveNom = async (dim, rawVal) => {
    if (!rawVal) return '(non défini)';
    if (dim.type === 'dynamic' || !dim.modelResolution) return String(rawVal);
    const record = await prisma[dim.modelResolution].findUnique({
      where: { id: rawVal },
      select: { nomFr: true },
    });
    return record?.nomFr || String(rawVal);
  };

  // Pivoter les resultats en matrice
  const lignesSet = new Map(); // rawVal -> nom
  const colonnesSet = new Map();

  for (const row of rows) {
    if (!lignesSet.has(row.ligne)) lignesSet.set(row.ligne, null);
    if (!colonnesSet.has(row.colonne)) colonnesSet.set(row.colonne, null);
  }

  // Resoudre les noms en batch
  for (const key of lignesSet.keys()) {
    lignesSet.set(key, await resolveNom(dimL, key));
  }
  for (const key of colonnesSet.keys()) {
    colonnesSet.set(key, await resolveNom(dimC, key));
  }

  const colonnesArr = [...colonnesSet.entries()].map(([id, nom]) => ({ id, nom }));
  const colonneIndex = new Map(colonnesArr.map((c, i) => [c.id, i]));

  // Construire la matrice
  const matrice = new Map();
  for (const row of rows) {
    if (!matrice.has(row.ligne)) matrice.set(row.ligne, new Array(colonnesArr.length).fill(0));
    const idx = colonneIndex.get(row.colonne);
    if (idx !== undefined) matrice.get(row.ligne)[idx] = Number(row.valeur);
  }

  const lignes = [...matrice.entries()].map(([rawLigne, valeurs]) => ({
    id: rawLigne,
    libelle: lignesSet.get(rawLigne) || String(rawLigne),
    valeurs,
    total: valeurs.reduce((a, b) => a + b, 0),
  }));

  // Trier par total decroissant
  lignes.sort((a, b) => b.total - a.total);

  const totauxColonnes = colonnesArr.map((_, i) => lignes.reduce((sum, l) => sum + l.valeurs[i], 0));
  const totalGeneral = totauxColonnes.reduce((a, b) => a + b, 0);

  return {
    colonnes: colonnesArr.map(c => c.nom),
    lignes,
    totauxColonnes,
    totalGeneral,
  };
}
