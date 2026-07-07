import React from 'react';
import { Card, DepartmentChip, Button } from '../components/ui';
import './Report.css';

export default function DGIReport() {
  const tableData = [
    { id: 'TX-8921', date: '28 Mars 2026', type: 'TVA', amount: '12 500 000', status: 'Validé' },
    { id: 'TX-8922', date: '28 Mars 2026', type: 'Impôt sur les Sociétés', amount: '450 000 000', status: 'Validé' },
    { id: 'TX-8923', date: '28 Mars 2026', type: 'IRPP', amount: '8 200 000', status: 'En attente' },
    { id: 'TX-8924', date: '27 Mars 2026', type: 'TVA', amount: '19 400 000', status: 'Validé' },
    { id: 'TX-8925', date: '27 Mars 2026', type: 'Taxe Foncière', amount: '2 100 000', status: 'Validé' },
  ];

  return (
    <div className="report-vault animate-fade-in sub-dgi">
      <div className="report-header">
        <div className="header-brand">
          <DepartmentChip department="DGI" />
          <h1 className="text-display mt-4">Collecte Fiscale</h1>
          <p className="text-body mt-2">Vue détaillée des consolidations de la Direction Générale des Impôts.</p>
        </div>
        <div className="header-actions">
          <Button variant="outline" className="export-dgi">Exporter Registre PDF</Button>
        </div>
      </div>

      <div className="report-stats mb-8">
        <Card className="stat-card">
          <span className="text-label">Recouvrement Journalier</span>
          <div className="stat-value text-dgi mt-2">2.8 Mds FCFA</div>
        </Card>
        <Card className="stat-card">
          <span className="text-label">Objectif Mensuel Atteint</span>
          <div className="stat-value text-primary mt-2">84%</div>
          <div className="progress-bar mt-4"><div className="progress-fill fill-dgi" style={{width: '84%'}}></div></div>
        </Card>
        <Card className="stat-card">
          <span className="text-label">Transactions Actives</span>
          <div className="stat-value text-primary mt-2">1,452</div>
        </Card>
      </div>

      <Card className="data-table-card">
        <div className="table-header mb-6 flex-center" style={{justifyContent: 'space-between'}}>
          <h2 className="text-headline">Registre des Écritures</h2>
          <div className="table-filters">
            <span className="text-label mr-4">Filtres Actifs: TVA, IS</span>
          </div>
        </div>
        
        <div className="table-wrapper">
          <table className="vault-table dgi-theme">
            <thead>
              <tr>
                <th className="text-label">ID Transaction</th>
                <th className="text-label">Date de valeur</th>
                <th className="text-label">Catégorie</th>
                <th className="text-label text-right">Montant (FCFA)</th>
                <th className="text-label text-right">Statut Central</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} className="vault-tr">
                  <td className="text-title font-bold cell-id">{row.id}</td>
                  <td className="text-body">{row.date}</td>
                  <td className="text-body">{row.type}</td>
                  <td className="text-title font-bold text-right amount-cell">{row.amount}</td>
                  <td className="text-right">
                    <span className={`status-orb ${row.status === 'Validé' ? 'orb-success' : 'orb-pending'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
