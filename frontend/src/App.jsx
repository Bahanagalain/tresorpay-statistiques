import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute, { SuperAdminRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import DGIStatistiques from './pages/DGIStatistiques';
import PerformanceCDI from './pages/PerformanceCDI';
import RepartitionFiscale from './pages/RepartitionFiscale';
import CartographieRegionale from './pages/CartographieRegionale';
import AnalyseContribuables from './pages/AnalyseContribuables';
import AlertesAnomalies from './pages/AlertesAnomalies';
import ConformiteRIB from './pages/ConformiteRIB';

import MonitoringOTP from './pages/MonitoringOTP';
import GenerationRapports from './pages/GenerationRapports';
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
          <Route index element={<Navigate to="/dgi" replace />} />
          <Route path="dgi" element={<DGIStatistiques />} />
          <Route path="performance-cdi" element={<PerformanceCDI />} />
          <Route path="repartition-fiscale" element={<RepartitionFiscale />} />
          <Route path="cartographie" element={<CartographieRegionale />} />
          <Route path="contribuables" element={<AnalyseContribuables />} />

          <Route path="conformite-rib" element={<ConformiteRIB />} />
          <Route path="monitoring-otp" element={<MonitoringOTP />} />
          <Route path="alertes" element={<AlertesAnomalies />} />
          <Route path="rapports" element={<GenerationRapports />} />
          <Route path="parametres" element={<Parametres />} />
          <Route path="profil" element={<Navigate to="/parametres" replace />} />
          <Route path="administration" element={<SuperAdminRoute><Administration /></SuperAdminRoute>} />
          <Route path="*" element={<Navigate to="/dgi" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
