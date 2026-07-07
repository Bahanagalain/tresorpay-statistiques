import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, AlertCircle, AlertTriangle, Building2, Search, X,
  FileSpreadsheet, FileDown, ChevronDown, ChevronUp, DollarSign,
  Ban, CreditCard, Layers, CheckCircle,
} from 'lucide-react';
import { fetchConformiteRib } from '../api/dgiAnalyticsApi';
import { exportToExcel, exportGenericPDF } from '../utils/exportUtils';
import { formatMontant, formatEntier } from '../utils/format';
import './ConformiteRIB.css';

const fmtFull = (n) => formatMontant(n);

const BLOCAGE_ICONS = {
  rib_manquant: Ban,
  rib_campost: CreditCard,
  rib_multiple: Layers,
  sans_imputations: AlertTriangle,
};

const SEVERITE_CLS = {
  critique: 'blocage-critique',
  attention: 'blocage-attention',
};

export default function ConformiteRIB() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedBlocage, setExpandedBlocage] = useState(null);
  const [activeTab, setActiveTab] = useState('blocages');

  useEffect(() => {
    fetchConformiteRib()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredCentres = useMemo(() => {
    if (!data?.parCentre) return [];
    const q = search.toLowerCase();
    return data.parCentre.filter(c =>
      !q || c.centre.toLowerCase().includes(q) || c.ribsRecette.some(r => r.toLowerCase().includes(q))
    );
  }, [data, search]);

  const handleExportExcel = useCallback(() => {
    if (!data?.parCentre) return;
    const headers = ['Centre CDI', 'Nb Avis', 'Nb Payés', 'Montant Total', 'Montant Payé', 'RIBs Recette', 'Nb RIBs', 'Sans RIB', 'Montant Sans RIB', 'RIB Campost'];
    const rows = data.parCentre.map(c => [
      c.centre, c.nbAvis, c.nbPayes, fmtFull(c.montantTotal), fmtFull(c.montantPaye),
      c.ribsRecette.join(' | '), c.nbRibsRecette, c.nbSansRibRecette, fmtFull(c.montantSansRibRecette), c.nbRibCampost,
    ]);
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    exportToExcel(rows, headers, 'Conformite RIB', `Conformite_RIB_${ts}.xlsx`);
  }, [data]);

  const handleExportPDF = useCallback(async () => {
    if (!data?.parCentre) return;
    const headers = ['Centre CDI', 'Nb Avis', 'Payés', 'Montant Payé', 'RIBs', 'Sans RIB', 'Mnt Sans RIB'];
    const rows = data.parCentre.map(c => [
      c.centre, c.nbAvis, c.nbPayes, fmtFull(c.montantPaye),
      c.ribsRecette.join(', '), c.nbSansRibRecette, fmtFull(c.montantSansRibRecette),
    ]);
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    await exportGenericPDF({
      title: 'TRESOR ANALYTICS — Conformite RIB',
      subtitle: `${data.parCentre.length} centres analysés`,
      headers, rows,
      filename: `Conformite_RIB_${ts}.pdf`,
    });
  }, [data]);

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Analyse des RIBs..." /></div></div>;
  }

  if (!data) {
    return <div className="page-container"><p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '3rem' }}>Impossible de charger les donnees.</p></div>;
  }

  const { resume, blocages } = data;
  const blocageList = Object.entries(blocages);
  const totalBlocages = blocageList.reduce((s, [, b]) => s + (b.nbAvis || b.nbCentres || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><Shield size={24} /> Conformite RIB & Blocages Reversements</h1>
          <p className="page-subtitle">Analyse des elements pouvant bloquer les reversements vers les beneficiaires</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button onClick={handleExportExcel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#555', border: '1px solid #ddd' }}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={handleExportPDF}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', boxShadow: '0 3px 10px rgba(5,150,105,0.3)' }}>
            <FileDown size={14} /> PDF
          </button>
        </div>
      </div>

      {/* KPI Resume */}
      <div className="rib-kpi-grid">
        <div className="rib-kpi-card">
          <DollarSign size={20} className="text-dgi" />
          <div><span className="rib-kpi-val">{fmtFull(resume.montantTotalPaye)}</span><span className="rib-kpi-label">Total Encaisse</span></div>
        </div>
        <div className="rib-kpi-card">
          <CheckCircle size={20} style={{ color: '#059669' }} />
          <div><span className="rib-kpi-val">{fmtFull(resume.totalReversements)}</span><span className="rib-kpi-label">Total Reverse ({formatEntier(resume.nombreReversements)} op.)</span></div>
        </div>
        <div className="rib-kpi-card">
          <AlertCircle size={20} style={{ color: '#DC2626' }} />
          <div><span className="rib-kpi-val">{fmtFull(resume.montantTotalPaye - resume.totalReversements)}</span><span className="rib-kpi-label">Ecart (non reverse)</span></div>
        </div>
        <div className="rib-kpi-card">
          <Ban size={20} style={{ color: '#DC2626' }} />
          <div><span className="rib-kpi-val">{formatEntier(totalBlocages)}</span><span className="rib-kpi-label">Blocages detectes</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rib-tabs">
        <button className={`rib-tab ${activeTab === 'blocages' ? 'active' : ''}`} onClick={() => setActiveTab('blocages')}>
          <AlertCircle size={14} /> Blocages ({blocageList.length})
        </button>
        <button className={`rib-tab ${activeTab === 'centres' ? 'active' : ''}`} onClick={() => setActiveTab('centres')}>
          <Building2 size={14} /> Par Centre ({data.parCentre.length})
        </button>
        <button className={`rib-tab ${activeTab === 'ribs' ? 'active' : ''}`} onClick={() => setActiveTab('ribs')}>
          <CreditCard size={14} /> Inventaire RIBs ({data.ribInventaire.length})
        </button>
      </div>

      {/* TAB: Blocages */}
      {activeTab === 'blocages' && (
        <div className="rib-blocages">
          {blocageList.map(([key, b]) => {
            const Icon = BLOCAGE_ICONS[key] || AlertTriangle;
            const isExpanded = expandedBlocage === key;
            const cls = SEVERITE_CLS[b.severite] || 'blocage-attention';
            return (
              <div key={key} className={`blocage-card ${cls}`}>
                <div className="blocage-header" onClick={() => setExpandedBlocage(isExpanded ? null : key)}>
                  <div className="blocage-header-left">
                    <Icon size={20} />
                    <div>
                      <h3 className="blocage-titre">{b.titre}</h3>
                      <p className="blocage-desc">{b.description}</p>
                    </div>
                  </div>
                  <div className="blocage-header-right">
                    {b.nbAvis != null && <span className="blocage-stat"><strong>{formatEntier(b.nbAvis)}</strong> avis</span>}
                    {b.montant != null && <span className="blocage-stat"><strong>{fmtFull(b.montant)}</strong></span>}
                    {b.nbCentres != null && <span className="blocage-stat"><strong>{b.nbCentres}</strong> centre(s)</span>}
                    <span className={`blocage-badge ${b.severite}`}>{b.severite}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && b.centres && (
                  <div className="blocage-details">
                    <table className="cdi-detail-table">
                      <thead>
                        <tr>
                          <th>Centre CDI</th>
                          {b.centres[0]?.nbAvis != null && <th className="text-center">Avis</th>}
                          {b.centres[0]?.montant != null && <th className="text-right">Montant</th>}
                          {b.centres[0]?.ribs && <th>RIBs</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {b.centres.map((c, i) => (
                          <tr key={i}>
                            <td className="contrib-name">{c.centre}</td>
                            {c.nbAvis != null && <td className="text-center">{c.nbAvis}</td>}
                            {c.montant != null && <td className="text-right montant-cell">{fmtFull(c.montant)}</td>}
                            {c.ribs && <td><div className="rib-list">{c.ribs.map((r, j) => <code key={j} className="rib-code">{r}</code>)}</div></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && b.exemples && (
                  <div className="blocage-details">
                    <table className="cdi-detail-table">
                      <thead><tr><th>N Avis</th><th>Contribuable</th><th>Centre</th><th className="text-right">Montant</th><th>Statut</th></tr></thead>
                      <tbody>
                        {b.exemples.slice(0, 20).map((a, i) => (
                          <tr key={i}>
                            <td><span className="avis-numero">{a.numero}</span></td>
                            <td className="contrib-name">{a.contribuable}</td>
                            <td>{a.centre}</td>
                            <td className="text-right montant-cell">{fmtFull(a.montant)}</td>
                            <td><span className={`mini-badge ${a.statut === 'PAID' ? 'paid' : a.statut === 'OVERDUE' ? 'overdue' : 'pending'}`}>{a.statut}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: Par Centre */}
      {activeTab === 'centres' && (
        <div>
          <div className="cdi-controls" style={{ marginBottom: '0.75rem' }}>
            <div className="search-box">
              <Search size={14} />
              <input className="search-input" placeholder="Rechercher un centre ou un RIB..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
            </div>
            <span className="cdi-count">{filteredCentres.length} centre(s)</span>
          </div>
          <div className="card cdi-table-card cdi-table-scroll" data-glow="green" style={{ padding: 0 }}>
            <table className="cdi-perf-table">
              <thead>
                <tr>
                  <th className="col-index">#</th>
                  <th>Centre CDI</th>
                  <th className="text-center">Avis</th>
                  <th className="text-center">Payes</th>
                  <th className="text-right">Montant Paye</th>
                  <th>RIBs Recette</th>
                  <th className="text-center">Sans RIB</th>
                  <th className="text-right">Mnt Sans RIB</th>
                  <th className="text-center">Campost</th>
                  <th className="text-center">Multi-RIB</th>
                </tr>
              </thead>
              <tbody>
                {filteredCentres.map((c, i) => (
                  <tr key={c.centre} className="cdi-perf-row">
                    <td className="col-index">{i + 1}</td>
                    <td className="cdi-name-cell"><Building2 size={14} className="cdi-row-icon" />{c.centre}</td>
                    <td className="text-center">{c.nbAvis}</td>
                    <td className="text-center"><span className="mini-badge paid">{c.nbPayes}</span></td>
                    <td className="text-right montant-cell">{fmtFull(c.montantPaye)}</td>
                    <td><div className="rib-list">{c.ribsRecette.length > 0 ? c.ribsRecette.map((r, j) => <code key={j} className="rib-code">{r}</code>) : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Aucun</span>}</div></td>
                    <td className="text-center">{c.nbSansRibRecette > 0 ? <span className="mini-badge overdue">{c.nbSansRibRecette}</span> : <span className="mini-badge paid">0</span>}</td>
                    <td className="text-right" style={{ color: c.montantSansRibRecette > 0 ? '#DC2626' : 'inherit', fontWeight: c.montantSansRibRecette > 0 ? 700 : 400 }}>{fmtFull(c.montantSansRibRecette)}</td>
                    <td className="text-center">{c.nbRibCampost > 0 ? <span className="mini-badge overdue">{c.nbRibCampost}</span> : <span className="mini-badge paid">0</span>}</td>
                    <td className="text-center">{c.multipleRibs ? <span className="mini-badge overdue">{c.nbRibsRecette}</span> : <span className="mini-badge paid">1</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Inventaire RIBs */}
      {activeTab === 'ribs' && (
        <div className="card cdi-table-card cdi-table-scroll" data-glow="green" style={{ padding: 0 }}>
          <table className="cdi-perf-table">
            <thead>
              <tr>
                <th className="col-index">#</th>
                <th>RIB</th>
                <th>Type</th>
                <th className="text-center">Nb Avis</th>
                <th className="text-right">Montant</th>
                <th>Centres utilisant ce RIB</th>
              </tr>
            </thead>
            <tbody>
              {data.ribInventaire.map((r, i) => (
                <tr key={i} className="cdi-perf-row">
                  <td className="col-index">{i + 1}</td>
                  <td><code className="rib-code">{r.rib}</code></td>
                  <td>{r.type === 'recette' ? 'Recette' : 'Fiscalite Locale'}</td>
                  <td className="text-center">{formatEntier(r.nbAvis)}</td>
                  <td className="text-right montant-cell">{fmtFull(r.montant)}</td>
                  <td><div className="rib-list">{r.centres.map((c, j) => <span key={j} className="centre-badge-sm">{c}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
