import React, { useState } from 'react';
import { Download, FileText, Table2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { exportToExcel } from '../../utils/exportUtils';

export default function ExportDashboard({ dashboardId, titre, widgets, gridRef }) {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExportPDF = async () => {
    setShowMenu(false);
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();

      // Header
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 30, 45);
      pdf.text(titre || 'Dashboard', w / 2, 12, { align: 'center' });

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      const dateStr = `Export du ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
      pdf.text(dateStr, w / 2, 17, { align: 'center' });

      // Capture le grid complet si ref disponible
      const gridEl = gridRef?.current || document.querySelector('.bi-grid-layout');

      if (gridEl) {
        // Capture chaque widget individuellement
        const widgetEls = gridEl.querySelectorAll('.bi-widget-card');

        if (widgetEls.length > 0) {
          let startY = 22;

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

            // Nouvelle page si déborde
            if (startY + imgH > pdf.internal.pageSize.getHeight() - 10) {
              pdf.addPage();
              startY = 15;
            }

            pdf.addImage(imgData, 'PNG', 15, startY, imgW, imgH);
            startY += imgH + 5;
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
          pdf.addImage(imgData, 'PNG', 15, 22, imgW, Math.min(imgH, 170));
        }
      }

      pdf.save(`${(titre || 'dashboard').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Export PDF error:', err);
      alert('Erreur lors de l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    setShowMenu(false);
    setExporting(true);
    try {
      // Exporte les données brutes de chaque widget
      if (widgets && widgets.length > 0) {
        const wb = XLSX.utils.book_new();

        widgets.forEach((widget, idx) => {
          const sheetName = (widget.titre || `Widget_${idx + 1}`).slice(0, 31);
          const data = widget.lastData || widget.data || [];
          let ws;

          if (Array.isArray(data) && data.length > 0) {
            ws = XLSX.utils.json_to_sheet(data);
          } else {
            ws = XLSX.utils.aoa_to_sheet([
              ['Widget', widget.titre || ''],
              ['Type', widget.typeVisualisation || ''],
              ['Dataset', widget.datasetCode || ''],
            ]);
          }

          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        XLSX.writeFile(wb, `${(titre || 'dashboard').replace(/\s+/g, '_')}.xlsx`);
      } else {
        exportToExcel([], ['Aucune donnée'], 'Dashboard', `${titre || 'dashboard'}.xlsx`);
      }
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('Erreur lors de l\'export Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bi-export-wrapper">
      <button
        className="bi-btn-secondary"
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
      >
        <Download size={15} />
        {exporting ? 'Export...' : 'Exporter'}
      </button>

      {showMenu && (
        <div className="bi-export-menu">
          <button onClick={handleExportPDF}>
            <FileText size={14} />
            Export PDF
          </button>
          <button onClick={handleExportExcel}>
            <Table2 size={14} />
            Export Excel
          </button>
        </div>
      )}
    </div>
  );
}
