import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Activity, Shield, TrendingDown, DollarSign } from 'lucide-react';
import { fetchAlertes } from '../api/dgiAnalyticsApi';
import { formatEntier } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './AlertesAnomalies.css';

const CATEGORIE_ICONS = {
  performance_cdi: TrendingDown,
  montant_eleve: DollarSign,
  sync: Activity,
};

const CATEGORIE_LABELS = {
  performance_cdi: 'Performance CDI',
  montant_eleve: 'Montant \u00e9lev\u00e9 en retard',
  sync: 'Synchronisation',
};

export default function AlertesAnomalies() {
  const [alertes, setAlertes] = useState([]);
  const [resume, setResume] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertes()
      .then(({ alertes, resume }) => { setAlertes(alertes); setResume(resume); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const critiques = alertes.filter(a => a.type === 'critical');
  const warnings = alertes.filter(a => a.type === 'warning');

  const getExportData = useCallback(() => ({
    headers: ['Type', 'Catégorie', 'Message', 'Valeur', 'Seuil'],
    rows: alertes.map(a => [a.type === 'critical' ? 'CRITIQUE' : 'AVERTISSEMENT', CATEGORIE_LABELS[a.categorie] || a.categorie, a.message, a.valeur, a.seuil]),
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
          <p className="page-subtitle">Suivi des situations critiques et des anomalies d\u00e9tect\u00e9es</p>
        </div>
        <ExportButtons getData={getExportData} title="Alertes & Anomalies" filenameBase="Alertes" />
      </div>

      {/* Summary cards */}
      <div className="alertes-summary">
        <div className="alerte-summary-card critical">
          <AlertCircle size={24} />
          <div>
            <span className="alerte-summary-num">{resume.nombreAlertesCritiques || 0}</span>
            <span className="alerte-summary-label">Alertes Critiques</span>
          </div>
        </div>
        <div className="alerte-summary-card warning">
          <AlertTriangle size={24} />
          <div>
            <span className="alerte-summary-num">{resume.nombreAlertesWarning || 0}</span>
            <span className="alerte-summary-label">Avertissements</span>
          </div>
        </div>
        <div className="alerte-summary-card info">
          <Shield size={24} />
          <div>
            <span className="alerte-summary-num">{formatEntier(resume.totalEnRetard)}</span>
            <span className="alerte-summary-label">Avis en Retard</span>
          </div>
        </div>
        <div className="alerte-summary-card info">
          <DollarSign size={24} />
          <div>
            <span className="alerte-summary-num">{formatEntier(resume.montantEnRetard)}</span>
            <span className="alerte-summary-label">Montant en Retard (FCFA)</span>
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
                    <span className="alerte-cat">{CATEGORIE_LABELS[a.categorie] || a.categorie}</span>
                    <span className="alerte-msg">{a.message}</span>
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
                    <span className="alerte-cat">{CATEGORIE_LABELS[a.categorie] || a.categorie}</span>
                    <span className="alerte-msg">{a.message}</span>
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
