import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute, { SuperAdminRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import TableauDeBord from './pages/TableauDeBord';
import PerformanceCDI from './pages/PerformanceCDI';
import RepartitionFiscale from './pages/RepartitionFiscale';
import CartographieRegionale from './pages/CartographieRegionale';
import AnalyseContribuables from './pages/AnalyseContribuables';
import AlertesAnomalies from './pages/AlertesAnomalies';
import ConformiteRIB from './pages/ConformiteRIB';
import MonitoringOTP from './pages/MonitoringOTP';
import GenerationRapports from './pages/GenerationRapports';
import Synchronisation from './pages/Synchronisation';
import AuditActivite from './pages/AuditActivite';
import Administration from './pages/Administration';
import Parametres from './pages/Parametres';

function getRouterBasename() {
  const rawBasePath = import.meta.env.VITE_APP_BASE_PATH || '/';
  const normalized = rawBasePath.replace(/\/+$/, '');
  return normalized || '/';
}

function App() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<TableauDeBord />} />
          <Route path="performance-ministeres" element={<PerformanceCDI />} />
          <Route path="repartition-recettes" element={<RepartitionFiscale />} />
          <Route path="cartographie" element={<CartographieRegionale />} />
          <Route path="activite-citoyens" element={<AnalyseContribuables />} />

          <Route path="plateformes-partenaires" element={<ConformiteRIB />} />
          <Route path="monitoring-paiements" element={<MonitoringOTP />} />
          <Route path="alertes" element={<AlertesAnomalies />} />
          <Route path="journal-soumissions" element={<GenerationRapports />} />
          <Route path="rapports" element={<GenerationRapports />} />

          <Route path="synchronisation" element={<SuperAdminRoute><Synchronisation /></SuperAdminRoute>} />
          <Route path="audit" element={<SuperAdminRoute><AuditActivite /></SuperAdminRoute>} />

          <Route path="parametres" element={<Parametres />} />
          <Route path="profil" element={<Navigate to="/parametres" replace />} />
          <Route path="administration" element={<SuperAdminRoute><Administration /></SuperAdminRoute>} />
          <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
