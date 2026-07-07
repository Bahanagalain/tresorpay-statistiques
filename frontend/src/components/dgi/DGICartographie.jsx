import React, { useMemo } from 'react';
import { Radio } from 'lucide-react';
import { REGIONS_DATA } from '../../data/dgiMapData';
import { mergeRegionTelemetry } from '../../utils/dgiAnalytics';
import './DGICartographie.css';

export default function DGICartographie({ regionTelemetry = [], selectedRegionId, onSelectRegion }) {
  const displayData = useMemo(
    () => mergeRegionTelemetry(REGIONS_DATA, regionTelemetry),
    [regionTelemetry],
  );

  const activeCount = useMemo(
    () => displayData.filter(r => r.status !== 'neutral').length,
    [displayData],
  );

  return (
    <div className="carto-map-fullwidth">
      <div className="carto-grid-bg">
        <div className="radar-sweep"></div>
      </div>

      <div className="map-title-overlay">
        <h2 className="title-glow"><Radio size={18} /> Flux par Région Fiscale</h2>
        <p>Supervision en temps réel — {displayData.length} régions fiscales · {activeCount} actives</p>
      </div>

      <div className="map-aspect-container">
        <div className="map-nodes-layer">
          {displayData.map((region) => {
            const isSelected = selectedRegionId === region.id;
            return (
              <div
                key={region.id}
                className={`map-node-wrapper ${isSelected ? 'selected' : ''} ${region.status === 'neutral' ? 'neutral' : ''}`}
                style={{ top: `${region.coords.y}%`, left: `${region.coords.x}%` }}
                onClick={() => onSelectRegion?.(region.id)}
              >
                <div className={`map-node-pulse ${region.status}`}></div>
                <div className={`map-node-core ${region.status}`}></div>
                <div className="map-node-label">
                  <span className="node-name">{region.name}</span>
                  <span className={`node-val ${region.status}`}>{region.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
