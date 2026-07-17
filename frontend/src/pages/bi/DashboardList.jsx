import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus, Copy, Trash2, Edit, Eye, Search, Star, Palette } from 'lucide-react';
import { fetchDashboards, createDashboard, deleteDashboard, duplicateDashboard, updateDashboard } from '../../api/biApi';
import WeaveSpinner from '../../components/ui/WeaveSpinner';
import './bi.css';

const THEME_COLORS = [
  { label: 'Vert', hex: '#059669' },
  { label: 'Bleu', hex: '#2563EB' },
  { label: 'Violet', hex: '#8B5CF6' },
  { label: 'Orange', hex: '#D97706' },
  { label: 'Rose', hex: '#EC4899' },
  { label: 'Teal', hex: '#14B8A6' },
  { label: 'Indigo', hex: '#6366F1' },
  { label: 'Slate', hex: '#64748B' },
];

const DEFAULT_COLOR = '#2563EB';

const DEFAULT_DASHBOARD_COLORS = {
  'Vue Opérationnelle': '#059669',
  'Vue Régionale': '#14B8A6',
  'Vue Ministère': '#2563EB',
  'Vue Direction Générale': '#8B5CF6',
};

function getAccentColor(dash) {
  // 1. Stored in themeConfig
  const stored = dash?.themeConfig?.accentColor;
  if (stored) return stored;
  // 2. Default mapping by title
  const title = dash?.titre || '';
  for (const [key, color] of Object.entries(DEFAULT_DASHBOARD_COLORS)) {
    if (title.includes(key)) return color;
  }
  return DEFAULT_COLOR;
}

function ColorPicker({ value, onChange, size = 22 }) {
  return (
    <div className="bi-color-picker" style={{ gap: '0.35rem' }}>
      {THEME_COLORS.map(c => (
        <button
          key={c.hex}
          type="button"
          className={`bi-color-dot${value === c.hex ? ' active' : ''}`}
          style={{
            background: c.hex,
            width: size,
            height: size,
            border: value === c.hex ? `2px solid ${c.hex}` : '2px solid transparent',
          }}
          title={c.label}
          onClick={(e) => { e.stopPropagation(); onChange(c.hex); }}
        />
      ))}
    </div>
  );
}

function CardColorDot({ color, onClick }) {
  return (
    <button
      className="bi-card-color-dot"
      style={{
        background: color,
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.7)',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        transition: 'transform 0.15s',
      }}
      title="Changer la couleur"
      onClick={onClick}
    />
  );
}

export default function DashboardList() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [colorPickerOpen, setColorPickerOpen] = useState(null); // dashboard id or null
  const colorPickerRef = useRef(null);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handleClick = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setColorPickerOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPickerOpen]);

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
    else if (sortBy === 'widgets') list.sort((a, b) => (b._count?.widgets ?? b.widgets?.length ?? 0) - (a._count?.widgets ?? a.widgets?.length ?? 0));
    else list.sort((a, b) => new Date(b.modifieLe || b.updatedAt || b.creeLe || b.createdAt || 0) - new Date(a.modifieLe || a.updatedAt || a.creeLe || a.createdAt || 0));
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

  const changeColor = async (dashId, hex) => {
    try {
      const dash = dashboards.find(d => d.id === dashId);
      const existingConfig = dash?.themeConfig || {};
      const themeConfig = { ...existingConfig, accentColor: hex };
      await updateDashboard(dashId, { themeConfig });
      setDashboards(prev => prev.map(d =>
        d.id === dashId ? { ...d, themeConfig } : d
      ));
      setColorPickerOpen(null);
    } catch (err) {
      console.error('Erreur changement couleur:', err);
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
      const themeConfig = { accentColor: newColor };
      const res = await createDashboard({ titre: newTitle.trim(), description: newDesc.trim(), themeConfig });
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewColor(DEFAULT_COLOR);
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
          {sorted.map(dash => {
            const accent = getAccentColor(dash);
            return (
              <div
                key={dash.id}
                className="bi-dashboard-card"
                style={{ borderTop: `4px solid ${accent}` }}
                onClick={() => navigate(`/bi/dashboards/${dash.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <LayoutDashboard size={16} style={{ color: accent, flexShrink: 0 }} />
                    <h3 style={{ color: accent }}>{dash.titre}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                      <CardColorDot
                        color={accent}
                        onClick={(e) => {
                          e.stopPropagation();
                          setColorPickerOpen(colorPickerOpen === dash.id ? null : dash.id);
                        }}
                      />
                      {colorPickerOpen === dash.id && (
                        <div
                          ref={colorPickerRef}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            background: 'var(--card-bg, #fff)',
                            border: '1px solid var(--border, #e5e7eb)',
                            borderRadius: '10px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            zIndex: 50,
                            minWidth: '200px',
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary, #6b7280)' }}>
                            Couleur du thème
                          </div>
                          <ColorPicker value={accent} onChange={(hex) => changeColor(dash.id, hex)} />
                        </div>
                      )}
                    </div>
                    <button
                      className={`bi-fav-btn ${dash.estFavori ? 'active' : ''}`}
                      style={{ position: 'static' }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(dash.id, dash.estFavori); }}
                      title={dash.estFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      <Star size={16} fill={dash.estFavori ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
                <div className="bi-card-meta">
                  {dash._count?.widgets ?? dash.widgets?.length ?? 0} widget{(dash._count?.widgets ?? dash.widgets?.length ?? 0) > 1 ? 's' : ''} &middot;{' '}
                  Modifié {(dash.modifieLe || dash.updatedAt) ? new Date(dash.modifieLe || dash.updatedAt).toLocaleDateString('fr-FR') : '—'}
                  {dash.proprietaire?.nomComplet && ` · ${dash.proprietaire.nomComplet}`}
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
                  <button title="Couleur" onClick={(e) => { e.stopPropagation(); setColorPickerOpen(colorPickerOpen === dash.id ? null : dash.id); }}>
                    <Palette size={14} />
                  </button>
                  <button className="danger" title="Supprimer" onClick={(e) => handleDelete(dash.id, e)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
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
              <label>Couleur du thème</label>
              <div style={{ marginBottom: '0.85rem' }}>
                <ColorPicker value={newColor} onChange={setNewColor} />
              </div>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: newColor,
                marginBottom: '1rem',
                transition: 'background 0.2s',
              }} />
              <div className="bi-modal-actions">
                <button type="button" className="bi-btn-secondary" onClick={() => { setShowCreate(false); setNewColor(DEFAULT_COLOR); }}>
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
