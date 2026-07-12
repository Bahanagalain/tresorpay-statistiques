import React, { useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import GaugeChart from '../ui/GaugeChart';

const COLORS = ['#2563eb', '#8b5cf6', '#059669', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

function getDataKey(config) {
  return config?.mesure || 'nombre';
}

function getLabelKey(config) {
  return config?.dimension || 'nom';
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
        <Tooltip />
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
        <Tooltip />
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
        <Tooltip />
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
        <Tooltip />
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
  if (!data?.length) return <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Aucune donnée</p>;
  const columns = Object.keys(data[0]);
  const dimensionCol = config?.dimension || columns[0];

  const handleCellClick = useCallback((row, col) => {
    if (onChartClick && col === dimensionCol) {
      onChartClick(col, row[col], row[col]);
    }
  }, [onChartClick, dimensionCol]);

  return (
    <div style={{ overflow: 'auto', width: '100%', height: '100%' }}>
      <table className="bi-simple-table">
        <thead>
          <tr>
            {columns.map(col => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td
                  key={col}
                  onClick={() => handleCellClick(row, col)}
                  style={{
                    cursor: col === dimensionCol && onChartClick ? 'pointer' : 'default',
                    fontWeight: col === dimensionCol && onChartClick ? 500 : undefined,
                  }}
                >
                  {typeof row[col] === 'number' ? row[col].toLocaleString('fr-FR') : row[col]}
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
    return <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Aucune donnée</p>;
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
