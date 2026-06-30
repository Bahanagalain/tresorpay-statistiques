import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const Loading = () => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>
    Chargement de la session...
  </div>
);

export default function ProtectedRoute({ children }) {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}

export function SuperAdminRoute({ children }) {
  const { user, status } = useAuth();

  if (status === 'loading') return <Loading />;
  if (!user?.est_super_admin) return <Navigate to="/tableau-de-bord" replace />;

  return children;
}
