import React, { useState, useEffect } from 'react';

/**
 * GaugeChart — SVG circular gauge with animated fill
 * Props:
 *   value     : number (current value)
 *   max       : number (max value, default 100)
 *   label     : string (center bottom label)
 *   color     : string (fill color)
 *   size      : number (SVG size in px, default 180)
 *   thickness : number (stroke width, default 16)
 */
export default function GaugeChart({
  value = 0,
  max = 100,
  label = '',
  color = '#059669',
  size = 180,
  thickness = 16,
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(value), 350);
    return () => clearTimeout(timeout);
  }, [value]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - thickness - 4;
  const circumference = 2 * Math.PI * r;

  // Arc covers 270° (75% of the circle), gap is 90° at the bottom
  const ARC_FRACTION = 0.75;
  const trackLength  = circumference * ARC_FRACTION;
  const fraction     = Math.min(Math.max(animated / max, 0), 1);
  const valueLength  = trackLength * fraction;

  // Rotate so the gap faces downward (135° rotation)
  const ROTATE_DEG = 135;

  // Color thresholds
  let fillColor = color;
  if (fraction < 0.5) fillColor = '#DC2626';
  else if (fraction < 0.75) fillColor = '#D97706';

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: `rotate(${ROTATE_DEG}deg)` }}
      >
        {/* Background track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--gauge-track)"
          strokeWidth={thickness}
          strokeDasharray={`${trackLength} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Colored value arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={fillColor}
          strokeWidth={thickness}
          strokeDasharray={`${valueLength} ${circumference}`}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 1.6s cubic-bezier(0.16,1,0.3,1), stroke 0.4s ease',
            filter: `drop-shadow(0 0 6px ${fillColor}55)`,
          }}
        />
      </svg>

      {/* Center text overlay */}
      <div
        style={{
          position: 'absolute',
          textAlign: 'center',
          pointerEvents: 'none',
          lineHeight: 1.1,
        }}
      >
        <div
          style={{
            fontSize: size * 0.175 + 'px',
            fontWeight: 800,
            color: fillColor,
            letterSpacing: '-0.03em',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {Math.round(animated)}
          <span style={{ fontSize: size * 0.09 + 'px', fontWeight: 600 }}>%</span>
        </div>
        {label && (
          <div
            style={{
              fontSize: size * 0.065 + 'px',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 2,
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
