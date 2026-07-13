// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Moteur de requête BI
// Génère et exécute des requêtes analytiques déclaratives
// Supporte multi-datasets, multi-mesures, ratios, drill-down
// ─────────────────────────────────────────────────────────────────────

import prisma from '../config/prisma.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION DES DATASETS
// ═══════════════════════════════════════════════════════════════

const DATASETS = {
  soumissions: {
    table: 'soumissions',
    alias: 's',
    colonneDate: 's.date_soumission',
    colonneMontant: 's.montant',
    colonneMontantPaye: 's.montant_paye',
    dimensions: {
      ministere: { sql: 's.ministere_id', model: 'ministere', champ: 'nomFr' },
      service: { sql: 's.service_id', model: 'serviceGouv', champ: 'nomFr' },
      domaine: { sql: 's.domaine_id', model: 'domaine', champ: 'nomFr' },
      region: { sql: 's.org_unit_id', model: 'orgUnit', champ: 'nomFr', filtre: { type: 'REGION' } },
      departement: { sql: 's.org_unit_id', model: 'orgUnit', champ: 'nomFr', filtre: { type: 'DEPARTMENT' } },
      org_unit: { sql: 's.org_unit_id', model: 'orgUnit', champ: 'nomFr' },
      statut: { sql: 's.statut_paiement', model: null },
      formulaire: { sql: 's.formulaire_id', model: null, labelSql: 's.formulaire_nom' },
    },
    filtres: {
      ministere_id: 's.ministere_id',
      service_id: 's.service_id',
      domaine_id: 's.domaine_id',
      org_unit_id: 's.org_unit_id',
      statut: 's.statut_paiement',
      formulaire_id: 's.formulaire_id',
    },
  },
  demandes_partenaire: {
    table: 'demandes_partenaire',
    alias: 'd',
    colonneDate: 'd.cree_le',
    colonneMontant: 'd.montant',
    colonneMontantPaye: 'd.montant_paye',
    dimensions: {
      plateforme: { sql: 'd.plateforme_id', model: 'plateformePartenaire', champ: 'nom' },
      statut: { sql: 'd.statut', model: null },
      methode_paiement: { sql: 'd.methode_paiement', model: null },
      operateur: { sql: 'd.operateur_paiement', model: null },
    },
    filtres: {
      plateforme_id: 'd.plateforme_id',
      statut: 'd.statut',
      methode_paiement: 'd.methode_paiement',
    },
  },
  audit: {
    table: 'journal_audit',
    alias: 'a',
    colonneDate: 'a.execute_le',
    colonneMontant: null,
    dimensions: {
      acteur: { sql: 'a.acteur_email', model: null },
      action: { sql: 'a.action', model: null },
      type_entite: { sql: 'a.type_entite', model: null },
    },
    filtres: {
      action: 'a.action',
      type_entite: 'a.type_entite',
      acteur_email: 'a.acteur_email',
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// GRANULARITES TEMPORELLES
// ═══════════════════════════════════════════════════════════════

const GRANULARITES = {
  JOUR: { sql: (col) => `${col}::date`, format: 'date' },
  SEMAINE: { sql: (col) => `to_char(${col}, 'IYYY-"S"IW')`, format: 'semaine' },
  MOIS: { sql: (col) => `to_char(${col}, 'YYYY-MM')`, format: 'mois' },
  TRIMESTRE: { sql: (col) => `to_char(${col}, 'YYYY-"T"Q')`, format: 'trimestre' },
  ANNEE: { sql: (col) => `to_char(${col}, 'YYYY')`, format: 'annee' },
};

// ═══════════════════════════════════════════════════════════════
// MOTEUR DE REQUETE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

/**
 * Exécute une requête analytique déclarative.
 *
 * @param {Object} req
 * @param {string} req.dataset - Code du dataset ("soumissions", "demandes_partenaire", "audit")
 * @param {string[]} req.dimensions - Clés de dimensions (ex: ["ministere", "mois", "champ_42"])
 * @param {Object[]} req.mesures - [{type: "COUNT"}, {type: "SUM", colonne: "montant"}, {type: "RATIO", filtreNum: {...}, filtreDen: {...}}]
 * @param {Object} req.filtres - Filtres appliqués (date_debut, date_fin, ministere_id, champs: {42: "Masculin"})
 * @param {string} req.granularite - Granularité temporelle (JOUR, SEMAINE, MOIS, TRIMESTRE, ANNEE)
 * @param {number} req.limite - Max rows (défaut 50, max 500)
 * @param {Object} req.tri - {colonne: "montant_total", direction: "desc"}
 * @param {Object} req.drillDown - {dimension: "ministere", valeur: "xxx-uuid"} filtre additionnel
 * @returns {Object} {rows: [...], meta: {dimensions, mesures, total, dureeMs}}
 */
export async function executerRequete(req) {
  const debut = Date.now();
  const {
    dataset: datasetCode = 'soumissions',
    dimensions: dimKeys = [],
    mesures = [{ type: 'COUNT' }],
    filtres = {},
    granularite,
    limite = 50,
    tri = { colonne: 'nombre', direction: 'desc' },
    drillDown,
  } = req;

  const ds = DATASETS[datasetCode];
  if (!ds) throw new Error(`Dataset inconnu: ${datasetCode}`);

  const maxLimite = Math.min(Math.max(limite, 1), 500);

  // ── Parser les dimensions ──
  const dims = [];
  const selectCols = [];
  const groupByCols = [];
  const joins = [];
  let joinIdx = 0;

  for (const dimKey of dimKeys) {
    const parsed = parseDimension(dimKey, ds, granularite);
    if (!parsed) continue;
    dims.push(parsed);

    selectCols.push(`${parsed.sql} AS ${parsed.alias}`);
    groupByCols.push(parsed.sql);

    if (parsed.join) {
      joins.push(parsed.join);
      joinIdx++;
    }
  }

  // Si granularite est spécifiée et pas de dimension temporelle explicite → ajouter
  if (granularite && !dims.some(d => d.type === 'temporal')) {
    const granDef = GRANULARITES[granularite];
    if (granDef && ds.colonneDate) {
      const sql = granDef.sql(ds.colonneDate);
      const alias = 'dim_periode';
      dims.push({ type: 'temporal', cle: 'periode', sql, alias, model: null });
      selectCols.push(`${sql} AS ${alias}`);
      groupByCols.push(sql);
    }
  }

  // ── Construire les mesures SQL ──
  const mesureSqls = [];
  const mesuresMeta = [];

  for (const m of mesures) {
    switch (m.type) {
      case 'COUNT':
        mesureSqls.push('COUNT(*) AS nombre');
        mesuresMeta.push({ cle: 'nombre', type: 'COUNT', format: 'entier' });
        break;
      case 'SUM': {
        const col = resolveColonneMesure(m.colonne, ds);
        mesureSqls.push(`COALESCE(SUM(${col}), 0) AS montant_total`);
        mesuresMeta.push({ cle: 'montant_total', type: 'SUM', format: 'montant' });
        break;
      }
      case 'AVG': {
        const col = resolveColonneMesure(m.colonne, ds);
        mesureSqls.push(`COALESCE(AVG(${col}), 0) AS montant_moyen`);
        mesuresMeta.push({ cle: 'montant_moyen', type: 'AVG', format: 'montant' });
        break;
      }
      case 'MIN': {
        const col = resolveColonneMesure(m.colonne, ds);
        mesureSqls.push(`MIN(${col}) AS valeur_min`);
        mesuresMeta.push({ cle: 'valeur_min', type: 'MIN', format: 'montant' });
        break;
      }
      case 'MAX': {
        const col = resolveColonneMesure(m.colonne, ds);
        mesureSqls.push(`MAX(${col}) AS valeur_max`);
        mesuresMeta.push({ cle: 'valeur_max', type: 'MAX', format: 'montant' });
        break;
      }
      case 'RATIO': {
        // Ratio = COUNT ou SUM avec filtre numérateur / total
        // Sera calculé en post-processing
        mesureSqls.push('COUNT(*) AS _ratio_denominateur');
        if (m.filtreNum?.statut) {
          mesureSqls.push(`COUNT(*) FILTER (WHERE ${ds.alias}.statut_paiement = '${sanitize(m.filtreNum.statut)}') AS _ratio_numerateur`);
        } else {
          mesureSqls.push('COUNT(*) AS _ratio_numerateur');
        }
        mesuresMeta.push({ cle: 'ratio', type: 'RATIO', format: 'pourcentage' });
        break;
      }
      default:
        mesureSqls.push('COUNT(*) AS nombre');
        mesuresMeta.push({ cle: 'nombre', type: 'COUNT', format: 'entier' });
    }
  }

  // ── Construire le WHERE ──
  const { where, params } = buildWhereClause(filtres, ds, drillDown);

  // ── Déterminer le ORDER BY ──
  const orderCol = resolveOrderColumn(tri.colonne, mesuresMeta);
  const orderDir = tri.direction === 'asc' ? 'ASC' : 'DESC';

  // ── Assembler le SQL ──
  const sql = `
    SELECT ${selectCols.concat(mesureSqls).join(', ')}
    FROM ${ds.table} ${ds.alias}
    ${joins.join('\n    ')}
    ${where}
    ${groupByCols.length > 0 ? `GROUP BY ${groupByCols.join(', ')}` : ''}
    ORDER BY ${orderCol} ${orderDir}
    LIMIT ${maxLimite}
  `;

  // ── Exécuter ──
  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(sql, ...params);
  } catch (err) {
    throw new Error(`Erreur SQL: ${err.message.substring(0, 200)}`);
  }

  // ── Post-processing : résolution noms + formatage ──
  const formattedRows = await formatRows(rows, dims, mesuresMeta);

  // ── Compter le total (sans LIMIT) ──
  let total = formattedRows.length;
  if (formattedRows.length >= maxLimite) {
    try {
      const countSql = `
        SELECT COUNT(*) AS cnt FROM (
          SELECT 1
          FROM ${ds.table} ${ds.alias}
          ${joins.join('\n          ')}
          ${where}
          ${groupByCols.length > 0 ? `GROUP BY ${groupByCols.join(', ')}` : ''}
        ) sub
      `;
      const [{ cnt }] = await prisma.$queryRawUnsafe(countSql, ...params);
      total = Number(cnt);
    } catch { /* fallback */ }
  }

  return {
    rows: formattedRows,
    meta: {
      dataset: datasetCode,
      dimensions: dims.map(d => d.cle),
      mesures: mesuresMeta,
      total,
      limite: maxLimite,
      dureeMs: Date.now() - debut,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// DIMENSIONS DISPONIBLES (pour le frontend)
// ═══════════════════════════════════════════════════════════════

export async function getDimensionsDisponibles(datasetCode, serviceId, formulaireId) {
  const ds = DATASETS[datasetCode || 'soumissions'];
  if (!ds) return { fixes: [], dynamiques: [] };

  const fixes = Object.entries(ds.dimensions).map(([cle, def]) => ({
    cle,
    libelle: cle.charAt(0).toUpperCase() + cle.slice(1).replace(/_/g, ' '),
    type: 'fixed',
  }));

  // Dimensions temporelles
  const temporelles = Object.keys(GRANULARITES).map(g => ({
    cle: `periode_${g.toLowerCase()}`,
    libelle: g.charAt(0) + g.slice(1).toLowerCase(),
    type: 'temporal',
    granularite: g,
  }));

  // Dimensions dynamiques (champs formulaire) — uniquement pour dataset soumissions
  let dynamiques = [];
  if (datasetCode === 'soumissions' || !datasetCode) {
    const where = { estDimension: true };
    if (serviceId) where.serviceId = serviceId;
    if (formulaireId) where.formulaireId = formulaireId;

    const champs = await prisma.champFormulaire.findMany({
      where,
      select: { id: true, cleChamp: true, libelleChamp: true, typeChamp: true, serviceId: true, optionsDisponibles: true },
      orderBy: [{ serviceId: 'asc' }, { ordreAffichage: 'asc' }],
    });

    dynamiques = champs.map(c => ({
      cle: `champ_${c.id}`,
      libelle: c.libelleChamp,
      type: 'dynamic',
      typeChamp: c.typeChamp,
      options: c.optionsDisponibles || [],
    }));
  }

  return { fixes, temporelles, dynamiques };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════

function parseDimension(dimKey, ds, granularite) {
  // Dimension dynamique (champ formulaire)
  if (dimKey.startsWith('champ_')) {
    const champId = parseInt(dimKey.replace('champ_', ''), 10);
    if (isNaN(champId)) return null;
    const alias = `dim_champ_${champId}`;
    return {
      type: 'dynamic',
      cle: dimKey,
      champId,
      sql: `vs_${champId}.valeur`,
      alias,
      model: null,
      join: `LEFT JOIN valeurs_soumission vs_${champId} ON vs_${champId}.soumission_id = ${ds.alias}.id AND vs_${champId}.champ_formulaire_id = ${champId}`,
    };
  }

  // Dimension temporelle (période avec granularité)
  if (dimKey === 'periode' || dimKey.startsWith('periode_') || dimKey.startsWith('date_')) {
    const gran = dimKey.startsWith('periode_') || dimKey.startsWith('date_') ? dimKey.replace(/^(periode_|date_)/, '').toUpperCase() : (granularite || 'MOIS');
    const granDef = GRANULARITES[gran];
    if (!granDef || !ds.colonneDate) return null;
    const sql = granDef.sql(ds.colonneDate);
    return { type: 'temporal', cle: 'periode', sql, alias: 'dim_periode', model: null };
  }

  // Dimension fixe du dataset
  const dimDef = ds.dimensions[dimKey];
  if (!dimDef) return null;
  return {
    type: 'fixed',
    cle: dimKey,
    sql: dimDef.sql,
    alias: `dim_${dimKey}`,
    model: dimDef.model,
    champ: dimDef.champ || 'nomFr',
  };
}

function resolveColonneMesure(colonne, ds) {
  if (colonne === 'montant_paye' && ds.colonneMontantPaye) return ds.colonneMontantPaye;
  if (colonne === 'montant' || !colonne) return ds.colonneMontant || '0';
  return ds.colonneMontant || '0';
}

function resolveOrderColumn(colonne, mesuresMeta) {
  const validCols = ['nombre', 'montant_total', 'montant_moyen', 'valeur_min', 'valeur_max', 'ratio'];
  if (validCols.includes(colonne)) {
    if (colonne === 'ratio') return '_ratio_numerateur';
    return colonne;
  }
  // Défaut : première mesure
  return mesuresMeta[0]?.cle || 'nombre';
}

function buildWhereClause(filtres, ds, drillDown) {
  const conditions = [];
  const params = [];
  let idx = 1;

  // Filtre temporel
  if (filtres.date_debut && ds.colonneDate) {
    conditions.push(`${ds.colonneDate} >= $${idx}`);
    params.push(new Date(filtres.date_debut));
    idx++;
  }
  if (filtres.date_fin && ds.colonneDate) {
    const fin = new Date(filtres.date_fin);
    fin.setHours(23, 59, 59, 999);
    conditions.push(`${ds.colonneDate} <= $${idx}`);
    params.push(fin);
    idx++;
  }

  // Filtres fixes du dataset
  for (const [cle, colSql] of Object.entries(ds.filtres || {})) {
    if (filtres[cle] !== undefined && filtres[cle] !== null && filtres[cle] !== '') {
      if (Array.isArray(filtres[cle])) {
        // IN clause
        const placeholders = filtres[cle].map((_, i) => `$${idx + i}`).join(', ');
        conditions.push(`${colSql} IN (${placeholders})`);
        params.push(...filtres[cle]);
        idx += filtres[cle].length;
      } else {
        conditions.push(`${colSql} = $${idx}`);
        params.push(filtres[cle]);
        idx++;
      }
    }
  }

  // Filtres dynamiques (champs formulaire)
  if (filtres.champs && typeof filtres.champs === 'object') {
    for (const [champIdStr, valeur] of Object.entries(filtres.champs)) {
      const champId = parseInt(champIdStr, 10);
      if (isNaN(champId)) continue;
      conditions.push(
        `EXISTS (SELECT 1 FROM valeurs_soumission vf WHERE vf.soumission_id = ${ds.alias}.id AND vf.champ_formulaire_id = $${idx} AND vf.valeur = $${idx + 1})`
      );
      params.push(champId, String(valeur));
      idx += 2;
    }
  }

  // Drill-down (filtre additionnel par dimension)
  if (drillDown?.dimension && drillDown?.valeur) {
    const dimDef = ds.dimensions[drillDown.dimension];
    if (dimDef) {
      conditions.push(`${dimDef.sql} = $${idx}`);
      params.push(drillDown.valeur);
      idx++;
    } else if (drillDown.dimension.startsWith('champ_')) {
      const champId = parseInt(drillDown.dimension.replace('champ_', ''), 10);
      if (!isNaN(champId)) {
        conditions.push(
          `EXISTS (SELECT 1 FROM valeurs_soumission vdd WHERE vdd.soumission_id = ${ds.alias}.id AND vdd.champ_formulaire_id = $${idx} AND vdd.valeur = $${idx + 1})`
        );
        params.push(champId, String(drillDown.valeur));
        idx += 2;
      }
    }
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function formatRows(rows, dims, mesuresMeta) {
  if (!rows.length) return [];

  // Résoudre les noms des dimensions fixes (batch)
  const nomsCache = {};
  for (const dim of dims) {
    if (dim.type === 'fixed' && dim.model) {
      const ids = [...new Set(rows.map(r => r[dim.alias]).filter(Boolean))];
      if (ids.length === 0) continue;
      try {
        const records = await prisma[dim.model].findMany({
          where: { id: { in: ids } },
          select: { id: true, [dim.champ]: true },
        });
        nomsCache[dim.cle] = new Map(records.map(r => [r.id, r[dim.champ]]));
      } catch {
        nomsCache[dim.cle] = new Map();
      }
    }
  }

  // Résoudre les labels des dimensions dynamiques (champs formulaire) — batch
  const optionsCache = {};
  for (const dim of dims) {
    if (dim.type === 'dynamic' && dim.champId) {
      try {
        const champ = await prisma.champFormulaire.findUnique({
          where: { id: dim.champId },
          select: { optionsDisponibles: true },
        });
        const options = champ?.optionsDisponibles;
        if (Array.isArray(options) && options.length > 0) {
          optionsCache[dim.cle] = new Map(options.map(o => [String(o.value ?? o.valeur ?? ''), o.label ?? o.libelle ?? String(o.value ?? o.valeur ?? '')]));
        }
      } catch {
        // pas d'options disponibles, on garde la valeur brute
      }
    }
  }

  return rows.map(row => {
    const result = { dimensions: {} };

    // Dimensions
    for (const dim of dims) {
      const rawVal = row[dim.alias];
      if (dim.type === 'fixed' && dim.model) {
        result.dimensions[dim.cle] = {
          id: rawVal,
          nom: nomsCache[dim.cle]?.get(rawVal) || rawVal || '(non défini)',
        };
      } else if (dim.type === 'dynamic' && optionsCache[dim.cle]) {
        const label = optionsCache[dim.cle].get(String(rawVal ?? ''));
        result.dimensions[dim.cle] = {
          id: rawVal,
          nom: label || (rawVal != null ? String(rawVal) : '(non défini)'),
        };
      } else {
        result.dimensions[dim.cle] = {
          id: rawVal,
          nom: rawVal != null ? String(rawVal) : '(non défini)',
        };
      }
    }

    // Mesures
    for (const m of mesuresMeta) {
      if (m.type === 'RATIO') {
        const num = Number(row._ratio_numerateur || 0);
        const den = Number(row._ratio_denominateur || 0);
        result[m.cle] = den > 0 ? Math.round((num / den) * 10000) / 100 : 0;
      } else {
        result[m.cle] = Number(row[m.cle] || 0);
      }
    }

    return result;
  });
}

function sanitize(val) {
  // Protection injection SQL pour les valeurs inline (uniquement pour FILTER WHERE)
  return String(val).replace(/[^a-zA-Z0-9_]/g, '');
}

// ═══════════════════════════════════════════════════════════════
// TABLEAU CROISE (PIVOT) — version BI
// ═══════════════════════════════════════════════════════════════

export async function executerTableauCroise(req) {
  const {
    dataset: datasetCode = 'soumissions',
    dim_ligne,
    dim_colonne,
    mesure = 'count',
    filtres = {},
    drillDown,
  } = req;

  const ds = DATASETS[datasetCode];
  if (!ds || !dim_ligne || !dim_colonne) {
    return { colonnes: [], lignes: [], totauxColonnes: [], totalGeneral: 0 };
  }

  const dimL = parseDimension(dim_ligne, ds);
  const dimC = parseDimension(dim_colonne, ds);
  if (!dimL || !dimC) return { colonnes: [], lignes: [], totauxColonnes: [], totalGeneral: 0 };

  const selectL = dimL.sql;
  const selectC = dimC.sql;
  const joinsArr = [dimL.join, dimC.join].filter(Boolean);

  const valeurExpr = mesure === 'sum' ? `COALESCE(SUM(${ds.colonneMontant}), 0)` : 'COUNT(*)';
  const { where, params } = buildWhereClause(filtres, ds, drillDown);

  const sql = `
    SELECT ${selectL} AS ligne, ${selectC} AS colonne, ${valeurExpr} AS valeur
    FROM ${ds.table} ${ds.alias}
    ${joinsArr.join('\n    ')}
    ${where}
    GROUP BY ${selectL}, ${selectC}
    ORDER BY ${selectL}, ${selectC}
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);

  // Résoudre les noms
  const resolveNom = async (dim, rawVal) => {
    if (!rawVal) return '(non défini)';
    if (!dim.model) return String(rawVal);
    const record = await prisma[dim.model].findUnique({
      where: { id: rawVal },
      select: { [dim.champ || 'nomFr']: true },
    });
    return record?.[dim.champ || 'nomFr'] || String(rawVal);
  };

  // Pivoter
  const lignesSet = new Map();
  const colonnesSet = new Map();
  for (const row of rows) {
    if (!lignesSet.has(row.ligne)) lignesSet.set(row.ligne, null);
    if (!colonnesSet.has(row.colonne)) colonnesSet.set(row.colonne, null);
  }

  for (const key of lignesSet.keys()) lignesSet.set(key, await resolveNom(dimL, key));
  for (const key of colonnesSet.keys()) colonnesSet.set(key, await resolveNom(dimC, key));

  const colonnesArr = [...colonnesSet.entries()].map(([id, nom]) => ({ id, nom }));
  const colonneIndex = new Map(colonnesArr.map((c, i) => [c.id, i]));

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

  lignes.sort((a, b) => b.total - a.total);

  const totauxColonnes = colonnesArr.map((_, i) => lignes.reduce((sum, l) => sum + l.valeurs[i], 0));
  const totalGeneral = totauxColonnes.reduce((a, b) => a + b, 0);

  return {
    colonnes: colonnesArr.map(c => c.nom),
    colonnesIds: colonnesArr.map(c => c.id),
    lignes,
    totauxColonnes,
    totalGeneral,
  };
}

// ═══════════════════════════════════════════════════════════════
// VALEURS POSSIBLES (pour filtres)
// ═══════════════════════════════════════════════════════════════

export async function getValeursFiltres(datasetCode, filtreCle) {
  const ds = DATASETS[datasetCode || 'soumissions'];
  if (!ds) return [];

  // Dimensions standard → lister les valeurs distinctes
  const dimDef = ds.dimensions[filtreCle];
  if (dimDef && dimDef.model) {
    const records = await prisma[dimDef.model].findMany({
      where: { estActif: true },
      select: { id: true, [dimDef.champ || 'nomFr']: true },
      orderBy: { [dimDef.champ || 'nomFr']: 'asc' },
      take: 200,
    });
    return records.map(r => ({ id: r.id, nom: r[dimDef.champ || 'nomFr'] }));
  }

  // Dimensions sans modèle → DISTINCT sur la colonne
  if (dimDef) {
    const sql = `SELECT DISTINCT ${dimDef.sql} AS val FROM ${ds.table} ${ds.alias} WHERE ${dimDef.sql} IS NOT NULL ORDER BY val LIMIT 100`;
    const rows = await prisma.$queryRawUnsafe(sql);
    return rows.map(r => ({ id: r.val, nom: String(r.val) }));
  }

  return [];
}
