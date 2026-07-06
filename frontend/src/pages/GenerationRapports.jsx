import { useState, useEffect, useCallback } from 'react';

import { FileText, Download, FileSpreadsheet, FileBarChart, Eye, Calendar, CheckCircle } from 'lucide-react';
import { fetchDashboard } from '../api/statistiquesApi';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { exportToPDF, exportToExcel, exportToCSV } from '../utils/exportUtils';
import { formatMontant, formatMontantCompact, formatPourcentage } from '../utils/format';

const REPORT_TYPES = [
  { key: 'kpi', label: 'KPI Global', desc: 'Indicateurs cles de performance', icon: FileBarChart },
  { key: 'evolution', label: 'Evolution', desc: 'Tendances mensuelles des revenus', icon: Calendar },
  { key: 'repartition', label: 'Repartition', desc: 'Ministeres, services et domaines', icon: FileSpreadsheet },
  { key: 'complet', label: 'Rapport Complet', desc: 'Toutes les donnees consolidees', icon: FileText },
];

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }) };

function buildExportData(data, reportType) {
  if (!data) return [];
  switch (reportType) {
    case 'kpi':
      return [{
        'Revenus Totaux': data.kpi?.totalRevenus || 0,
        'Total Soumissions': data.kpi?.totalSoumissions || 0,
        'Soumissions Payees': data.kpi?.soumissionsPayees || 0,
        'En Attente': data.kpi?.soumissionsEnAttente || 0,
        'Echouees': data.kpi?.soumissionsEchouees || 0,
        'Taux Paiement (%)': data.kpi?.tauxPaiement || 0,
      }];
    case 'evolution':
      return (data.evolution || []).map((e) => ({
        'Periode': e.mois,
        'Paye (FCFA)': e.paye,
        'En Attente (FCFA)': e.enAttente,
        'Echoue (FCFA)': e.echoue,
      }));
    case 'repartition':
      return (data.ministeres || []).map((m) => ({
        'Ministere': m.nom,
        'Montant (FCFA)': m.montant,
        'Soumissions': m.nombreSoumissions,
        'Taux Paiement (%)': m.tauxPaiement,
      }));
    case 'complet': {
      const rows = [];
      // KPI section
      rows.push({ Section: 'KPI', Cle: 'Revenus Totaux', Valeur: data.kpi?.totalRevenus || 0 });
      rows.push({ Section: 'KPI', Cle: 'Total Soumissions', Valeur: data.kpi?.totalSoumissions || 0 });
      rows.push({ Section: 'KPI', Cle: 'Taux Paiement', Valeur: `${data.kpi?.tauxPaiement || 0}%` });
      // Ministeres
      (data.ministeres || []).forEach((m) => {
        rows.push({ Section: 'Ministere', Cle: m.nom, Valeur: m.montant });
      });
      // Services
      (data.services || []).forEach((s) => {
        rows.push({ Section: 'Service', Cle: s.nom, Valeur: s.montant });
      });
      return rows;
    }
    default:
      return [];
  }
}

