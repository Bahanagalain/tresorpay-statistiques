import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Map, Activity, Building2, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Target, DollarSign, Users, FileText, ArrowUpRight, ArrowDownRight,
  LayoutDashboard,
} from 'lucide-react';
import CarteCameroun from '../components/carte/CarteCameroun';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { fetchTelemetrieRegions, fetchRegionDetail } from '../api/analyticsApi';
import { formatMontant } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './CartographieRegionale.css';

const fmtFull = (n) => formatMontant(n);
const fmt = (n) => n >= 1e9 ? `${(n/1e9).toFixed(2)} Mrd` : n >= 1e6 ? `${(n/1e6).toFixed(1)} M` : n >= 1e3 ? `${(n/1e3).toFixed(0)} K` : String(n ?? 0);

const DETAIL_VIEWS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'departements', label: 'Départements', icon: Building2 },
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

  // Build a lookup map: orgUnitId/code -> telemetry item
  // so we can resolve the region code for fetchRegionDetail
  const telemetryByKey = useMemo(() => {
    const map = new Map();
    telemetry.forEach((item) => {
      if (item.orgUnitId) map.set(item.orgUnitId, item);
      if (item.code) map.set(item.code, item);
    });
    return map;
  }, [telemetry]);

  useEffect(() => {
    setLoading(true);
    fetchTelemetrieRegions(dateRange)
      .then(setTelemetry)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateRange]);

  useEffect(() => {
    if (!selectedRegion) { setRegionDetail(null); return; }
    setDetailLoading(true);
    setDetailView('overview');

    // selectedRegion is an orgUnitId (or static region id from CarteCameroun).
    // fetchRegionDetail expects the region "code" (e.g. "CE", "LT").
    // Look up the telemetry item to get the code.
    const match = telemetryByKey.get(selectedRegion);
    const code = match?.code || selectedRegion;

    const controller = new AbortController();
    fetchRegionDetail(code, dateRange, controller.signal)
      .then(setRegionDetail)
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      })
      .finally(() => setDetailLoading(false));

    return () => controller.abort();
  }, [selectedRegion, dateRange, telemetryByKey]);

  const getExportData = useCallback(() => {
    if (regionDetail && regionDetail.departements) {
      return {
        headers: ['Département', 'Montant', 'Revenus', 'Nb Soumissions', 'Payées', 'Échouées', 'Taux (%)'],
        rows: regionDetail.departements.map(c => [c.nom, fmtFull(c.montant), fmtFull(c.revenus), c.nombreSoumissions, c.soumissionsPayees, c.soumissionsEchouees, `${c.tauxPaiement}%`]),
        sheetName: regionDetail.region || 'Région',
        subtitle: `Région ${regionDetail.region} — ${regionDetail.departements.length} départements`,
      };
    }
    return {
      headers: ['Région', 'Revenus', 'Objectif', 'Nb Soumissions', 'Taux (%)'],
      rows: telemetry.map(r => [r.nom, fmtFull(r.valeur), fmtFull(r.objectif), r.nombreSoumissions, `${r.tauxPaiement || 0}%`]),
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
          <CarteCameroun regionTelemetry={telemetry} selectedRegionId={selectedRegion} onSelectRegion={setSelectedRegion} />
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
                      <h2 className="carto-region-name">{d.region}</h2>
                      <p className="carto-region-sub">{(d.departements || []).length} départements · {d.totalSoumissions} soumissions</p>
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
                        <div className="cdi-dkpi" data-glow="green"><DollarSign size={16} className="text-dgi" /><div><span className="cdi-dkpi-val">{fmtFull(d.totalRevenus)}</span><span className="cdi-dkpi-label">Revenus</span></div></div>
                        <div className="cdi-dkpi" data-glow="green"><CheckCircle size={16} className="text-success" /><div><span className="cdi-dkpi-val">{d.soumissionsPayees}</span><span className="cdi-dkpi-label">Payées</span></div></div>
                        <div className="cdi-dkpi" data-glow="green"><FileText size={16} className="text-info" /><div><span className="cdi-dkpi-val">{d.totalSoumissions}</span><span className="cdi-dkpi-label">Soumissions</span></div></div>
                        <div className="cdi-dkpi" data-glow="green"><Building2 size={16} className="text-info" /><div><span className="cdi-dkpi-val">{(d.departements || []).length}</span><span className="cdi-dkpi-label">Départements</span></div></div>
                        <div className="cdi-dkpi" data-glow="green">
                          <div className={`taux-circle ${d.tauxPaiement >= 50 ? 'good' : d.tauxPaiement >= 25 ? 'mid' : 'bad'}`}>{d.tauxPaiement}%</div>
                          <div><span className="cdi-dkpi-val">{d.soumissionsPayees} / {d.totalSoumissions}</span><span className="cdi-dkpi-label">Taux</span></div>
                        </div>
                      </div>
                      {d.services && d.services.length > 0 && (
                        <div className="carto-indicators">
                          {d.services.slice(0, 3).map((s, i) => (
                            <div key={i} className="carto-ind-item"><Activity size={14} className="text-dgi" /><span className="carto-ind-val">{s.nom || s.nomFr}</span><span className="carto-ind-label">{s.nombreSoumissions} soumissions</span></div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Départements table */}
                  {detailView === 'departements' && (
                    <div className="carto-table-scroll">
                      <table className="cdi-detail-table">
                        <thead><tr><th>#</th><th>Département</th><th className="text-right">Revenus</th><th className="text-center">Soumissions</th><th className="text-center">Payées</th><th className="text-center">Taux</th><th>Perf.</th></tr></thead>
                        <tbody>
                          {(d.departements || []).length === 0 ? (
                            <tr><td colSpan={7} className="empty-row"><div className="empty-state-sm"><p>Aucun département dans cette région.</p></div></td></tr>
                          ) : (d.departements || []).map((c, i) => (
                            <tr key={i} className="cdi-perf-row">
                              <td className="col-index">{i + 1}</td>
                              <td className="cdi-name-cell"><Building2 size={14} className="cdi-row-icon" />{c.nom}</td>
                              <td className="text-right montant-recouvre-cell">{fmtFull(c.revenus)}</td>
                              <td className="text-center">{c.nombreSoumissions}</td>
                              <td className="text-center"><span className="mini-badge paid">{c.soumissionsPayees}</span></td>
                              <td className="text-center"><span className={`taux-badge ${c.tauxPaiement >= 50 ? 'good' : c.tauxPaiement >= 25 ? 'mid' : 'bad'}`}>{c.tauxPaiement}%</span></td>
                              <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, (c.revenus / ((d.departements || [])[0]?.revenus || 1)) * 100)}%` }} /></div></td>
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
                        <thead><tr><th>#</th><th>Région</th><th className="text-right">Revenus</th><th className="text-right">Objectif</th><th className="text-center">Soumissions</th><th className="text-center">Taux</th><th>Perf.</th></tr></thead>
                        <tbody>
                          {d.classement.map((r, i) => {
                            const isSelected = r.orgUnitId === selectedRegion || r.code === d.code;
                            return (
                              <tr key={i} className={`cdi-perf-row ${isSelected ? 'selected-row' : ''}`} onClick={() => setSelectedRegion(r.orgUnitId || r.code)} style={{ cursor: 'pointer' }}>
                                <td className="col-index">{i + 1}</td>
                                <td className="contrib-name">{r.nom} {isSelected && <span className="mini-badge paid" style={{ marginLeft: '0.3rem' }}>Sélectionnée</span>}</td>
                                <td className="text-right montant-recouvre-cell">{fmtFull(r.valeur)}</td>
                                <td className="text-right">{fmtFull(r.objectif)}</td>
                                <td className="text-center">{r.nombreSoumissions}</td>
                                <td className="text-center"><span className={`taux-badge ${r.tauxPaiement >= 50 ? 'good' : r.tauxPaiement >= 25 ? 'mid' : 'bad'}`}>{r.tauxPaiement}%</span></td>
                                <td><div className="perf-bar-bg"><div className="perf-bar-fill" style={{ width: `${Math.max(2, (r.objectif / (d.classement[0]?.objectif || 1)) * 100)}%`, background: isSelected ? '#059669' : 'var(--text-tertiary)' }} /></div></td>
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
