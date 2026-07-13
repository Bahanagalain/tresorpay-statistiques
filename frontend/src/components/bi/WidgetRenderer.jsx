import React, { useCallback, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import GaugeChart from '../ui/GaugeChart';

const COLORS = ['#2563eb', '#8b5cf6', '#059669', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

const LABELS = {
  ministere: 'Ministère', service: 'Service', domaine: 'Domaine',
  region: 'Région', statut: 'Statut', org_unit: 'Unité org.',
  departement: 'Département', formulaire: 'Formulaire', periode: 'Période',
  nombre: 'Nombre', montant_total: 'Montant total', montant_moyen: 'Montant moyen', ratio: 'Taux (%)',
};

const MESURE_KEYS = new Set(['nombre', 'montant_total', 'montant_moyen', 'ratio']);

function fmtExact(val, type) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (type === 'montant') return n.toLocaleString('fr-FR') + ' FCFA';
  return n.toLocaleString('fr-FR');
}

function fmt(val, type) {
  if (val === null || val === undefined) return '\u2014';
  const n = Number(val);
  if (type === 'montant') {
    if (n >= 1_000_000) {
      const millions = n / 1_000_000;
      const display = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',');
      return display + 'M FCFA';
    }
    return n.toLocaleString('fr-FR') + ' FCFA';
  }
  if (type === 'pourcentage') return n.toFixed(1) + ' %';
  return n.toLocaleString('fr-FR');
}

