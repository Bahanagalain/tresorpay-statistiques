// ============================================================
// Données fictives DGD (Douane) — Cameroun
// ============================================================

export const KPI_DGD = {
  totalRecouvreDouane: 3_450_000_000,
  totalDeclarations: 2847,
  declarationsValidees: 2103,
  declarationsEnAttente: 512,
  declarationsLitigieuses: 232,
  tauxDedouanement: 73.9,
  progressionMoisPrecedent: +9.2,
  montantEnAttente: 1_120_000_000,
  montantLitigieux: 785_000_000,
};

export const EVOLUTION_MENSUELLE_DGD = [
  { mois: 'Jan 2026', valide: 980_000_000, enAttente: 310_000_000, litigieux: 120_000_000 },
  { mois: 'Fév 2026', valide: 870_000_000, enAttente: 390_000_000, litigieux: 180_000_000 },
  { mois: 'Mar 2026', valide: 1_600_000_000, enAttente: 420_000_000, litigieux: 485_000_000 },
];

export const PAR_BUREAU = [
  { bureau: 'Port de Douala', montant: 1_450_000_000, declarations: 987, taux: 86, color: '#2563EB' },
  { bureau: 'Aéroport YDE Int.', montant: 650_000_000,  declarations: 423, taux: 79, color: '#3B82F6' },
  { bureau: 'Frontière Nord-Kousséri', montant: 480_000_000,  declarations: 312, taux: 71, color: '#60A5FA' },
  { bureau: 'Frontière Est-Garoua-Boulaï', montant: 320_000_000,  declarations: 287, taux: 68, color: '#93C5FD' },
  { bureau: 'Frontière Ouest-Ekok', montant: 280_000_000,  declarations: 198, taux: 74, color: '#1E40AF' },
  { bureau: 'Entrepôts Spéciaux', montant: 270_000_000,  declarations: 640, taux: 91, color: '#1D4ED8' },
];

export const PAR_TYPE_MARCHANDISE = [
  { type: 'Équipements industriels', montant: 850_000_000, count: 342, color: '#2563EB' },
  { type: 'Denrées alimentaires',    montant: 620_000_000, count: 567, color: '#3B82F6' },
  { type: 'Véhicules & Transport',   montant: 540_000_000, count: 213, color: '#60A5FA' },
  { type: 'Matières premières',      montant: 480_000_000, count: 456, color: '#1E40AF' },
  { type: 'Pharmaceutiques',         montant: 420_000_000, count: 289, color: '#1D4ED8' },
  { type: 'Textiles & Vêtements',    montant: 280_000_000, count: 678, color: '#93C5FD' },
  { type: 'Produits électroniques',  montant: 260_000_000, count: 302, color: '#BFDBFE' },
];

