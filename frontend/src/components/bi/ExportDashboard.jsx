import React, { useState } from 'react';
import { Download, FileText, Table, FileSpreadsheet, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export default function ExportDashboard({ dashboardId, titre, widgets, gridRef }) {
  const [exporting, setExporting] = useState(null); // 'pdf' | 'excel' | 'csv' | null
  const [showMenu, setShowMenu] = useState(false);

  const safeTitre = (titre || 'dashboard').replace(/\s+/g, '_');

  // ─── Export PDF ─────────────────────────────────────────────
  const handleExportPDF = async () => {
    setShowMenu(false);
    setExporting('pdf');
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      const dateStr = `Export du ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`;

      // --- En-tete premiere page ---
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, w, 22, 'F');

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('TRESOR PUBLIC \u2014 Analytics', 15, 9);

      pdf.setFontSize(14);
      pdf.text(titre || 'Dashboard', 15, 16);

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(200, 220, 255);
      pdf.text(dateStr, w - 15, 16, { align: 'right' });

      // Capture chaque widget individuellement
      const gridEl = gridRef?.current || document.querySelector('.bi-grid-layout');
      let totalPages = 1;

      if (gridEl) {
        const widgetEls = gridEl.querySelectorAll('.bi-widget-card');

        if (widgetEls.length > 0) {
          let startY = 28;

          for (let i = 0; i < widgetEls.length; i++) {
            const el = widgetEls[i];
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const imgW = w - 30;
            const imgH = (canvas.height / canvas.width) * imgW;

            // Nouvelle page si deborde
            if (startY + imgH > h - 18) {
              pdf.addPage();
              totalPages++;
              startY = 15;
            }

            pdf.addImage(imgData, 'PNG', 15, startY, imgW, imgH);
            startY += imgH + 8;
          }
        } else {
          // Fallback : capture le grid entier
          const canvas = await html2canvas(gridEl, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
          });
          const imgData = canvas.toDataURL('image/png');
          const imgW = w - 30;
          const imgH = (canvas.height / canvas.width) * imgW;
          pdf.addImage(imgData, 'PNG', 15, 28, imgW, Math.min(imgH, 170));
        }
      }

      // Pagination sur chaque page
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(140, 140, 140);
        pdf.text(`Page ${p}/${totalPages}`, w - 15, h - 6, { align: 'right' });
      }

      pdf.save(`${safeTitre}.pdf`);
    } catch (err) {
      console.error('Export PDF error:', err);
      alert("Erreur lors de l'export PDF");
    } finally {
      setExporting(null);
    }
  };

  // ─── Export Excel ───────────────────────────────────────────
  const handleExportExcel = () => {
    setShowMenu(false);
    setExporting('excel');
    try {
      if (!widgets || widgets.length === 0) {
        alert('Aucun widget a exporter');
        return;
      }

      const wb = XLSX.utils.book_new();

      // Feuille de couverture "Resume"
      const coverData = [
        ['TRESOR PUBLIC \u2014 Analytics'],
        [],
        ['Dashboard', titre || ''],
        ['Date d\'export', new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR')],
        ['Nombre de widgets', widgets.length],
        [],
        ['Widgets :'],
        ...widgets.map((w, i) => [`  ${i + 1}. ${w.titre || 'Sans titre'}`, w.typeVisualisation || '', w.datasetCode || '']),
      ];
      const coverWs = XLSX.utils.aoa_to_sheet(coverData);
      // Largeur colonnes couverture
      coverWs['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, coverWs, 'Resume');

      // Une feuille par widget
      widgets.forEach((widget, idx) => {
        const rawName = (widget.titre || `Widget_${idx + 1}`).replace(/[\\/*?[\]:]/g, '').slice(0, 31);
        const sheetName = rawName || `Widget_${idx + 1}`;
        const data = widget.lastData || widget.data || [];

        let ws;
        if (Array.isArray(data) && data.length > 0) {
          ws = XLSX.utils.json_to_sheet(data);
          const headers = Object.keys(data[0]);
          const colCount = headers.length;

          // En-tetes en gras + fond colore
          for (let c = 0; c < colCount; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c });
            if (ws[cellRef]) {
              ws[cellRef].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '2563EB' } },
                alignment: { horizontal: 'center' },
              };
            }
          }

          // Formatage colonnes monetaires + auto-width
          const colWidths = headers.map((h, c) => {
            let maxLen = h.length;
            const isMoney = /montant|recette|depense|solde|total|recouvr/i.test(h);
            data.forEach((row, r) => {
              const cellRef = XLSX.utils.encode_cell({ r: r + 1, c });
              const val = row[h];
              if (val != null) {
                const strLen = String(val).length;
                if (strLen > maxLen) maxLen = strLen;
                if (isMoney && typeof val === 'number' && ws[cellRef]) {
                  ws[cellRef].v = val;
                  ws[cellRef].t = 'n';
                  ws[cellRef].z = '#,##0 "FCFA"';
                }
              }
            });
            return { wch: Math.min(maxLen + 4, 50) };
          });
          ws['!cols'] = colWidths;
        } else {
          ws = XLSX.utils.aoa_to_sheet([
            ['Widget', widget.titre || ''],
            ['Type', widget.typeVisualisation || ''],
            ['Dataset', widget.datasetCode || ''],
          ]);
          ws['!cols'] = [{ wch: 15 }, { wch: 30 }];
        }

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, `${safeTitre}.xlsx`);
    } catch (err) {
      console.error('Export Excel error:', err);
      alert("Erreur lors de l'export Excel");
    } finally {
      setExporting(null);
    }
  };

  // ─── Export CSV ─────────────────────────────────────────────
  const handleExportCSV = () => {
    setShowMenu(false);
    setExporting('csv');
    try {
      let csv = '\uFEFF'; // BOM UTF-8
      let hasData = false;

      // Priorite 1 : donnees brutes des widgets
      if (widgets && widgets.length > 0) {
        widgets.forEach((widget, idx) => {
          const data = widget.lastData || widget.data || [];
          const widgetTitle = widget.titre || `Widget ${idx + 1}`;

          if (idx > 0) csv += '\n';
          csv += `--- ${widgetTitle} ---\n`;

          if (Array.isArray(data) && data.length > 0) {
            hasData = true;
            const headers = Object.keys(data[0]);
            csv += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';') + '\n';
            data.forEach(row => {
              csv += headers.map(h => {
                const val = row[h] != null ? String(row[h]) : '';
                return `"${val.replace(/"/g, '""')}"`;
              }).join(';') + '\n';
            });
          }
        });
      }

      // Priorite 2 : extraction DOM (tables visibles)
      if (!hasData) {
        const gridEl = gridRef?.current || document.querySelector('.bi-grid-layout');
        const tables = gridEl?.querySelectorAll('.bi-simple-table') || [];

        if (tables.length > 0) {
          tables.forEach((table, idx) => {
            const card = table.closest('.bi-widget-card');
            const titleEl = card?.querySelector('.bi-widget-card-header h4');
            const widgetTitle = titleEl?.textContent || `Widget ${idx + 1}`;

            if (idx > 0) csv += '\n';
            csv += `--- ${widgetTitle} ---\n`;

            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('th, td');
              csv += Array.from(cells)
                .map(c => `"${c.textContent.replace(/"/g, '""')}"`)
                .join(';') + '\n';
            });
            hasData = true;
          });
        }
      }

      if (!hasData) {
        csv += 'Aucune donnee tabulaire a exporter\n';
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitre}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export CSV error:', err);
      alert("Erreur lors de l'export CSV");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="bi-export-wrapper">
      <button
        className="bi-btn-secondary"
        onClick={() => setShowMenu(!showMenu)}
        disabled={!!exporting}
      >
        {exporting ? (
          <>
            <Loader2 size={15} className="bi-spin" />
            Exportation...
          </>
        ) : (
          <>
            <Download size={15} />
            Exporter
          </>
        )}
      </button>

      {showMenu && !exporting && (
        <div className="bi-export-menu">
          <button onClick={handleExportPDF}>
            <FileText size={15} />
            Exporter en PDF
          </button>
          <button onClick={handleExportExcel}>
            <FileSpreadsheet size={15} />
            Exporter en Excel
          </button>
          <button onClick={handleExportCSV}>
            <Table size={15} />
            Exporter en CSV
          </button>
        </div>
      )}
    </div>
  );
}
