import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export async function exportToPDF(elementId, filename = 'rapport-tresorpay-statistiques') {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  // Header
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('REPUBLIQUE DU CAMEROUN', pdfWidth / 2, 12, { align: 'center' });
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.text('Ministere des Finances — TresorPay Statistiques', pdfWidth / 2, 18, { align: 'center' });
  pdf.setDrawColor(184, 134, 11);
  pdf.setLineWidth(0.5);
  pdf.line(20, 22, pdfWidth - 20, 22);

  pdf.addImage(imgData, 'PNG', 0, 26, pdfWidth, pdfHeight);

  // Footer
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text(`Page ${i}/${totalPages} — Genere le ${new Date().toLocaleString('fr-FR')}`, pdfWidth / 2, pdf.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  pdf.save(`${filename}.pdf`);
}

export function exportToExcel(data, filename = 'rapport-tresorpay-statistiques', sheetName = 'Donnees') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(data, filename = 'rapport-tresorpay-statistiques') {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
