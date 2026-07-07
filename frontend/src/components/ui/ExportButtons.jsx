import React, { useState, useCallback } from 'react';
import { FileSpreadsheet, FileDown } from 'lucide-react';
import { exportToExcel, exportGenericPDF } from '../../utils/exportUtils';

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

const BTN_BASE = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem',
  fontWeight: 600, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
  transition: 'all 0.2s',
};

const BTN_EXCEL = {
  ...BTN_BASE,
  background: 'var(--bg-surface, #fff)',
  color: 'var(--text-secondary, #555)',
  border: '1px solid var(--glass-border, #ddd)',
};

const BTN_PDF = {
  ...BTN_BASE,
  background: 'linear-gradient(135deg, #059669, #047857)',
  color: '#fff',
  boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
};

export default function ExportButtons({ getData, title, filenameBase }) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleExcel = useCallback(() => {
    const { headers, rows, sheetName } = getData();
    if (!rows?.length) return;
    exportToExcel(rows, headers, sheetName || title || 'Export', `${filenameBase}_${ts()}.xlsx`);
  }, [getData, title, filenameBase]);

  const handlePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      const { headers, rows, subtitle } = getData();
      if (!rows?.length) return;
      await exportGenericPDF({
        title: `TRESOR ANALYTICS — ${title}`,
        subtitle,
        headers,
        rows,
        filename: `${filenameBase}_${ts()}.pdf`,
      });
    } catch (e) {
      console.error('Export PDF error:', e);
    } finally {
      setPdfLoading(false);
    }
  }, [getData, title, filenameBase]);

  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
      <button onClick={handleExcel} style={BTN_EXCEL}>
        <FileSpreadsheet size={14} /> Excel
      </button>
      <button onClick={handlePDF} disabled={pdfLoading} style={{ ...BTN_PDF, opacity: pdfLoading ? 0.6 : 1 }}>
        <FileDown size={14} /> {pdfLoading ? 'Export…' : 'PDF'}
      </button>
    </div>
  );
}
