import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import tresorPayLogo from '../assets/logo-tresorpay.png';
import { formatEntier, formatMontant } from './format';

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// ─── Export PDF Structuré (Souverain) ───────────────────────

function drawInstitutionalHeader(pdf, w, logoImg) {
  const centerX = w / 2;

  // ── Left: République du Cameroun ──
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 30, 45);
  pdf.text('REPUBLIQUE DU CAMEROUN', 15, 8);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Paix — Travail — Patrie', 15, 12);
  pdf.text('Ministère des Finances', 15, 16);

  // ── Center: Logo TresorPay ──
  if (logoImg) {
    pdf.addImage(logoImg, 'PNG', centerX - 15, 4, 30, 12);
  }

  // ── Right: Republic of Cameroon ──
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 30, 45);
  pdf.text('REPUBLIC OF CAMEROON', w - 15, 8, { align: 'right' });
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Peace — Work — Fatherland', w - 15, 12, { align: 'right' });
  pdf.text('Ministry of Finance', w - 15, 16, { align: 'right' });

  // ── Separator line ──
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.4);
  pdf.line(15, 19, w - 15, 19);
}

export async function exportToPDF(data, filename = 'rapport_DGI.pdf') {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();

  // Load logo once
  let logoImg = null;
  try {
    logoImg = await loadImage(tresorPayLogo);
  } catch (error) {
    console.error('Failed to load logo for PDF:', error);
  }

  // ── Institutional Header ──
  drawInstitutionalHeader(pdf, w, logoImg);

  // ── Title ──
  pdf.setTextColor(15, 30, 45);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TRESOR ANALYTICS - DGI', w / 2, 26, { align: 'center' });

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Date d'export : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, w / 2, 31, { align: 'center' });

  if (!data || !data.kpi || !data.avisList) {
    pdf.save(filename);
    return;
  }

  // ── KPI Section (compact, single row) ──
  pdf.setTextColor(40, 40, 40);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Indicateurs Stratégiques de la Période', 15, 38);

  const kpiRow = [
    [
      formatMontant(data.kpi.totalRecouvre),
      data.kpi.avisPayes.toString(),
      data.kpi.avisEnAttente.toString(),
      data.kpi.avisEnRetard.toString(),
      data.kpi.tauxRecouvrement + '%'
    ]
  ];

  autoTable(pdf, {
    startY: 41,
    head: [['Total Recouvré', 'Avis Payés', 'Avis En Attente', 'Avis En Retard', 'Taux Recouvrement']],
    body: kpiRow,
    theme: 'grid',
    headStyles: { fillColor: [40, 50, 60], textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 2, halign: 'center' },
    bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 3 },
    styles: { font: 'helvetica' },
  });

  // ── Avis Table ──
  let finalY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY : 55;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40, 40, 40);
  pdf.text('Registre Détaillé des Avis Fiscaux', 15, finalY + 8);

  const tableHeaders = ['N°', 'N° Avis', 'Contribuable', 'NUI', 'Centre CDI', 'Montant (FCFA)', 'Date', 'Statut'];
  const tableData = data.avisList.map((a, i) => [
    (i + 1).toString(),
    a.numero,
    a.contribuable,
    a.nui,
    a.centre,
    formatEntier(a.montantTotal),
    a.dateCreation,
    a.statut
  ]);

  autoTable(pdf, {
    startY: finalY + 11,
    head: [tableHeaders],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    margin: { top: 24 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 52 },
      3: { cellWidth: 36 },
      4: { cellWidth: 32 },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 24 },
      7: { cellWidth: 20, halign: 'center' }
    },
    didDrawPage: (d) => {
      // Re-draw institutional header on every new page
      if (d.pageNumber > 1) {
        drawInstitutionalHeader(pdf, w, logoImg);
      }
    }
  });

  pdf.save(filename);
}

// ─── Export PDF Générique (réutilisable sur toutes les pages) ─
export async function exportGenericPDF({ title, subtitle, headers, rows, filename = 'export.pdf', orientation = 'landscape' }) {
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();

  let logoImg = null;
  try { logoImg = await loadImage(tresorPayLogo); } catch { /* ignore */ }

  drawInstitutionalHeader(pdf, w, logoImg);

  pdf.setTextColor(15, 30, 45);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title || 'TRESOR ANALYTICS', w / 2, 26, { align: 'center' });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  const dateStr = `Export du ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
  pdf.text(subtitle ? `${subtitle} — ${dateStr}` : dateStr, w / 2, 31, { align: 'center' });

  if (!rows || rows.length === 0) { pdf.save(filename); return; }

  autoTable(pdf, {
    startY: 35,
    head: [headers],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    margin: { top: 24 },
    didDrawPage: (d) => { if (d.pageNumber > 1) drawInstitutionalHeader(pdf, w, logoImg); },
  });

  pdf.save(filename);
}

// ─── Export Excel ─────────────────────────────────────────────
export function exportToExcel(data, headers, sheetName = 'DGI Export', filename = 'export.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ─── Export Chart as PNG ──────────────────────────────────────
export async function exportChartPNG(elementId, filename = 'chart.png') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

// ─── CSV export ──
export function exportToCSV(data, filename = 'export.csv') {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows    = data.map(row => headers.map(h => row[h]).join(';'));
  const csv = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