function colLabel(key) {
  if (LABELS[key]) return LABELS[key];
  if (key.startsWith('champ_')) return key.replace('champ_', 'Champ ').replace(/^\w/, c => c.toUpperCase());
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getDataKey(config) {
  return config?.mesure || 'nombre';
}

function getLabelKey(config) {
  return config?.dimension || 'nom';
}

function EmptyState() {
  return (
    <div className="bi-empty-state">
      <BarChart3 size={32} strokeWidth={1.5} />
      <p>Aucune donnée disponible</p>
      <span>Ajustez les filtres ou la période pour voir des résultats</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bi-custom-tooltip">
      <p className="bi-custom-tooltip-label">{label || payload[0]?.name}</p>
      {payload.map((entry, i) => {
        const key = entry.dataKey || entry.name;
        const type = (key === 'montant_total' || key === 'montant_moyen') ? 'montant' : key === 'ratio' ? 'pourcentage' : null;
        return (
          <div key={i} className="bi-custom-tooltip-row">
            <span style={{ color: entry.color || entry.fill }}>{colLabel(key)}</span>
            <strong>{type ? fmtExact(entry.value, type) || fmt(entry.value, type) : fmt(entry.value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function RenderBarChart({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);

  const handleClick = useCallback((payload) => {
    if (payload && payload.activePayload?.[0] && onChartClick) {
      const item = payload.activePayload[0].payload;
      onChartClick(labelKey, item[labelKey], item[labelKey]);
    }
  }, [onChartClick, labelKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        onClick={handleClick}
        style={{ cursor: onChartClick ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={dataKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RenderLineChart({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);

  const handleClick = useCallback((payload) => {
    if (payload && payload.activePayload?.[0] && onChartClick) {
      const item = payload.activePayload[0].payload;
      onChartClick(labelKey, item[labelKey], item[labelKey]);
    }
  }, [onChartClick, labelKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        onClick={handleClick}
        style={{ cursor: onChartClick ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey={dataKey} stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RenderPieChart({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);

  const handleClick = useCallback((_, index) => {
    if (onChartClick && data[index]) {
      const item = data[index];
      onChartClick(labelKey, item[labelKey], item[labelKey]);
    }
  }, [onChartClick, data, labelKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={labelKey}
          cx="50%"
          cy="50%"
          outerRadius="70%"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={{ strokeWidth: 1 }}
          onClick={handleClick}
          style={{ cursor: onChartClick ? 'pointer' : 'default' }}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RenderAreaChart({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);

  const handleClick = useCallback((payload) => {
    if (payload && payload.activePayload?.[0] && onChartClick) {
      const item = payload.activePayload[0].payload;
      onChartClick(labelKey, item[labelKey], item[labelKey]);
    }
  }, [onChartClick, labelKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        onClick={handleClick}
        style={{ cursor: onChartClick ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey={dataKey} stroke="#8b5cf6" fill="rgba(139, 92, 246, 0.15)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RenderKpiCard({ data, config }) {
  const dataKey = getDataKey(config);
  const row = Array.isArray(data) ? data[0] : data;
  const value = row?.[dataKey] ?? 0;
  const label = config?.label || config?.dimension || dataKey;

  const formatted = typeof value === 'number'
    ? value.toLocaleString('fr-FR')
    : value;

  return (
    <div className="bi-kpi-card">
      <div className="bi-kpi-value">{formatted}</div>
      <div className="bi-kpi-label">{label}</div>
    </div>
  );
}

function RenderTable({ data, config, onChartClick }) {
  if (!data?.length) return <EmptyState />;

  const columns = Object.keys(data[0]);
  const dimCols = columns.filter(c => !MESURE_KEYS.has(c));
  const firstDimCol = dimCols[0] || columns[0];

  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const handleSort = useCallback((col) => {
    setSortConfig(prev => {
      if (prev.key !== col) return { key: col, direction: 'asc' };
      if (prev.direction === 'asc') return { key: col, direction: 'desc' };
      return { key: null, direction: null };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;
    const sorted = [...data].sort((a, b) => {
      const va = a[sortConfig.key];
      const vb = b[sortConfig.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return String(va).localeCompare(String(vb), 'fr');
    });
    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [data, sortConfig]);

  const handleCellClick = useCallback((row, col) => {
    if (onChartClick && col === firstDimCol) {
      onChartClick(col, row[col], row[col]);
    }
  }, [onChartClick, firstDimCol]);

  function formatCell(col, val) {
    const isMontant = col === 'montant_total' || col === 'montant_moyen';
    if (isMontant) {
      const exact = fmtExact(val, 'montant');
      return <span title={exact}>{fmt(val, 'montant')}</span>;
    }
    if (col === 'ratio') return fmt(val, 'pourcentage');
    if (col === 'nombre') return fmt(val);
    return val;
  }

  function sortIndicator(col) {
    if (sortConfig.key !== col) return null;
    return sortConfig.direction === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  return (
    <div style={{ overflow: 'auto', width: '100%', height: '100%' }}>
      <table className="bi-simple-table">
        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'white' }}>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                onClick={() => handleSort(col)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {colLabel(col)}{sortIndicator(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td
                  key={col}
                  onClick={() => handleCellClick(row, col)}
                  style={{
                    cursor: col === firstDimCol && onChartClick ? 'pointer' : 'default',
                    fontWeight: col === firstDimCol && onChartClick ? 500 : undefined,
                    textAlign: MESURE_KEYS.has(col) ? 'right' : 'left',
                  }}
                >
                  {formatCell(col, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RenderGauge({ data, config }) {
  const dataKey = getDataKey(config);
  const row = Array.isArray(data) ? data[0] : data;
  const value = row?.[dataKey] ?? 0;
  const max = config?.max || 100;
  const label = config?.label || dataKey;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <GaugeChart value={value} max={max} label={label} size={140} />
    </div>
  );
}

export default function WidgetRenderer({ type, data, config, onChartClick }) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <EmptyState />;
  }

  switch (type) {
    case 'CHART_BAR':
      return <RenderBarChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_LINE':
      return <RenderLineChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_PIE':
      return <RenderPieChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_AREA':
      return <RenderAreaChart data={data} config={config} onChartClick={onChartClick} />;
    case 'KPI_CARD':
      return <RenderKpiCard data={data} config={config} />;
    case 'TABLE':
      return <RenderTable data={data} config={config} onChartClick={onChartClick} />;
    case 'GAUGE':
      return <RenderGauge data={data} config={config} />;
    default:
      return <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Type inconnu : {type}</p>;
  }
}
