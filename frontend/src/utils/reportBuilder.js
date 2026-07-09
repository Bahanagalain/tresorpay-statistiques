import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import tresorPayLogo from '../assets/logo-tresorpay.png';
import logoCameroun from '/images/logo-cameroun.png';
import {
  fetchKpi, fetchEvolution, fetchRepartitionMinisteres, fetchRepartitionServices,
  fetchRepartitionDomaines, fetchTelemetrieRegions, fetchSoumissions,
  fetchCitoyens,
} from '../api/analyticsApi';

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const fmtAmount = (n) => {
  const num = Math.round(n ?? 0);
  const str = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return str + ' FCFA';
};

// ─── Institutional Header — Cameroon / TresorPay ─────────────────
function drawHeader(pdf, w, logoImg, coatImg) {
  // Top green bar
  pdf.setFillColor(5, 100, 70);
  pdf.rect(0, 0, w, 3, 'F');

  const topY = 10;
  const cx = w / 2; // center X
  const leftX = cx - 55; // text closer to logo
  const rightX = cx + 55;

  // Center: Coat of arms of Cameroon (no background, just the image)
  if (coatImg) pdf.addImage(coatImg, 'PNG', cx - 10, topY - 4, 20, 20);

  // Left: Republic of Cameroon (French) — centered text alignment
  pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 30, 45);
  pdf.text('REPUBLIQUE DU CAMEROUN', leftX, topY, { align: 'center' });
  pdf.setFontSize(7); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(80, 80, 80);
  pdf.text('Paix — Travail — Patrie', leftX, topY + 4, { align: 'center' });
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(50, 50, 50);
  pdf.text('MINISTERE DES FINANCES', leftX, topY + 9, { align: 'center' });
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(70, 70, 70);
  pdf.text('TresorPay', leftX, topY + 13, { align: 'center' });

  // Right: Republic of Cameroon (English) — centered text alignment
  pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 30, 45);
  pdf.text('REPUBLIC OF CAMEROON', rightX, topY, { align: 'center' });
  pdf.setFontSize(7); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(80, 80, 80);
  pdf.text('Peace — Work — Fatherland', rightX, topY + 4, { align: 'center' });
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(50, 50, 50);
  pdf.text('MINISTRY OF FINANCE', rightX, topY + 9, { align: 'center' });
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(70, 70, 70);
  pdf.text('TresorPay', rightX, topY + 13, { align: 'center' });

  // Separator line
  pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.3);
  pdf.line(15, topY + 18, w - 15, topY + 18);

  // Watermark: TresorPay logo (semi-transparent, center of page)
  if (logoImg) {
    try {
      const gs = pdf.GState ? pdf.GState({ opacity: 0.04 }) : null;
      if (gs) pdf.setGState(gs);
      pdf.addImage(logoImg, 'PNG', cx - 35, 130, 70, 28);
      if (gs) pdf.setGState(pdf.GState({ opacity: 1 }));
    } catch {}
  }

  return topY + 24;
}


// ─── Fetch data by subject ──────────────────────────────────
export async function fetchSubjectData(subjectId, config) {
  const range = { startDate: config.startDate, endDate: config.endDate };
  switch (subjectId) {
    case 'ministeres': return fetchRepartitionMinisteres(range);
    case 'regions': return fetchTelemetrieRegions(range);
    case 'services': return fetchRepartitionServices(range);
    case 'domaines': return fetchRepartitionDomaines(range);
    case 'citoyens': {
      let all = [], page = 1, hasMore = true;
      while (hasMore) {
        const res = await fetchCitoyens({ ...range, page, limit: 200 });
        all.push(...res.data);
        hasMore = page < res.meta.totalPages;
        page++;
      }
      return all;
    }
    case 'soumissions': {
      let all = [], page = 1, hasMore = true;
      while (hasMore) {
        const res = await fetchSoumissions({ ...range, page, limit: 200, statut: config.statutFilter && config.statutFilter !== 'TOUS' ? config.statutFilter : undefined });
        all.push(...res.data);
        hasMore = page < res.meta.totalPages;
        page++;
      }
      return all;
    }
    default: return [];
  }
}

// ─── Resolve row value ──────────────────────────────────────
function getVal(row, col, idx) {
  if (col.id === 'index') return idx + 1;
  if (col.computed) return col.computed(row);
  return row[col.id];
}

