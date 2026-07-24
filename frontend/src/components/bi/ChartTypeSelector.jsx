import React from 'react';
import {
  BarChart3, LineChart, PieChart, AreaChart,
  Table, Gauge, Map, Hash, TrendingUp, TreePine, Grid3x3,
} from 'lucide-react';

const CHART_TYPES = [
  { value: 'CHART_BAR', label: 'Barres', icon: BarChart3 },
  { value: 'CHART_LINE', label: 'Lignes', icon: LineChart },
  { value: 'CHART_PIE', label: 'Camembert', icon: PieChart },
  { value: 'CHART_AREA', label: 'Aire', icon: AreaChart },
  { value: 'CHART_BAR_STACKED', label: 'Barres empilées', icon: BarChart3 },
  { value: 'CHART_COMBO', label: 'Combiné', icon: TrendingUp },
  { value: 'CHART_TREEMAP', label: 'Treemap', icon: TreePine },
  { value: 'CHART_HEATMAP', label: 'Heatmap', icon: Grid3x3 },
  { value: 'KPI_CARD', label: 'KPI', icon: Hash },
  { value: 'TABLE', label: 'Table', icon: Table },
  { value: 'GAUGE', label: 'Jauge', icon: Gauge },
  { value: 'PIVOT_TABLE', label: 'Tableau croisé', icon: Table },
  { value: 'MAP', label: 'Carte', icon: Map },
];

export default function ChartTypeSelector({ value, onChange }) {
  return (
    <div className="bi-chart-type-grid">
      {CHART_TYPES.map(({ value: type, label, icon: Icon }) => (
        <div
          key={type}
          className={`bi-chart-type-item ${value === type ? 'selected' : ''}`}
          onClick={() => onChange(type)}
        >
          <Icon size={22} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export { CHART_TYPES };
