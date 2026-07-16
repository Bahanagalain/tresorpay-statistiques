import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Activity, Shield, TrendingDown, DollarSign, RefreshCw, ChevronRight, Search, X, Filter } from 'lucide-react';
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

    // Type filter
    if (typeFilter === 'critique') {
      result = result.filter(a => a.type === 'danger');
    } else if (typeFilter === 'avertissement') {
      result = result.filter(a => a.type === 'attention');
    }

    // Category filter
    if (categorieFilter !== 'tous') {
      result = result.filter(a => a.categorie === categorieFilter);
    }

    // Search filter
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

      {/* Summary cards */}
      <div className="alertes-summary">
        <div className="alerte-summary-card critical" onClick={() => { setTypeFilter('critique'); setCategorieFilter('tous'); }} style={{ cursor: 'pointer' }}>
          <AlertCircle size={24} />
          <div>
            <span className="alerte-summary-num">{critiques.length}</span>
            <span className="alerte-summary-label">Alertes Critiques</span>
          </div>
        </div>
        <div className="alerte-summary-card warning" onClick={() => { setTypeFilter('avertissement'); setCategorieFilter('tous'); }} style={{ cursor: 'pointer' }}>
          <AlertTriangle size={24} />
          <div>
            <span className="alerte-summary-num">{warnings.length}</span>
            <span className="alerte-summary-label">Avertissements</span>
          </div>
        </div>
        <div className="alerte-summary-card info" onClick={() => { setTypeFilter('tous'); setCategorieFilter('tous'); }} style={{ cursor: 'pointer' }}>
          <Shield size={24} />
          <div>
            <span className="alerte-summary-num">{alertes.length}</span>
            <span className="alerte-summary-label">Total alertes</span>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        marginBottom: '1.2rem', padding: '0.75rem 1rem',
        background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
        borderRadius: '10px',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Rechercher une alerte..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.4rem 0.5rem 0.4rem 2rem',
              border: '1px solid var(--glass-border)', borderRadius: '6px',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              fontSize: '0.8rem', outline: 'none',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{
              position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex',
            }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Filter size={13} style={{ color: 'var(--text-tertiary)' }} />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              padding: '0.4rem 0.5rem', border: '1px solid var(--glass-border)',
              borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)',
              fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="tous">Tous les types</option>
            <option value="critique">Critique</option>
            <option value="avertissement">Avertissement</option>
          </select>
        </div>

        {/* Category filter */}
        <select
          value={categorieFilter}
          onChange={e => setCategorieFilter(e.target.value)}
          style={{
            padding: '0.4rem 0.5rem', border: '1px solid var(--glass-border)',
            borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)',
            fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="tous">Toutes les catégories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{CATEGORIE_LABELS[cat] || cat}</option>
          ))}
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{
            padding: '0.35rem 0.6rem', borderRadius: '6px',
            border: '1px solid var(--glass-border)', background: 'none',
            color: 'var(--text-secondary)', fontSize: '0.75rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}>
            <X size={12} /> Réinitialiser
          </button>
        )}

        {/* Result count */}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {filteredAlertes.length} alerte{filteredAlertes.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` sur ${alertes.length}`}
        </span>
      </div>

      {/* Unified alert list */}
      {filteredAlertes.length > 0 && (
        <div className="alerte-list">
          {filteredAlertes.map((a, i) => {
            const Icon = CATEGORIE_ICONS[a.categorie] || AlertTriangle;
            const isDanger = a.type === 'danger';
            const borderColor = isDanger ? '#DC2626' : '#D97706';
            const iconColor = isDanger ? '#DC2626' : '#D97706';

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.8rem',
                padding: '0.8rem 1rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--glass-border)',
                borderLeft: `3px solid ${borderColor}`,
                borderRadius: '10px',
                marginBottom: '0.5rem',
              }}>
                <div style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                  {isDanger
                    ? <AlertCircle size={18} style={{ color: iconColor }} />
                    : <AlertTriangle size={18} style={{ color: iconColor }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {a.titre}
                    </span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.04em', padding: '0.1rem 0.4rem', borderRadius: '4px',
                      background: isDanger ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)',
                      color: isDanger ? '#DC2626' : '#D97706',
                    }}>
                      {isDanger ? 'Critique' : 'Avertissement'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {a.description}
                  </div>
                  {a.valeur && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.3rem' }}>
                      Valeur : {a.valeur}
                    </div>
                  )}
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={11} style={{ opacity: 0.6 }} />
                    {CATEGORIE_LABELS[a.categorie] || a.categorie}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                  {a.date && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{a.date}</span>
                  )}
                  <button onClick={() => handleAlertAction(a)} style={{
                    padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)',
                    background: 'none', color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap',
                  }}>
                    {getActionLabel(a.categorie)} <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results after filtering */}
      {filteredAlertes.length === 0 && alertes.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <Search size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '0.8rem' }} />
          <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.3rem' }}>Aucun résultat</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Aucune alerte ne correspond aux filtres sélectionnés.</p>
          <button onClick={clearFilters} style={{
            marginTop: '0.8rem', padding: '0.4rem 1rem', borderRadius: '6px',
            border: '1px solid var(--glass-border)', background: 'none',
            color: 'var(--accent-dgi)', fontSize: '0.8rem', cursor: 'pointer',
          }}>
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
