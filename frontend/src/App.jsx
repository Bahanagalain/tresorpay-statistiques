import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute, { SuperAdminRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import TableauDeBord from './pages/TableauDeBord';
import PerformanceMinisteres from './pages/PerformanceMinisteres';
import RepartitionServices from './pages/RepartitionServices';
import CartographieRegionale from './pages/CartographieRegionale';
import AnalyseSoumissions from './pages/AnalyseSoumissions';
import AlertesAnomalies from './pages/AlertesAnomalies';
import MonitoringPaiements from './pages/MonitoringPaiements';
import GenerationRapports from './pages/GenerationRapports';
import Administration from './pages/Administration';
import Parametres from './pages/Parametres';

// ── Error Boundary ──────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#ef4444', background: '#111', minHeight: '100vh' }}>
          <h2>Une erreur est survenue</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#ccc', marginTop: 12 }}>
            {this.state.error?.message || 'Erreur inconnue'}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 24px', background: '#b8860b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function getRouterBasename() {
  const rawBasePath = import.meta.env.VITE_APP_BASE_PATH || '/';
  const normalized = rawBasePath.replace(/\/+$/, '');
  return normalized || '/';
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={getRouterBasename()}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/tableau-de-bord" replace />} />
            <Route path="tableau-de-bord" element={<TableauDeBord />} />
            <Route path="performance-ministeres" element={<PerformanceMinisteres />} />
            <Route path="repartition-services" element={<RepartitionServices />} />
            <Route path="cartographie" element={<CartographieRegionale />} />
            <Route path="soumissions" element={<AnalyseSoumissions />} />
            <Route path="monitoring-paiements" element={<MonitoringPaiements />} />
            <Route path="alertes" element={<AlertesAnomalies />} />
            <Route path="rapports" element={<GenerationRapports />} />
            <Route path="parametres" element={<Parametres />} />
            <Route path="profil" element={<Navigate to="/parametres" replace />} />
            <Route path="administration" element={<SuperAdminRoute><Administration /></SuperAdminRoute>} />
            <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
