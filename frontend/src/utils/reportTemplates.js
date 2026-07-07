// ─── Report Subjects & Configuration ─────────────────────────

export const CHART_TYPES = [
  { id: 'bar',           label: 'Barres verticales',   icon: 'BarChart3',    description: 'Classement des entités par montant' },
  { id: 'horizontal_bar', label: 'Barres horizontales', icon: 'BarChart3',    description: 'Idéal pour les longs noms (CDIs, contribuables)' },
  { id: 'pie',           label: 'Camembert',           icon: 'PieChart',     description: 'Répartition en % (ex: taux de recouvrement par CDI)' },
  { id: 'donut',         label: 'Anneau',              icon: 'PieChart',     description: 'Variante du pie, plus moderne' },
  { id: 'line',          label: 'Courbe temporelle',   icon: 'TrendingUp',   description: 'Évolution sur une période' },
  { id: 'area',          label: 'Aire',                icon: 'TrendingUp',   description: 'Évolution avec remplissage (tendance visuelle)' },
  { id: 'comparison',    label: 'Comparatif',          icon: 'Columns',      description: 'Barres groupées, compare 2 entités ou 2 périodes' },
  { id: 'heatmap',       label: 'Carte de chaleur',    icon: 'Grid3x3',      description: 'Intensité de recouvrement par zone' },
  { id: 'kpi_cards',     label: 'Bandeau KPIs',        icon: 'LayoutGrid',   description: 'Cartes métriques (Total, Recouvré, Reste, Taux)' },
  { id: 'stackedBar',    label: 'Barres empilées',     icon: 'Layers',       description: 'Comparaison multi-séries empilées' },
];

export const CHART_LIMITS = [
  { value: 5, label: 'Top 5' },
  { value: 10, label: 'Top 10' },
  { value: 15, label: 'Top 15' },
  { value: 20, label: 'Top 20' },
  { value: 0, label: 'Tous' },
];

