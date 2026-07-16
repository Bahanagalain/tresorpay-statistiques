import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, CheckCircle, Clock, AlertTriangle, Building2, RotateCcw } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import { fetchSoumissions } from '../../api/analyticsApi';
import { formatEntier, formatMontant } from '../../utils/format';
import './DrillDownModal.css';

const STATUS_COLORS = { PAID: '#059669', PENDING: '#D97706', PARTIAL: '#2563EB', FAILED: '#DC2626' };
const STATUS_LABELS = { PAID: 'Payé', PENDING: 'En attente', PARTIAL: 'Partiel', FAILED: 'Échoué' };
const STATUS_ICONS = { PAID: CheckCircle, PENDING: Clock, PARTIAL: Clock, FAILED: AlertTriangle };

const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(0)} K`
  : formatEntier(n);

const fmtFull = (n) => formatMontant(n);

async function loadAllAvisForCdi({ cdi, dateRange, signal }) {
  const firstPage = await fetchSoumissions({
    ...dateRange,
    cdi,
    page: 1,
    limit: 200,
  }, signal);

  const allRows = [...firstPage.data];
  const pageCount = Math.max(firstPage.meta.totalPages || 1, 1);

  for (let page = 2; page <= pageCount; page += 1) {
    const nextPage = await fetchSoumissions({
      ...dateRange,
      cdi,
      page,
      limit: 200,
    }, signal);
    allRows.push(...nextPage.data);
  }

  return allRows;
}

export default function DrillDownModal({ cdi, dateRange, onClose }) {
  const overlayRef = useRef(null);
  const [avis, setAvis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!cdi) return undefined;

    let isMounted = true;
    const controller = new AbortController();

    async function loadAvis() {
      setLoading(true);
      setError('');

      try {
        const rows = await loadAllAvisForCdi({
          cdi,
          dateRange,
          signal: controller.signal,
        });

        if (!isMounted) return;
        setAvis(rows);
      } catch (loadError) {
        if (!isMounted || loadError?.name === 'AbortError') return;
        setError(loadError?.message || 'Impossible de charger le détail du ministère.');
        setAvis([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAvis();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [cdi, dateRange, reloadNonce]);

  const metrics = useMemo(() => {
    const payes = avis.filter((item) => item.statut === 'PAID');
    const attente = avis.filter((item) => item.statut === 'PENDING');
    const retard = avis.filter((item) => item.statut === 'OVERDUE');
    const total = avis.reduce((sum, item) => sum + item.montantTotal, 0);
    const montantPaye = payes.reduce((sum, item) => sum + item.montantTotal, 0);
    const montantAttente = attente.reduce((sum, item) => sum + item.montantTotal, 0);
    const montantRetard = retard.reduce((sum, item) => sum + item.montantTotal, 0);
    const taux = total > 0 ? Math.round((montantPaye / total) * 100) : 0;

    const pieData = [
      { name: 'Payé', value: payes.length, fill: STATUS_COLORS.PAID },
      { name: 'En attente', value: attente.length, fill: STATUS_COLORS.PENDING },
      { name: 'En retard', value: retard.length, fill: STATUS_COLORS.OVERDUE },
    ].filter((item) => item.value > 0);

    const imputations = new Map();
    avis.forEach((item) => {
      item.imputations.forEach((imputation) => {
        const key = imputation.libelle || 'Imputation non libellée';
        imputations.set(key, (imputations.get(key) || 0) + imputation.montant);
      });
    });

    const imputData = [...imputations.entries()]
      .map(([name, montant]) => ({
        name: name.length > 22 ? `${name.slice(0, 22)}…` : name,
        montant,
      }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 6);

    return {
      total,
      taux,
      payes,
      attente,
      retard,
      montantPaye,
      montantAttente,
      montantRetard,
      pieData,
      imputData,
    };
  }, [avis]);

  if (!cdi) return null;

  return (
    <div
      className="ddm-overlay"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div className="ddm-panel animate-slide-from-right">
        <div className="ddm-header">
          <div className="ddm-header-left">
            <Building2 size={20} />
            <div>
              <h2 className="ddm-title">{cdi}</h2>
              <p className="ddm-sub">
                Analyse détaillée
                {' — '}
                {loading ? 'Chargement des soumissions…' : `${avis.length} soumission(s)`}
              </p>
            </div>
          </div>
          <button className="ddm-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && (
          <div className="active-filters-bar" style={{ marginBottom: '1rem', borderColor: 'rgba(220,38,38,0.2)', color: '#DC2626' }}>
            <span className="af-label" style={{ color: '#DC2626' }}>
              <AlertTriangle size={12} /> {error}
            </span>
            <button className="af-reset" onClick={() => setReloadNonce((value) => value + 1)}>
              <RotateCcw size={12} /> Réessayer
            </button>
          </div>
        )}

        <div className="ddm-kpis">
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Montant total soumis</span>
            <span className="ddm-kpi__value" style={{ color: '#059669' }}>{fmt(metrics.total)} FCFA</span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Taux de paiement</span>
            <span className="ddm-kpi__value" style={{ color: metrics.taux >= 80 ? '#059669' : metrics.taux >= 60 ? '#D97706' : '#DC2626' }}>
              {metrics.taux}%
            </span>
          </div>
          <div className="ddm-kpi">
            <span className="ddm-kpi__label">Soumissions</span>
            <span className="ddm-kpi__value">{avis.length}</span>
          </div>
        </div>

        <div className="ddm-status-row">
          {[
            { key: 'Payés', count: metrics.payes.length, amount: metrics.montantPaye, color: STATUS_COLORS.PAID, Icon: CheckCircle },
            { key: 'En attente', count: metrics.attente.length, amount: metrics.montantAttente, color: STATUS_COLORS.PENDING, Icon: Clock },
            { key: 'En retard', count: metrics.retard.length, amount: metrics.montantRetard, color: STATUS_COLORS.OVERDUE, Icon: AlertTriangle },
          ].map(({ key, count, amount, color, Icon }) => (
            <div className="ddm-status-card" key={key} style={{ borderTopColor: color }}>
              <div className="ddm-status-card__icon" style={{ color }}>
                <Icon size={16} />
              </div>
              <div>
                <p className="ddm-status-card__label">{key}</p>
                <p className="ddm-status-card__count" style={{ color }}>{count}</p>
                <p className="ddm-status-card__amount">{fmt(amount)} FCFA</p>
              </div>
            </div>
          ))}
        </div>

        <div className="ddm-charts">
          <div className="ddm-chart-block">
            <h3 className="ddm-section-title">Répartition statuts</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={metrics.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  isAnimationActive
                  animationDuration={1000}
                >
                  {metrics.pieData.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} soumission(s)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {metrics.imputData.length > 0 && (
            <div className="ddm-chart-block">
              <h3 className="ddm-section-title">Répartition par service</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={metrics.imputData} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(value) => [fmtFull(value), 'Montant']} />
                  <Bar
                    dataKey="montant"
                    fill="#059669"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="ddm-avis-section">
          <h3 className="ddm-section-title">Liste des soumissions — {cdi}</h3>
          <div className="ddm-table-wrapper">
            <table className="ddm-table">
              <thead>
                <tr>
                  <th>Code unique</th>
                  <th>Soumetteur</th>
                  <th>Email</th>
                  <th className="text-right">Montant</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="ddm-row">
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                      Chargement des soumissions…
                    </td>
                  </tr>
                ) : error ? (
                  <tr className="ddm-row">
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>
                      <button className="action-btn outline" onClick={() => setReloadNonce((value) => value + 1)}>
                        <RotateCcw size={13} /> Recharger
                      </button>
                    </td>
                  </tr>
                ) : avis.length ? (
                  avis.map((item) => {
                    const Icon = STATUS_ICONS[item.statut] || AlertTriangle;
                    const color = STATUS_COLORS[item.statut] || STATUS_COLORS.OVERDUE;
                    return (
                      <tr key={item.numero} className="ddm-row">
                        <td><code className="ddm-numero">{item.numero}</code></td>
                        <td className="ddm-contribuable">{item.contribuable}</td>
                        <td className="ddm-nui">{item.nui}</td>
                        <td className="text-right ddm-montant">{fmtFull(item.montantTotal)}</td>
                        <td>
                          <span className="ddm-statut" style={{ background: `${color}18`, color }}>
                            <Icon size={10} /> {STATUS_LABELS[item.statut] || item.statut}
                          </span>
                        </td>
                        <td className="ddm-date">{item.dateCreation}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="ddm-row">
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                      Aucune soumission trouvée pour ce ministère sur la période sélectionnée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
