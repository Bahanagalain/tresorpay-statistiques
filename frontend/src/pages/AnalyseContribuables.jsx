import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, X, FileText, CheckCircle, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, Eye, XCircle, Filter,
  ArrowUp, ArrowDown, ArrowLeft,
} from 'lucide-react';
import WeaveSpinner from '../components/ui/WeaveSpinner';
import DatePresetFilter from '../components/ui/DatePresetFilter';
import ExportButtons from '../components/ui/ExportButtons';
import CountUp from '../components/ui/CountUp';
import { fetchSoumissions, fetchSoumissionDetail } from '../api/analyticsApi';
import { getCurrentPeriodRange } from '../hooks/usePeriodFilter';
import { formatEntier, formatMontant } from '../utils/format';
import './AnalyseContribuables.css';

// ─── Status config ────────────────────────────────────────────
const STATUT_CONFIG = {
  PAID:    { label: 'Payé',       color: '#059669', bg: 'rgba(5,150,105,0.1)',  icon: CheckCircle },
  PENDING: { label: 'En attente', color: '#D97706', bg: 'rgba(217,119,6,0.1)', icon: Clock },
  PARTIAL: { label: 'Partiel',    color: '#2563EB', bg: 'rgba(37,99,235,0.1)', icon: CheckCircle },
  FAILED:  { label: 'Échoué',     color: '#DC2626', bg: 'rgba(220,38,38,0.1)', icon: XCircle },
};

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PAID', label: 'Payé' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'PARTIAL', label: 'Partiel' },
  { value: 'FAILED', label: 'Échoué' },
];

const LIMIT_OPTIONS = [20, 50, 100];

const COLUMNS = [
  { key: 'uniqueCode',     label: 'Code unique',   sortable: true },
  { key: 'soumetteurNom',  label: 'Soumetteur',    sortable: true },
  { key: 'service',        label: 'Service / Ministère', sortable: true },
  { key: 'montant',        label: 'Montant',       sortable: true, align: 'right' },
  { key: 'montantPaye',    label: 'Montant payé',  sortable: true, align: 'right' },
  { key: 'statutPaiement', label: 'Statut',        sortable: true },
  { key: 'dateSoumission', label: 'Date',          sortable: true },
];

// ─── Helpers ──────────────────────────────────────────────────
function safeString(val) {
  if (val == null) return '';
  if (typeof val === 'object') return val.nomFr || val.nom || val.name || '';
  return String(val);
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
}

