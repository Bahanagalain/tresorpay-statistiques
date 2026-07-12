import React, { useState } from 'react';
import {
  X, TrendingUp, BarChart3, PieChart, LineChart, Table2,
  Activity, Hash, Percent, ArrowUpRight, Layers,
} from 'lucide-react';

const CATEGORIES = ['KPI', 'Graphiques', 'Tables', 'Avancé'];

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

export default function WidgetLibrary({ open, onClose, onSelect }) {
  const [categorie, setCategorie] = useState('KPI');

  if (!open) return null;

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
              {cat}
            </button>
          ))}
        </div>

        {/* Grille de templates */}
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
      </div>
    </div>
  );
}
