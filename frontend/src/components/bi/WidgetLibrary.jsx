import React, { useState } from 'react';
import {
  X, TrendingUp, BarChart3, PieChart, LineChart, Table2,
  Activity, Hash, Percent, ArrowUpRight, Layers,
  Building2, Landmark, Globe, MapPin, LayoutDashboard,
} from 'lucide-react';

const CATEGORIES = ['Dashboards', 'KPI', 'Graphiques', 'Tables', 'Avancé'];

// ─── Templates de dashboards pré-faits ───
const DASHBOARD_TEMPLATES = [
  {
    id: 'minfi',
    titre: 'Vue MINFI',
    description: 'Vue consolidée des recettes par ministère et groupe de revenus',
    icon: Building2,
    widgets: [
      { titre: 'Recettes totales', typeWidget: 'KPI_CARD', dimensions: ['ministere'], chartConfig: { mesures: [{ type: 'SUM', colonne: 'montant' }], tri: { colonne: 'montant_total', direction: 'desc' } }, filtresLocaux: {}, gridW: 3, gridH: 2 },
      { titre: 'Taux de paiement', typeWidget: 'KPI_CARD', dimensions: ['ministere'], chartConfig: { mesures: [{ type: 'RATIO', filtreNum: { statut: 'PAID' } }], tri: { colonne: 'ratio', direction: 'desc' } }, filtresLocaux: {}, gridW: 3, gridH: 2 },
      { titre: 'Soumissions par ministère', typeWidget: 'CHART_BAR', dimensions: ['ministere'], chartConfig: { mesures: [{ type: 'COUNT' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Recettes par groupe de revenus', typeWidget: 'CHART_PIE', dimensions: ['groupe_revenu'], chartConfig: { mesures: [{ type: 'SUM', colonne: 'montant' }], tri: { colonne: 'montant_total', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Évolution mensuelle', typeWidget: 'CHART_LINE', dimensions: ['periode_mois'], chartConfig: { mesures: [{ type: 'COUNT' }, { type: 'SUM', colonne: 'montant' }], tri: { colonne: 'nombre', direction: 'asc' } }, filtresLocaux: {}, gridW: 12, gridH: 4 },
    ],
  },
  {
    id: 'suivi-ministere',
    titre: 'Suivi Ministère',
    description: "Performance détaillée d'un ministère : services, domaines, statuts",
    icon: Landmark,
    widgets: [
      { titre: 'Total soumissions', typeWidget: 'KPI_CARD', dimensions: ['service'], chartConfig: { mesures: [{ type: 'COUNT' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 3, gridH: 2 },
      { titre: 'Montant total', typeWidget: 'KPI_CARD', dimensions: ['service'], chartConfig: { mesures: [{ type: 'SUM', colonne: 'montant' }], tri: { colonne: 'montant_total', direction: 'desc' } }, filtresLocaux: {}, gridW: 3, gridH: 2 },
      { titre: 'Services du ministère', typeWidget: 'TABLE', dimensions: ['service'], chartConfig: { mesures: [{ type: 'COUNT' }, { type: 'SUM', colonne: 'montant' }], tri: { colonne: 'montant_total', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Répartition par statut', typeWidget: 'CHART_PIE', dimensions: ['statut_paiement'], chartConfig: { mesures: [{ type: 'COUNT' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Évolution mensuelle', typeWidget: 'CHART_AREA', dimensions: ['periode_mois'], chartConfig: { mesures: [{ type: 'SUM', colonne: 'montant' }], tri: { colonne: 'montant_total', direction: 'asc' } }, filtresLocaux: {}, gridW: 12, gridH: 4 },
    ],
  },
  {
    id: 'partenaires',
    titre: 'Monitoring Partenaires',
    description: 'Suivi des plateformes partenaires : statuts, méthodes de paiement, opérateurs',
    icon: Globe,
    widgets: [
      { titre: 'Demandes partenaires', typeWidget: 'KPI_CARD', dimensions: [], chartConfig: { mesures: [{ type: 'COUNT' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 3, gridH: 2 },
      { titre: 'Par plateforme', typeWidget: 'CHART_BAR', dimensions: ['plateforme'], chartConfig: { mesures: [{ type: 'COUNT' }, { type: 'SUM', colonne: 'montant' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Par méthode de paiement', typeWidget: 'CHART_PIE', dimensions: ['methode_paiement'], chartConfig: { mesures: [{ type: 'COUNT' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Détail par statut', typeWidget: 'TABLE', dimensions: ['statut'], chartConfig: { mesures: [{ type: 'COUNT' }, { type: 'SUM', colonne: 'montant' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 12, gridH: 3 },
    ],
  },
  {
    id: 'performance-regionale',
    titre: 'Performance Régionale',
    description: 'Analyse comparative des recettes par région et département',
    icon: MapPin,
    widgets: [
      { titre: 'Recettes par région', typeWidget: 'CHART_BAR', dimensions: ['region'], chartConfig: { mesures: [{ type: 'SUM', colonne: 'montant' }], tri: { colonne: 'montant_total', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Soumissions par région', typeWidget: 'CHART_BAR_STACKED', dimensions: ['region'], chartConfig: { mesures: [{ type: 'COUNT' }, { type: 'SUM', colonne: 'montant' }], tri: { colonne: 'nombre', direction: 'desc' } }, filtresLocaux: {}, gridW: 6, gridH: 4 },
      { titre: 'Tableau régional', typeWidget: 'TABLE', dimensions: ['region'], chartConfig: { mesures: [{ type: 'COUNT' }, { type: 'SUM', colonne: 'montant' }, { type: 'RATIO', filtreNum: { statut: 'PAID' } }], tri: { colonne: 'montant_total', direction: 'desc' } }, filtresLocaux: {}, gridW: 12, gridH: 4 },
    ],
  },
];

const TEMPLATES = [
  // ─── KPI ───
  {
    categorie: 'KPI',
    titre: 'Total recettes',
    description: 'Montant total des recettes perçues',
    icon: TrendingUp,
    config: {
      titre: 'Total recettes',
      typeVisualisation: 'KPI_CARD',
      datasetCode: 'soumissions',
      mesure: 'SUM',
      colonne: 'montant',
      format: 'montant',
    },
  },
  {
    categorie: 'KPI',
    titre: 'Nombre soumissions',
    description: 'Nombre total de soumissions enregistrées',
    icon: Hash,
    config: {
      titre: 'Nombre soumissions',
      typeVisualisation: 'KPI_CARD',
      datasetCode: 'soumissions',
      mesure: 'COUNT',
      format: 'entier',
    },
  },
  {
    categorie: 'KPI',
    titre: 'Taux de paiement',
    description: 'Ratio de soumissions avec statut PAID',
    icon: Percent,
    config: {
      titre: 'Taux de paiement',
      typeVisualisation: 'KPI_CARD',
      datasetCode: 'soumissions',
      mesure: 'RATIO',
      filtreNumerateur: { statut: 'PAID' },
      format: 'pourcentage',
    },
  },
  // ─── Graphiques ───
  {
    categorie: 'Graphiques',
    titre: 'Recettes par ministère',
    description: 'Barres horizontales des recettes par ministère',
    icon: BarChart3,
    config: {
      titre: 'Recettes par ministère',
      typeVisualisation: 'CHART_BAR',
      datasetCode: 'soumissions',
      dimension: 'ministere',
      mesure: 'SUM',
      colonne: 'montant',
    },
  },
  {
    categorie: 'Graphiques',
    titre: 'Évolution mensuelle',
    description: 'Courbe d\'évolution des recettes par mois',
    icon: LineChart,
    config: {
      titre: 'Évolution mensuelle',
      typeVisualisation: 'CHART_LINE',
      datasetCode: 'soumissions',
      dimension: 'periode_mois',
      mesure: 'SUM',
      colonne: 'montant',
    },
  },
  {
    categorie: 'Graphiques',
    titre: 'Répartition par domaine',
    description: 'Camembert de répartition par domaine',
    icon: PieChart,
    config: {
      titre: 'Répartition par domaine',
      typeVisualisation: 'CHART_PIE',
      datasetCode: 'soumissions',
      dimension: 'domaine',
      mesure: 'SUM',
      colonne: 'montant',
    },
  },
  {
    categorie: 'Graphiques',
    titre: 'Statuts de paiement',
    description: 'Donut des statuts de paiement',
    icon: PieChart,
    config: {
      titre: 'Statuts de paiement',
      typeVisualisation: 'CHART_DONUT',
      datasetCode: 'soumissions',
      dimension: 'statut',
      mesure: 'COUNT',
    },
  },
  {
    categorie: 'Graphiques',
    titre: 'Top 10 services',
    description: 'Barres des 10 services les plus performants',
    icon: BarChart3,
    config: {
      titre: 'Top 10 services',
      typeVisualisation: 'CHART_BAR',
      datasetCode: 'soumissions',
      dimension: 'service',
      mesure: 'SUM',
      colonne: 'montant',
      limite: 10,
    },
  },
  // ─── Tables ───
  {
    categorie: 'Tables',
    titre: 'Détail par structure',
    description: 'Tableau avec nombre et montant par unité organisationnelle',
    icon: Table2,
    config: {
      titre: 'Détail par structure',
      typeVisualisation: 'TABLE',
      datasetCode: 'soumissions',
      dimension: 'org_unit',
      mesures: ['COUNT', 'SUM'],
      colonne: 'montant',
    },
  },
  {
    categorie: 'Tables',
    titre: 'Demandes partenaires',
    description: 'Tableau des demandes partenaires par plateforme',
    icon: Table2,
    config: {
      titre: 'Demandes partenaires',
      typeVisualisation: 'TABLE',
      datasetCode: 'demandes_partenaire',
      dimension: 'plateforme',
      mesures: ['COUNT', 'SUM'],
      colonne: 'montant',
    },
  },
  // ─── Avancé ───
  {
    categorie: 'Avancé',
    titre: 'Pivot Ministère × Statut',
    description: 'Tableau croisé dynamique ministère / statut',
    icon: Layers,
    config: {
      titre: 'Pivot Ministère × Statut',
      typeVisualisation: 'PIVOT',
      datasetCode: 'soumissions',
      dimensionLigne: 'ministere',
      dimensionColonne: 'statut',
      mesure: 'COUNT',
    },
  },
];

export default function WidgetLibrary({ open, onClose, onSelect, onApplyTemplate }) {
  const [categorie, setCategorie] = useState('Dashboards');

  if (!open) return null;

  const handleApplyTemplate = (template) => {
    if (onApplyTemplate) {
      onApplyTemplate(template.widgets);
    } else {
      template.widgets.forEach(w => onSelect(w));
    }
    onClose();
  };

  const filtered = TEMPLATES.filter(t => t.categorie === categorie);

  return (
    <div className="bi-library-overlay" onClick={onClose}>
      <div className="bi-library-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bi-library-header">
          <h2>Bibliothèque de widgets</h2>
          <button className="bi-library-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Catégories */}
        <div className="bi-library-categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`bi-pill ${categorie === cat ? 'active' : ''}`}
              onClick={() => setCategorie(cat)}
            >
              {cat === 'Dashboards' && <LayoutDashboard size={14} />}
              {cat}
            </button>
          ))}
        </div>

        {/* Contenu selon la catégorie */}
        {categorie === 'Dashboards' ? (
          <div className="bi-library-dashboards">
            {DASHBOARD_TEMPLATES.map(tpl => {
              const Icon = tpl.icon;
              return (
                <div key={tpl.id} className="bi-library-dashboard-card">
                  <div className="bi-library-dashboard-header">
                    <span className="bi-library-card-icon">
                      <Icon size={22} />
                    </span>
                    <div>
                      <span className="bi-library-card-title">{tpl.titre}</span>
                      <span className="bi-library-card-desc">{tpl.description}</span>
                    </div>
                  </div>
                  <div className="bi-library-dashboard-footer">
                    <span className="bi-library-dashboard-count">
                      {tpl.widgets.length} widgets
                    </span>
                    <button
                      className="bi-library-dashboard-apply"
                      onClick={() => handleApplyTemplate(tpl)}
                    >
                      <ArrowUpRight size={14} /> Appliquer ce template
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bi-library-grid">
            {filtered.map((tpl, idx) => {
              const Icon = tpl.icon;
              return (
                <button
                  key={idx}
                  className="bi-library-card"
                  onClick={() => onSelect(tpl.config)}
                >
                  <span className="bi-library-card-icon">
                    <Icon size={20} />
                  </span>
                  <span className="bi-library-card-title">{tpl.titre}</span>
                  <span className="bi-library-card-desc">{tpl.description}</span>
                  <span className="bi-library-card-add">
                    <ArrowUpRight size={14} /> Ajouter
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
