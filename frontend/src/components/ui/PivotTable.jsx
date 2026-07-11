import React from 'react';

function formatVal(value, mesure) {
  if (mesure === 'sum') return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA';
  return value.toLocaleString('fr-FR');
}

function formatPct(val, denom) {
  if (!denom) return '—';
  return ((val / denom) * 100).toFixed(1) + '%';
}

export default function PivotTable({ data, mesure = 'count', dimLigneLabel, dimColonneLabel, displayMode = 'raw' }) {
  if (!data || !data.colonnes?.length || !data.lignes?.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
        Aucune donnée pour cette combinaison de dimensions.
      </div>
    );
  }

  const { colonnes, lignes, totauxColonnes, totalGeneral } = data;
  const isPct = displayMode !== 'raw';

  function renderCell(val, rowTotal, colTotal) {
    if (!val && val !== 0) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
    if (isPct) {
      const denom = displayMode === 'pctRow' ? rowTotal : displayMode === 'pctCol' ? colTotal : totalGeneral;
      return formatPct(val, denom);
    }
    return val > 0 ? formatVal(val, mesure) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
  }

  function renderRowTotal(rowTotal) {
    if (isPct) {
      if (displayMode === 'pctRow') return '100%';
      const denom = displayMode === 'pctCol' ? totalGeneral : totalGeneral;
      return formatPct(rowTotal, denom);
    }
    return formatVal(rowTotal, mesure);
  }

  function renderColTotal(colTotal) {
    if (isPct) {
      if (displayMode === 'pctCol') return '100%';
      const denom = displayMode === 'pctRow' ? totalGeneral : totalGeneral;
      return formatPct(colTotal, denom);
    }
    return formatVal(colTotal, mesure);
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>{dimLigneLabel || 'Ligne'} / {dimColonneLabel || 'Colonne'}</th>
            {colonnes.map((col, i) => (
              <th key={i} style={{ ...thStyle, textAlign: 'right', minWidth: '90px' }}>
                {col || '(vide)'}
              </th>
            ))}
            <th style={{ ...thStyle, textAlign: 'right', background: 'var(--bg-tertiary)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
              <td style={tdLabelStyle}>{ligne.libelle || '(vide)'}</td>
              {ligne.valeurs.map((val, j) => (
                <td key={j} style={tdValueStyle}>
                  {renderCell(val, ligne.total, totauxColonnes[j])}
                </td>
              ))}
              <td style={{ ...tdValueStyle, fontWeight: 600, background: 'var(--bg-tertiary)' }}>
                {renderRowTotal(ligne.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--border-color)' }}>
            <td style={{ ...tdLabelStyle, fontWeight: 700 }}>Total</td>
            {totauxColonnes.map((val, i) => (
              <td key={i} style={{ ...tdValueStyle, fontWeight: 700 }}>
                {renderColTotal(val)}
              </td>
            ))}
            <td style={{ ...tdValueStyle, fontWeight: 700, background: 'var(--bg-tertiary)' }}>
              {isPct ? '100%' : formatVal(totalGeneral, mesure)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const thStyle = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  borderBottom: '2px solid var(--border-color)',
  whiteSpace: 'nowrap',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const tdLabelStyle = {
  padding: '0.5rem 0.75rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  maxWidth: '250px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const tdValueStyle = {
  padding: '0.5rem 0.75rem',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
