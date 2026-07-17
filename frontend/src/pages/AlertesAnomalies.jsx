import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Activity, Shield, TrendingDown, DollarSign, RefreshCw, ChevronRight, Search, X, Filter, Bell } from 'lucide-react';
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

const ACTION_LABELS = {
  service_inactif: 'Voir les services',
  sync_echouee: 'Voir synchronisation',
};

const ACTION_ROUTES = {
  service_inactif: '/performance-ministeres',
  sync_echouee: '/synchronisation',
};

function getActionLabel(categorie) {
  return ACTION_LABELS[categorie] || 'Détails';
}

export default function AlertesAnomalies() {
  const navigate = useNavigate();
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('tous');
  const [categorieFilter, setCategorieFilter] = useState('tous');

  useEffect(() => {
    fetchAlertes()
      .then(data => {
        setAlertes(data);
        setLastChecked(new Date());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Derive unique categories from data
  const categories = useMemo(() => {
    const cats = new Set(alertes.map(a => a.categorie));
    return [...cats].sort();
  }, [alertes]);

  // Filtered alerts
  const filteredAlertes = useMemo(() => {
    let result = alertes;

    if (typeFilter === 'critique') {
      result = result.filter(a => a.type === 'danger');
    } else if (typeFilter === 'avertissement') {
      result = result.filter(a => a.type === 'attention');
    }

    if (categorieFilter !== 'tous') {
      result = result.filter(a => a.categorie === categorieFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(a =>
        (a.titre && a.titre.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (CATEGORIE_LABELS[a.categorie] || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [alertes, typeFilter, categorieFilter, searchQuery]);

  const critiques = alertes.filter(a => a.type === 'danger');
  const warnings = alertes.filter(a => a.type === 'attention');

  const handleAlertAction = useCallback((alert) => {
    const route = ACTION_ROUTES[alert.categorie];
    if (route) {
      navigate(route);
    }
  }, [navigate]);

  const getExportData = useCallback(() => ({
    headers: ['Type', 'Catégorie', 'Titre', 'Description', 'Valeur', 'Date'],
    rows: filteredAlertes.map(a => [a.type === 'danger' ? 'CRITIQUE' : 'AVERTISSEMENT', CATEGORIE_LABELS[a.categorie] || a.categorie, a.titre, a.description, a.valeur, a.date]),
    sheetName: 'Alertes',
    subtitle: `${filteredAlertes.length} alertes`,
  }), [filteredAlertes]);

  const hasActiveFilters = searchQuery || typeFilter !== 'tous' || categorieFilter !== 'tous';

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('tous');
    setCategorieFilter('tous');
  };

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Chargement..." /></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><AlertTriangle size={24} /> Alertes & Anomalies</h1>
          <p className="page-subtitle">
            Centre de notifications — situations critiques et anomalies détectées
            {lastChecked && (
              <span style={{ marginLeft: '1rem', fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                Dernière vérification : {lastChecked.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
        <ExportButtons getData={getExportData} title="Alertes & Anomalies" filenameBase="Alertes" />
      </div>

      {/* Summary cards — design épuré */}
      <div className="alertes-summary">
        <button
          type="button"
          className={`alertes-metric-card ${typeFilter === 'critique' ? 'active' : ''}`}
          onClick={() => { setTypeFilter(typeFilter === 'critique' ? 'tous' : 'critique'); setCategorieFilter('tous'); }}
        >
          <div className="alertes-metric-icon alertes-metric-icon--danger">
            <AlertCircle size={20} />
          </div>
          <div className="alertes-metric-body">
            <span className="alertes-metric-value">{critiques.length}</span>
            <span className="alertes-metric-label">Alertes critiques</span>
          </div>
        </button>
        <button
          type="button"
          className={`alertes-metric-card ${typeFilter === 'avertissement' ? 'active' : ''}`}
          onClick={() => { setTypeFilter(typeFilter === 'avertissement' ? 'tous' : 'avertissement'); setCategorieFilter('tous'); }}
        >
          <div className="alertes-metric-icon alertes-metric-icon--warning">
            <AlertTriangle size={20} />
          </div>
          <div className="alertes-metric-body">
            <span className="alertes-metric-value">{warnings.length}</span>
            <span className="alertes-metric-label">Avertissements</span>
          </div>
        </button>
        <button
          type="button"
          className={`alertes-metric-card ${typeFilter === 'tous' ? 'active' : ''}`}
          onClick={() => { setTypeFilter('tous'); setCategorieFilter('tous'); }}
        >
          <div className="alertes-metric-icon alertes-metric-icon--total">
            <Bell size={20} />
          </div>
          <div className="alertes-metric-body">
            <span className="alertes-metric-value">{alertes.length}</span>
            <span className="alertes-metric-label">Total alertes</span>
          </div>
        </button>
      </div>

      {/* Filters bar */}
      <div className="alertes-toolbar">
        <div className="alertes-search-wrap">
          <Search size={14} className="alertes-search-icon" />
          <input
            type="text"
            placeholder="Rechercher une alerte..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="alertes-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="alertes-search-clear">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="alertes-filters">
          <Filter size={13} style={{ color: 'var(--text-tertiary)' }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="alertes-select">
            <option value="tous">Tous les types</option>
            <option value="critique">Critique</option>
            <option value="avertissement">Avertissement</option>
          </select>
          <select value={categorieFilter} onChange={e => setCategorieFilter(e.target.value)} className="alertes-select">
            <option value="tous">Toutes les catégories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{CATEGORIE_LABELS[cat] || cat}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="alertes-clear-btn">
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>
        <span className="alertes-count">
          {filteredAlertes.length} alerte{filteredAlertes.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` sur ${alertes.length}`}
        </span>
      </div>

      {/* Alert list — tableau structuré */}
      {filteredAlertes.length > 0 && (
        <div className="alertes-table-card">
          <table className="alertes-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}></th>
                <th>Alerte</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Valeur</th>
                <th style={{ textAlign: 'right' }}>Date</th>
                <th style={{ width: 130 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredAlertes.map((a, i) => {
                const Icon = CATEGORIE_ICONS[a.categorie] || AlertTriangle;
                const isDanger = a.type === 'danger';

                return (
                  <tr key={i} className={isDanger ? 'alertes-row--danger' : 'alertes-row--warning'}>
                    <td className="alertes-td-icon">
                      <span className={`alertes-severity-dot ${isDanger ? 'danger' : 'warning'}`}>
                        {isDanger ? <AlertCircle size={15} /> : <AlertTriangle size={15} />}
                      </span>
                    </td>
                    <td>
                      <div className="alertes-cell-title">
                        {a.titre}
                        <span className={`alertes-type-tag ${isDanger ? 'danger' : 'warning'}`}>
                          {isDanger ? 'Critique' : 'Avertissement'}
                        </span>
                      </div>
                      <div className="alertes-cell-desc">{a.description}</div>
                    </td>
                    <td>
                      <span className="alertes-cat-badge">
                        <Icon size={12} />
                        {CATEGORIE_LABELS[a.categorie] || a.categorie}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.82rem' }}>
                      {a.valeur ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {a.date || '—'}
                    </td>
                    <td>
                      {ACTION_ROUTES[a.categorie] && (
                        <button onClick={() => handleAlertAction(a)} className="alertes-action-btn">
                          {getActionLabel(a.categorie)} <ChevronRight size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* No results after filtering */}
      {filteredAlertes.length === 0 && alertes.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <Search size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '0.8rem' }} />
          <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.3rem' }}>Aucun résultat</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Aucune alerte ne correspond aux filtres sélectionnés.</p>
          <button onClick={clearFilters} className="alertes-clear-btn" style={{ marginTop: '0.8rem' }}>
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {/* No alerts at all */}
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
