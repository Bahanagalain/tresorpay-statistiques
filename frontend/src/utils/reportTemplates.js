// ─── Report Subjects & Configuration ─────────────────────────

export const CHART_TYPES = [
  { id: 'bar',           label: 'Barres verticales',   icon: 'BarChart3',    description: 'Classement des entités par montant' },
  { id: 'horizontal_bar', label: 'Barres horizontales', icon: 'BarChart3',    description: 'Idéal pour les longs noms (ministères, services)' },
  { id: 'pie',           label: 'Camembert',           icon: 'PieChart',     description: 'Répartition en % (ex: taux de paiement par ministère)' },
  { id: 'donut',         label: 'Anneau',              icon: 'PieChart',     description: 'Variante du pie, plus moderne' },
  { id: 'line',          label: 'Courbe temporelle',   icon: 'TrendingUp',   description: 'Évolution sur une période' },
  { id: 'area',          label: 'Aire',                icon: 'TrendingUp',   description: 'Évolution avec remplissage (tendance visuelle)' },
  { id: 'comparison',    label: 'Comparatif',          icon: 'Columns',      description: 'Barres groupées, compare 2 entités ou 2 périodes' },
  { id: 'heatmap',       label: 'Carte de chaleur',    icon: 'Grid3x3',      description: 'Intensité de paiement par zone' },
  { id: 'kpi_cards',     label: 'Bandeau KPIs',        icon: 'LayoutGrid',   description: 'Cartes métriques (Total, Payé, Reste, Taux)' },
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
    id: 'ministeres',
    name: 'Performance Ministères',
    icon: 'Building2',
    description: 'Classement et performance des ministères',
    fetchKey: 'ministeres',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'ministereId', label: 'ID' },
      { id: 'nom', label: 'Ministère', required: true },
      { id: 'montant', label: 'Montant', default: true, type: 'number' },
      { id: 'nombreSoumissions', label: 'Soumissions', default: true, type: 'number' },
      { id: 'tauxPaiement', label: 'Taux Paiement (%)', default: true, type: 'number' },
      { id: 'couleur', label: 'Couleur' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Soumissions, Taux)', default: true },
      { id: 'table_full', label: 'Tableau classement complet des ministères', default: true },
      { id: 'table_top10', label: 'Top 10 ministères uniquement', default: false },
    ],
    chartAxes: {
      x: [{ id: 'nom', label: 'Ministère' }],
      y: [
        { id: 'montant', label: 'Montant', color: '#6366F1' },
        { id: 'nombreSoumissions', label: 'Soumissions', color: '#059669' },
        { id: 'tauxPaiement', label: 'Taux Paiement (%)', color: '#D97706' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'line', 'area', 'comparison', 'heatmap', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.montant || 0), 0), type: 'amount' },
      { id: 'soumissions', label: 'Soumissions', compute: (rows) => rows.reduce((s, r) => s + (r.nombreSoumissions || 0), 0), type: 'number' },
      { id: 'taux', label: 'Taux Moyen', compute: (rows) => { const t = rows.reduce((s, r) => s + (r.montant || 0), 0); return rows.length > 0 ? (rows.reduce((s, r) => s + (r.tauxPaiement || 0), 0) / rows.length).toFixed(1) : '0'; }, type: 'percent' },
    ],
  },
  {
    id: 'regions',
    name: 'Cartographie Régionale',
    icon: 'Map',
    description: 'Cartographie régionale des revenus et soumissions',
    fetchKey: 'regions',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'nom', label: 'Région', required: true },
      { id: 'valeur', label: 'Revenus', default: true, type: 'number' },
      { id: 'objectif', label: 'Objectif', default: true, type: 'number' },
      { id: 'nombreSoumissions', label: 'Soumissions', default: true, type: 'number' },
      { id: 'statut', label: 'Statut', default: true },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI', default: true },
      { id: 'table_full', label: 'Tableau classement des régions', default: true },
    ],
    chartAxes: {
      x: [{ id: 'nom', label: 'Région' }],
      y: [
        { id: 'valeur', label: 'Revenus', color: '#6366F1' },
        { id: 'objectif', label: 'Objectif', color: '#059669' },
        { id: 'nombreSoumissions', label: 'Soumissions', color: '#D97706' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'line', 'area', 'comparison', 'heatmap', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'revenus', label: 'Revenus Total', compute: (rows) => rows.reduce((s, r) => s + (r.valeur || 0), 0), type: 'amount' },
      { id: 'objectif', label: 'Objectif Total', compute: (rows) => rows.reduce((s, r) => s + (r.objectif || 0), 0), type: 'amount' },
      { id: 'soumissions', label: 'Soumissions', compute: (rows) => rows.reduce((s, r) => s + (r.nombreSoumissions || 0), 0), type: 'number' },
      { id: 'taux', label: 'Taux Global', compute: (rows) => { const o = rows.reduce((s, r) => s + (r.objectif || 0), 0); const v = rows.reduce((s, r2) => s + (r2.valeur || 0), 0); return o > 0 ? ((v / o) * 100).toFixed(1) : '0'; }, type: 'percent' },
    ],
  },
  {
    id: 'services',
    name: 'Répartition Services',
    icon: 'Users',
    description: 'Répartition des services par ministère et montant',
    fetchKey: 'services',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'nom', label: 'Service', required: true },
      { id: 'ministereNom', label: 'Ministère', default: true },
      { id: 'montant', label: 'Montant', default: true, type: 'number' },
      { id: 'nombreSoumissions', label: 'Soumissions', default: true, type: 'number' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Nb Services)', default: true },
      { id: 'table_full', label: 'Liste complète des services', default: true },
    ],
    chartAxes: {
      x: [{ id: 'nom', label: 'Service' }],
      y: [
        { id: 'montant', label: 'Montant', color: '#6366F1' },
        { id: 'nombreSoumissions', label: 'Soumissions', color: '#059669' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'line', 'area', 'comparison', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.montant || 0), 0), type: 'amount' },
      { id: 'nb', label: 'Services', compute: (rows) => rows.length, type: 'number' },
      { id: 'soumissions', label: 'Soumissions', compute: (rows) => rows.reduce((s, r) => s + (r.nombreSoumissions || 0), 0), type: 'number' },
    ],
  },
  {
    id: 'domaines',
    name: 'Répartition Domaines',
    icon: 'PieChart',
    description: 'Ventilation par domaine d\'activité',
    fetchKey: 'domaines',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'nom', label: 'Domaine', required: true },
      { id: 'montant', label: 'Montant', default: true, type: 'number' },
      { id: 'nombreSoumissions', label: 'Soumissions', default: true, type: 'number' },
      { id: 'tauxPaiement', label: 'Taux (%)', default: true, type: 'number' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Total, Nb Domaines)', default: true },
      { id: 'table_full', label: 'Tableau ventilation complète', default: true },
    ],
    chartAxes: {
      x: [{ id: 'nom', label: 'Domaine' }],
      y: [
        { id: 'montant', label: 'Montant', color: '#D97706' },
        { id: 'nombreSoumissions', label: 'Soumissions', color: '#2563EB' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'area', 'kpi_cards', 'stackedBar'],
    },
    kpiFields: [
      { id: 'total', label: 'Montant Total', compute: (rows) => rows.reduce((s, r) => s + (r.montant || 0), 0), type: 'amount' },
      { id: 'domaines', label: 'Domaines', compute: (rows) => rows.length, type: 'number' },
    ],
  },
  {
    id: 'soumissions',
    name: 'Registre des Soumissions',
    icon: 'FileText',
    description: 'Liste détaillée des soumissions de paiement',
    fetchKey: 'soumissions',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'numero', label: 'N° Soumission', required: true },
      { id: 'citoyen', label: 'Citoyen', required: true },
      { id: 'service', label: 'Service', default: true },
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
        { id: 'service', label: 'Service' },
      ],
      y: [
        { id: 'montantTotal', label: 'Montant', color: '#059669' },
        { id: '_count', label: 'Nombre de soumissions', color: '#2563EB' },
      ],
      supportedTypes: ['bar', 'pie', 'donut', 'kpi_cards'],
    },
    kpiFields: [
      { id: 'total', label: 'Total Soumissions', compute: (rows) => rows.length, type: 'number' },
      { id: 'paid', label: 'Payés', compute: (rows) => rows.filter(r => r.statut === 'PAID').length, type: 'number' },
      { id: 'pending', label: 'En Attente', compute: (rows) => rows.filter(r => r.statut === 'PENDING').length, type: 'number' },
      { id: 'overdue', label: 'En Retard', compute: (rows) => rows.filter(r => r.statut === 'OVERDUE').length, type: 'number' },
    ],
    filters: [
      { id: 'statut', label: 'Filtrer par statut', options: ['TOUS', 'PAID', 'PENDING', 'OVERDUE'] },
    ],
  },
  {
    id: 'partenaires',
    name: 'Plateformes Partenaires',
    icon: 'Handshake',
    description: 'Performance et transactions des plateformes partenaires',
    fetchKey: 'partenaires',
    columns: [
      { id: 'index', label: 'N°', required: true },
      { id: 'nom', label: 'Plateforme', required: true },
      { id: 'code', label: 'Code', default: true },
      { id: 'statut', label: 'Statut', default: true },
      { id: 'ministere', label: 'Ministère', default: true },
      { id: 'totalDemandes', label: 'Total Demandes', default: true, type: 'number' },
      { id: 'montantPaye', label: 'Montant Payé', default: true, type: 'amount' },
      { id: 'tauxSucces', label: 'Taux Succès (%)', default: true, type: 'number' },
    ],
    pdfSections: [
      { id: 'kpi_bar', label: 'Bandeau KPI (Plateformes, Demandes, Taux)', default: true },
      { id: 'table_full', label: 'Tableau complet des plateformes', default: true },
    ],
    chartAxes: {
      x: [{ id: 'nom', label: 'Plateforme' }],
      y: [
        { id: 'totalDemandes', label: 'Demandes', color: '#6366F1' },
        { id: 'montantPaye', label: 'Montant Payé', color: '#059669' },
        { id: 'tauxSucces', label: 'Taux Succès (%)', color: '#D97706' },
      ],
      supportedTypes: ['bar', 'horizontal_bar', 'pie', 'donut', 'kpi_cards'],
    },
    kpiFields: [
      { id: 'plateformes', label: 'Plateformes', compute: (rows) => rows.length, type: 'number' },
      { id: 'demandes', label: 'Total Demandes', compute: (rows) => rows.reduce((s, r) => s + (r.totalDemandes || 0), 0), type: 'number' },
      { id: 'montant', label: 'Montant Total Payé', compute: (rows) => rows.reduce((s, r) => s + (r.montantPaye || 0), 0), type: 'amount' },
    ],
  },
];

export const FORMAT_OPTIONS = [
  { id: 'pdf',    label: 'PDF',         description: 'Rapport complet avec graphiques, KPIs et tableaux', icon: 'FileText' },
  { id: 'excel',  label: 'Excel',       description: 'Données tabulaires exploitables avec formules', icon: 'Table' },
  { id: 'charts', label: 'Graphiques',  description: 'Export graphiques uniquement (PDF ou PNG)', icon: 'BarChart3' },
];
