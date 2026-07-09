import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Activity, Shield, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import { fetchAlertes } from '../api/analyticsApi';
import { formatEntier } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './AlertesAnomalies.css';

const CATEGORIE_ICONS = {
  paiement_echoue: AlertTriangle,
  service_inactif: Activity,
  taux_echec_eleve: TrendingDown,
  anomalie_montant: DollarSign,
  sync_echouee: RefreshCw,
};

const CATEGORIE_LABELS = {
  paiement_echoue: 'Paiements échoués',
  service_inactif: 'Services inactifs',
  taux_echec_eleve: "Taux d'échec élevé",
  anomalie_montant: 'Anomalie de montant',
  sync_echouee: 'Synchronisation échouée',
};

export default function AlertesAnomalies() {
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertes()
      .then(data => setAlertes(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const critiques = alertes.filter(a => a.type === 'danger');
  const warnings = alertes.filter(a => a.type === 'attention');

  const getExportData = useCallback(() => ({
    headers: ['Type', 'Catégorie', 'Titre', 'Description', 'Valeur', 'Date'],
    rows: alertes.map(a => [a.type === 'danger' ? 'CRITIQUE' : 'AVERTISSEMENT', CATEGORIE_LABELS[a.categorie] || a.categorie, a.titre, a.description, a.valeur, a.date]),
    sheetName: 'Alertes',
    subtitle: `${alertes.length} alertes`,
  }), [alertes]);

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Chargement..." /></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><AlertTriangle size={24} /> Alertes & Anomalies</h1>
          <p className="page-subtitle">Suivi des situations critiques et des anomalies détectées</p>
        </div>
        <ExportButtons getData={getExportData} title="Alertes & Anomalies" filenameBase="Alertes" />
      </div>

      {/* Summary cards — computed from alertes array */}
      <div className="alertes-summary">
        <div className="alerte-summary-card critical">
          <AlertCircle size={24} />
          <div>
            <span className="alerte-summary-num">{critiques.length}</span>
            <span className="alerte-summary-label">Alertes Critiques</span>
          </div>
        </div>
        <div className="alerte-summary-card warning">
          <AlertTriangle size={24} />
          <div>
            <span className="alerte-summary-num">{warnings.length}</span>
            <span className="alerte-summary-label">Avertissements</span>
          </div>
        </div>
        <div className="alerte-summary-card info">
          <Shield size={24} />
          <div>
            <span className="alerte-summary-num">{alertes.length}</span>
            <span className="alerte-summary-label">Total alertes</span>
          </div>
        </div>
      </div>

      {/* Critiques */}
      {critiques.length > 0 && (
        <div className="card alerte-section">
          <h3 className="card-title alerte-critical-title"><AlertCircle size={16} /> Alertes Critiques</h3>
          <div className="alerte-list">
            {critiques.map((a, i) => {
              const Icon = CATEGORIE_ICONS[a.categorie] || AlertTriangle;
              return (
                <div key={i} className="alerte-item critical">
                  <Icon size={18} />
                  <div className="alerte-content">
                    <span className="alerte-cat">{a.titre}</span>
                    <span className="alerte-msg">{a.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="card alerte-section">
          <h3 className="card-title alerte-warning-title"><AlertTriangle size={16} /> Avertissements</h3>
          <div className="alerte-list">
            {warnings.map((a, i) => {
              const Icon = CATEGORIE_ICONS[a.categorie] || AlertTriangle;
              return (
                <div key={i} className="alerte-item warning">
                  <Icon size={18} />
                  <div className="alerte-content">
                    <span className="alerte-cat">{a.titre}</span>
                    <span className="alerte-msg">{a.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {alertes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Shield size={48} style={{ color: '#059669', marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-primary)' }}>Aucune alerte</h3>
          <p style={{ color: 'var(--text-tertiary)' }}>Tous les indicateurs sont dans les seuils normaux.</p>
        </div>
      )}
    </div>
  );
}