export const REPORT_SUBJECTS = [
  {
    id: 'cdis',
    name: 'Performance CDIs',
    icon: 'Building2',
    description: 'Classement et performance des centres d\'impôts',
    fetchKey: 'cdis',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'centre', label: 'Centre CDI', required: true },
      { id: 'montant', label: 'Montant Total', default: true, type: 'amount' },
      { id: 'montantRecouvre', label: 'Montant Recouvré', default: true, type: 'amount' },
      { id: 'montantRestant', label: 'Montant Restant', default: false, type: 'amount', computed: (r) => r.montant - r.montantRecouvre },
      { id: 'tauxRecouvrement', label: 'Taux (%)', default: true, type: 'percent' },
      { id: 'nombreAvis', label: 'Nb Avis', default: true, type: 'number' },
      { id: 'avisPaies', label: 'Avis Payés', default: false, type: 'number' },
      { id: 'avisEnAttente', label: 'Avis En Attente', default: false, type: 'number' },
      { id: 'avisEnRetard', label: 'Avis En Retard', default: false, type: 'number' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Recouvré, Reste, Taux)', default: true },
      { id: 'table_full', label: 'Tableau classement complet des CDIs', default: true },
      { id: 'table_top10', label: 'Top 10 CDIs uniquement', default: false },
    ],
    chartAxes: {
      x: [{ id: 'centre', label: 'Centre CDI' }],
      y: [
        { id: 'montant', label: 'Montant Total', color: '#6366F1' },
        { id: 'montantRecouvre', label: 'Montant Recouvré', color: '#059669' },
        { id: 'tauxRecouvrement', label: 'Taux (%)', color: '#D97706' },
        { id: 'nombreAvis', label: 'Nb Avis', color: '#2563EB' },
        { id: 'avisPaies', label: 'Avis Payés', color: '#14B8A6' },
        { id: 'avisEnRetard', label: 'Avis En Retard', color: '#DC2626' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'line', 'area', 'comparison', 'heatmap', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.montant || 0), 0), type: 'amount' },
      { id: 'recouvre', label: 'Recouvré', compute: (rows) => rows.reduce((s, r) => s + (r.montantRecouvre || 0), 0), type: 'amount' },
      { id: 'reste', label: 'Reste', compute: (rows) => rows.reduce((s, r) => s + ((r.montant || 0) - (r.montantRecouvre || 0)), 0), type: 'amount' },
      { id: 'taux', label: 'Taux Global', compute: (rows) => { const t = rows.reduce((s, r) => s + (r.montant || 0), 0); const r = rows.reduce((s, r2) => s + (r2.montantRecouvre || 0), 0); return t > 0 ? ((r / t) * 100).toFixed(1) : '0'; }, type: 'percent' },
    ],
  },
  {
    id: 'regions',
    name: 'Régions Fiscales',
    icon: 'Map',
    description: 'Classement régional avec CDIs rattachés',
    fetchKey: 'regions',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'name', label: 'Région', required: true },
      { id: 'target', label: 'Montant Total', default: true, type: 'amount' },
      { id: 'value', label: 'Montant Recouvré', default: true, type: 'amount' },
      { id: 'nbCdis', label: 'Nb CDIs', default: true, type: 'number' },
      { id: 'nbAvis', label: 'Nb Avis', default: true, type: 'number' },
      { id: 'tauxRecouvrement', label: 'Taux (%)', default: true, type: 'percent' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI', default: true },
      { id: 'table_full', label: 'Tableau classement des régions', default: true },
    ],
    chartAxes: {
      x: [{ id: 'name', label: 'Région' }],
      y: [
        { id: 'target', label: 'Montant Total', color: '#6366F1' },
        { id: 'value', label: 'Montant Recouvré', color: '#059669' },
        { id: 'nbCdis', label: 'Nb CDIs', color: '#2563EB' },
        { id: 'nbAvis', label: 'Nb Avis', color: '#D97706' },
        { id: 'tauxRecouvrement', label: 'Taux (%)', color: '#DC2626' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'line', 'area', 'comparison', 'heatmap', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.target || 0), 0), type: 'amount' },
      { id: 'recouvre', label: 'Recouvré', compute: (rows) => rows.reduce((s, r) => s + (r.value || 0), 0), type: 'amount' },
      { id: 'cdis', label: 'CDIs', compute: (rows) => rows.reduce((s, r) => s + (r.nbCdis || 0), 0), type: 'number' },
      { id: 'taux', label: 'Taux Global', compute: (rows) => { const t = rows.reduce((s, r) => s + (r.target || 0), 0); const v = rows.reduce((s, r2) => s + (r2.value || 0), 0); return t > 0 ? ((v / t) * 100).toFixed(1) : '0'; }, type: 'percent' },
    ],
  },
  {
    id: 'contribuables',
    name: 'Contribuables',
    icon: 'Users',
    description: 'Analyse des contribuables avec dettes et conformité',
    fetchKey: 'contribuables',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'contribuable', label: 'Contribuable', required: true },
      { id: 'nui', label: 'NUI', required: true },
      { id: 'centre', label: 'Centre CDI', default: false },
      { id: 'nombreAvis', label: 'Nb Avis', default: true, type: 'number' },
      { id: 'montantTotal', label: 'Montant Total', default: true, type: 'amount' },
      { id: 'montantPaye', label: 'Montant Payé', default: true, type: 'amount' },
      { id: 'montantDu', label: 'Reste Dû', default: true, type: 'amount', computed: (r) => (r.montantTotal || 0) - (r.montantPaye || 0) },
      { id: 'tauxPaiement', label: 'Taux (%)', default: true, type: 'percent' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Nb Contribuables, Taux)', default: true },
      { id: 'table_full', label: 'Liste complète des contribuables', default: true },
    ],
    chartAxes: {
      x: [
        { id: 'contribuable', label: 'Contribuable' },
        { id: 'centre', label: 'Centre CDI' },
      ],
      y: [
        { id: 'montantTotal', label: 'Montant Total', color: '#6366F1' },
        { id: 'montantPaye', label: 'Montant Payé', color: '#059669' },
        { id: 'montantDu', label: 'Reste Dû', color: '#DC2626', computed: (r) => (r.montantTotal || 0) - (r.montantPaye || 0) },
        { id: 'tauxPaiement', label: 'Taux (%)', color: '#D97706' },
        { id: 'nombreAvis', label: 'Nb Avis', color: '#2563EB' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'line', 'area', 'comparison', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.montantTotal || 0), 0), type: 'amount' },
      { id: 'paye', label: 'Payé', compute: (rows) => rows.reduce((s, r) => s + (r.montantPaye || 0), 0), type: 'amount' },
      { id: 'nb', label: 'Contribuables', compute: (rows) => rows.length, type: 'number' },
      { id: 'taux', label: 'Taux Moyen', compute: (rows) => { const t = rows.reduce((s, r) => s + (r.montantTotal || 0), 0); const p = rows.reduce((s, r) => s + (r.montantPaye || 0), 0); return t > 0 ? ((p / t) * 100).toFixed(1) : '0'; }, type: 'percent' },
    ],
  },
  {
    id: 'taxes',
    name: 'Types de Taxes',
    icon: 'PieChart',
    description: 'Ventilation des recettes par type d\'impôt',
    fetchKey: 'taxes',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'code', label: 'Code', required: false, default: true },
      { id: 'type', label: 'Libellé', required: true },
      { id: 'montant', label: 'Montant', default: true, type: 'amount' },
      { id: 'count', label: 'Nb Imputations', default: true, type: 'number' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Nb Types)', default: true },
      { id: 'table_full', label: 'Tableau ventilation complète', default: true },
    ],
    chartAxes: {
      x: [{ id: 'type', label: 'Type de Taxe' }],
      y: [
        { id: 'montant', label: 'Montant', color: '#D97706' },
        { id: 'count', label: 'Nb Imputations', color: '#2563EB' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'area', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.montant || 0), 0), type: 'amount' },
      { id: 'types', label: 'Types de Taxes', compute: (rows) => rows.length, type: 'number' },
    ],
  },
  {
    id: 'communes',
    name: 'Communes Bénéficiaires',
    icon: 'Target',
    description: 'Recettes par collectivité territoriale décentralisée',
    fetchKey: 'communes',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'commune', label: 'Commune / Bénéficiaire', required: true },
      { id: 'montant', label: 'Montant', default: true, type: 'amount' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Nb Communes)', default: true },
      { id: 'table_full', label: 'Liste complète des communes', default: true },
    ],
    chartAxes: {
      x: [{ id: 'commune', label: 'Commune' }],
      y: [{ id: 'montant', label: 'Montant', color: '#8B5CF6' }],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'heatmap', 'kpi_cards'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.montant || 0), 0), type: 'amount' },
      { id: 'communes', label: 'Communes', compute: (rows) => rows.length, type: 'number' },
    ],
  },
  {
    id: 'avis',
    name: 'Registre des Avis',
    icon: 'FileText',
    description: 'Liste détaillée des avis d\'imposition',
    fetchKey: 'avis',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'numero', label: 'N° Avis', required: true },
      { id: 'contribuable', label: 'Contribuable', required: true },
      { id: 'nui', label: 'NUI', default: false },
      { id: 'centre', label: 'Centre CDI', default: true },
      { id: 'montantTotal', label: 'Montant', default: true, type: 'amount' },
      { id: 'dateCreation', label: 'Date', default: true },
      { id: 'statut', label: 'Statut', default: true },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Payés, Attente, Retard)', default: true },
      { id: 'table_full', label: 'Registre complet', default: true },
    ],
    chartAxes: {
      x: [
        { id: 'statut', label: 'Statut' },
        { id: 'centre', label: 'Centre CDI' },
      ],
      y: [
        { id: 'montantTotal', label: 'Montant', color: '#059669' },
        { id: '_count', label: 'Nombre d\'avis', color: '#2563EB' },
      ],
      supportedTypes: ['bar', 'pie', 'donut', 'kpi_cards'],
    },
    kpiFields: [
      { id: 'total', label: 'Total Avis', compute: (rows) => rows.length, type: 'number' },
      { id: 'paid', label: 'Payés', compute: (rows) => rows.filter(r => r.statut === 'PAID').length, type: 'number' },
      { id: 'pending', label: 'En Attente', compute: (rows) => rows.filter(r => r.statut === 'PENDING').length, type: 'number' },
      { id: 'overdue', label: 'En Retard', compute: (rows) => rows.filter(r => r.statut === 'OVERDUE').length, type: 'number' },
    ],
    filters: [
      { id: 'statut', label: 'Filtrer par statut', options: ['TOUS', 'PAID', 'PENDING', 'OVERDUE'] },
    ],
  },
];

export const FORMAT_OPTIONS = [
  { id: 'pdf',    label: 'PDF',         description: 'Rapport complet avec graphiques, KPIs et tableaux', icon: 'FileText' },
  { id: 'excel',  label: 'Excel',       description: 'Données tabulaires exploitables avec formules', icon: 'Table' },
  { id: 'charts', label: 'Graphiques',  description: 'Export graphiques uniquement (PDF ou PNG)', icon: 'BarChart3' },
];