// ─── Status Badge ─────────────────────────────────────────────
function StatutBadge({ statut }) {
  const cfg = STATUT_CONFIG[statut] || { label: statut || '—', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', icon: AlertTriangle };
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.6rem', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

// ─── Sort Header ──────────────────────────────────────────────
function SortHeader({ column, sortBy, sortDir, onSort }) {
  const active = sortBy === column.key;
  return (
    <th
      onClick={column.sortable ? () => onSort(column.key) : undefined}
      style={{
        padding: '0.65rem 0.75rem',
        fontSize: '0.72rem',
        fontWeight: 700,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: column.sortable ? 'pointer' : 'default',
        userSelect: 'none',
        textAlign: column.align || 'left',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--glass-border)',
        background: 'transparent',
        transition: 'color 0.15s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        {column.label}
        {column.sortable && active && (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        )}
      </span>
    </th>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────
function DetailPanel({ detail, loading, onClose }) {
  if (!detail && !loading) return null;

  return (
    <div className="card" style={{
      padding: '1.5rem', marginBottom: '1rem',
      borderLeft: '3px solid #2563EB',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          onClick={onClose}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.35rem 0.7rem', borderRadius: '8px',
            fontSize: '0.78rem', fontWeight: 600,
            background: 'var(--bg-surface)', color: 'var(--text-secondary)',
            border: '1px solid var(--glass-border)', cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> Retour à la liste
        </button>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Détail de soumission</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <WeaveSpinner size={50} message="Chargement du détail..." />
        </div>
      ) : detail ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
          {/* Identité */}
          <div>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Identification
            </h4>
            <DetailRow label="Code unique" value={safeString(detail.uniqueCode)} mono />
            <DetailRow label="Nom" value={safeString(detail.soumetteurNom)} />
            <DetailRow label="Email" value={safeString(detail.soumetteurEmail)} />
            <DetailRow label="Téléphone" value={safeString(detail.soumetteurTelephone)} />
          </div>
          {/* Service */}
          <div>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Service
            </h4>
            <DetailRow label="Service" value={safeString(detail.service)} />
            <DetailRow label="Ministère" value={safeString(detail.ministere)} />
            <DetailRow label="Domaine" value={safeString(detail.domaine)} />
            <DetailRow label="Formulaire" value={safeString(detail.formulaireNom)} />
            <DetailRow label="Unité org." value={safeString(detail.orgUnit)} />
          </div>
          {/* Paiement */}
          <div>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Paiement
            </h4>
            <DetailRow label="Montant" value={formatMontant(detail.montant)} highlight />
            <DetailRow label="Montant payé" value={formatMontant(detail.montantPaye)} highlight />
            <DetailRow label="Statut" value={<StatutBadge statut={detail.statutPaiement} />} />
            <DetailRow label="Date soumission" value={formatDate(detail.dateSoumission)} />
            <DetailRow label="Date paiement" value={formatDate(detail.datePaiement)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value, mono, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--glass-border)' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{
        fontSize: '0.78rem',
        color: highlight ? '#059669' : 'var(--text-primary)',
        fontWeight: highlight ? 700 : mono ? 600 : 400,
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────
export default function AnalyseContribuables() {
  // Read initial search from URL params (e.g. ?search=ABC123)
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  // Filters & pagination state
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [statut, setStatut] = useState('');
  const [dateRange, setDateRange] = useState(getCurrentPeriodRange);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState('dateSoumission');
  const [sortDir, setSortDir] = useState('desc');

  // Data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Detail state
  const [selectedCode, setSelectedCode] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Clear URL search param after consuming it (keep URL clean)
  useEffect(() => {
    if (initialSearch) {
      searchParams.delete('search');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statut, dateRange]);

  // Fetch list
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await fetchSoumissions({
          search: debouncedSearch || undefined,
          statut: statut || undefined,
          startDate: dateRange?.startDate,
          endDate: dateRange?.endDate,
          page,
          limit,
        }, controller.signal);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          console.error('fetchSoumissions error:', e);
          if (!cancelled) setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [debouncedSearch, statut, dateRange, page, limit]);

  // Fetch detail
  useEffect(() => {
    if (!selectedCode) { setDetail(null); return; }
    let cancelled = false;
    const controller = new AbortController();
    setDetailLoading(true);

    (async () => {
      try {
        const res = await fetchSoumissionDetail(selectedCode, controller.signal);
        if (!cancelled) setDetail(res);
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          console.error('fetchSoumissionDetail error:', e);
          if (!cancelled) setDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [selectedCode]);

  // Sort handler
  const handleSort = useCallback((key) => {
    setSortBy(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  // Client-side sort (backend may not support sorting)
  const sortedDonnees = useMemo(() => {
    const items = data?.donnees || [];
    if (!sortBy) return items;
    return [...items].sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data?.donnees, sortBy, sortDir]);

  // Pagination info
  const pagination = data?.pagination || { page: 1, limite: 20, total: 0, totalPages: 0 };
  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limite + 1;
  const rangeEnd = Math.min(pagination.page * pagination.limite, pagination.total);

  // Active filter count
  const activeFilterCount = [
    debouncedSearch ? 1 : 0,
    statut ? 1 : 0,
    (dateRange?.startDate || dateRange?.endDate) ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setStatut('');
    setPage(1);
  }, []);

  // Export data
  const getExportData = useCallback(() => ({
    headers: ['Code unique', 'Soumetteur', 'Email', 'Téléphone', 'Service', 'Ministère', 'Montant', 'Montant payé', 'Statut', 'Date'],
    rows: (data?.donnees || []).map(s => [
      s.uniqueCode || '',
      s.soumetteurNom || '',
      s.soumetteurEmail || '',
      s.soumetteurTelephone || '',
      safeString(s.service),
      safeString(s.ministere),
      formatMontant(s.montant),
      formatMontant(s.montantPaye),
      STATUT_CONFIG[s.statutPaiement]?.label || s.statutPaiement || '',
      formatDate(s.dateSoumission),
    ]),
    sheetName: 'Soumissions',
    subtitle: `${formatEntier(pagination.total)} soumissions`,
  }), [data?.donnees, pagination.total]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title"><FileText size={24} /> Registre des Soumissions</h1>
          <p className="page-subtitle">Recherche et suivi des soumissions de paiement — codes uniques, statuts, montants</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportButtons getData={getExportData} title="Registre des Soumissions" filenameBase="Soumissions" />
          <DatePresetFilter onChange={setDateRange} />
        </div>
      </div>

      {/* Compact KPI strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem', marginBottom: '1rem',
      }}>
        <div className="card" style={{
          padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
          borderLeft: '3px solid #2563EB',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '8px',
            background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={15} style={{ color: '#2563EB' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total soumissions</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              <CountUp end={pagination.total} duration={0.8} separator=" " />
            </div>
          </div>
        </div>

        <div className="card" style={{
          padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
          borderLeft: '3px solid #8B5CF6',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '8px',
            background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Filter size={15} style={{ color: '#8B5CF6' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Filtres actifs</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {activeFilterCount > 0 ? `${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''}` : 'Aucun'}
            </div>
          </div>
        </div>

        <div className="card" style={{
          padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
          borderLeft: '3px solid #059669',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '8px',
            background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Eye size={15} style={{ color: '#059669' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Affichés</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {pagination.total > 0 ? `${rangeStart}–${rangeEnd}` : '0'}
            </div>
          </div>
        </div>

        <div className="card" style={{
          padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
          borderLeft: '3px solid #D97706',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '8px',
            background: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={15} style={{ color: '#D97706' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Pages</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {pagination.totalPages > 0 ? `${pagination.page} / ${pagination.totalPages}` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="card" style={{
        padding: '0.8rem 1rem', marginBottom: '1rem',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem',
      }}>
        {/* Search */}
        <div style={{
          flex: '1 1 300px', display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px',
          padding: '0.4rem 0.7rem',
        }}>
          <Search size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par code unique, nom, email, téléphone..."
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: '0.82rem', color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
            >
              <X size={14} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          )}
        </div>

        {/* Statut filter */}
        <select
          value={statut}
          onChange={e => setStatut(e.target.value)}
          style={{
            padding: '0.45rem 0.7rem', borderRadius: '8px',
            fontSize: '0.82rem', fontWeight: 600,
            border: '1px solid var(--glass-border)', background: 'var(--bg-surface)',
            color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          {STATUT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Active filters badge + clear */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.35rem 0.7rem', borderRadius: '999px',
              fontSize: '0.72rem', fontWeight: 700,
              background: 'rgba(37,99,235,0.1)', color: '#2563EB',
              border: 'none', cursor: 'pointer',
            }}
          >
            <X size={12} />
            {activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Detail panel (shown when a row is clicked) */}
      {selectedCode && (
        <DetailPanel
          detail={detail}
          loading={detailLoading}
          onClose={() => { setSelectedCode(null); setDetail(null); }}
        />
      )}

      {/* Main table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <WeaveSpinner size={70} message="Chargement des soumissions..." />
          </div>
        ) : !data || sortedDonnees.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '4rem 2rem', gap: '0.8rem', textAlign: 'center',
          }}>
            <FileText size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
            <h3 style={{ color: 'var(--text-secondary)', fontWeight: 700, margin: 0, fontSize: '1rem' }}>
              Aucune soumission trouvée
            </h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', margin: 0 }}>
              {debouncedSearch || statut
                ? 'Essayez de modifier vos critères de recherche ou filtres.'
                : 'Aucune soumission pour la période sélectionnée.'}
            </p>
            {(debouncedSearch || statut) && (
              <button
                onClick={clearAllFilters}
                style={{
                  marginTop: '0.5rem', padding: '0.45rem 1rem', borderRadius: '8px',
                  fontSize: '0.82rem', fontWeight: 600,
                  background: '#2563EB', color: '#fff',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Effacer les filtres
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <SortHeader
                        key={col.key}
                        column={col}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    ))}
                    <th style={{
                      padding: '0.65rem 0.75rem', fontSize: '0.72rem', fontWeight: 700,
                      color: 'var(--text-secondary)', textTransform: 'uppercase',
                      letterSpacing: '0.04em', borderBottom: '1px solid var(--glass-border)',
                      width: 40,
                    }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedDonnees.map((s, idx) => {
                    const isSelected = selectedCode === s.uniqueCode;
                    const serviceStr = safeString(s.service);
                    const ministereStr = safeString(s.ministere);
                    return (
                      <tr
                        key={s.id || s.uniqueCode || idx}
                        onClick={() => setSelectedCode(isSelected ? null : s.uniqueCode)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(37,99,235,0.06)' : idx % 2 === 1 ? 'var(--bg-secondary, rgba(0,0,0,0.01))' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(37,99,235,0.04)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 1 ? 'var(--bg-secondary, rgba(0,0,0,0.01))' : 'transparent'; }}
                      >
                        {/* Code unique */}
                        <td style={{
                          padding: '0.6rem 0.75rem', fontSize: '0.8rem',
                          fontFamily: 'monospace', fontWeight: 600, color: '#2563EB',
                          borderBottom: '1px solid var(--glass-border)',
                          whiteSpace: 'nowrap',
                        }}>
                          {s.uniqueCode || '—'}
                        </td>

                        {/* Soumetteur (nom + email) */}
                        <td style={{
                          padding: '0.6rem 0.75rem',
                          borderBottom: '1px solid var(--glass-border)',
                          maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3 }}>
                            {s.soumetteurNom || '—'}
                          </div>
                          {s.soumetteurEmail && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', lineHeight: 1.3, marginTop: '1px' }}>
                              {s.soumetteurEmail}
                            </div>
                          )}
                        </td>

                        {/* Service / Ministère */}
                        <td style={{
                          padding: '0.6rem 0.75rem',
                          borderBottom: '1px solid var(--glass-border)',
                          maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {serviceStr || '—'}
                          </div>
                          {ministereStr && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', lineHeight: 1.3, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ministereStr}
                            </div>
                          )}
                        </td>

                        {/* Montant */}
                        <td style={{
                          padding: '0.6rem 0.75rem', fontSize: '0.8rem',
                          fontWeight: 700, color: 'var(--text-primary)',
                          borderBottom: '1px solid var(--glass-border)',
                          textAlign: 'right', whiteSpace: 'nowrap',
                        }}>
                          {formatMontant(s.montant)}
                        </td>

                        {/* Montant payé */}
                        <td style={{
                          padding: '0.6rem 0.75rem', fontSize: '0.8rem',
                          fontWeight: 700,
                          color: s.montantPaye > 0 ? '#059669' : 'var(--text-tertiary)',
                          borderBottom: '1px solid var(--glass-border)',
                          textAlign: 'right', whiteSpace: 'nowrap',
                        }}>
                          {formatMontant(s.montantPaye)}
                        </td>

                        {/* Statut */}
                        <td style={{
                          padding: '0.6rem 0.75rem',
                          borderBottom: '1px solid var(--glass-border)',
                        }}>
                          <StatutBadge statut={s.statutPaiement} />
                        </td>

                        {/* Date soumission */}
                        <td style={{
                          padding: '0.6rem 0.75rem', fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          borderBottom: '1px solid var(--glass-border)',
                          whiteSpace: 'nowrap',
                        }}>
                          {formatDate(s.dateSoumission)}
                        </td>

                        {/* Action eye */}
                        <td style={{
                          padding: '0.6rem 0.75rem',
                          borderBottom: '1px solid var(--glass-border)',
                          textAlign: 'center',
                        }}>
                          <Eye size={14} style={{ color: isSelected ? '#2563EB' : 'var(--text-tertiary)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.7rem 1rem', borderTop: '1px solid var(--glass-border)',
              flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {pagination.total > 0
                  ? `${formatEntier(rangeStart)} à ${formatEntier(rangeEnd)} sur ${formatEntier(pagination.total)} résultats`
                  : 'Aucun résultat'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Limit selector */}
                <select
                  value={limit}
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  style={{
                    padding: '0.3rem 0.5rem', borderRadius: '6px',
                    fontSize: '0.78rem', fontWeight: 600,
                    border: '1px solid var(--glass-border)', background: 'var(--bg-surface)',
                    color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  {LIMIT_OPTIONS.map(l => (
                    <option key={l} value={l}>{l} / page</option>
                  ))}
                </select>

                {/* Page info */}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0 0.3rem' }}>
                  Page {pagination.page} / {pagination.totalPages || 1}
                </span>

                {/* Previous */}
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: '8px',
                    border: '1px solid var(--glass-border)', background: 'var(--bg-surface)',
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: pagination.page <= 1 ? 0.4 : 1,
                    color: 'var(--text-primary)',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Next */}
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: '8px',
                    border: '1px solid var(--glass-border)', background: 'var(--bg-surface)',
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    opacity: pagination.page >= pagination.totalPages ? 0.4 : 1,
                    color: 'var(--text-primary)',
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
