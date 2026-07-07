import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Map, Activity, Building2, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Target, DollarSign, Users, FileText, ArrowUpRight, ArrowDownRight,
  LayoutDashboard,
} from 'lucide-react';
import DGICartographie from '../components/dgi/DGICartographie';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { fetchDgiRegionTelemetry, fetchRegionDetail } from '../api/dgiAnalyticsApi';
import { formatMontant } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './CartographieRegionale.css';

const fmtFull = (n) => formatMontant(n);
const fmt = (n) => n >= 1e9 ? `${(n/1e9).toFixed(2)} Mrd` : n >= 1e6 ? `${(n/1e6).toFixed(1)} M` : n >= 1e3 ? `${(n/1e3).toFixed(0)} K` : String(n ?? 0);

const DETAIL_VIEWS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'cdis', label: 'CDIs de la région', icon: Building2 },
  { id: 'classement', label: 'Classement national', icon: TrendingUp },
];

export default function CartographieRegionale() {
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getCurrentPeriodRange);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [regionDetail, setRegionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailView, setDetailView] = useState('overview');

  useEffect(() => {
    setLoading(true);
    fetchDgiRegionTelemetry(dateRange)
      .then(setTelemetry)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateRange]);

  useEffect(() => {
    if (!selectedRegion) { setRegionDetail(null); return; }
    setDetailLoading(true);
    setDetailView('overview');
    fetchRegionDetail(selectedRegion, dateRange)
      .then(setRegionDetail)
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selectedRegion, dateRange]);

  const getExportData = useCallback(() => {
    if (regionDetail && regionDetail.cdis) {
      return {
        headers: ['Centre CDI', 'Montant', 'Recouvré', 'Nb Avis', 'Payés', 'Retard', 'Taux (%)'],
        rows: regionDetail.cdis.map(c => [c.centre, fmtFull(c.montant), fmtFull(c.montantRecouvre), c.nombreAvis, c.avisPaies, c.avisEnRetard, `${c.tauxRecouvrement}%`]),
        sheetName: regionDetail.nom || 'Région',
        subtitle: `Région ${regionDetail.nom} — ${regionDetail.cdis.length} CDIs`,
      };
    }
    return {
      headers: ['Région', 'Montant Recouvré', 'Montant Total', 'Nb CDIs', 'Nb Avis', 'Taux (%)'],
      rows: telemetry.map(r => [r.name, fmtFull(r.value), fmtFull(r.target), r.nbCdis, r.nbAvis, `${r.tauxRecouvrement}%`]),
      sheetName: 'Régions',
      subtitle: `${telemetry.length} régions`,
    };
  }, [regionDetail, telemetry]);

  if (loading) {
    return <div className="page-container"><div className="exec-loading"><WeaveSpinner message="Chargement..." /></div></div>;
  }

  const d = regionDetail;

  return (
    <div className="carto-page">
      {/* Header — compact */}
      <div className="carto-page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: '1.15rem', marginBottom: '0.1rem' }}><Map size={20} /> Cartographie Régionale</h1>
          <p className="page-subtitle" style={{ fontSize: '0.72rem' }}>Cliquer sur une région pour voir le détail</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Cartographie Régionale" filenameBase="Cartographie" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      {/* Main layout: map (top) + detail (bottom) — NO page scroll */}
      <div className="carto-layout">
        {/* Map */}
        <div className={`carto-map-area ${selectedRegion ? 'with-detail' : ''}`}>
          <DGICartographie regionTelemetry={telemetry} selectedRegionId={selectedRegion} onSelectRegion={setSelectedRegion} />
        </div>

        {/* Detail panel — below the map, scrolls internally */}
        {selectedRegion && (
          <div className="carto-detail-panel">
            {detailLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><WeaveSpinner size={40} /></div>
            ) : d ? (
              <>
                <div className="carto-detail-header-bar">
                  <div className="carto-detail-header-left">
                    <div className="carto-region-icon"><Map size={18} /></div>
                    <div>
                      <h2 className="carto-region-name">{d.nom}</h2>
                      <p className="carto-region-sub">{d.nbCdis} CDIs · {d.nbContribuables} contribuables · {d.nbAvis} avis</p>
                    </div>
                  </div>
                  <div className="carto-detail-nav">
                    {DETAIL_VIEWS.map(v => { const I = v.icon; return (
                      <button key={v.id} className={`cdi-tab ${detailView === v.id ? 'active' : ''}`} onClick={() => setDetailView(v.id)}>
                        <I size={13} /> {v.label}
                      </button>
                    ); })}
                  </div>
                </div>

                <div className="carto-detail-content">
                  {/* Overview */}
                  {detailView === 'overview' && (
                    <>
                      <div className="cdi-detail-kpis" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                        <div className="cdi-dkpi" data-glow="green"><DollarSign size={16} className="text-dgi" /><div><span className="cdi-dkpi-val">{fmtFull(d.montant)}</span><span className="cdi-dkpi-label">Total</span></div></div>
                        <div className="cdi-dkpi" data-glow="green"><CheckCircle size={16} className="text-success" /><div><span className="cdi-dkpi-val">{fmtFull(d.montantRecouvre)}</span><span className="cdi-dkpi-label">Recouvré</span></div></div>
                        <div className="cdi-dkpi" data-glow="green"><AlertTriangle size={16} className="text-danger" /><div><span className="cdi-dkpi-val">{fmtFull(d.montantRestant)}</span><span className="cdi-dkpi-label">Reste</span></div></div>
                        <div className="cdi-dkpi" data-glow="green"><FileText size={16} className="text-info" /><div><span className="cdi-dkpi-val">{d.nbAvis}</span><span className="cdi-dkpi-label">Avis</span></div></div>
                        <div className="cdi-dkpi" data-glow="green">
                          <div className={`taux-circle ${d.tauxRecouvrement >= 50 ? 'good' : d.tauxRecouvrement >= 25 ? 'mid' : 'bad'}`}>{d.tauxRecouvrement}%</div>
                          <div><span className="cdi-dkpi-val">{d.avisPaies} / {d.nbAvis}</span><span className="cdi-dkpi-label">Taux</span></div>
                        </div>
                      </div>
                      {d.indicateurs && (
                        <div className="carto-indicators">
                          <div className="carto-ind-item"><DollarSign size={14} className="text-dgi" /><span className="carto-ind-val">{fmtFull(d.indicateurs.montantMoyenParCdi)}</span><span className="carto-ind-label">Moy. / CDI</span></div>
                          {d.indicateurs.bestCdi && <div className="carto-ind-item"><TrendingUp size={14} className="text-success" /><span className="carto-ind-val">{d.indicateurs.bestCdi.centre}</span><span className="carto-ind-label">Meilleur ({d.indicateurs.bestCdi.taux}%)</span></div>}
                          {d.indicateurs.worstCdi && <div className="carto-ind-item"><TrendingDown size={14} className="text-danger" /><span className="carto-ind-val">{d.indicateurs.worstCdi.centre}</span><span className="carto-ind-label">En alerte ({d.indicateurs.worstCdi.taux}%)</span></div>}
                          <div className="carto-ind-item">
                            {d.indicateurs.tauxVsMoyenne >= 0 ? <ArrowUpRight size={14} className="text-success" /> : <ArrowDownRight size={14} className="text-danger" />}
                            <span className="carto-ind-val" style={{ color: d.indicateurs.tauxVsMoyenne >= 0 ? '#059669' : '#DC2626' }}>{d.indicateurs.tauxVsMoyenne >= 0 ? '+' : ''}{d.indicateurs.tauxVsMoyenne}%</span>
                            <span className="carto-ind-label">vs moy. ({d.indicateurs.moyenneNationale}%)</span>
                          </div>
                          <div className="carto-ind-item"><Target size={14} className="text-info" /><span className="carto-ind-val">{d.indicateurs.concentration}%</span><span className="carto-ind-label">du national</span></div>
                        </div>
                      )}
                    </>
                  )}

                  {/* CDIs table */}
                  {detailView === 'cdis' && (
                    <div className="carto-table-scroll">
                      <table className="cdi-detail-table">
                        <thead><tr><th>#</th><th>Centre CDI</th><th className="text-right">Montant</th><th className="text-right">Recouvré</th><th className="text-center">Avis</th><th className="text-center">Payés</th><th className="text-center">Retard</th><th className="text-center">Taux</th><th>Perf.</th></tr></thead>
                        <tbody>
                          {(d.cdis || []).length === 0 ? (
                            <tr><td colSpan={9} className="empty-row"><div className="empty-state-sm"><p>Aucun CDI dans cette région.</p></div></td></tr>
                          ) : (d.cdis || []).map((c, i) => (
                            <tr key={i} className="cdi-perf-row">
                              <td className="col-index">{i + 1}</td>
                              <td className="cdi-name-cell"><Building2 size={14} className="cdi-row-icon" />{c.centre}</td>
                              <td className="text-right montant-cell">{fmtFull(c.montant)}</td>
                              <td className="text-right montant-recouvre-cell">{fmtFull(c.montantRecouvre)}</td>
                              <td className="text-center">{c.nombreAvis}</td>
                              <td className="text-center"><span className="mini-badge paid">{c.avisPaies}</span></td>
                              <td className="text-center">{c.avisEnRetard > 0 ? <span className="mini-badge overdue">{c.avisEnRetard}</span> : <span className="mini-badge paid">0</span>}</td>
                              <td className="text-center"><span className={`taux-badge ${c.tauxRecouvrement >= 50 ? 'good' : c.tauxRecouvrement >= 25 ? 'mid' : 'bad'}`}>{c.tauxRecouvrement}%</span></td>
                              <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, (c.montant / ((d.cdis || [])[0]?.montant || 1)) * 100)}%` }} /></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Classement table */}
                  {detailView === 'classement' && d.classement && (
                    <div className="carto-table-scroll">
                      <table className="cdi-detail-table">
                        <thead><tr><th>#</th><th>Région</th><th className="text-right">Montant</th><th className="text-right">Recouvré</th><th className="text-center">CDIs</th><th className="text-center">Avis</th><th className="text-center">Taux</th><th>Perf.</th></tr></thead>
                        <tbody>
                          {d.classement.map((r, i) => {
                            const isSelected = r.id === d.code;
                            return (
                              <tr key={i} className={`cdi-perf-row ${isSelected ? 'selected-row' : ''}`} onClick={() => setSelectedRegion(r.id)} style={{ cursor: 'pointer' }}>
                                <td className="col-index">{i + 1}</td>
                                <td className="contrib-name">{r.name} {isSelected && <span className="mini-badge paid" style={{ marginLeft: '0.3rem' }}>Sélectionnée</span>}</td>
                                <td className="text-right">{fmtFull(r.target)}</td>
                                <td className="text-right montant-recouvre-cell">{fmtFull(r.value)}</td>
                                <td className="text-center">{r.nbCdis}</td>
                                <td className="text-center">{r.nbAvis}</td>
                                <td className="text-center"><span className={`taux-badge ${r.tauxRecouvrement >= 50 ? 'good' : r.tauxRecouvrement >= 25 ? 'mid' : 'bad'}`}>{r.tauxRecouvrement}%</span></td>
                                <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, (r.target / (d.classement[0]?.target || 1)) * 100)}%`, background: isSelected ? '#059669' : 'var(--text-tertiary)' }} /></div></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '1.5rem' }}>Aucune donnée pour cette région.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
