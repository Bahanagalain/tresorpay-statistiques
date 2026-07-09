import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, X, Filter, RotateCcw, Building2, ChevronDown, ChevronUp,
  CheckCircle, Clock, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Activity,
  FileDown, Download,
} from 'lucide-react';
import CountUp from '../components/ui/CountUp';
import { fetchSoumissions, fetchKpi } from '../api/analyticsApi';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import './RegistreImposition.css';

const fmtFull = (n) => (n ?? 0).toLocaleString('fr-FR') + ' FCFA';
const STATUT_CONFIG = {
  PAID: { cls: 'statut-paid', label: 'Payé', icon: CheckCircle },
  PENDING: { cls: 'statut-pending', label: 'En attente', icon: Clock },
  PARTIAL: { cls: 'statut-partial', label: 'Partiel', icon: Activity },
  FAILED: { cls: 'statut-failed', label: 'Échoué', icon: AlertTriangle },
};

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={13} className="sort-icon neutral" />;
  return sortDir === 'asc' ? <ArrowUp size={13} className="sort-icon active" /> : <ArrowDown size={13} className="sort-icon active" />;
}

function SoumissionRow({ soumission, rowIndex }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUT_CONFIG[soumission.statutPaiement] || STATUT_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <>
      <tr className="avis-row" onClick={() => setOpen(!open)}>
        <td className="col-index">{rowIndex}</td>
        <td><span className="avis-numero">{soumission.uniqueCode}</span></td>
        <td>{soumission.service?.nomFr || '—'}</td>
        <td><span className="centre-badge" style={soumission.ministere?.couleur ? { borderColor: soumission.ministere.couleur, color: soumission.ministere.couleur } : {}}>{soumission.ministere?.nomFr || '—'}</span></td>
        <td className="text-right avis-montant">{fmtFull(soumission.montant)}</td>
        <td><span className={`statut-orb ${cfg.cls}`}><Icon size={11} /> {cfg.label}</span></td>
        <td className="text-right"><span className="avis-date">{soumission.dateSoumission}</span></td>
        <td className="expand-toggle">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</td>
      </tr>
      {open && (
        <tr className="imputations-row">
          <td colSpan={8}>
            <div className="imputations-panel">
              <p className="imputations-title">Détails de la soumission</p>
              <table className="imputations-table">
                <thead><tr><th>Soumetteur</th><th>Email</th><th>Formulaire</th></tr></thead>
                <tbody>
                  <tr>
                    <td>{soumission.soumetteurNom || '—'}</td>
                    <td>{soumission.soumetteurEmail || '—'}</td>
                    <td>{soumission.formulaireNom || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const PAGE_SIZE = 10;

export default function RegistreImposition() {
  const [soumissionsResponse, setSoumissionsResponse] = useState({ donnees: [], pagination: { page: 1, limite: PAGE_SIZE, total: 0, totalPages: 0 } });
  const [kpi, setKpi] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilter] = useState('TOUS');
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const totalPages = Math.max(soumissionsResponse.pagination.totalPages || 0, 1);

  useEffect(() => {
    fetchKpi().then(setKpi).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSoumissions({
      page: currentPage,
      limit: PAGE_SIZE,
      search: search || undefined,
      statut: filterStatut !== 'TOUS' ? filterStatut : undefined,
    }).then(res => {
      setSoumissionsResponse(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentPage, search, filterStatut]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const soumissionsPage = [...soumissionsResponse.donnees].sort((a, b) => {
    if (!sortCol) return 0;
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va === vb) return 0;
    return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><FileText size={24} /> Journal des Soumissions</h1>
        <p className="page-subtitle">Consultation et suivi de toutes les soumissions</p>
      </div>

      {/* KPI Summary Bar */}
      {kpi && (
        <div className="registre-kpi-bar">
          <div className="registre-kpi-item"><span className="registre-kpi-num"><CountUp end={kpi.totalSoumissions} separator=" " /></span><span className="registre-kpi-label">Soumissions au total</span></div>
          <div className="registre-kpi-item success"><span className="registre-kpi-num"><CountUp end={kpi.soumissionsPayees} separator=" " /></span><span className="registre-kpi-label">Payées</span></div>
          <div className="registre-kpi-item warning"><span className="registre-kpi-num"><CountUp end={kpi.soumissionsEnAttente} separator=" " /></span><span className="registre-kpi-label">En attente</span></div>
          <div className="registre-kpi-item danger"><span className="registre-kpi-num"><CountUp end={kpi.soumissionsEchouees} separator=" " /></span><span className="registre-kpi-label">Échouées</span></div>
          <div className="registre-kpi-item"><span className="registre-kpi-num">{fmtFull(kpi.totalRevenus)}</span><span className="registre-kpi-label">Revenus</span></div>
        </div>
      )}

      {/* Filters */}
      <div className="registre-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder="Rechercher code unique, service, ministère..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <div className="filter-group">
          <Filter size={13} />
          <select className="filter-select" value={filterStatut} onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}>
            <option value="TOUS">Tous</option>
            <option value="PAID">Payé</option>
            <option value="PENDING">En attente</option>
            <option value="PARTIAL">Partiel</option>
            <option value="FAILED">Échoué</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="avis-table">
            <thead>
              <tr>
                <th className="col-index">#</th>
                <th className="sortable" onClick={() => handleSort('uniqueCode')}>Code Unique <SortIcon col="uniqueCode" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Service</th>
                <th>Ministère</th>
                <th className="text-right sortable" onClick={() => handleSort('montant')}>Montant <SortIcon col="montant" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="sortable" onClick={() => handleSort('statutPaiement')}>Statut <SortIcon col="statutPaiement" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="text-right sortable" onClick={() => handleSort('dateSoumission')}>Date <SortIcon col="dateSoumission" sortCol={sortCol} sortDir={sortDir} /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty-row"><div className="empty-state"><p>Chargement...</p></div></td></tr>
              ) : soumissionsPage.length ? (
                soumissionsPage.map((s, idx) => <SoumissionRow key={s.id || s.uniqueCode} soumission={s} rowIndex={(currentPage - 1) * PAGE_SIZE + idx + 1} />)
              ) : (
                <tr><td colSpan={8} className="empty-row"><div className="empty-state"><Search size={32} /><p>Aucune soumission trouvée.</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>{soumissionsResponse.pagination.total} soumissions au total</span>
          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>{'\u2039'}</button>
              {(() => {
                const pages = [];
                if (totalPages <= 8) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                else {
                  const start = [1,2,3,4,5], end = [totalPages-2, totalPages-1, totalPages];
                  const around = [];
                  for (let i = currentPage-1; i <= currentPage+1; i++) if (i > 5 && i < totalPages-2) around.push(i);
                  const all = [...new Set([...start,...around,...end])].sort((a,b) => a-b);
                  for (let i = 0; i < all.length; i++) {
                    if (i > 0 && all[i] - all[i-1] > 1) pages.push('e'+i);
                    pages.push(all[i]);
                  }
                }
                return pages.map(p => typeof p === 'string' ? <span key={p} className="page-ellipsis">{'\u2026'}</span> : <button key={p} className={`page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>);
              })()}
              <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>{'\u203a'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