function fmtVal(val, type) {
  if (val == null) return '—';
  if (type === 'amount') return fmtAmount(val);
  if (type === 'percent') return val + '%';
  if (type === 'number') return Number(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return String(val);
}

// ─── Excel Generation (multi-sheet) ─────────────────────────
function generateExcel(rows, columns, subject, config) {
  const wb = XLSX.utils.book_new();
  const sheets = config.excelSheets || { raw: true };

  // Sheet 1: Données brutes
  if (sheets.raw !== false) {
    const header = columns.map(c => c.label);
    const data = [header, ...rows.map((row, i) => columns.map(col => {
      const val = getVal(row, col, i);
      if (col.type === 'amount' && typeof val === 'number') return val;
      return val;
    }))];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Format amount columns with FCFA suffix
    columns.forEach((col, ci) => {
      if (col.type === 'amount') {
        for (let ri = 1; ri <= rows.length; ri++) {
          const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
          if (cell) cell.z = '#,##0 "FCFA"';
        }
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Données brutes');
  }

  // Sheet 2: Récapitulatif (KPIs)
  if (sheets.recap) {
    const kpiFields = subject.kpiFields || [];
    if (kpiFields.length > 0) {
      const recapData = [
        ['Indicateur', 'Valeur'],
        ...kpiFields.map(kpi => {
          const val = kpi.compute(rows);
          return [kpi.label, kpi.type === 'amount' ? fmtAmount(val) : kpi.type === 'percent' ? val + '%' : val];
        }),
        [],
        ['Nombre total d\'éléments', rows.length],
        ['Période', config.startDate && config.endDate ? `${config.startDate} → ${config.endDate}` : 'Tout'],
        ['Date d\'export', new Date().toLocaleDateString('fr-FR')],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recapData), 'Récapitulatif');
    }
  }

  // Sheet 3: Pivot par Ministère (if applicable)
  if (sheets.pivot && subject.id === 'ministeres') {
    const pivotHeader = ['Ministère', 'Montant', 'Soumissions', 'Taux Paiement (%)'];
    const pivotData = [pivotHeader, ...rows.map(r => [
      r.nom, r.montant || 0, r.nombreSoumissions || 0, r.tauxPaiement || 0,
    ])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pivotData), 'Pivot par Ministère');
  }

  return wb;
}

// ─── PDF Generation (enhanced template) ─────────────────────
async function generatePDF(rows, columns, config, subject, chartImageDataUrls) {
  const landscape = config.orientation === 'landscape';
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const margin = 20;

  let logoImg = null;
  let coatImg = null;
  try { logoImg = await loadImage(tresorPayLogo); } catch {}
  try { coatImg = await loadImage(logoCameroun); } catch {}

  let y = 8;

  // Draw institutional header
  if (config.institutional !== false) {
    y = drawHeader(pdf, w, logoImg, coatImg);
  }

  // Title block — centered, clean
  const reportTitle = config.title || subject.name;
  pdf.setTextColor(15, 30, 45); pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
  pdf.text(reportTitle, w / 2, y + 4, { align: 'center', maxWidth: w - 40 });

  // Subtitle: period + count (smaller, gray)
  const periodStr = config.startDate && config.endDate
    ? `Du ${config.startDate} au ${config.endDate}`
    : 'Toutes les données';
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 120, 120);
  pdf.text(`${periodStr} — ${rows.length} élément(s)`, w / 2, y + 10, { align: 'center' });

  y += 16;
  const sections = config.pdfSections || [];

  // KPI Bar
  if (sections.includes('kpi_bar') && rows.length > 0) {
    const kpiFields = subject.kpiFields || [];
    if (kpiFields.length > 0) {
      const kpiHead = [kpiFields.map(k => k.label)];
      const kpiRow = [kpiFields.map(k => {
        const val = k.compute(rows);
        return k.type === 'amount' ? fmtAmount(val) : k.type === 'percent' ? val + '%' : String(val);
      })];

      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(40, 40, 40);
      pdf.text('Indicateurs Clés', 15, y);
      autoTable(pdf, {
        startY: y + 3, head: kpiHead, body: kpiRow, theme: 'grid',
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 2.5 },
        bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 3.5, textColor: [30, 30, 30] },
        margin: { left: 15, right: 15 },
      });
      y = pdf.lastAutoTable.finalY + 6;
    }
  }

  // Main Table (with zebra striping and green header)
  if (sections.includes('table_full') || sections.includes('table_top10')) {
    const tableRows = sections.includes('table_top10') ? rows.slice(0, 10) : rows;
    const head = [columns.map(c => c.label)];
    const body = tableRows.map((row, i) => columns.map(col => fmtVal(getVal(row, col, i), col.type)));

    if (y > h - 40) {
      pdf.addPage();
      y = config.institutional !== false ? drawHeader(pdf, w, logoImg, coatImg) : margin;
    }

    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(40, 40, 40);
    pdf.text(subject.name + (sections.includes('table_top10') ? ' (Top 10)' : ''), 15, y);

    const headerHeight = config.institutional !== false ? 38 : 20;

    autoTable(pdf, {
      startY: y + 3, head, body, theme: 'striped',
      headStyles: {
        fillColor: [5, 100, 70], textColor: 255, fontStyle: 'bold',
        fontSize: 6.5, cellPadding: 2.5, lineWidth: 0,
      },
      styles: { fontSize: 6.5, cellPadding: 2, lineColor: [230, 230, 230], lineWidth: 0.2, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [245, 248, 250] },
      columnStyles: columns.reduce((acc, col, i) => {
        if (col.type === 'amount' || col.type === 'number' || col.type === 'percent') acc[i] = { halign: 'right' };
        if (col.id === 'index') acc[i] = { cellWidth: 10, halign: 'center' };
        return acc;
      }, {}),
      margin: { left: 15, right: 15, top: headerHeight, bottom: 18 },
      didDrawPage: (d) => {
        if (d.pageNumber > 1 && config.institutional !== false) {
          drawHeader(pdf, w, logoImg, coatImg);
        }
      },
    });
    y = pdf.lastAutoTable.finalY + 6;
  }

  // Charts — insert captured images
  if (chartImageDataUrls && chartImageDataUrls.length > 0) {
    for (const imgData of chartImageDataUrls) {
      if (!imgData) continue;
      const img = new Image();
      img.src = imgData;
      await new Promise(r => { img.onload = r; img.onerror = r; });

      const imgW = w - 30;
      const imgH = Math.min((img.height / img.width) * imgW, h - margin - 20);

      if (y + imgH > h - 15) {
        pdf.addPage();
        y = config.institutional !== false ? drawHeader(pdf, w, logoImg, coatImg) : margin;
      }
      pdf.addImage(imgData, 'PNG', 15, y, imgW, imgH);
      y += imgH + 8;
    }
  }

  // Draw footer on ALL pages (page X / total)
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} / ${totalPages}`, w / 2, h - 6, { align: 'center' });
    pdf.text(`TresorPay Analytics — ${new Date().toLocaleDateString('fr-FR')}`, w - 15, h - 6, { align: 'right' });
  }

  return pdf;
}

// ─── Charts-Only PDF ────────────────────────────────────────
async function generateChartsPDF(chartImageDataUrls, config, subject) {
  const landscape = config.chartsSize !== 'square';
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();

  for (let idx = 0; idx < chartImageDataUrls.length; idx++) {
    const imgData = chartImageDataUrls[idx];
    if (!imgData) continue;

    if (idx > 0) pdf.addPage();

    const img = new Image();
    img.src = imgData;
    await new Promise(r => { img.onload = r; img.onerror = r; });

    let y = 10;

    if (config.chartsIncludeTitle) {
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 30, 30);
      pdf.text(config.title || subject.name, w / 2, y + 4, { align: 'center' });
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 120, 120);
      const pStr = config.startDate && config.endDate ? `${config.startDate} → ${config.endDate}` : 'Toutes les données';
      pdf.text(pStr, w / 2, y + 10, { align: 'center' });
      y += 16;
    }

    const imgW = w - 20;
    const imgH = Math.min((img.height / img.width) * imgW, h - y - 10);
    pdf.addImage(imgData, 'PNG', 10, y, imgW, imgH);

    // Footer
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(150, 150, 150);
    pdf.text(`Graphique ${idx + 1} / ${chartImageDataUrls.length}`, w / 2, h - 5, { align: 'center' });
  }

  return pdf;
}

// ─── Charts-Only PNG ZIP ────────────────────────────────────
async function generateChartsPNG(chartImageDataUrls, config, subject) {
  // For PNG export, we create a simple download of each image
  // In a production app, we'd use JSZip. For now, download first chart as PNG.
  // This creates individual downloads for each chart.
  for (let idx = 0; idx < chartImageDataUrls.length; idx++) {
    const imgData = chartImageDataUrls[idx];
    if (!imgData) continue;
    const link = document.createElement('a');
    link.href = imgData;
    link.download = `${subject.id}_chart_${idx + 1}.png`;
    link.click();
  }
}

// ─── Capture chart elements from DOM ────────────────────────
export async function captureCharts(chartIds) {
  if (!chartIds || chartIds.length === 0) return [];
  const images = [];

  // Force light theme temporarily for readable chart export
  const root = document.documentElement;
  const wasDark = root.getAttribute('data-theme') === 'dark';
  if (wasDark) root.setAttribute('data-theme', 'light');

  // Wait for styles to apply
  await new Promise(r => setTimeout(r, 200));

  try {
    const html2canvas = (await import('html2canvas')).default;
    for (const id of chartIds) {
      const el = document.getElementById(id);
      if (!el) { images.push(null); continue; }

      // Force dark text colors on the element for capture
      el.style.color = '#111827';
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      el.style.color = '';
      images.push(canvas.toDataURL('image/png'));
    }
  } catch (err) {
    console.warn('Chart capture error:', err.message);
  }

  // Restore dark theme if it was active
  if (wasDark) root.setAttribute('data-theme', 'dark');

  return images.filter(Boolean);
}

// ─── Main Export Function ───────────────────────────────────
export async function buildReport(config, subject, rows, chartImages) {
  if (!rows) {
    rows = await fetchSubjectData(subject.id, config);
  }
  const selectedCols = subject.columns.filter(c => c.required || config.selectedColumns?.includes(c.id));
  const ts = new Date();
  const dateStr = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}h${String(ts.getMinutes()).padStart(2, '0')}`;
  const baseName = `TresorAnalytics_${subject.id}_${dateStr}`;

  if (config.format === 'excel') {
    const wb = generateExcel(rows, selectedCols, subject, config);
    XLSX.writeFile(wb, `${baseName}.xlsx`);
  } else if (config.format === 'charts') {
    // Charts-only export
    if (config.chartsExportFormat === 'png') {
      await generateChartsPNG(chartImages || [], config, subject);
    } else {
      const pdf = await generateChartsPDF(chartImages || [], config, subject);
      pdf.save(`${baseName}_graphiques.pdf`);
    }
  } else {
    // Standard PDF
    const pdf = await generatePDF(rows, selectedCols, config, subject, chartImages || []);
    pdf.save(`${baseName}.pdf`);
  }

  const ext = config.format === 'excel' ? 'xlsx' : config.format === 'charts' ? (config.chartsExportFormat === 'png' ? 'png' : 'pdf') : 'pdf';
  return {
    id: Date.now().toString(),
    date: ts.toISOString(),
    subjectId: subject.id,
    title: config.title || subject.name,
    format: config.format || 'pdf',
    filename: `${baseName}.${ext}`,
    nbRows: rows.length,
    nbColumns: selectedCols.length,
    nbCharts: (chartImages || []).filter(Boolean).length,
    // Store config for re-export
    config: { ...config, selectedColumns: config.selectedColumns },
  };
}

