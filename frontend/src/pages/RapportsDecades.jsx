import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Calendar, ChevronDown, Download, Users, ArrowLeft,
  Printer, TrendingUp, Hash, Building2,
} from 'lucide-react';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import ExportButtons from '../components/ui/ExportButtons';
import { fetchDecades, fetchSyntheseMensuelle } from '../api/analyticsApi';
import { formatEntier, formatMontant } from '../utils/format';
import './RapportsDecades.css';

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const ANNEES = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => now - i);
})();

// ─── Sub-components ───────────────────────────────────────

function MonthSelector({ annee, mois, onAnneeChange, onMoisChange }) {
  return (
    <div className="rd-month-selector">
      <Calendar size={16} />
      <select value={annee} onChange={(e) => onAnneeChange(Number(e.target.value))}>
        {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <select value={mois} onChange={(e) => onMoisChange(Number(e.target.value))}>
        {MOIS_LABELS.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
      </select>
    </div>
  );
}

function KpiStrip({ totaux, label }) {
  return (
    <div className="rd-kpi-strip">
      <div className="rd-kpi">
        <TrendingUp size={16} className="rd-kpi__icon" style={{ color: '#059669' }} />
        <div>
          <div className="rd-kpi__label">Montant encaissé</div>
          <div className="rd-kpi__value" style={{ color: '#059669' }}>{formatMontant(totaux.montantPaye)} FCFA</div>
        </div>
      </div>
      <div className="rd-kpi">
        <Hash size={16} className="rd-kpi__icon" style={{ color: '#2563EB' }} />
        <div>
          <div className="rd-kpi__label">Transactions</div>
          <div className="rd-kpi__value">{formatEntier(totaux.nombreTransactions)}</div>
        </div>
      </div>
      <div className="rd-kpi">
        <FileText size={16} className="rd-kpi__icon" style={{ color: '#8B5CF6' }} />
        <div>
          <div className="rd-kpi__label">Services</div>
          <div className="rd-kpi__value">{label}</div>
        </div>
      </div>
    </div>
  );
}

function RecettesTable({ lignes, showBeneficiaires, onToggleBenef }) {
  if (!lignes?.length) {
    return (
      <div className="rd-empty">
        <FileText size={40} style={{ opacity: 0.2 }} />
        <p>Aucune recette payée sur cette période</p>
      </div>
    );
  }

  const totalPaye = lignes.reduce((s, l) => s + l.montantPaye, 0);

  return (
    <div className="rd-table-wrapper">
      <table className="rd-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>N°</th>
            <th>Recette / Service</th>
            <th>Code budgétaire</th>
            <th>Ministère</th>
            <th className="text-right">Transactions</th>
            <th className="text-right">Montant payé</th>
            {showBeneficiaires && <th>Bénéficiaires (répartition)</th>}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={l.serviceId || i}>
              <td className="rd-num">{i + 1}</td>
              <td className="rd-service">{l.serviceNom}</td>
              <td className="rd-code"><code>{l.serviceCode || '—'}</code></td>
              <td className="rd-ministere">{l.ministereNom || '—'}</td>
              <td className="text-right rd-count">{formatEntier(l.nombreTransactions)}</td>
              <td className="text-right rd-amount">{formatMontant(l.montantPaye)}</td>
              {showBeneficiaires && (
                <td className="rd-benef-cell">
                  {l.beneficiaires?.length > 0 ? (
                    <div className="rd-benef-list">
                      {l.beneficiaires.map((b) => (
                        <div key={b.code} className="rd-benef-row">
                          <span className="rd-benef-name">{b.nom}</span>
                          <span className="rd-benef-pct">{b.pourcentage}%</span>
                          <span className="rd-benef-montant">{formatMontant(b.montant)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="rd-no-benef">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showBeneficiaires ? 4 : 4} className="rd-total-label">TOTAL</td>
            <td className="text-right rd-total-count">{formatEntier(lignes.reduce((s, l) => s + l.nombreTransactions, 0))}</td>
            <td className="text-right rd-total-amount">{formatMontant(totalPaye)}</td>
            {showBeneficiaires && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function RapportsDecades() {
  const now = new Date();
  const [tab, setTab] = useState('decades'); // decades | synthese
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [showBeneficiaires, setShowBeneficiaires] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedDecade, setSelectedDecade] = useState(null); // 0,1,2 or null

  // Fetch
  const loadData = useCallback(async () => {
    setLoading(true);
    setData(null);
    setSelectedDecade(null);
    try {
      if (tab === 'decades') {
        const res = await fetchDecades(annee, mois);
        setData(res);
      } else {
        const res = await fetchSyntheseMensuelle(annee, mois);
        setData(res);
      }
    } catch (e) {
      console.error('Rapport error:', e);
    } finally {
      setLoading(false);
    }
  }, [tab, annee, mois]);

  useEffect(() => { loadData(); }, [loadData]);

  // Export data builder
  const getExportData = useCallback(() => {
    const allLignes = tab === 'decades' && data?.decades
      ? (selectedDecade != null ? data.decades[selectedDecade]?.lignes || [] : data.decades.flatMap((d) => d.lignes || []))
      : data?.lignes || [];

    const baseHeaders = ['N°', 'Recette / Service', 'Code budgétaire', 'Ministère', 'Transactions', 'Montant payé FCFA'];
    const headers = showBeneficiaires
      ? [...baseHeaders, 'Bénéficiaire', '% Quote-part', 'Montant bénéficiaire FCFA']
      : baseHeaders;

    const rows = [];
    allLignes.forEach((l, i) => {
      const base = [i + 1, l.serviceNom, l.serviceCode || '', l.ministereNom || '', l.nombreTransactions, l.montantPaye];
      if (showBeneficiaires && l.beneficiaires?.length > 0) {
        l.beneficiaires.forEach((b) => {
          rows.push([...base, b.nom, `${b.pourcentage}%`, b.montant]);
        });
      } else {
        rows.push(showBeneficiaires ? [...base, '', '', ''] : base);
      }
    });

    const periodLabel = tab === 'decades'
      ? (selectedDecade != null ? `${data.decades[selectedDecade]?.label} - ${MOIS_LABELS[mois - 1]} ${annee}` : `Décades - ${MOIS_LABELS[mois - 1]} ${annee}`)
      : `Synthèse ${MOIS_LABELS[mois - 1]} ${annee}`;

    return {
      headers,
      rows,
      sheetName: tab === 'decades' ? 'Décade' : 'Synthèse',
      subtitle: periodLabel,
    };
  }, [data, tab, selectedDecade, showBeneficiaires, annee, mois]);

  const titleLabel = tab === 'decades'
    ? `Décades — ${MOIS_LABELS[mois - 1]} ${annee}`
    : `Synthèse Mensuelle — ${MOIS_LABELS[mois - 1]} ${annee}`;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><FileText size={24} /> Rapports</h1>
          <p className="page-subtitle">Décades et synthèses mensuelles des recettes encaissées</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {data && <ExportButtons getData={getExportData} title={titleLabel} filenameBase={tab === 'decades' ? 'Decade' : 'Synthese'} />}
        </div>
      </div>

      {/* Tabs + controls */}
      <div className="card rd-controls">
        <div className="rd-tabs">
          <button className={`rd-tab ${tab === 'decades' ? 'active' : ''}`} onClick={() => setTab('decades')}>
            <Calendar size={15} /> Décades
          </button>
          <button className={`rd-tab ${tab === 'synthese' ? 'active' : ''}`} onClick={() => setTab('synthese')}>
            <FileText size={15} /> Synthèse mensuelle
          </button>
        </div>

        <div className="rd-controls-right">
          <MonthSelector annee={annee} mois={mois} onAnneeChange={setAnnee} onMoisChange={setMois} />

          <label className="rd-toggle">
            <input type="checkbox" checked={showBeneficiaires} onChange={(e) => setShowBeneficiaires(e.target.checked)} />
            <Users size={14} />
            <span>Bénéficiaires</span>
          </label>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <WeaveSpinner size={70} message="Génération du rapport..." />
        </div>
      ) : !data ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Aucune donnée disponible
        </div>
      ) : tab === 'decades' && data.decades ? (
        <>
          {/* Decade selector cards */}
          {selectedDecade == null && (
            <div className="rd-decade-grid">
              {data.decades.map((d, i) => (
                <button key={i} className="card rd-decade-card" onClick={() => setSelectedDecade(i)}>
                  <div className="rd-decade-card__header">
                    <Calendar size={18} />
                    <h3>{d.label}</h3>
                  </div>
                  <div className="rd-decade-card__period">
                    {new Date(d.debut).toLocaleDateString('fr-FR')} — {new Date(d.fin).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="rd-decade-card__stats">
                    <div>
                      <span className="rd-decade-card__stat-label">Encaissé</span>
                      <span className="rd-decade-card__stat-value">{formatMontant(d.totaux?.montantPaye || 0)} FCFA</span>
                    </div>
                    <div>
                      <span className="rd-decade-card__stat-label">Transactions</span>
                      <span className="rd-decade-card__stat-value">{formatEntier(d.totaux?.nombreTransactions || 0)}</span>
                    </div>
                  </div>
                  <div className="rd-decade-card__services">
                    {formatEntier(d.lignes?.length || 0)} recette(s)
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Decade detail */}
          {selectedDecade != null && data.decades[selectedDecade] && (() => {
            const dec = data.decades[selectedDecade];
            return (
              <div className="rd-detail">
                <button className="rd-back" onClick={() => setSelectedDecade(null)}>
                  <ArrowLeft size={15} /> Retour aux décades
                </button>
                <div className="card" style={{ marginTop: '0.5rem' }}>
                  <div className="rd-detail-header">
                    <div>
                      <h2 className="rd-detail-title">{dec.label}</h2>
                      <p className="rd-detail-period">
                        {new Date(dec.debut).toLocaleDateString('fr-FR')} — {new Date(dec.fin).toLocaleDateString('fr-FR')}
                        {' · '}{MOIS_LABELS[mois - 1]} {annee}
                      </p>
                    </div>
                  </div>
                  <KpiStrip totaux={dec.totaux || { montantPaye: 0, nombreTransactions: 0 }} label={`${dec.lignes?.length || 0} recette(s)`} />
                  <RecettesTable lignes={dec.lignes || []} showBeneficiaires={showBeneficiaires} />
                </div>
              </div>
            );
          })()}
        </>
      ) : tab === 'synthese' && data.lignes ? (
        <div className="card" style={{ marginTop: '0.5rem' }}>
          <div className="rd-detail-header">
            <div>
              <h2 className="rd-detail-title">Synthèse mensuelle</h2>
              <p className="rd-detail-period">
                {new Date(data.periode?.debut).toLocaleDateString('fr-FR')} — {new Date(data.periode?.fin).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <KpiStrip totaux={data.totaux || { montantPaye: 0, nombreTransactions: 0 }} label={`${data.lignes?.length || 0} recette(s)`} />
          <RecettesTable lignes={data.lignes || []} showBeneficiaires={showBeneficiaires} />
        </div>
      ) : null}
    </div>
  );
}