export default function GenerationRapports() {
  const { state: periodState, setState: setPeriodState, range } = usePeriodFilter();
  const [reportType, setReportType] = useState('complet');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboard(range);
      setData(result);
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      await exportToPDF('report-preview', `rapport-${reportType}`);
    } catch { /* silent */ }
    setExporting(null);
  };

  const handleExportExcel = () => {
    setExporting('excel');
    try {
      const rows = buildExportData(data, reportType);
      exportToExcel(rows, `rapport-${reportType}`, 'Rapport');
    } catch { /* silent */ }
    setExporting(null);
  };

  const handleExportCSV = () => {
    setExporting('csv');
    try {
      const rows = buildExportData(data, reportType);
      exportToCSV(rows, `rapport-${reportType}`);
    } catch { /* silent */ }
    setExporting(null);
  };

  const previewData = buildExportData(data, reportType);

  return (
    <div>
      {/* Header */}
      <div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <h2 className="text-headline" style={{ margin: 0 }}>Generation de Rapports</h2>
        <p className="text-body" style={{ margin: '4px 0 0' }}>Exportez vos donnees en PDF, Excel ou CSV</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        {/* Left Panel — Options */}
        <div>
          {/* Period Selection */}
          <div className="card-layer glass-panel" custom={0} variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 16 }}>
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 12 }}>Periode</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'all', label: 'Toute la periode' },
                { key: 'today', label: "Aujourd'hui" },
                { key: 'month', label: 'Ce mois' },
                { key: 'custom', label: 'Personnalise' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodState({ preset: p.key })}
                  style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid',
                    borderColor: periodState.preset === p.key ? 'var(--accent-gold)' : 'var(--glass-border)',
                    background: periodState.preset === p.key ? 'var(--accent-gold-dim)' : 'transparent',
                    color: periodState.preset === p.key ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {periodState.preset === p.key && <CheckCircle size={16} />}
                  {p.label}
                </button>
              ))}
              {periodState.preset === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <label className="text-label" style={{ fontSize: 11 }}>Date debut</label>
                  <input type="date" className="ghost-input" style={{ padding: '8px 10px' }} value={periodState.customStart} onChange={(e) => setPeriodState({ customStart: e.target.value })} />
                  <label className="text-label" style={{ fontSize: 11 }}>Date fin</label>
                  <input type="date" className="ghost-input" style={{ padding: '8px 10px' }} value={periodState.customEnd} onChange={(e) => setPeriodState({ customEnd: e.target.value })} />
                </div>
              )}
            </div>
          </div>

          {/* Report Type Selection */}
          <div className="card-layer glass-panel" custom={1} variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 16 }}>
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 12 }}>Type de rapport</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REPORT_TYPES.map((rt) => {
                const Icon = rt.icon;
                const selected = reportType === rt.key;
                return (
                  <button
                    key={rt.key}
                    onClick={() => setReportType(rt.key)}
                    style={{
                      padding: '12px 14px', borderRadius: 8, border: '1px solid',
                      borderColor: selected ? 'var(--accent-gold)' : 'var(--glass-border)',
                      background: selected ? 'var(--accent-gold-dim)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <Icon size={20} style={{ color: selected ? 'var(--accent-gold)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: selected ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{rt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{rt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="card-layer glass-panel" custom={2} variants={fadeUp} initial="hidden" animate="visible">
            <h3 className="text-title" style={{ marginTop: 0, marginBottom: 12 }}>Exporter</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-primary" onClick={handleExportPDF} disabled={loading || !data || exporting === 'pdf'} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Download size={16} />
                {exporting === 'pdf' ? 'Export en cours...' : 'Telecharger PDF'}
              </button>
              <button className="btn-secondary-outline" onClick={handleExportExcel} disabled={loading || !data || exporting === 'excel'} style={{ width: '100%', justifyContent: 'center' }}>
                <FileSpreadsheet size={16} />
                {exporting === 'excel' ? 'Export en cours...' : 'Telecharger Excel'}
              </button>
              <button className="btn-secondary-outline" onClick={handleExportCSV} disabled={loading || !data || exporting === 'csv'} style={{ width: '100%', justifyContent: 'center' }}>
                <FileText size={16} />
                {exporting === 'csv' ? 'Export en cours...' : 'Telecharger CSV'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel — Preview */}
        <div className="card-layer glass-panel" custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="text-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={18} /> Apercu du rapport
            </h3>
            <span className="text-label" style={{ fontSize: 11 }}>
              {REPORT_TYPES.find((r) => r.key === reportType)?.label}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-tertiary)' }}>Chargement des donnees...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>
              <button className="btn-primary" onClick={loadData}>Reessayer</button>
            </div>
          ) : (
            <div id="report-preview" style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 24 }}>
              {/* Report Header */}
              <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid var(--accent-gold)' }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Republique du Cameroun</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>TresorPay Statistiques</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {REPORT_TYPES.find((r) => r.key === reportType)?.label}
                  {range.startDate && ` — du ${range.startDate}`}
                  {range.endDate && ` au ${range.endDate}`}
                </div>
              </div>

              {/* KPI Summary (for kpi and complet) */}
              {(reportType === 'kpi' || reportType === 'complet') && data?.kpi && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Indicateurs Cles</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Revenus Totaux', value: formatMontantCompact(data.kpi.totalRevenus) },
                      { label: 'Soumissions', value: data.kpi.totalSoumissions },
                      { label: 'Taux Paiement', value: formatPourcentage(data.kpi.tauxPaiement) },
                      { label: 'Payees', value: data.kpi.soumissionsPayees },
                      { label: 'En Attente', value: data.kpi.soumissionsEnAttente },
                      { label: 'Echouees', value: data.kpi.soumissionsEchouees },
                    ].map((k) => (
                      <div key={k.label} style={{ padding: 12, background: 'var(--bg-surface-elevated)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {previewData.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                        {Object.keys(previewData[0]).map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          {Object.values(row).map((val, vi) => (
                            <td key={vi} style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>
                              {typeof val === 'number' ? val.toLocaleString('fr-FR') : val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 20 && (
                    <div style={{ textAlign: 'center', padding: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                      ... et {previewData.length - 20} lignes supplementaires
                    </div>
                  )}
                </div>
              )}

              {previewData.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Aucune donnee pour ce type de rapport</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
