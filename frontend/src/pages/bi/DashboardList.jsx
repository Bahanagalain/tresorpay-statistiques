import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus, Copy, Trash2, Edit, Eye, Search, Star } from 'lucide-react';
import { fetchDashboards, createDashboard, deleteDashboard, duplicateDashboard, updateDashboard } from '../../api/biApi';
import WeaveSpinner from '../../components/ui/WeaveSpinner';
import './bi.css';

export default function DashboardList() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const filtered = useMemo(() => {
    if (!search.trim()) return dashboards;
    const q = search.toLowerCase();
    return dashboards.filter(d =>
      (d.titre || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q)
    );
  }, [dashboards, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === 'title') list.sort((a, b) => (a.titre || '').localeCompare(b.titre || ''));
    else if (sortBy === 'widgets') list.sort((a, b) => (b.widgets?.length || 0) - (a.widgets?.length || 0));
    else list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    return list;
  }, [filtered, sortBy]);

  const toggleFavorite = async (dashId, current) => {
    try {
      await updateDashboard(dashId, { estFavori: !current });
      setDashboards(prev => prev.map(d => d.id === dashId ? { ...d, estFavori: !d.estFavori } : d));
    } catch (err) {
      console.error('Erreur favori:', err);
    }
  };

  const loadDashboards = async () => {
    setLoading(true);
    try {
      const res = await fetchDashboards();
      setDashboards(res?.datas || []);
    } catch (err) {
      setError(err.message || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboards(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await createDashboard({ titre: newTitle.trim(), description: newDesc.trim() });
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      const created = res?.datas || res;
      if (created?.id) {
        navigate(`/bi/dashboards/${created.id}`);
      } else {
        loadDashboards();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    try {
      await duplicateDashboard(id);
      loadDashboards();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Supprimer ce dashboard ?')) return;
    try {
      await deleteDashboard(id);
      setDashboards(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <WeaveSpinner size={80} message="Chargement des dashboards..." />;

  return (
    <div className="bi-dashboard-list">
      <div className="bi-list-header">
        <h1>
          <LayoutDashboard size={22} />
          Mes Dashboards
        </h1>
        <button className="bi-btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Nouveau dashboard
        </button>
      </div>

      <div className="bi-list-toolbar">
        <div className="bi-search-bar">
          <Search size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un dashboard..."
            className="bi-search-input"
          />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bi-sort-select">
          <option value="recent">Plus récents</option>
          <option value="title">Alphabétique</option>
          <option value="widgets">Nombre de widgets</option>
        </select>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</p>}

      {sorted.length === 0 ? (
        <div className="bi-grid-empty">
          <LayoutDashboard size={48} />
          {dashboards.length === 0 ? (
            <>
              <p>Aucun dashboard pour le moment.</p>
              <p style={{ fontSize: '0.82rem' }}>Créez votre premier dashboard personnalisé.</p>
            </>
          ) : (
            <p>Aucun dashboard ne correspond à votre recherche.</p>
          )}
        </div>
      ) : (
        <div className="bi-dashboards-grid">
          {sorted.map(dash => (
            <div
              key={dash.id}
              className="bi-dashboard-card"
              onClick={() => navigate(`/bi/dashboards/${dash.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3>{dash.titre}</h3>
                <button
                  className={`bi-fav-btn ${dash.estFavori ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(dash.id, dash.estFavori); }}
                  title={dash.estFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Star size={16} fill={dash.estFavori ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="bi-card-meta">
                {dash.widgets?.length || 0} widget{(dash.widgets?.length || 0) > 1 ? 's' : ''} &middot;{' '}
                Modifié {dash.updatedAt ? new Date(dash.updatedAt).toLocaleDateString('fr-FR') : '—'}
                {dash.proprietaire && ` · ${dash.proprietaire}`}
              </div>
              {dash.description && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {dash.description}
                </p>
              )}
              <div className="bi-card-actions">
                <button title="Ouvrir" onClick={(e) => { e.stopPropagation(); navigate(`/bi/dashboards/${dash.id}`); }}>
                  <Eye size={14} />
                </button>
                <button title="Modifier" onClick={(e) => { e.stopPropagation(); navigate(`/bi/dashboards/${dash.id}`); }}>
                  <Edit size={14} />
                </button>
                <button title="Dupliquer" onClick={(e) => handleDuplicate(dash.id, e)}>
                  <Copy size={14} />
                </button>
                <button className="danger" title="Supprimer" onClick={(e) => handleDelete(dash.id, e)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <div className="bi-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="bi-modal" onClick={e => e.stopPropagation()}>
            <h2>Nouveau dashboard</h2>
            <form onSubmit={handleCreate}>
              <label>Titre</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Ex: Suivi recettes 2026"
                autoFocus
              />
              <label>Description (optionnel)</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Objectif du dashboard..."
              />
              <div className="bi-modal-actions">
                <button type="button" className="bi-btn-secondary" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
                <button type="submit" className="bi-btn-primary" disabled={creating || !newTitle.trim()}>
                  <Plus size={15} />
                  {creating ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
