import WeaveSpinner from '../components/ui/WeaveSpinner';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Search, X } from 'lucide-react';
import { fetchContribuables } from '../api/dgiAnalyticsApi';
import { useTranslation } from '../i18n/LanguageProvider';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import VirtualizedTable from '../components/ui/VirtualizedTable';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatMontant } from '../utils/format';
import ExportButtons from '../components/ui/ExportButtons';
import './AnalyseContribuables.css';

const fmtFull = (n) => formatMontant(n);

export default function AnalyseContribuables() {
  const { t } = useTranslation();
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('montantTotal');
  const [sortDir, setSortDir] = useState('desc');
  const [dateRange, setDateRange] = useState(getCurrentPeriodRange);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchContribuables({ ...dateRange, page: 1, limit: 0 });
        if (!cancelled) setAllData(res.data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setAllData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dateRange]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allData
      .filter(c => !q || (c.contribuable || '').toLowerCase().includes(q) || (c.nui || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const va = a[sortBy] ?? 0, vb = b[sortBy] ?? 0;
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc' ? va - vb : vb - va;
      });
  }, [allData, search, sortBy, sortDir]);

  const columns = useMemo(() => [
    { key: 'index', label: '#', width: '56px', render: (_, i) => i + 1 },
    { key: 'contribuable', label: t('taxpayers.headers.taxpayer'), width: '1.6fr', sortable: true,
      render: (c) => <span className="contrib-name">{c.contribuable}</span> },
    { key: 'nui', label: t('taxpayers.headers.nui'), width: '1fr',
      render: (c) => <span className="avis-nui">{c.nui}</span> },
    { key: 'centre', label: t('taxpayers.headers.center'), width: '1.2fr',
      render: (c) => <span className="centre-badge">{c.centre}</span> },
    { key: 'nombreAvis', label: t('taxpayers.headers.nbNotices'), width: '90px', sortable: true, align: 'right',
      render: (c) => <strong>{c.nombreAvis}</strong> },
    { key: 'montantTotal', label: t('taxpayers.headers.totalAmount'), width: '1.2fr', sortable: true, align: 'right',
      render: (c) => <span className="avis-montant">{fmtFull(c.montantTotal)}</span> },
    { key: 'tauxPaiement', label: t('taxpayers.headers.paymentRate'), width: '110px', sortable: true, align: 'right',
      render: (c) => (
        <span className={`taux-badge ${c.tauxPaiement >= 75 ? 'good' : c.tauxPaiement >= 40 ? 'mid' : 'bad'}`}>
          {c.tauxPaiement}%
        </span>
      ) },
    { key: 'statuses', label: t('taxpayers.headers.statuses'), width: '1fr',
      render: (c) => (
        <div className="contrib-statuts">
          {c.avisPayes > 0 && <span className="mini-badge paid">{c.avisPayes} P</span>}
          {c.avisEnAttente > 0 && <span className="mini-badge pending">{c.avisEnAttente} A</span>}
          {c.avisEnRetard > 0 && <span className="mini-badge overdue">{c.avisEnRetard} R</span>}
        </div>
      ) },
  ], [t]);

  const getExportData = useCallback(() => ({
    headers: ['Contribuable', 'NUI', 'Centre CDI', 'Nb Avis', 'Montant Total', 'Montant Payé', 'Taux Paiement'],
    rows: filtered.map(c => [c.contribuable, c.nui, c.centre, c.nombreAvis, fmtFull(c.montantTotal), fmtFull(c.montantPaye), `${c.tauxPaiement}%`]),
    sheetName: 'Contribuables',
    subtitle: `${filtered.length} contribuables`,
  }), [filtered]);

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><Users size={24} /> {t('taxpayers.title')}</h1>
          <p className="page-subtitle">{t('taxpayers.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Analyse Contribuables" filenameBase="Contribuables" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      <div className="registre-controls">
        <div className="search-box">
          <Search size={14} />
          <input className="search-input" placeholder={t('taxpayers.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <span className="cdi-count">{filtered.length} {t('taxpayers.count')}</span>
      </div>

      {loading ? (
        <div className="card"><div className="exec-loading"><WeaveSpinner size={80} message={t('loading')} /></div></div>
      ) : (
        <div className="card cdi-table-card" data-glow="green" style={{ padding: 0 }}>
          <VirtualizedTable
            columns={columns}
            rows={filtered}
            rowHeight={48}
            height={Math.min(filtered.length * 48 + 8, 600)}
            onSort={toggleSort}
            sortCol={sortBy}
            sortDir={sortDir}
            emptyMessage={t('taxpayers.noResult')}
          />
        </div>
      )}
    </div>
  );
}
