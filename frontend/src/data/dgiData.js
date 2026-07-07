// ============================================================
// DONNÉES FICTIVES DGI — Structure basée sur les avis d'imposition TresorPay
// À remplacer par des appels API réels vers DGI/TresorPay
// ============================================================

// --- Codes fiscaux & libellés ---
export const CODE_FISCAUX = {
  71600: "Impôt Général Synthétique (IGS)",
  71210: "Taxe de développement local sur patente ou IGS",
  4752401: "Frais d'assiette sur IGS",
  4752402: "TDL retenue centralisée",
  44338587982: "IGS part FEICOM",
  71430: "Impôt sur les Revenus des Personnes Physiques (IRPP)",
  71420: "Impôt sur les Sociétés (IS)",
  71500: "Taxe sur la Valeur Ajoutée (TVA)",
  71610: "Patente",
  71620: "Licence",
};

// --- Centres CDI ---
export const CENTRES_CDI = [
  "CDI YAOUNDE 1", "CDI YAOUNDE 2", "CDI YAOUNDE 3",
  "CDI YAOUNDE 4", "CDI YAOUNDE 5", "CDI DOUALA 1",
  "CDI DOUALA 2", "CDI DOUALA 3", "CDI BAFOUSSAM",
  "CDI GAROUA", "CDI MAROUA", "CDI BERTOUA",
];

// --- Communes bénéficiaires ---
export const COMMUNES = [
  "COMMUNE DE YAOUNDE 1", "COMMUNE DE YAOUNDE 2", "COMMUNE DE YAOUNDE 3",
  "COMMUNE DE DOUALA 1", "COMMUNE DE DOUALA 2", "COMMUNE DE NGAOUNDAL",
  "COMMUNE DE TIBATI", "COMMUNE DE BAFOUSSAM", "COMMUNE DE GAROUA",
  "COMMUNE DE MAROUA", "COMMUNE DE BERTOUA", "COMMUNE DE EBOLOWA",
];

