import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, LayoutDashboard, Landmark, Shield, ChevronRight, X, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMontant } from '../../utils/format';
import './CommandPalette.css';

const COMMANDS = [
  { id: 'nav-dash',  label: 'Aperçu Stratégique — Dashboard',  icon: LayoutDashboard, action: 'nav', path: '/dashboard', group: 'Navigation' },
  { id: 'nav-dgi',   label: 'DGI — Impôts & Recouvrement',     icon: Landmark,        action: 'nav', path: '/dgi',       group: 'Navigation' },
  { id: 'nav-dgd',   label: 'DGD — Douanes & Déclarations',    icon: Building2,       action: 'nav', path: '/dgd',       group: 'Navigation' },
  { id: 'nav-users', label: 'Audits & Accès — Gouvernance',    icon: Shield,          action: 'nav', path: '/users',     group: 'Navigation' },
];

const formatCompactAmount = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M FCFA`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} K FCFA`;
  return formatMontant(value);
};

export default function CommandPalette({ open, onClose, avisItems = [], cdiItems = [] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build results
  const results = useMemo(() => {
    const q = query.toLowerCase();
    const cmds = COMMANDS.filter(c => !q || c.label.toLowerCase().includes(q));
    const avisResults = avisItems
      .filter((a) => {
        if (!q) return true;
        return [a.contribuable, a.numero, a.nui]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(q));
      })
      .slice(0, 4)
      .map(a => ({
        id: a.numero,
        label: `${a.contribuable} — ${a.numero}`,
        sub: `${a.centre} · ${formatCompactAmount(a.montantTotal)}`,
        icon: Landmark,
        action: 'nav',
        path: '/dgi',
        group: 'Avis DGI',
      }));
    const cdiResults = cdiItems
      .filter(c => !q || c.centre.toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({
        id: c.centre,
        label: c.centre,
        sub: `${formatCompactAmount(c.montant)}`,
        icon: Building2,
        action: 'nav',
        path: '/dgi',
        group: 'Centres CDI',
      }));
    return [...cmds, ...cdiResults, ...avisResults];
  }, [avisItems, cdiItems, query]);

  useEffect(() => {
    if (selected > Math.max(results.length - 1, 0)) {
      setSelected(0);
    }
  }, [results, selected]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); runCommand(results[selected]); }
      if (e.key === 'Escape')    onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, open, results, selected]);

  const runCommand = (cmd) => {
    if (!cmd) return;
    if (cmd.action === 'nav') navigate(cmd.path);
    onClose();
  };

  if (!open) return null;

  // Group results
  const groups = results.reduce((acc, r) => {
    if (!acc[r.group]) acc[r.group] = [];
    acc[r.group].push(r);
    return acc;
  }, {});

  let globalIdx = 0;

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="cp-search">
          <Search size={18} className="cp-search__icon" />
          <input
            ref={inputRef}
            className="cp-search__input"
            placeholder="Rechercher une page, un avis, un contribuable…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
          />
          {query && (
            <button className="cp-search__clear" onClick={() => setQuery('')}>
              <X size={14}/>
            </button>
          )}
          <div className="cp-kbd">Échap</div>
        </div>

        {/* Results */}
        <div className="cp-results">
          {results.length === 0 ? (
            <div className="cp-empty">
              <Search size={28} />
              <p>Aucun résultat pour « {query} »</p>
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="cp-group">
                <span className="cp-group__label">{group}</span>
                {items.map(item => {
                  const idx = globalIdx++;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      className={`cp-item ${selected === idx ? 'cp-item--selected' : ''}`}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={() => runCommand(item)}
                    >
                      <span className="cp-item__icon"><Icon size={15}/></span>
                      <span className="cp-item__text">
                        <span className="cp-item__label">{item.label}</span>
                        {item.sub && <span className="cp-item__sub">{item.sub}</span>}
                      </span>
                      <ChevronRight size={14} className="cp-item__chevron" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cp-footer">
          <span><kbd>↑↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> sélectionner</span>
          <span><kbd>Échap</kbd> fermer</span>
        </div>
      </div>
    </div>
  );
}
