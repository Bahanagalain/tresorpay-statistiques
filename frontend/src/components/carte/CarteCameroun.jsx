import React, { useMemo } from 'react';
import { Radio } from 'lucide-react';
import { REGIONS_CAMEROUN } from '../../data/camerounRegions';
import './CarteCameroun.css';

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function formatAmount(value) {
  const n = Number(value) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} Mrd`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} K`;
  return String(n);
}

export default function CarteCameroun({ regionTelemetry = [], selectedRegionId, onSelectRegion }) {
  const displayData = useMemo(() => {
    const telemetryByName = new Map();
    const telemetryByCode = new Map();
    const telemetryById = new Map();

    regionTelemetry.forEach((item) => {
      if (item.nom) telemetryByName.set(normalizeKey(item.nom), item);
      if (item.code) telemetryByCode.set(normalizeKey(item.code), item);
      if (item.orgUnitId) telemetryById.set(item.orgUnitId, item);
    });

    return REGIONS_CAMEROUN.map((region) => {
      const match =
        telemetryByName.get(normalizeKey(region.name)) ||
        telemetryByCode.get(normalizeKey(region.id)) ||
        null;

      if (!match) {
        return { ...region, status: 'neutral', value: '0', target: '0', orgUnitId: null };
      }

      return {
        ...region,
        orgUnitId: match.orgUnitId || match.code || region.id,
        status: match.statut || 'neutral',
        value: formatAmount(match.valeur),
        target: formatAmount(match.objectif),
      };
    });
  }, [regionTelemetry]);

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
        <h2 className="title-glow"><Radio size={18} /> Recettes par Région</h2>
        <p>Supervision en temps réel — {displayData.length} régions · {activeCount} actives</p>
      </div>

      <div className="map-aspect-container">
        <div className="map-nodes-layer">
          {displayData.map((region) => {
            const isSelected = selectedRegionId === (region.orgUnitId || region.id);
            return (
              <div
                key={region.id}
                className={`map-node-wrapper ${isSelected ? 'selected' : ''} ${region.status === 'neutral' ? 'neutral' : ''}`}
                style={{ top: `${region.coords.y}%`, left: `${region.coords.x}%` }}
                onClick={() => onSelectRegion?.(region.orgUnitId || region.id)}
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