// ─── Standard Report Builder (pre-configured) ──────────────
export async function buildStandardReport(templateId, dateRange, entityFilter = null) {
  const { REPORT_SUBJECTS } = await import('./reportTemplates');
  const subject = REPORT_SUBJECTS.find(s => s.id === templateId);
  if (!subject) throw new Error('Template inconnu: ' + templateId);

  let rows = await fetchSubjectData(subject.id, dateRange);

  // Filter by specific entities if provided
  if (entityFilter && entityFilter.length > 0) {
    const nameField = subject.columns.find(c => c.required && c.id !== 'index')?.id;
    if (nameField) {
      rows = rows.filter(r => entityFilter.includes(r[nameField]));
    }
  }

  // Check for empty data
  if (rows.length === 0) {
    throw new Error('NO_DATA');
  }

  const allCols = subject.columns.filter(c => c.required || c.default);

  const config = {
    format: 'pdf',
    title: subject.name,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    orientation: 'portrait',
    institutional: true,
    selectedColumns: allCols.map(c => c.id),
    pdfSections: ['kpi_bar', 'table_full'],
  };

  const pdf = await generatePDF(rows, allCols, config, subject, []);
  const ts = new Date();
  const dateStr = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}h${String(ts.getMinutes()).padStart(2, '0')}`;
  const filename = `Rapport_${subject.id}_${dateStr}.pdf`;
  pdf.save(filename);

  return {
    id: Date.now().toString(),
    date: ts.toISOString(),
    subjectId: subject.id,
    title: subject.name,
    format: 'pdf',
    filename,
    nbRows: rows.length,
    nbColumns: allCols.length,
    nbCharts: 0,
    config,
    standard: true,
  };
}
