import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import {
  Plus, Trash2, BarChart3, PieChart as PieIcon, TrendingUp, Layers,
  Columns, Grid3x3, LayoutGrid, Settings2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { CHART_TYPES, CHART_LIMITS } from '../../utils/reportTemplates';
import { formatEntier, formatMontant } from '../../utils/format';
import './ChartBuilder.css';

const CHART_ICON_MAP = { BarChart3, PieChart: PieIcon, TrendingUp, Layers, Columns, Grid3x3, LayoutGrid };
const COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

const fmtVal = (v) => {
  if (v == null) return '0';
  if (typeof v === 'number') return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : formatEntier(v);
  return String(v);
};

// ─── Aggregate data for charts ──────────────────────────────
function aggregateForChart(rows, chart, subject) {
  const { xKey, yKey, limit } = chart;
  let data;

  if (yKey === '_count') {
    const map = {};
    for (const r of rows) {
      const k = r[xKey] || 'Autre';
      map[k] = (map[k] || 0) + 1;
    }
    data = Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  } else {
    const yAxisDef = subject?.chartAxes?.y?.find(a => a.id === yKey);
    data = rows.map(r => {
      let val;
      if (yAxisDef?.computed) val = yAxisDef.computed(r);
      else val = Number(r[yKey] || 0);
      return { name: r[xKey] || 'N/A', value: val };
    }).sort((a, b) => b.value - a.value);
  }

  if (limit && limit > 0) data = data.slice(0, limit);
  return data;
}

// ─── KPI Cards Renderer ─────────────────────────────────────
function KpiCardsPreview({ previewData, subject }) {
  const kpis = subject.kpiFields || [];
  if (!kpis.length || !previewData?.length) return <p className="cb-no-data">Pas de KPIs disponibles</p>;

  return (
    <div className="cb-kpi-grid">
      {kpis.map(kpi => {
        const val = kpi.compute(previewData);
        const formatted = kpi.type === 'amount'
          ? formatMontant(val)
          : kpi.type === 'percent' ? val + '%'
          : kpi.type === 'number' ? formatEntier(val)
          : String(val);
        return (
          <div key={kpi.id} className="cb-kpi-card">
            <span className="cb-kpi-label">{kpi.label}</span>
            <span className="cb-kpi-value">{formatted}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Heatmap Renderer ───────────────────────────────────────
function HeatmapPreview({ data }) {
  if (!data.length) return <p className="cb-no-data">Pas assez de données</p>;
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="cb-heatmap-grid">
      {data.slice(0, 20).map((d, i) => {
        const intensity = max > 0 ? d.value / max : 0;
        const bg = `rgba(5, 150, 105, ${0.1 + intensity * 0.85})`;
        return (
          <div key={i} className="cb-heatmap-cell" style={{ background: bg }} title={`${d.name}: ${fmtVal(d.value)}`}>
            <span className="cb-hm-name">{d.name?.slice(0, 14)}</span>
            <span className="cb-hm-val">{fmtVal(d.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart Preview Renderer ─────────────────────────────────
function ChartPreview({ chart, previewData, subject }) {
  const data = useMemo(() => {
    if (!previewData?.length || !chart.xKey || !chart.yKey) return [];
    return aggregateForChart(previewData, chart, subject);
  }, [previewData, chart, subject]);

  if (chart.type === 'kpi_cards') {
    return <KpiCardsPreview previewData={previewData} subject={subject} />;
  }

  if (chart.type === 'heatmap') {
    return <HeatmapPreview data={data} />;
  }

  if (data.length === 0) {
    return <p className="cb-no-data">Sélectionnez les axes pour voir l'aperçu</p>;
  }

  const yDef = subject.chartAxes?.y?.find(a => a.id === chart.yKey);
  const color = yDef?.color || '#059669';

  switch (chart.type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis stroke="var(--chart-axis)" fontSize={10} tickFormatter={fmtVal} />
            <Tooltip formatter={(v) => formatEntier(v)} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    case 'horizontal_bar':
      return (
        <ResponsiveContainer width="100%" height={Math.max(150, data.length * 28)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis type="number" stroke="var(--chart-axis)" fontSize={10} tickFormatter={fmtVal} />
            <YAxis type="category" dataKey="name" stroke="var(--chart-axis)" fontSize={10} width={120} />
            <Tooltip formatter={(v) => formatEntier(v)} />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2} label={({ name, percent }) => `${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatEntier(v)} />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'donut':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={3} label={({ name, percent }) => `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatEntier(v)} />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} />
            <YAxis stroke="var(--chart-axis)" fontSize={10} tickFormatter={fmtVal} />
            <Tooltip formatter={(v) => formatEntier(v)} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'area':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} />
            <YAxis stroke="var(--chart-axis)" fontSize={10} tickFormatter={fmtVal} />
            <Tooltip formatter={(v) => formatEntier(v)} />
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#areaGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      );
    case 'comparison': {
      // Grouped bars: top N split into 2 groups visually
      const half = Math.ceil(data.length / 2);
      const groupA = data.slice(0, half);
      const groupB = data.slice(half);
      const compData = groupA.map((a, i) => ({
        name: a.name?.slice(0, 12),
        'Groupe A': a.value,
        'Groupe B': groupB[i]?.value || 0,
      }));
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={compData} margin={{ left: 0, right: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} interval={0} angle={-20} textAnchor="end" height={45} />
            <YAxis stroke="var(--chart-axis)" fontSize={10} tickFormatter={fmtVal} />
            <Tooltip formatter={(v) => formatEntier(v)} />
            <Legend fontSize={10} />
            <Bar dataKey="Groupe A" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Groupe B" fill="#6366F1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    case 'stackedBar':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis stroke="var(--chart-axis)" fontSize={10} tickFormatter={fmtVal} />
            <Tooltip formatter={(v) => formatEntier(v)} />
            <Bar dataKey="value" fill={color} stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    default:
      return <p className="cb-no-data">Type de graphique non supporté</p>;
  }
}

// ─── Chart Toggle Card (for Step 2 grid) ────────────────────
function ChartToggleCard({ chartType, enabled, onToggle, onConfigure, configured }) {
  const Icon = CHART_ICON_MAP[chartType.icon] || BarChart3;
  return (
    <div className={`cb-toggle-card ${enabled ? 'active' : ''}`}>
      <div className="cb-toggle-header">
        <div className="cb-toggle-icon"><Icon size={20} /></div>
        <div className="cb-toggle-info">
          <strong>{chartType.label}</strong>
          <span>{chartType.description}</span>
        </div>
        <label className="cb-switch" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          <span className="cb-switch-slider" />
        </label>
      </div>
      {enabled && (
        <button className="cb-configure-btn" onClick={onConfigure}>
          <Settings2 size={13} />
          {configured ? 'Modifier la configuration' : 'Configurer les axes'}
        </button>
      )}
    </div>
  );
}

// ─── Chart Config Panel (inline, expands below card) ────────
function ChartConfigPanel({ chart, subject, previewData, onChange, chartIdPrefix, index }) {
  const axes = subject.chartAxes || { x: [], y: [], supportedTypes: [] };
  const update = (key, val) => onChange({ ...chart, [key]: val });

  const needsAxes = !['kpi_cards'].includes(chart.type);

  return (
    <div className="cb-config-panel">
      {needsAxes && (
        <div className="cb-config-axes">
          <div className="cb-config-field">
            <label className="cb-label">Axe X (catégorie)</label>
            <select className="cb-select" value={chart.xKey || ''} onChange={e => update('xKey', e.target.value)}>
              <option value="">— Choisir —</option>
              {axes.x.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div className="cb-config-field">
            <label className="cb-label">Axe Y (valeur)</label>
            <select className="cb-select" value={chart.yKey || ''} onChange={e => update('yKey', e.target.value)}>
              <option value="">— Choisir —</option>
              {axes.y.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div className="cb-config-field cb-config-field-sm">
            <label className="cb-label">Limite</label>
            <select className="cb-select" value={chart.limit ?? 10} onChange={e => update('limit', Number(e.target.value))}>
              {CHART_LIMITS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Live Preview */}
      <div className="cb-preview" id={`${chartIdPrefix || 'chart-preview'}-${index}`}>
        <div className="cb-preview-box">
          <ChartPreview chart={chart} previewData={previewData} subject={subject} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ChartBuilder Component (Step 2 — Visualization) ───
export default function ChartBuilder({ subject, previewData, charts, onChange, chartIdPrefix }) {
  const [expandedType, setExpandedType] = useState(null);

  const axes = subject?.chartAxes || {};
  const availableTypes = CHART_TYPES.filter(t => (axes.supportedTypes || []).includes(t.id));

  // Map chart type ID → chart config (or null if disabled)
  const chartMap = useMemo(() => {
    const map = {};
    charts.forEach(c => { map[c.type] = c; });
    return map;
  }, [charts]);

  const toggleChart = (typeId) => {
    if (chartMap[typeId]) {
      // Remove
      onChange(charts.filter(c => c.type !== typeId));
      if (expandedType === typeId) setExpandedType(null);
    } else {
      // Add with defaults
      const defaultX = axes.x?.[0]?.id || '';
      const defaultY = axes.y?.[0]?.id || '';
      onChange([...charts, { type: typeId, xKey: defaultX, yKey: defaultY, limit: 10 }]);
    }
  };

  const updateChart = (typeId, updated) => {
    onChange(charts.map(c => c.type === typeId ? updated : c));
  };

  const toggleExpand = (typeId) => {
    setExpandedType(prev => prev === typeId ? null : typeId);
  };

  if (!subject?.chartAxes) return null;

  const enabledCount = charts.length;

  return (
    <div className="cb-container">
      <div className="cb-header-row">
        <span className="cb-header-title">Graphiques disponibles</span>
        <span className="cb-header-badge">{enabledCount} sélectionné{enabledCount > 1 ? 's' : ''}</span>
      </div>

      <div className="cb-toggle-grid">
        {availableTypes.map(ct => {
          const enabled = !!chartMap[ct.id];
          const isExpanded = expandedType === ct.id && enabled;
          const chartIdx = charts.findIndex(c => c.type === ct.id);
          return (
            <div key={ct.id} className={`cb-toggle-wrapper ${isExpanded ? 'expanded' : ''}`}>
              <ChartToggleCard
                chartType={ct}
                enabled={enabled}
                onToggle={() => toggleChart(ct.id)}
                onConfigure={() => toggleExpand(ct.id)}
                configured={enabled && chartMap[ct.id]?.xKey && chartMap[ct.id]?.yKey}
              />
              {isExpanded && (
                <ChartConfigPanel
                  chart={chartMap[ct.id]}
                  subject={subject}
                  previewData={previewData}
                  onChange={(updated) => updateChart(ct.id, updated)}
                  chartIdPrefix={chartIdPrefix}
                  index={chartIdx}
                />
              )}
            </div>
          );
        })}
      </div>

      {enabledCount === 0 && (
        <p className="cb-empty-hint">Activez au moins un graphique pour l'inclure dans votre rapport.</p>
      )}

    </div>
  );
}

// Re-export for use in report builder
export { aggregateForChart, ChartPreview };
