import React, { useCallback, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Treemap,
} from 'recharts';
import { BarChart3, TrendingDown, FileQuestion } from 'lucide-react';
import GaugeChart from '../ui/GaugeChart';

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/* Palette professionnelle daltonien-safe — Trésor #1a3a5c en base */
const COLORS = ['#1a3a5c', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4f46e5', '#0d9488', '#b45309'];

const LABELS = {
  ministere: 'Ministère', service: 'Service', domaine: 'Domaine',
  region: 'Région', statut: 'Statut', org_unit: 'Unité org.',
  departement: 'Département', arrondissement: 'Arrondissement', formulaire: 'Formulaire', periode: 'Période',
  nombre: 'Nombre', montant_total: 'Montant total', montant_paye: 'Montant payé',
  montant_moyen: 'Montant moyen', ratio: 'Taux (%)',
  ecart: 'Écart (en souffrance)', taux_completude: 'Taux de complétude (%)',
  delai_moyen: 'Délai moyen (jours)', montant_cumul: 'Cumul montant',
};

const MESURE_KEYS = new Set(['nombre', 'montant_total', 'montant_paye', 'montant_moyen', 'ratio', 'ecart', 'taux_completude', 'delai_moyen', 'montant_cumul']);

function fmtExact(val, type) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (type === 'montant') return n.toLocaleString('fr-FR') + ' FCFA';
  if (type === 'pourcentage') return n.toFixed(1) + ' %';
  if (type === 'decimal') return n.toFixed(1) + ' j';
  return n.toLocaleString('fr-FR');
}

function fmt(val, type) {
  if (val === null || val === undefined) return '\u2014';
  const n = Number(val);
  if (type === 'montant') {
    if (Math.abs(n) >= 1_000_000_000) {
      const g = n / 1_000_000_000;
      return (g % 1 === 0 ? g.toFixed(0) : g.toFixed(1).replace('.', ',')) + 'G FCFA';
    }
    if (Math.abs(n) >= 1_000_000) {
      const m = n / 1_000_000;
      return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace('.', ',')) + 'M FCFA';
    }
    if (Math.abs(n) >= 10_000) {
      const k = n / 1_000;
      return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace('.', ',')) + 'k FCFA';
    }
    return n.toLocaleString('fr-FR') + ' FCFA';
  }
  if (type === 'pourcentage') return n.toFixed(1) + ' %';
  if (type === 'decimal') return n.toFixed(1) + ' j';
  return n.toLocaleString('fr-FR');
}

function fmtAxis(val, type) {
  if (val === null || val === undefined) return '';
  const n = Number(val);
  if (type === 'montant') {
    if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.', ',') + 'G';
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  }
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

function EmptyState({ type }) {
  const messages = {
    CHART_BAR: { icon: <BarChart3 size={36} strokeWidth={1.2} />, msg: 'Aucune donnée pour ce graphique' },
    CHART_LINE: { icon: <TrendingDown size={36} strokeWidth={1.2} />, msg: 'Aucune évolution à afficher' },
    TABLE: { icon: <FileQuestion size={36} strokeWidth={1.2} />, msg: 'Aucune ligne à afficher' },
  };
  const { icon, msg } = messages[type] || { icon: <BarChart3 size={36} strokeWidth={1.2} />, msg: 'Aucune donnée disponible' };
  return (
    <div className="bi-empty-state">
      <div className="bi-empty-state-icon">{icon}</div>
      <p>{msg}</p>
      <span>Ajustez les filtres ou la période pour voir des résultats</span>
    </div>
  );
}

function detectType(key) {
  if (key === 'montant_total' || key === 'montant_moyen' || key === 'montant_paye' || key === 'ecart' || key === 'montant_cumul') return 'montant';
  if (key === 'ratio' || key === 'taux_completude') return 'pourcentage';
  if (key === 'delai_moyen') return 'decimal';
  return null;
}

function CustomTooltip({ active, payload, label, chartData }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bi-custom-tooltip">
      <p className="bi-custom-tooltip-label">{label || payload[0]?.name}</p>
      {payload.map((entry, i) => {
        const key = entry.dataKey || entry.name;
        const type = detectType(key);
        const exactVal = fmtExact(entry.value, type);
        const shortVal = fmt(entry.value, type);
        return (
          <div key={i} className="bi-custom-tooltip-row">
            <span className="bi-custom-tooltip-key" style={{ color: entry.color || entry.fill }}>
              <span className="bi-custom-tooltip-dot" style={{ background: entry.color || entry.fill }} />
              {colLabel(key)}
            </span>
            <strong>{exactVal || shortVal}</strong>
          </div>
        );
      })}
      {chartData && chartData.length > 1 && payload.map((entry, i) => {
        const key = entry.dataKey || entry.name;
        const type = detectType(key);
        const avg = chartData.reduce((s, r) => s + (Number(r[key]) || 0), 0) / chartData.length;
        return (
          <div key={`avg-${i}`} className="bi-custom-tooltip-avg">
            Moy. : {fmtExact(avg, type) || fmt(avg, type)}
          </div>
        );
      })}
    </div>
  );
}