export const DECLARATIONS_DOUANE = [
  { numero: 'DEC-2026-0087', declarant: 'SOTRAKMAH SARL', ninea: 'CM-DGD-123456', bureau: 'Port de Douala', typeMarchandise: 'Équipements industriels', montantTotal: 45_000_000, droitsDouane: 15_750_000, tvaImport: 8_100_000, statut: 'VALIDE',    dateDepot: '2026-03-15', pays: 'France',   regime: 'IM4' },
  { numero: 'DEC-2026-0088', declarant: 'CAMTEL SA',       ninea: 'CM-DGD-234567', bureau: 'Aéroport YDE Int.', typeMarchandise: 'Produits électroniques', montantTotal: 28_500_000, droitsDouane: 5_700_000,  tvaImport: 5_130_000, statut: 'EN_ATTENTE', dateDepot: '2026-03-16', pays: 'Chine',    regime: 'IM4' },
  { numero: 'DEC-2026-0089', declarant: 'BRASSERIES DU CAMEROUN', ninea: 'CM-DGD-345678', bureau: 'Frontière Nord-Kousséri', typeMarchandise: 'Matières premières', montantTotal: 62_000_000, droitsDouane: 6_200_000,  tvaImport: 11_160_000, statut: 'LITIGIEUX', dateDepot: '2026-03-17', pays: 'Nigeria',  regime: 'IM4' },
  { numero: 'DEC-2026-0090', declarant: 'MSC AGENTS CAMEROUN', ninea: 'CM-DGD-456789', bureau: 'Port de Douala', typeMarchandise: 'Véhicules & Transport', montantTotal: 95_000_000, droitsDouane: 28_500_000, tvaImport: 17_100_000, statut: 'VALIDE',    dateDepot: '2026-03-18', pays: 'Japon',    regime: 'IM4' },
  { numero: 'DEC-2026-0091', declarant: 'PHARMACAM SARL',  ninea: 'CM-DGD-567890', bureau: 'Aéroport YDE Int.', typeMarchandise: 'Pharmaceutiques', montantTotal: 12_400_000, droitsDouane: 620_000,    tvaImport: 2_232_000,  statut: 'VALIDE',    dateDepot: '2026-03-19', pays: 'Belgique', regime: 'IM4' },
  { numero: 'DEC-2026-0092', declarant: 'AGRITECH SAHEL',  ninea: 'CM-DGD-678901', bureau: 'Frontière Est-Garoua-Boulaï', typeMarchandise: 'Denrées alimentaires', montantTotal: 18_750_000, droitsDouane: 3_750_000,  tvaImport: 3_375_000,  statut: 'EN_ATTENTE', dateDepot: '2026-03-20', pays: 'Tchad',    regime: 'IM4' },
  { numero: 'DEC-2026-0093', declarant: 'HYDRO CAMEROUN',  ninea: 'CM-DGD-789012', bureau: 'Entrepôts Spéciaux', typeMarchandise: 'Équipements industriels', montantTotal: 134_000_000, droitsDouane: 26_800_000, tvaImport: 24_120_000, statut: 'VALIDE',    dateDepot: '2026-03-21', pays: 'Allemagne', regime: 'IM4' },
  { numero: 'DEC-2026-0094', declarant: 'TOYOTA CAMEROUN', ninea: 'CM-DGD-890123', bureau: 'Port de Douala', typeMarchandise: 'Véhicules & Transport', montantTotal: 87_500_000, droitsDouane: 26_250_000, tvaImport: 15_750_000, statut: 'EN_ATTENTE', dateDepot: '2026-03-22', pays: 'Japon',    regime: 'IM4' },
  { numero: 'DEC-2026-0095', declarant: 'SODECOTON',       ninea: 'CM-DGD-901234', bureau: 'Frontière Nord-Kousséri', typeMarchandise: 'Matières premières', montantTotal: 42_300_000, droitsDouane: 4_230_000,  tvaImport: 7_614_000,  statut: 'LITIGIEUX', dateDepot: '2026-03-23', pays: 'Nigeria',  regime: 'IM4' },
  { numero: 'DEC-2026-0096', declarant: 'ALUCAM SA',       ninea: 'CM-DGD-012345', bureau: 'Port de Douala', typeMarchandise: 'Équipements industriels', montantTotal: 215_000_000, droitsDouane: 43_000_000, tvaImport: 38_700_000, statut: 'VALIDE',    dateDepot: '2026-03-24', pays: 'France',   regime: 'IM4' },
];

export const PAR_PAYS_ORIGINE = [
  { pays: 'Chine',     montant: 980_000_000, pct: 28.4 },
  { pays: 'France',    montant: 620_000_000, pct: 18.0 },
  { pays: 'Nigeria',   montant: 415_000_000, pct: 12.0 },
  { pays: 'Inde',      montant: 290_000_000, pct: 8.4  },
  { pays: 'Japon',     montant: 245_000_000, pct: 7.1  },
  { pays: 'Allemagne', montant: 220_000_000, pct: 6.4  },
  { pays: 'USA',       montant: 185_000_000, pct: 5.4  },
  { pays: 'Autres',    montant: 495_000_000, pct: 14.3 },
];