// --- Avis d'imposition fictifs ---
export const AVIS_IMPOSITION = [
  {
    numero: "0010204144726", contribuable: "MOUHAMADOU AWAL",
    nui: "P1075123499958G", poste: 597,
    centre: "CDI YAOUNDE 5", montantTotal: 9376,
    dateCreation: "2026-03-24", datePaiement: "2026-03-24",
    statut: "PAID", codeUnique: "DGI260324000011",
    imputations: [
      { code: 71600, libelle: "Impôt Général Synthétique (IGS)", beneficiaire: "COMMUNE DE NGAOUNDAL", montant: 2160 },
      { code: 71600, libelle: "Impôt Général Synthétique (IGS)", beneficiaire: "COMMUNE DE TIBATI", montant: 3240 },
      { code: 4752401, libelle: "Frais d'assiette sur IGS", beneficiaire: "CDI YAOUNDE 5", montant: 750 },
      { code: 4752402, libelle: "TDL retenue centralisée", beneficiaire: "CDI YAOUNDE 5", montant: 188 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE NGAOUNDAL", montant: 675 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE TIBATI", montant: 1013 },
      { code: 44338587982, libelle: "IGS part FEICOM", beneficiaire: "INSTITUTION FEICOM", montant: 1350 },
    ],
  },
  {
    numero: "0010204150023", contribuable: "ENTREPRISE MODERNE SARL",
    nui: "M082145367821C", poste: 312,
    centre: "CDI DOUALA 2", montantTotal: 145800,
    dateCreation: "2026-03-25", datePaiement: "2026-03-25",
    statut: "PAID", codeUnique: "DGI260325000042",
    imputations: [
      { code: 71420, libelle: "Impôt sur les Sociétés (IS)", beneficiaire: "ETAT DU CAMEROUN", montant: 98000 },
      { code: 71500, libelle: "Taxe sur la Valeur Ajoutée (TVA)", beneficiaire: "ETAT DU CAMEROUN", montant: 42000 },
      { code: 4752401, libelle: "Frais d'assiette sur IGS", beneficiaire: "CDI DOUALA 2", montant: 5800 },
    ],
  },
  {
    numero: "0010204151987", contribuable: "KAMGA BERTRAND",
    nui: "P0923456712H", poste: 445,
    centre: "CDI BAFOUSSAM", montantTotal: 54200,
    dateCreation: "2026-03-25", datePaiement: null,
    statut: "PENDING", codeUnique: "DGI260325000089",
    imputations: [
      { code: 71430, libelle: "IRPP", beneficiaire: "ETAT DU CAMEROUN", montant: 38500 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE BAFOUSSAM", montant: 12400 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE BAFOUSSAM", montant: 3300 },
    ],
  },
  {
    numero: "0010204152341", contribuable: "NGONO CLAIRE MICHELINE",
    nui: "P1134567890K", poste: 201,
    centre: "CDI YAOUNDE 3", montantTotal: 18900,
    dateCreation: "2026-03-26", datePaiement: "2026-03-26",
    statut: "PAID", codeUnique: "DGI260326000017",
    imputations: [
      { code: 71600, libelle: "Impôt Général Synthétique (IGS)", beneficiaire: "COMMUNE DE YAOUNDE 3", montant: 12500 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE YAOUNDE 3", montant: 4200 },
      { code: 44338587982, libelle: "IGS part FEICOM", beneficiaire: "INSTITUTION FEICOM", montant: 2200 },
    ],
  },
  {
    numero: "0010204153890", contribuable: "BELLO IBRAHIM ET FILS",
    nui: "M073289145623F", poste: 789,
    centre: "CDI GAROUA", montantTotal: 320000,
    dateCreation: "2026-03-26", datePaiement: null,
    statut: "PENDING", codeUnique: "DGI260326000031",
    imputations: [
      { code: 71420, libelle: "Impôt sur les Sociétés (IS)", beneficiaire: "ETAT DU CAMEROUN", montant: 220000 },
      { code: 71500, libelle: "Taxe sur la Valeur Ajoutée (TVA)", beneficiaire: "ETAT DU CAMEROUN", montant: 85000 },
      { code: 71610, libelle: "Patente", beneficiaire: "COMMUNE DE GAROUA", montant: 15000 },
    ],
  },
  {
    numero: "0010204154210", contribuable: "TCHOUPO ELECTRO PLUS",
    nui: "M081923456712B", poste: 560,
    centre: "CDI YAOUNDE 1", montantTotal: 78450,
    dateCreation: "2026-03-27", datePaiement: "2026-03-27",
    statut: "PAID", codeUnique: "DGI260327000008",
    imputations: [
      { code: 71600, libelle: "Impôt Général Synthétique (IGS)", beneficiaire: "COMMUNE DE YAOUNDE 1", montant: 52000 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE YAOUNDE 1", montant: 18000 },
      { code: 4752401, libelle: "Frais d'assiette sur IGS", beneficiaire: "CDI YAOUNDE 1", montant: 5450 },
      { code: 44338587982, libelle: "IGS part FEICOM", beneficiaire: "INSTITUTION FEICOM", montant: 3000 },
    ],
  },
  {
    numero: "0010204155001", contribuable: "FOUDA MARIE THERESE",
    nui: "P0867234512M", poste: 102,
    centre: "CDI DOUALA 1", montantTotal: 6750,
    dateCreation: "2026-03-27", datePaiement: null,
    statut: "OVERDUE", codeUnique: "DGI260327000055",
    imputations: [
      { code: 71600, libelle: "Impôt Général Synthétique (IGS)", beneficiaire: "COMMUNE DE DOUALA 1", montant: 4500 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE DOUALA 1", montant: 1500 },
      { code: 44338587982, libelle: "IGS part FEICOM", beneficiaire: "INSTITUTION FEICOM", montant: 750 },
    ],
  },
  {
    numero: "0010204156789", contribuable: "ALIM Hassan TRADING",
    nui: "M065432189023E", poste: 833,
    centre: "CDI MAROUA", montantTotal: 189500,
    dateCreation: "2026-03-28", datePaiement: "2026-03-28",
    statut: "PAID", codeUnique: "DGI260328000022",
    imputations: [
      { code: 71600, libelle: "Impôt Général Synthétique (IGS)", beneficiaire: "COMMUNE DE MAROUA", montant: 125000 },
      { code: 71610, libelle: "Patente", beneficiaire: "COMMUNE DE MAROUA", montant: 42000 },
      { code: 4752401, libelle: "Frais d'assiette sur IGS", beneficiaire: "CDI MAROUA", montant: 12500 },
      { code: 44338587982, libelle: "IGS part FEICOM", beneficiaire: "INSTITUTION FEICOM", montant: 10000 },
    ],
  },
  {
    numero: "0010204157345", contribuable: "NGUEFACK PIERRE",
    nui: "P1023456789A", poste: 678,
    centre: "CDI YAOUNDE 4", montantTotal: 23100,
    dateCreation: "2026-03-28", datePaiement: "2026-03-29",
    statut: "PAID", codeUnique: "DGI260328000078",
    imputations: [
      { code: 71430, libelle: "IRPP", beneficiaire: "ETAT DU CAMEROUN", montant: 16500 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE YAOUNDE 4", montant: 4800 },
      { code: 44338587982, libelle: "IGS part FEICOM", beneficiaire: "INSTITUTION FEICOM", montant: 1800 },
    ],
  },
  {
    numero: "0010204158012", contribuable: "BERTOUA AGRI SARL",
    nui: "M079123456012D", poste: 415,
    centre: "CDI BERTOUA", montantTotal: 67300,
    dateCreation: "2026-03-29", datePaiement: null,
    statut: "PENDING", codeUnique: "DGI260329000003",
    imputations: [
      { code: 71420, libelle: "Impôt sur les Sociétés (IS)", beneficiaire: "ETAT DU CAMEROUN", montant: 48000 },
      { code: 71500, libelle: "Taxe sur la Valeur Ajoutée (TVA)", beneficiaire: "ETAT DU CAMEROUN", montant: 16000 },
      { code: 71210, libelle: "Taxe de développement local sur patente ou IGS", beneficiaire: "COMMUNE DE BERTOUA", montant: 3300 },
    ],
  },
];

// ============================================================
// DONNÉES AGRÉGÉES — Évolution mensuelle (Janvier–Mars 2026)
// ============================================================
export const EVOLUTION_MENSUELLE = [
  { mois: "Jan 2026", paye: 4820000, enAttente: 1240000, enRetard: 380000, total: 6440000 },
  { mois: "Fév 2026", paye: 5630000, enAttente: 980000, enRetard: 290000, total: 6900000 },
  { mois: "Mar 2026", paye: 6120000, enAttente: 1580000, enRetard: 620000, total: 8320000 },
];

// --- Répartition par type de taxe ---
export const PAR_TYPE_TAXE = [
  { type: "IGS (71600)", montant: 1985000, count: 142, color: "#059669" },
  { type: "Impôt Sociétés (71420)", montant: 3660000, count: 28, color: "#2563EB" },
  { type: "TVA (71500)", montant: 2430000, count: 45, color: "#7C3AED" },
  { type: "IRPP (71430)", montant: 1280000, count: 89, color: "#D97706" },
  { type: "Patente (71610)", montant: 890000, count: 67, color: "#DC2626" },
  { type: "TDL (71210)", montant: 680000, count: 203, color: "#0891B2" },
  { type: "Frais assiette (4752401)", montant: 245000, count: 312, color: "#65A30D" },
  { type: "FEICOM (44338587982)", montant: 189000, count: 245, color: "#9333EA" },
];

// --- Répartition par centre CDI ---
export const PAR_CENTRE_CDI = [
  { centre: "CDI YAOUNDE 5", montant: 1850000, avis: 198, taux: 89 },
  { centre: "CDI YAOUNDE 1", montant: 1620000, avis: 175, taux: 92 },
  { centre: "CDI DOUALA 1", montant: 1980000, avis: 220, taux: 76 },
  { centre: "CDI DOUALA 2", montant: 1540000, avis: 167, taux: 88 },
  { centre: "CDI DOUALA 3", montant: 1230000, avis: 134, taux: 91 },
  { centre: "CDI BAFOUSSAM", montant: 890000, avis: 98, taux: 85 },
  { centre: "CDI GAROUA", montant: 760000, avis: 82, taux: 73 },
  { centre: "CDI MAROUA", montant: 580000, avis: 63, taux: 78 },
  { centre: "CDI BERTOUA", montant: 420000, avis: 45, taux: 81 },
];

// --- Répartition par commune bénéficiaire ---
export const PAR_COMMUNE = [
  { commune: "Commune de Yaounde 1", montant: 840000 },
  { commune: "Commune de Douala 1", montant: 920000 },
  { commune: "Commune de Douala 2", montant: 780000 },
  { commune: "Commune de Bafoussam", montant: 490000 },
  { commune: "Commune de Garoua", montant: 410000 },
  { commune: "Commune de Maroua", montant: 320000 },
  { commune: "Commune de Ngaoundal", montant: 215000 },
  { commune: "Commune de Tibati", montant: 198000 },
  { commune: "Commune de Bertoua", montant: 245000 },
  { commune: "Institution FEICOM", montant: 380000 },
];

// --- KPIs globaux ---
export const KPI_GLOBAL = {
  totalRecouvre: 13547426,
  totalAvis: 912,
  tauxRecouvrement: 84.3,
  avisPayes: 648,
  avisEnAttente: 189,
  avisEnRetard: 75,
  montantEnAttente: 2802000,
  montantEnRetard: 1190000,
  progressionMoisPrecedent: +12.4,
};