function RenderBarChart({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);
  const yType = detectType(dataKey);

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
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtAxis(v, yType)} />
        <Tooltip content={<CustomTooltip chartData={data} />} />
        <Bar dataKey={dataKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RenderLineChart({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);
  const yType = detectType(dataKey);

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
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtAxis(v, yType)} />
        <Tooltip content={<CustomTooltip chartData={data} />} />
        <Line type="monotone" dataKey={dataKey} stroke={COLORS[1]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, strokeWidth: 2 }} isAnimationActive={!prefersReducedMotion} animationDuration={800} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RenderPieChart({ data, config, onChartClick, donut = false }) {
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
          {...(donut ? { innerRadius: '40%' } : {})}
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={{ strokeWidth: 1 }}
          isAnimationActive={!prefersReducedMotion}
          animationDuration={600}
          onClick={handleClick}
          style={{ cursor: onChartClick ? 'pointer' : 'default' }}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip chartData={data} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RenderAreaChart({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);
  const yType = detectType(dataKey);

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
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtAxis(v, yType)} />
        <Tooltip content={<CustomTooltip chartData={data} />} />
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[4]} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLORS[4]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={COLORS[4]} fill="url(#areaGradient)" strokeWidth={2} isAnimationActive={!prefersReducedMotion} animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RenderStackedBarChart({ data, config, onChartClick }) {
  const labelKey = getLabelKey(config);
  const mesureKeys = data.length > 0 ? Object.keys(data[0]).filter(k => MESURE_KEYS.has(k)) : ['nombre'];
  const yType = mesureKeys[0] ? detectType(mesureKeys[0]) : null;
  const handleClick = useCallback((payload) => {
    if (payload && payload.activePayload?.[0] && onChartClick) {
      const item = payload.activePayload[0].payload;
      onChartClick(labelKey, item[labelKey], item[labelKey]);
    }
  }, [onChartClick, labelKey]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} onClick={handleClick} style={{ cursor: onChartClick ? 'pointer' : 'default' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtAxis(v, yType)} />
        <Tooltip content={<CustomTooltip chartData={data} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {mesureKeys.map((key, idx) => (
          <Bar key={key} dataKey={key} stackId="stack" fill={COLORS[idx % COLORS.length]} name={LABELS[key] || key} radius={idx === mesureKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} isAnimationActive={!prefersReducedMotion} animationDuration={600} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function RenderComboChart({ data, config, onChartClick }) {
  const labelKey = getLabelKey(config);
  const mesureKeys = data.length > 0 ? Object.keys(data[0]).filter(k => MESURE_KEYS.has(k)) : ['nombre'];
  const barKey = mesureKeys[0] || 'nombre';
  const lineKey = mesureKeys.length > 1 ? mesureKeys[1] : null;
  const barType = detectType(barKey);
  const lineType = lineKey ? detectType(lineKey) : null;
  const handleClick = useCallback((payload) => {
    if (payload && payload.activePayload?.[0] && onChartClick) {
      const item = payload.activePayload[0].payload;
      onChartClick(labelKey, item[labelKey], item[labelKey]);
    }
  }, [onChartClick, labelKey]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} onClick={handleClick} style={{ cursor: onChartClick ? 'pointer' : 'default' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => fmtAxis(v, barType)} />
        {lineKey && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => fmtAxis(v, lineType)} />}
        <Tooltip content={<CustomTooltip chartData={data} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey={barKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} name={LABELS[barKey] || barKey} isAnimationActive={!prefersReducedMotion} animationDuration={600} />
        {lineKey && <Line yAxisId="right" type="monotone" dataKey={lineKey} stroke={COLORS[3]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={LABELS[lineKey] || lineKey} isAnimationActive={!prefersReducedMotion} animationDuration={800} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

function KpiProgressBar({ value, objectif }) {
  const pct = objectif > 0 ? Math.min((value / objectif) * 100, 100) : 0;
  const color = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="bi-kpi-progress">
      <div className="bi-kpi-progress-track">
        <div
          className="bi-kpi-progress-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="bi-kpi-progress-label">{pct.toFixed(0)}% de l'objectif</span>
    </div>
  );
}

function RenderKpiCard({ data, config }) {
  const dataKey = getDataKey(config);

  // data = { current, previous, spark } (nouveau format KPI)
  // Fallback : ancien format (tableau ou objet plat)
  const current = data?.current || (Array.isArray(data) ? data[0] : data) || {};
  const previous = data?.previous || {};
  const sparkData = data?.spark || [];

  // Valeur principale
  const value = current[dataKey] ?? 0;
  const prevValue = previous[dataKey] ?? 0;

  // Tendance
  const diff = prevValue > 0 ? ((value - prevValue) / prevValue * 100) : 0;
  const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const trendColor = trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#6b7280';

  // Format
  const isMonetaire = dataKey.includes('montant') || dataKey === 'ecart';
  const type = isMonetaire ? 'montant' : (dataKey === 'ratio' || dataKey === 'taux_completude') ? 'pourcentage' : null;
  const formatted = type ? fmt(value, type) : value.toLocaleString('fr-FR');
  const prevFormatted = type ? fmt(prevValue, type) : prevValue.toLocaleString('fr-FR');
  const exactFormatted = type ? fmtExact(value, type) : null;

  const label = config?.label || LABELS[dataKey] || dataKey;

  // Alerte seuil
  const seuil = config?.seuil;
  const seuilDepasse = seuil != null && (
    (config?.seuilDirection === 'below' && value < seuil) ||
    (config?.seuilDirection !== 'below' && value > seuil)
  );

  // Objectif
  const objectif = config?.objectif;

  return (
    <div className={`bi-kpi-card ${seuilDepasse ? 'bi-kpi-alert' : ''}`} title={exactFormatted || undefined}>
      <div className="bi-kpi-label">{label}</div>
      <div className="bi-kpi-value">{formatted}</div>
      {(prevValue > 0 || diff !== 0) && (
        <div className="bi-kpi-trend" style={{ color: trendColor }}>
          <span className="bi-kpi-trend-arrow">
            {trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2192'}
          </span>
          <span className="bi-kpi-trend-pct">
            {Math.abs(diff).toFixed(1)}%
          </span>
          <span className="bi-kpi-trend-prev">
            vs {prevFormatted}
          </span>
        </div>
      )}
      {objectif != null && objectif > 0 && (
        <KpiProgressBar value={value} objectif={objectif} />
      )}
      {sparkData.length > 0 && (
        <div className="bi-kpi-spark">
          <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={trendColor}
                fill={trendColor}
                fillOpacity={0.1}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={!prefersReducedMotion}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function RenderTable({ data, config, onChartClick }) {
  if (!data?.length) return <EmptyState type="TABLE" />;

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
    const isMontant = col === 'montant_total' || col === 'montant_moyen' || col === 'montant_paye' || col === 'ecart' || col === 'montant_cumul';
    if (isMontant) {
      const exact = fmtExact(val, 'montant');
      return <span title={exact}>{fmt(val, 'montant')}</span>;
    }
    if (col === 'ratio' || col === 'taux_completude') return fmt(val, 'pourcentage');
    if (col === 'delai_moyen') return fmt(val, 'decimal');
    if (col === 'nombre') return fmt(val);
    return val;
  }

  function sortIndicator(col) {
    if (sortConfig.key !== col) return null;
    return sortConfig.direction === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  return (
    <div style={{ overflow: 'auto', width: '100%', height: '100%' }} role="region" aria-label="Tableau de données" tabIndex={0}>
      <table className="bi-simple-table" role="table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                onClick={() => handleSort(col)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col); } }}
                tabIndex={0}
                role="columnheader"
                aria-sort={sortConfig.key === col ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
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

function TreemapContent({ root, depth, x, y, width, height, name, value }) {
  if (depth > 1 || width < 30 || height < 20) return null;
  const idx = root?.children?.findIndex(c => c.name === name) ?? 0;
  const color = COLORS[idx % COLORS.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={3} fill={color} fillOpacity={0.85} stroke="var(--card-bg, #fff)" strokeWidth={2} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + 6} y={y + 16} fontSize={11} fontWeight={600} fill="#fff">{name?.length > Math.floor(width / 7) ? name.slice(0, Math.floor(width / 7)) + '…' : name}</text>
          <text x={x + 6} y={y + 30} fontSize={10} fill="rgba(255,255,255,0.75)">{fmt(value, 'montant')}</text>
        </>
      )}
    </g>
  );
}

function RenderTreemap({ data, config, onChartClick }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);
  const treemapData = data.map(d => ({ name: d[labelKey] || '?', size: Number(d[dataKey]) || 0 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={treemapData}
        dataKey="size"
        nameKey="name"
        content={<TreemapContent />}
        isAnimationActive={!prefersReducedMotion}
        animationDuration={600}
      >
        <Tooltip content={({ payload }) => {
          if (!payload?.length) return null;
          const d = payload[0]?.payload;
          const type = detectType(dataKey);
          return (
            <div className="bi-custom-tooltip">
              <p className="bi-custom-tooltip-label">{d?.name}</p>
              <div className="bi-custom-tooltip-row"><span>{colLabel(dataKey)}</span><strong>{fmtExact(d?.size, type) || fmt(d?.size, type)}</strong></div>
            </div>
          );
        }} />
      </Treemap>
    </ResponsiveContainer>
  );
}

function RenderPivotTable({ data, config }) {
  if (!data?.length) return <EmptyState type="TABLE" />;

  const dataKey = getDataKey(config);
  const columns = Object.keys(data[0]);
  const dimCols = columns.filter(c => !MESURE_KEYS.has(c));
  const mesureCols = columns.filter(c => MESURE_KEYS.has(c));
  const type = detectType(dataKey);

  // Sous-totaux par première dimension
  const totals = {};
  let grandTotal = 0;
  data.forEach(row => {
    for (const col of mesureCols) {
      const v = Number(row[col]) || 0;
      grandTotal += v;
      const groupKey = dimCols[0] ? row[dimCols[0]] : 'Total';
      if (!totals[groupKey]) totals[groupKey] = {};
      totals[groupKey][col] = (totals[groupKey][col] || 0) + v;
    }
  });

  return (
    <div style={{ overflow: 'auto', width: '100%', height: '100%' }}>
      <table className="bi-simple-table bi-pivot-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{colLabel(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col} style={{ textAlign: MESURE_KEYS.has(col) ? 'right' : 'left' }}>
                  {MESURE_KEYS.has(col) ? (
                    <span title={fmtExact(row[col], type)}>{fmt(row[col], detectType(col))}</span>
                  ) : row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bi-pivot-total-row">
            <td style={{ fontWeight: 700 }}>Total</td>
            {columns.slice(1).map(col => (
              <td key={col} style={{ textAlign: MESURE_KEYS.has(col) ? 'right' : 'left', fontWeight: 700 }}>
                {MESURE_KEYS.has(col) ? fmt(data.reduce((s, r) => s + (Number(r[col]) || 0), 0), detectType(col)) : ''}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RenderHeatmap({ data, config }) {
  const dataKey = getDataKey(config);
  const labelKey = getLabelKey(config);
  const values = data.map(d => Number(d[dataKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const type = detectType(dataKey);

  return (
    <div className="bi-heatmap-grid">
      {data.map((d, i) => {
        const val = Number(d[dataKey]) || 0;
        const intensity = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0;
        const bg = `rgba(26, 58, 92, ${0.1 + intensity * 0.8})`;
        const textColor = intensity > 0.5 ? '#fff' : 'var(--text-primary, #1f2937)';
        return (
          <div key={i} className="bi-heatmap-cell" style={{ background: bg, color: textColor }} title={`${d[labelKey]}: ${fmtExact(val, type)}`}>
            <span className="bi-heatmap-label">{d[labelKey]}</span>
            <span className="bi-heatmap-value">{fmt(val, type)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function WidgetRenderer({ type, data, config, onChartClick }) {
  // KPI_CARD reçoit un objet { current, previous, spark }, pas un tableau
  if (type === 'KPI_CARD') {
    if (!data || (!data.current && !Array.isArray(data) && typeof data !== 'object')) {
      return <EmptyState type={type} />;
    }
    return <RenderKpiCard data={data} config={config} />;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <EmptyState type={type} />;
  }

  switch (type) {
    case 'CHART_BAR':
      return <RenderBarChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_LINE':
      return <RenderLineChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_PIE':
      return <RenderPieChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_DONUT':
      return <RenderPieChart data={data} config={config} onChartClick={onChartClick} donut />;
    case 'CHART_AREA':
      return <RenderAreaChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_BAR_STACKED':
      return <RenderStackedBarChart data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_COMBO':
      return <RenderComboChart data={data} config={config} onChartClick={onChartClick} />;
    case 'TABLE':
      return <RenderTable data={data} config={config} onChartClick={onChartClick} />;
    case 'GAUGE':
      return <RenderGauge data={data} config={config} />;
    case 'CHART_TREEMAP':
      return <RenderTreemap data={data} config={config} onChartClick={onChartClick} />;
    case 'CHART_HEATMAP':
      return <RenderHeatmap data={data} config={config} />;
    case 'PIVOT_TABLE':
      return <RenderPivotTable data={data} config={config} />;
    default:
      return <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Type inconnu : {type}</p>;
  }
}
